const MARKERS = ['【类比 / 背景知识】', '【背景知识】', '【类比】'];

function kindFor(marker) {
  if (marker.includes('类比') && marker.includes('背景知识')) return 'mixed';
  if (marker.includes('背景知识')) return 'background';
  return 'analogy';
}

function isLeading(ctx, node) {
  const parent = ctx.parent(node);
  if (!parent || !('children' in parent)) return false;
  const idx = ctx.indexOf(node);
  if (idx === undefined) return false;
  for (let i = 0; i < idx; i += 1) {
    const child = parent.children[i];
    if (!child || child.type !== 'text' || String(child.value).trim() !== '') return false;
  }
  return true;
}

export const calloutsPlugin = {
  name: 'insights-callouts',
  element: [
    {
      filter: ['blockquote'],
      visit(node, ctx) {
        const text = ctx.textContent(node).trimStart();
        if (text.startsWith('阅读说明')) {
          ctx.setProperty(node, 'className', 'preface');
        }
      },
    },
    {
      filter: ['table'],
      visit(node, ctx) {
        ctx.wrapNode(node, {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-scroll'] },
          children: [],
        });
      },
    },
  ],
  text(node, ctx) {
    const value = typeof node.value === 'string' ? node.value : '';
    const trimmed = value.trimStart();
    const marker = MARKERS.find((item) => trimmed.startsWith(item));
    if (!marker) return;

    const paragraph = ctx.parent(node);
    if (!paragraph || paragraph.type !== 'element' || paragraph.tagName !== 'p') return;
    if (!isLeading(ctx, node)) return;

    const quote = ctx.parent(paragraph);
    if (!quote || quote.type !== 'element' || quote.tagName !== 'blockquote') return;
    if (!isLeading(ctx, paragraph)) return;

    const kind = kindFor(marker);
    const lead = value.slice(0, value.length - trimmed.length);
    const rest = trimmed.slice(marker.length);
    const next = [];
    if (lead) next.push({ type: 'text', value: lead });
    next.push({
      type: 'element',
      tagName: 'span',
      properties: { className: ['callout-badge', `callout-badge-${kind}`] },
      children: [{ type: 'text', value: marker }],
    });
    if (rest) next.push({ type: 'text', value: rest });

    ctx.replaceNode(node, next);
    ctx.setProperty(quote, 'className', `callout callout-${kind}`);
  },
};
