const HTML_TOKEN = /(<\/?[\w-]+|\/?>)|([\w-]+)(=)("[^"]*")/g;

function span(className: string, text: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}

export function highlightHtml(): void {
  for (const code of document.querySelectorAll<HTMLElement>('code[data-highlight="html"]')) {
    const source = code.textContent ?? '';
    const fragment = document.createDocumentFragment();
    let index = 0;
    for (const match of source.matchAll(HTML_TOKEN)) {
      const [whole, tag, name, equals, value] = match;
      fragment.append(source.slice(index, match.index));
      if (tag) fragment.append(span('tag', tag));
      else if (name && equals && value)
        fragment.append(span('attr', name), equals, span('str', value));
      index = match.index + whole.length;
    }
    fragment.append(source.slice(index));
    code.replaceChildren(fragment);
  }
}
