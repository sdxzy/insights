# 解读站

Mark 的主题解读。静态站点，发布在 <https://sdxzy.github.io/insights/>。

现在只有「经济学」这一个分类，页面上不会放空分类。分类完全由文章的 `category` 字段决定：以后新文章写成别的分类名，首页、顶栏和分类页会自动出现，不必改模板，也不必事先建占位页。

## 本地开发

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev
```

开发服务器在 <http://localhost:4321/insights/>。

```bash
npm run build
npm run check
npm run preview
```

`check` 会核对构建结果：正文是否被改写、站内链接和资源是否存在、基础路径是否为 `/insights/`。

## 新增一篇文章

只需要往 `src/content/articles/` 放一个 Markdown 文件。文件名（去掉 `.md`）就是地址。例如 `ai-agents.md` 会成为 `/insights/articles/ai-agents/`。

文件开头写 YAML front matter：

```yaml
---
title: "文章标题"
date: 2026-10-14
category: 经济学
tags: [标签一, 标签二]
summary: "一两句摘要，会出现在首页卡片和文首。"
---
```

然后直接写正文。

- `title`、`date`、`category`、`summary` 必填。`tags` 可以省略，默认是空列表。
- `category` 用中文分类名。现在的文章是「经济学」。写成一个新名字时，才会多出对应分类，不会预先出现空分类。
- `tags` 里的每个标签会显示在列表和文首，并生成 `/insights/tags/标签名/`。
- 二级标题（`##`）会自动进入文内目录。
- 引用块如果以 `【背景知识】`、`【类比】` 或 `【类比 / 背景知识】` 开头，会渲染成单独的标注。这三个标记请原样写在引用的开头。文中其他位置提到它们时，保持普通正文即可。

日期写成 `YYYY-MM-DD`。不要改写已有文章里的句子；站点只负责排版。

提交并推送到 `main` 后，GitHub Actions 会构建，并发布到 GitHub Pages。站点基础路径是 `/insights/`，对应项目页地址，不要改成根路径。

## 技术栈

[Astro](https://astro.build/) 静态生成，样式是手写 CSS。页面为中文排版，支持浅色和深色，窄屏会改成单列。字体随站点自带（Noto Sans SC / Noto Serif SC 简体子集，即思源黑体 / 思源宋体），许可见 `src/fonts/OFL.txt`，不依赖外部字体服务。
