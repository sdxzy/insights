import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const base = '/insights/';
const articleRel = 'articles/nobel-econ-2026/index.html';
const failures = [];

function fail(message) {
  failures.push(message);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function unescapeHtml(value) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function visibleText(html) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  return unescapeHtml(withoutNoise.replace(/<[^>]+>/g, ''));
}

function normalize(value) {
  return value.replace(/\s+/g, '');
}

function markdownLines(markdown) {
  const body = markdown.split(/^---\s*$/m).slice(2).join('---');
  const lines = [];
  let fence = false;
  for (const raw of body.split('\n')) {
    if (/^\s*```/.test(raw)) {
      fence = !fence;
      continue;
    }
    lines.push(raw);
  }
  return lines
    .map((line) => line.replace(/^>\s?/, ''))
    .filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .map((line) => {
      if (line.trim().startsWith('|')) {
        return line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim())
          .join('');
      }
      return line.replace(/^#{1,6}\s+/, '').replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '');
    })
    .map((line) => line.replace(/<(https?:\/\/[^>\s]+)>/g, '$1').replace(/[`*]/g, ''))
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectUrls(text) {
  const urls = [];
  const attr = /(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of text.matchAll(attr)) urls.push(match[1] ?? match[2] ?? match[3]);
  const css = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/g;
  for (const match of text.matchAll(css)) urls.push(match[1] ?? match[2] ?? match[3]);
  return urls.filter(Boolean);
}

function localPath(urlValue) {
  const clean = urlValue.split('#')[0].split('?')[0];
  if (!clean || clean.startsWith('#') || clean.startsWith('mailto:') || clean.startsWith('http:') || clean.startsWith('https:')) {
    return null;
  }
  if (!clean.startsWith('/')) return null;
  if (!clean.startsWith(base)) {
    fail(`链接未使用基础路径 ${base}：${urlValue}`);
    return null;
  }
  let rel = decodeURIComponent(clean.slice(base.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  return path.join(dist, rel);
}

const files = await walk(dist);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
if (!htmlFiles.length) fail('dist 里没有 HTML');

const home = path.join(dist, 'index.html');
const article = path.join(dist, articleRel);
const softwareRel = 'articles/ai-dev-regression-review/index.html';
const software = path.join(dist, softwareRel);
for (const file of [
  home,
  article,
  software,
  path.join(dist, 'category/经济学/index.html'),
  path.join(dist, 'category/软件工程/index.html'),
  path.join(dist, 'tags/诺贝尔奖/index.html'),
  path.join(dist, 'favicon.svg'),
]) {
  try {
    await stat(file);
  } catch {
    fail(`缺少文件 ${path.relative(dist, file)}`);
  }
}

const markdown = await readFile('src/content/articles/nobel-econ-2026.md', 'utf8');
const articleHtml = await readFile(article, 'utf8');
const articleText = normalize(visibleText(articleHtml));
for (const line of markdownLines(markdown)) {
  const compact = normalize(line);
  if (!articleText.includes(compact)) fail(`正文缺失：${line.slice(0, 80)}`);
}

const homeHtml = await readFile(home, 'utf8');
const homeCategories = [...homeHtml.matchAll(/class="category-block"[^>]*id="([^"]+)"|id="([^"]+)"[^>]*class="category-block"/g)].map(
  (match) => match[1] || match[2],
);
if (homeCategories.join('\0') !== ['经济学', '软件工程'].join('\0')) {
  fail(`首页分类应为「经济学、软件工程」，实际：${homeCategories.join('、') || '（无）'}`);
}
if (homeHtml.includes('id="科技"') || homeHtml.includes('id="AI"')) fail('首页出现了空分类');

for (const snippet of ['AI 辅助编码时代的小步快跑', '软件工程', '回归测试', '重构']) {
  if (!homeHtml.includes(snippet)) fail(`首页缺少 ${snippet}`);
}
for (const snippet of ['让经济平稳着陆的底层代码', '经济学', '2026年10月14日', '诺贝尔奖', '宏观经济', '货币政策']) {
  if (!homeHtml.includes(snippet)) fail(`首页缺少 ${snippet}`);
  if (!articleHtml.includes(snippet)) fail(`文章页缺少 ${snippet}`);
}
if (!articleHtml.includes('Hall 证明了"老百姓花钱看未来"')) fail('直引号被改写');
if (!articleHtml.includes('零基础也能看懂')) fail('文章页缺少新摘要');
if (!homeHtml.includes('零基础也能看懂')) fail('首页缺少新摘要');
for (const marker of ['【背景知识】', '【类比】', '【类比 / 背景知识】']) {
  const expected = markdown.split(marker).length - 1;
  const actual = visibleText(articleHtml).split(marker).length - 1;
  if (actual !== expected) fail(`${marker} 出现次数应为 ${expected}，实际 ${actual}`);
}
for (const cls of ['callout-background', 'callout-analogy', 'callout-mixed', 'preface', 'callout-badge']) {
  if (!articleHtml.includes(cls)) fail(`文章页缺少样式类 ${cls}`);
}

const h2ids = [...articleHtml.matchAll(/<h2[^>]*id="([^"]+)"/g)].map((match) => match[1]);
const h3ids = [...articleHtml.matchAll(/<h3[^>]*id="([^"]+)"/g)].map((match) => match[1]);
if (h2ids.length !== 11) fail(`二级标题应为 11 个，实际 ${h2ids.length}`);
if (h3ids.length !== 12) fail(`三级标题应为 12 个，实际 ${h3ids.length}`);
const ids = [...h2ids, ...h3ids];
const tocHrefs = [...articleHtml.matchAll(/<nav class="toc"[\s\S]*?<\/nav>/g)]
  .flatMap((match) => [...match[0].matchAll(/href="#([^"]+)"/g)].map((item) => item[1]));
if (tocHrefs.length !== ids.length) fail(`目录链接应为 ${ids.length} 个，实际 ${tocHrefs.length}`);
for (const href of tocHrefs) {
  const id = decodeURIComponent(href);
  if (!ids.includes(id)) fail(`目录锚点不存在：${href}`);
}
if (!articleHtml.includes('class="mermaid-source"')) fail('文章页缺少 mermaid 源码');
if (!articleHtml.includes('flowchart LR') || !articleHtml.includes('央行定利率')) fail('mermaid 源码不完整');
const rows = articleHtml.match(/<tr[\s>]/g) || [];
if (rows.length !== 21) fail(`名词表应为 21 行，实际 ${rows.length}`);

const softwareMd = await readFile('src/content/articles/ai-dev-regression-review.md', 'utf8');
const softwareHtml = await readFile(software, 'utf8');
const softwareText = normalize(visibleText(softwareHtml));
for (const line of markdownLines(softwareMd)) {
  const compact = normalize(line);
  if (!softwareText.includes(compact)) fail(`软件工程正文缺失：${line.slice(0, 80)}`);
}
const adviceExpected = softwareMd.split('【建议】').length - 1;
const softwareProse = softwareHtml.match(/<div class="prose">[\s\S]*?<nav class="toc"/)?.[0] ?? softwareHtml;
const adviceActual = visibleText(softwareProse).split('【建议】').length - 1;
if (adviceActual !== adviceExpected) fail(`【建议】出现次数应为 ${adviceExpected}，实际 ${adviceActual}`);
if (!softwareHtml.includes('callout-advice') || !softwareHtml.includes('callout-badge-advice')) {
  fail('文章页缺少建议标注');
}
if ((softwareHtml.match(/callout-advice/g) || []).length < 8) fail('以【建议】开头的条目没有变成标注');
if (!softwareHtml.includes('flowchart TD') || !softwareHtml.includes('主控: 拆分为小故事')) fail('软件工程 mermaid 源码不完整');
const softwareH2 = [...softwareHtml.matchAll(/<h2[^>]*id="([^"]+)"/g)].map((match) => match[1]);
const softwareH3 = [...softwareHtml.matchAll(/<h3[^>]*id="([^"]+)"/g)].map((match) => match[1]);
if (softwareH2.length !== 11) fail(`软件工程二级标题应为 11 个，实际 ${softwareH2.length}`);
if (softwareH3.length !== 2) fail(`软件工程三级标题应为 2 个，实际 ${softwareH3.length}`);
const softwareToc = [...softwareHtml.matchAll(/<nav class="toc"[\s\S]*?<\/nav>/g)]
  .flatMap((match) => [...match[0].matchAll(/href="#([^"]+)"/g)].map((item) => decodeURIComponent(item[1])));
if (softwareToc.length !== softwareH2.length + softwareH3.length) {
  fail(`软件工程目录链接应为 ${softwareH2.length + softwareH3.length} 个，实际 ${softwareToc.length}`);
}
for (const id of softwareToc) {
  if (!softwareH2.includes(id) && !softwareH3.includes(id)) fail(`软件工程目录锚点不存在：${id}`);
}
const wideTable = softwareHtml.includes('Beck') && softwareHtml.includes('Uncle Bob') && softwareHtml.includes('接入成本');
if (!wideTable) fail('软件工程宽表内容缺失');

for (const file of files.filter((item) => item.endsWith('.html') || item.endsWith('.css'))) {
  const text = await readFile(file, 'utf8');
  const urls = collectUrls(text);
  for (const url of urls) {
    if (url.startsWith('data:')) continue;
    if (url.startsWith('#')) {
      const hash = decodeURIComponent(url.slice(1));
      if (hash && !text.includes(`id="${hash}"`)) fail(`${path.relative(dist, file)} 的页内锚点不存在：#${hash}`);
      continue;
    }
    const hash = url.includes('#') ? decodeURIComponent(url.slice(url.indexOf('#') + 1)) : '';
    const target = localPath(url);
    if (!target) {
      if (hash && file.endsWith('.html')) {
        const html = file === article ? articleHtml : await readFile(file, 'utf8');
        if (!html.includes(`id="${hash}"`) && !html.includes(`id="${encodeURIComponent(hash)}"`)) {
          fail(`${path.relative(dist, file)} 的页内锚点不存在：#${hash}`);
        }
      }
      continue;
    }
    try {
      await stat(target);
    } catch {
      fail(`${path.relative(dist, file)} 指向缺失文件 ${url}`);
    }
  }
}

if (!articleHtml.includes('/insights/')) fail('文章页没有 /insights/ 基础路径');
if (articleHtml.includes('href="/favicon') || articleHtml.includes("href='/favicon")) fail('favicon 路径错误');

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`checked ${htmlFiles.length} html files, article text and internal links`);
