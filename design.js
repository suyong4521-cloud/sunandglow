/* Decorative motion is optional; content and form work without this script. */
(function () {
  'use strict';
  if (!window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.featured-copy, .moment, .product, .story-copy, .usage, .closing-inner').forEach(function (element) {
    // Do not hide anything already visible, including a restored scroll position.
    if (element.getBoundingClientRect().top < innerHeight) return;
    element.classList.add('reveal-once');
    observer.observe(element);
  });
})();
