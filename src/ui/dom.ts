export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', content?: string) {
    const element = document.createElement(tag);
    element.className = className;
    if (content !== undefined)
        element.textContent = content;
    return element;
}
export function button(label: string, action: () => void, className = 'button') {
    const b = el('button', className, label);
    b.type = 'button';
    b.addEventListener('click', event => { event.stopPropagation(); action(); });
    return b;
}
export function paragraph(content: string, className = '') { return el('p', className, content); }
export function image(url: string, alt: string, className = '') {
    const img = el('img', className);
    img.src = url;
    img.alt = alt;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
        const host = img.parentElement instanceof HTMLButtonElement ? img.parentElement : img;
        const state = el('div', 'image-failure');
        state.append(paragraph('這張圖暫時沒送到。'), button('重新載入', () => {
            img.src = `${url}?retry=${Date.now()}`;
            state.replaceWith(host);
        }));
        host.replaceWith(state);
    });
    return img;
}
export function tags(values: string[]) {
    const group = el('div', 'tags');
    for (const value of values)
        group.append(el('span', 'tag', value));
    return group;
}
export function section(title: string, ...children: Node[]) { const s = el('section', 'section'); s.append(el('h3', '', title), ...children); return s; }
export function safeExternal(url: string) {
    try {
        const parsed = new URL(url);
        return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null;
    }
    catch {
        return null;
    }
}
