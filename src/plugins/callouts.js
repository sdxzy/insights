const MARKERS = ['【类比 / 背景知识】', '【背景知识】', '【类比】', '【建议】'];

function kindFor(marker) {
  if (marker === '【建议】') return 'advice';
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

function badge(marker) {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['callout-badge', `callout-badge-${kindFor(marker)}`] },
    children: [{ type: 'text', value: marker }],
  };
}

function splitMarker(value, marker) {
  const trimmed = value.trimStart();
  const lead = value.slice(0, value.length - trimmed.length);
  const rest = trimmed.slice(marker.length);
  const next = [];
  if (lead) next.push({ type: 'text', value: lead });
  next.push(badge(marker));
  if (rest) next.push({ type: 'text', value: rest });
  return next;
}

function calloutTarget(ctx, node) {
  const parent = ctx.parent(node);
  if (!parent || parent.type !== 'element') return null;
  if (!isLeading(ctx, node)) return null;

  if (parent.tagName === 'li') return parent;
  if (parent.tagName !== 'p') return null;
  if (!isLeading(ctx, parent)) return null;

  const grand = ctx.parent(parent);
  if (!grand || grand.type !== 'element') return parent;
  if (grand.tagName === 'blockquote' || grand.tagName === 'li') return grand;
  if (grand.tagName === 'td' || grand.tagName === 'th') return null;
  return parent;
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
    if (!value) return;

    const trimmed = value.trimStart();
    const marker = MARKERS.find((item) => trimmed.startsWith(item));
    if (marker && isLeading(ctx, node)) {
      const parent = ctx.parent(node);
      const inTable =
        parent?.type === 'element' &&
        (parent.tagName === 'td' ||
          parent.tagName === 'th' ||
          (parent.tagName === 'p' &&
            ['td', 'th'].includes(ctx.parent(parent)?.tagName)));
      ctx.replaceNode(node, splitMarker(value, marker));
      if (!inTable) {
        const target = calloutTarget(ctx, node);
        if (target) ctx.setProperty(target, 'className', `callout callout-${kindFor(marker)}`);
      }
      return;
    }

    if (!value.includes('【建议】')) return;
    const parts = value.split('【建议】');
    const next = [];
    parts.forEach((part, index) => {
      if (part) next.push({ type: 'text', value: part });
      if (index < parts.length - 1) next.push(badge('【建议】'));
    });
    ctx.replaceNode(node, next);
  },
};
