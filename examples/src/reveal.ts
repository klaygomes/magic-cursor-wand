const revealed = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      revealed.unobserve(entry.target);
    }
  },
  { threshold: 0.2 },
);

for (const element of document.querySelectorAll('[data-reveal]')) revealed.observe(element);
