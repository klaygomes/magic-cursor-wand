export function revealOnScroll(): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.2 },
  );
  for (const element of document.querySelectorAll('[data-reveal]')) observer.observe(element);
}
