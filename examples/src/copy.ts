const RESET_MS = 1600;

/** Copies the text of the element named in `data-copy` when its button is clicked. */
export function bindCopyButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    const source = document.getElementById(button.dataset.copy ?? '');
    const label = button.textContent;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(source?.textContent?.trim() ?? '');
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Select and copy';
      }
      setTimeout(() => {
        button.textContent = label;
      }, RESET_MS);
    });
  }
}
