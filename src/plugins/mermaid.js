function isMermaid(code) {
  const className = code.properties?.className;
  const classes = Array.isArray(className) ? className : className ? [className] : [];
  return classes.some((item) => item === 'language-mermaid');
}

export const mermaidPlugin = {
  name: 'insights-mermaid',
  element: {
    filter: ['pre'],
    visit(node, ctx) {
      const code = node.children?.find((child) => child.type === 'element' && child.tagName === 'code');
      if (!code || !isMermaid(code)) return;

      const source = ctx.textContent(code).replace(/\n$/, '');
      ctx.replaceNode(node, {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['diagram'] },
        children: [
          {
            type: 'element',
            tagName: 'pre',
            properties: { className: ['mermaid-source'], ariaHidden: 'true' },
            children: [{ type: 'text', value: source }],
          },
          {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['mermaid-view'],
              role: 'img',
              ariaLabel: '流程图',
            },
            children: [],
          },
        ],
      });
    },
  },
};
