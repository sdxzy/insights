import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

export const SITE = {
  name: '解读站',
  tagline: 'Mark 的主题解读',
  description: '把复杂的事讲到能站住。Mark 的主题解读，从经济学到科技与人工智能。',
  repo: 'https://github.com/sdxzy/insights',
};

const CATEGORY_ORDER = ['经济学', '科技', 'AI'];

export const CATEGORY_BLURBS: Record<string, string> = {
  经济学: '宏观、货币与稳定政策。从官方材料出发，把模型讲成能用的直觉。',
  科技: '技术怎样被造出来，又怎样改变行业与生活。',
  AI: '模型、产品与影响。少口号，多机制。',
};

export function withBase(path = ''): string {
  const base = import.meta.env.BASE_URL;
  if (!path) return base;
  return `${base}${path.replace(/^\//, '')}`;
}

export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${year}年${month}月${day}日`;
}

export function isoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getArticles(): Promise<Article[]> {
  const articles = await getCollection('articles');
  return articles.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function groupByCategory(articles: Article[]): [string, Article[]][] {
  const map = new Map<string, Article[]>();
  for (const article of articles) {
    const key = article.data.category;
    const list = map.get(key);
    if (list) list.push(article);
    else map.set(key, [article]);
  }
  return [...map.entries()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a[0]);
    const ib = CATEGORY_ORDER.indexOf(b[0]);
    const ra = ia === -1 ? CATEGORY_ORDER.length : ia;
    const rb = ib === -1 ? CATEGORY_ORDER.length : ib;
    if (ra !== rb) return ra - rb;
    return a[0].localeCompare(b[0], 'zh-CN');
  });
}

export function collectTags(articles: Article[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const article of articles) {
    for (const tag of article.data.tags) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

export function articleHref(id: string): string {
  return withBase(`articles/${id}/`);
}

export function categoryHref(category: string): string {
  return withBase(`category/${category}/`);
}

export function tagHref(tag: string): string {
  return withBase(`tags/${tag}/`);
}

export function tagLinks(tags: string[]): { name: string; href: string }[] {
  return tags.map((name) => ({ name, href: tagHref(name) }));
}
