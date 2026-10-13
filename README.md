# 解读站

Mark 的主题解读。静态站点，发布在 <https://sdxzy.github.io/insights/>。

现在已有分类「经济学」。之后写成「科技」「AI」或其他分类，首页和导航会自动出现，不必改模板。

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
- `category` 用中文分类名。已有「经济学」；写成 `科技`、`AI` 或其他新名字，都会自动生成分类页，并出现在首页分组和顶栏。
- `tags` 里的每个标签会显示在列表和文首，并生成 `/insights/tags/标签名/`。
- 二级标题（`##`）会自动进入文内目录。
- 引用块如果以 `【背景知识】`、`【类比】` 或 `【类比 / 背景知识】` 开头，会渲染成单独的标注。这三个标记请原样写在引用的开头。文中其他位置提到它们时，保持普通正文即可。

日期写成 `YYYY-MM-DD`。不要改写已有文章里的句子；站点只负责排版。

提交并推送到 `main` 后，GitHub Actions 会构建，并发布到 GitHub Pages。站点基础路径是 `/insights/`，对应项目页地址，不要改成根路径。

## 技术栈

[Astro](https://astro.build/) 静态生成，样式是手写 CSS。页面为中文排版，支持浅色和深色，窄屏会改成单列。字体随站点自带（Noto Sans SC / Noto Serif SC 简体子集，即思源黑体 / 思源宋体），许可见 `src/fonts/OFL.txt`，不依赖外部字体服务。
