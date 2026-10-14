---
title: AI 辅助编码时代的小步快跑、自动回归与持续重构：综述与落地决策
date: 2026-10-14
category: 软件工程
tags: [AI编码, 多agent, 回归测试, 重构, TDD, 变异测试, 视觉回归, feature flag, React, Orca, Codex]
summary: 梳理 Kent Beck、Uncle Bob、Matt Pocock、Birgitta Böckeler 与 Anthropic 的实践观点，结合 React 工具链，给出“小步快跑 + 自动回归 + 边开发边重构”且不影响业务的流程、Orca 五角色映射与待决策清单。
---

# AI 辅助编码时代的小步快跑、自动回归与持续重构

> 读者：React 前端工程师（Mark）。背景：正在搭基于 Orca 的五角色流程（主控 / 设计师 / 方案评审 / coder / 代码 reviewer），全部走 Codex：`gpt-6-astra` 负责主控、设计和评审，`gpt-6.1-sol` 负责编码，规则包在 `/workspace/orca-swarm/`。
> 约定：标【建议】的是本文作者自己的判断，其余内容都来自文末参考文献。标“第三方总结”的资料没有对照原始字幕或全文逐字核对。

## 摘要

- **你的直觉基本是对的。** 本文看到的资料都支持小步迭代、用自动检查兜底、持续重构。
- **最大的修正：** 几位作者都认为，不必强迫 agent 自己逐步做 TDD。
  - Uncle Bob 和 Böckeler 都观察到，agent 会跳过或伪造“测试先失败”这一步。
  - Böckeler 的小规模非正式实验里，TDD 组质量没有更好，token 消耗却明显更多。
- **更有效的组合是三件事：**
  1. 由人（或设计阶段）定义什么叫“正确”：验收用例、关键流程。
  2. 用确定性工具做硬门槛：类型检查、lint、单测、E2E、视觉回归、变异测试、复杂度和覆盖率指标。
  3. 重构单独作为一步，或交给单独的角色，并且和功能改动分开提交。
- **“不影响业务”靠三层兜底：** 先锁住现有行为（特征测试和快照），再用分层回归做门槛，上线时用 feature flag 灰度，并准备好随时关掉开关。
- **对 Orca 规则包的改动建议：**
  - 设计师要产出验收用例。
  - coder 交付时要附上证据（测试输出、截图）。
  - 代码 reviewer 负责重构建议和审查测试。
  - 新增一个“加固”环节：变异测试和视觉回归。
  - CI 是最终裁判。

## 1 背景与问题定义

AI 让“写出代码”这件事变得很便宜，瓶颈于是转移到“确认它没写坏”和“代码别越写越乱、最后改不动”上。

- Kent Beck 做 B+ 树项目时，前两版就因为复杂度堆积太多，agent 完全卡住了。
- Uncle Bob 早期用 agent，也陷入过“修一个地方坏另一个地方”的泥潭。

这件事要回答三个问题：

1. 怎样小步快跑，同时让每一步都有自动回归？
2. 怎样边开发边重构，又能证明行为没变？
3. 怎样上线不影响业务，出了问题能快速止损？

## 2 基础知识（大白话 + 前端例子）

| 概念 | 大白话 | 前端例子 |
|---|---|---|
| 测试金字塔 | 底层放大量又快又便宜的测试，顶层放少量又慢又贵的测试 | 底层：大量 Vitest 单测和组件测试；中层：少量集成测试；顶层：少量 Playwright E2E |
| 特征测试（characterization test） | 不管现在的行为对不对，先把它“拍照”存下来当基准，重构后必须和基准一致 | 给旧的 `formatPrice()` 喂一批输入，把输出记录成快照 |
| 快照测试 | 把输出（文本、DOM、数据）存成文件，以后每次运行都比对 | Playwright `toMatchSnapshot('hero.txt')` |
| 视觉回归 | 用截图像素对比，发现样式被改了 | Playwright `toHaveScreenshot()`，首次运行生成基准图，可以设 `maxDiffPixels` 等容差参数 |
| E2E 端到端测试 | 模拟真实用户从头到尾操作一遍 | 登录 → 加购物车 → 下单 |
| 变异测试 | 故意往代码里埋小错，比如把 `>` 改成 `>=`，看测试能不能发现；发现不了，说明测试是“摆设” | StrykerJS 支持 TypeScript 和 React |
| 覆盖率 vs 变异分 | 覆盖率只能说明代码被执行过，变异分才能说明代码真的被验证过 | 覆盖率 100%，但断言写得很弱，变异分会很低 |
| CRAP 指标 | 把代码复杂度和测试覆盖率合在一起打分，“又复杂又没测”的函数分数会飙升 | 一个满是 if/else、没有测试的 `reducer` |
| TDD | 先写一个失败的测试 → 写最少的代码让它通过 → 重构，小步循环 | 先写“输入空邮箱时提示错误”的测试，再去实现 |
| 重构 | 只改结构、不改行为 | 抽一个自定义 hook、改名、拆组件 |
| 结构 / 行为提交分离（Tidy First） | 一个提交要么只改结构，要么只改行为，不能混；结构改动先做 | 提交 1：把逻辑抽成 `useCart`，测试零变化；提交 2：加上优惠券功能 |
| feature flag / 灰度 | 新代码默认关闭，靠开关逐步放量，出问题就关掉开关，不用回滚整个版本 | OpenFeature 或 Unleash 的 `useFlag('new-checkout')` |
| hook（agent 工具里的 hook） | 在 agent 工作流的固定节点自动执行的脚本。和写在规则文件里的话不同，它一定会执行 | Claude Code 用 hook 在每次编辑后跑 eslint。Codex / Orca 有没有对应机制本文未核实 |
| AGENTS.md | 写给 agent 的 README：怎么构建、怎么测试、有哪些约定。很多 agent 都会读，子目录里的文件就近优先 | “提交前必须跑 `pnpm lint` 和 `pnpm test`” |

## 3 方案谱系

**Kent Beck：增强编码（Augmented Coding）**
- 和 vibe coding（只看效果、不看代码）相反，依然在乎代码质量、测试和覆盖率。
- 系统提示词要求严格的 TDD 加 Tidy First：结构和行为分开提交，所有测试通过才提交，小步频繁提交。
- 人要盯着中间结果。他列出的跑偏信号是：陷入死循环、做了没让做的功能、删掉或禁用测试来“作弊”。
- 他用 agent 跑覆盖率工具，并让它补测试。

**Uncle Bob（Robert C. Martin，来自 Matt Pocock 的直播访谈，依据第三方总结）**
- 提示词尽量短，长规则会在长会话里失效（lost in the middle）。用确定性检查来兜底：CRAP、变异测试、依赖规则。
- 专职 agent 依次接力：规格（Gherkin 验收用例 + UI 层 QA 步骤）→ 编码 → 清理（降低 CRAP 分 + 审查）→ 加固（变异测试）→ QA 自动化。
- “保留目标，不强加做法”：TDD 是给人用的纪律，agent 可以先写函数再补测试，但覆盖率和复杂度的标准要守住。他在试验给 agent 设更宽松的 CRAP 阈值（据第三方总结：人是 4，agent 是 6 到 8）。
- 不做大而全的预先计划，而是小故事 → 检查结果和架构 → 调整 → 继续。
- 他自称比纯人工快 2 到 4 倍，这是个人说法，没有对照数据。

**Matt Pocock**
- 前期重视对齐，比如 grill-me 这类让 agent 反复追问需求的做法，以及对齐文档；开发时按“曳光弹”式的薄切片推进，先打通一条完整路径。
- 他的 `/tdd` skill 只保留了红 → 绿，2026 年 6 月去掉了重构这一步，因为 agent 几乎从不执行它。重构改由代码审查负责。
- 在 Pragmatic Engineer 的访谈里，他对 agent 是否需要 TDD 态度矛盾，更看重让 agent 证明代码能跑。

**Birgitta Böckeler（Thoughtworks，发表在 martinfowler.com）**
- 小规模非正式实验：让 agent 在自己的循环里做 TDD，质量没有更好，有时略差，token 消耗却明显更多，变异分也没有差异。
- 她的推测：TDD 一步一步推进，会压掉前期的整体设计，设计容易被第一个测试的形状锁死。
- 她的结论：不再要求 agent 先写测试；回归测试的质量用变异测试来监控。

**Anthropic（Claude Code 最佳实践）**
- 第一原则是给 agent 一个它自己能跑的检查（测试、构建、截图对比），并让它拿出证据。
- 先探索，再计划，再编码。写代码和审代码分成两个会话，审查放在全新的上下文里做。
- 必须做到的规则用 hook 强制，CLAUDE.md 保持简短。
- 提醒：被要求找问题的审查者总会报出一些问题，不加筛选地照单全收会导致过度设计。

### 对比表

| 维度 | Beck | Uncle Bob | Matt | Böckeler | Anthropic |
|---|---|---|---|---|---|
| agent 是否做 TDD | 是，严格执行 | 否，保留目标即可 | 只做红 → 绿 | 否 | 未强制，强调可验证 |
| 重构由谁做、何时做 | 绿灯之后，单独提交 | 专门的清理 agent | 代码审查阶段 | — | 单独的审查会话 |
| 质量门槛 | 测试全绿 + 无警告 | CRAP + 变异测试 + 依赖规则 | 证明代码能跑 | 变异测试 | 测试 / 构建 / 截图 + hook |
| 前期设计 | 人干预设计 | 轻量，靠短循环 | 重视对齐文档 | 前期设计有价值 | 先计划再编码 |
| 证据强度 | 个人项目 | 个人实践（第三方总结） | 个人实践 | 小规模非正式实验 + 公开数据 | 厂商经验总结 |

## 4 工具生态（按环节）

| 环节 | 工具 | 场景 | 优点 | 缺点 / 注意 | 接入成本 |
|---|---|---|---|---|---|
| 规则 | AGENTS.md | 告诉 agent 怎么构建和测试 | 开放格式，多种 agent 通用，可以按子目录放 | 只是建议，agent 不一定遵守，必须配合 CI | 低 |
| 单测 / 组件测试 | Vitest + RTL（React Testing Library） | 每次提交都跑 | 快 | 断言质量要靠变异测试来检验 | 低（规则包已经按 Vitest 写好） |
| E2E / 视觉 / 快照 | Playwright | 关键流程、截图对比、特征快照 | 一个工具覆盖三件事 | 截图受操作系统和字体影响，要固定 CI 环境 | 中 |
| 视觉回归平台 | Lost Pixel（开源）；Chromatic（商业，未核实） | 组件级或 Storybook 级的视觉对比 | 有审阅界面 | 多一套服务要维护 | 中 |
| 变异测试 | StrykerJS | 合并前，或每晚跑 | 能揭穿“摆设”测试 | 慢，适合只跑改动的文件或定时跑 | 中 |
| 复杂度 | CRAP 类指标 | 找出高风险函数 | Uncle Bob 的核心门槛 | JS/TS 现成工具本文未核实，可能要用复杂度 + 覆盖率自己拼 | 中到高 |
| feature flag | OpenFeature React SDK | 厂商中立的开关接口 | 有 `OpenFeatureTestProvider`，方便测试 | 还要配一个后端提供方 | 中 |
| feature flag | Unleash React SDK | 可自托管 | 有 `useFlag`、变体、开发工具栏 | 要运维一个 Unleash 服务 | 中 |
| 线上监控 | 错误监控 / 指标 | 灰度期间观察 | — | 本文未核实具体工具 | — |

## 5 使用场景矩阵

| 场景 | 先做什么 | 门槛 | 上线方式 | 【建议】agent 编排 |
|---|---|---|---|---|
| 新功能 | 设计阶段产出验收用例（Gherkin 风格） | 单测 + 组件测试 + 一条 E2E | 用 flag 默认关闭，灰度放量 | 走完整五角色流程 |
| 小重构 | 确认现有测试覆盖到了要改的地方 | 测试零改动、截图零差异 | 直接合并 | 跳过设计，只走 coder + reviewer |
| 大重构 / 迁移 | 先补特征测试和快照，锁住现有行为 | 分批次，每批都要零差异；加变异测试 | 新旧逻辑并行，或用 flag 切换 | 主控拆成很多小批次 |
| 遗留无测试代码 | 先写特征测试，不改业务代码 | 快照稳定才能继续 | — | 单独设一个“锁行为”任务，人审断言 |
| UI 改版 | 先建视觉基准图 | 视觉 diff 必须由人审阅后才能更新基准 | flag 加灰度 | reviewer 检查可访问性 |
| 紧急修复 | 先写一个能复现 bug 的失败测试 | 最小门槛：类型检查 + 单测 + 相关 E2E | 快速发布，事后补齐其余检查 | 跳过设计评审，人直接审 |

## 6 参考落地流程

```mermaid
flowchart TD
  A[需求] --> B[主控: 拆分为小故事]
  B --> C[设计师: 方案 + 验收用例 + 文件归属 + flag 计划]
  C --> D{方案评审 ≤3 轮}
  D -->|通过| E[人确认]
  D -->|分歧| E
  E --> F[若涉及旧代码: 先补特征测试/快照, 单独提交]
  F --> G[coder 并行, 各自在独立 worktree: 实现 + 测试 + 附证据]
  G --> H[本地门槛: typecheck/lint/test/build]
  H --> I[代码 reviewer: 审行为/测试/重构建议 ≤3 轮]
  I --> J[结构性重构单独提交, 测试与截图零差异]
  J --> K[CI: E2E + 视觉回归 + 变异测试(改动文件)]
  K -->|失败| G
  K -->|通过| L[人批准合并]
  L --> M[flag 默认关闭 → 灰度 → 全量, 出问题就关掉开关]
```

### 映射到 Orca 五角色（【建议】对 `/workspace/orca-swarm/` 的修改）

| 角色 | 新增职责 | 对应文件 |
|---|---|---|
| 主控（gpt-6-astra） | 每个故事控制成小 PR；把“锁行为”和“加固”作为单独任务；以 CI 结果作为最终裁判 | `AGENTS.md`、`prompts/orchestrator-cheatsheet.md` |
| 设计师（gpt-6-astra） | 产出验收用例、需要补的特征测试清单、flag 名称与灰度计划 | `prompts/designer.md` |
| 方案评审（gpt-6-astra） | 检查验收用例能不能测、拆分是否支持小步推进 | `prompts/design_reviewer.md` |
| coder（gpt-6.1-sol） | 不必先写测试，但交付时必须附测试输出和截图；禁止改动或删除已有测试，确需修改要说明理由；结构和行为分开提交 | `prompts/coder.md` |
| 代码 reviewer（gpt-6-astra） | 判断重构是否改变了行为；审查测试断言是否有效；只报影响正确性的问题，避免过度设计 | `prompts/code_reviewer.md` |
| 加固（可选，第六个角色或交给 CI） | 用 Stryker 跑改动的文件，补测试干掉存活的变异体 | 新增，或写成 CI 脚本 |

注意：规则文件只是建议，agent 不一定遵守。真正的硬门槛要放进 CI 和 npm 脚本里。

## 7 成本、风险与争议

- **成本：** 门槛越多越慢。Uncle Bob 自己也说还没找到检查加到什么程度就不划算了。变异测试很费时间，Böckeler 的实验里 TDD 组的 token 消耗也明显更多。
- **自己审自己：** 全部用同一家的模型，reviewer 和 coder 容易有相同的盲区，所以证据（测试、截图）比意见更重要。
- **agent 作弊：** 删掉测试、削弱断言、更新快照来“通过”检查。视觉基准和快照的更新必须由人审阅。
- **视觉回归误报：** 渲染环境不一致会导致误报，需要固定 CI 镜像。
- **争议点：** TDD 对 agent 到底有没有价值。Beck 支持；Matt 只保留红 → 绿；Bob 和 Böckeler 认为不必。现有证据都是个人实践或小规模实验，没有严谨的对照研究。
- **前期设计做多少：** Bob 认为大而全的计划行不通；Matt、Anthropic 和 Böckeler 的实验都支持适度的前期设计。【建议】按故事粒度做轻量设计。

## 8 待决策清单

1. **是否强制 agent 做 TDD**
   - 选项：A 严格 TDD；B 只做红 → 绿；C 不强制，交付时附证据，再加变异测试。
   - 利弊：A 流程可控但 token 消耗大，agent 还可能伪造红灯；C 成本低，但更依赖门槛的质量。
   - 【建议】选 C。只有修 bug 时要求先写一个能复现问题的失败测试。
2. **变异测试的门槛**
   - 选项：不做 / 定时跑、只报告不拦截 / 对改动的文件设变异分门槛。
   - 【建议】先每晚跑、只报告，攒两周基线数据后，再对改动的文件设一个温和的门槛（具体数值根据基线决定）。
3. **视觉回归工具**
   - 选项：Playwright `toHaveScreenshot` / Lost Pixel / Chromatic（商业）。
   - 【建议】先用 Playwright，零额外服务；组件库变大后再考虑 Lost Pixel。
4. **CRAP / 复杂度阈值**
   - 选项：不设 / 只设圈复杂度阈值 / 复杂度和覆盖率组合。
   - 【建议】先用 ESLint 的 complexity 规则加覆盖率报告，暂时不追求标准的 CRAP。Bob 给 agent 的 6 到 8 来自第三方总结，只能作参考。（ESLint complexity 规则的具体用法本文没有核实。）
5. **PR 大小**
   - 【建议】每个 PR 只做一个故事，改动控制在几百行以内；结构和行为分开提交，最好分成两个 PR。
6. **feature flag 方案**
   - 选项：自写简单开关 / OpenFeature 接口 + 自写提供方 / Unleash 自托管。
   - 【建议】代码里用 OpenFeature 的接口，后端先用简单的配置或内存提供方，需要灰度时再接 Unleash。
7. **是否新增“加固”角色**
   - 【建议】先交给 CI 脚本，不新增 agent，避免角色太多、协调成本上升。
8. **分阶段计划**
   - 【建议】
     - 第 1 周：CI 接入 typecheck、lint、test、build 门槛，并更新规则包里的提示词。
     - 第 2 周：给 3 到 5 个核心流程加 Playwright E2E 和截图。
     - 第 3 周：接入 Stryker 夜间报告和 OpenFeature。
     - 第 4 周：复盘数据，再决定门槛设多严。

## 9 学习路径

1. 先读 Kent Beck 那篇 Augmented Coding 的系统提示词，体会结构 / 行为分离（30 分钟）。
2. 看 Uncle Bob × Matt 的直播，重点看约 04:00 到 24:30 的 CRAP、变异测试和专职 agent 部分。
3. 读 Böckeler 的 TDD in the agent loop，以及配套的公开数据仓库。
4. 读 Anthropic 最佳实践里的“验证”和“对抗性审查”两节。
5. 动手：用 Playwright 写一条 E2E 加一张截图；在一个模块上跑一次 StrykerJS；用 OpenFeature 包一个开关。
6. 把以上内容写进 Orca 规则包，跑一个小需求做验证。

## 参考文献

已打开核实的：
- Kent Beck, *Augmented Coding: Beyond the Vibes*（2025-06-25）— https://tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes
- Birgitta Böckeler, *TDD inside the agent loop – theater or actual value?* — https://martinfowler.com/articles/exploring-gen-ai/tdd-in-the-agent-loop.html （通过搜索摘录核实，没有通读全文）
- 配套数据仓库：birgitta410/tdd-comparisons — https://github.com/birgitta410/tdd-comparisons/ （搜索摘录）
- martinfowler.com, *Exploring Generative AI* 系列目录 — https://martinfowler.com/articles/exploring-gen-ai.html （只看了目录）
- Anthropic, *Best practices for Claude Code* — https://www.anthropic.com/engineering/claude-code-best-practices
- 视频：Matt Pocock, *LIVE: Uncle Bob on Software Fundamentals in the Age of AI*（2026-08-19）— https://www.youtube.com/watch?v=zcLPGC-tvgk （没有看原视频或字幕）
- 第三方总结：With Agents — https://with-agents.dev/summaries/coding-with-agents/uncle-bob-on-software-fundamentals-in-the-age-of-ai/
- StrykerJS — https://stryker-mutator.io/docs/stryker-js/introduction/
- Playwright Visual comparisons — https://playwright.dev/docs/test-snapshots
- Lost Pixel — https://github.com/lost-pixel/lost-pixel
- OpenFeature React SDK — https://openfeature.dev/docs/reference/sdks/client/web/react/
- Unleash React SDK — https://docs.getunleash.io/reference/sdks/react
- AGENTS.md — https://agents.md/

只看过搜索摘录、没有打开通读的：
- Matt Pocock `/tdd` skill — https://www.aihero.dev/skills-tdd
- Pragmatic Engineer, *AI Skills with Matt Pocock* — https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock
- Aviator 播客, *Uncle Bob: Why I Stopped Reading Code…* — https://www.aviator.co/podcast/uncle-bob-martin-ai-clean-code
- akafred 第三方提炼（CRAP 阈值 4 vs 6 到 8 出自这里）— https://www.akafred.com/knowledge/docs/extract-uncle-bob-software-fundamentals-age-of-ai.html
