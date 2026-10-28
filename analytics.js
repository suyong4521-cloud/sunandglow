/* GA4: send only fixed metadata. Never read or serialize form input values. */
(function () {
  'use strict';
  var measurementId = 'G-YL5MC7J7NG';
  var pageType = document.body.dataset.pageType || (document.getElementById('lead-form') ? 'landing' : 'result');
  var debug = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || pageType === 'diagnostic';
  var status = window.sunGlowAnalyticsStatus = {
    measurementId: measurementId, loader: 'loading', eventCount: 0, lastEvent: ''
  };
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  // Drop arbitrary query strings/fragments; retain only standard campaign attribution.
  var cleanUrl = new URL(location.origin + location.pathname);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term', 'utm_content', 'gclid', 'dclid', 'gbraid', 'wbraid'].forEach(function (key) {
    var value = new URLSearchParams(location.search).get(key);
    if (value) cleanUrl.searchParams.set(key, value);
  });
  var pageLocation = cleanUrl.href;
  var referrer = '';
  try { var url = new URL(document.referrer); referrer = url.origin + url.pathname; } catch (_) {}
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false, page_location: pageLocation, page_referrer: referrer,
    allow_google_signals: false, allow_ad_personalization_signals: false,
    debug_mode: debug
  });
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  script.onload = function () { status.loader = 'loaded'; };
  script.onerror = function () { status.loader = 'failed'; };
  document.head.appendChild(script);

  function track(name, params) {
    status.eventCount += 1;
    status.lastEvent = name;
    window.gtag('event', name, Object.assign({
      send_to: measurementId, page_type: pageType, flow_type: 'demo',
      page_location: pageLocation, page_referrer: referrer
    }, params || {}));
  }
  window.sunGlowTrack = track;
  track('page_view');

  var products = {
    daily_set: '데일리 선미스트 세트', full_60ml: '60ml 본품', mini_15ml: '15ml 미니'
  };
  function item(element, index) {
    return { item_id: element.dataset.productId, item_name: products[element.dataset.productId], index: index };
  }
  document.addEventListener('click', function (event) {
    var element = event.target.closest('[data-event]');
    if (!element) return;
    var params = { placement: element.dataset.placement, cta_id: element.dataset.ctaId,
      target_section: element.dataset.targetSection };
    if (element.dataset.productId) params.product_id = element.dataset.productId;
    if (element.dataset.contentId) params.content_id = element.dataset.contentId;
    if (element.dataset.event === 'select_item') {
      params.item_list_id = 'best_items';
      params.items = [item(element, Array.from(document.querySelectorAll('.product')).indexOf(element))];
    }
    track(element.dataset.event, params);
  });

  var form = document.getElementById('lead-form');
  if (form) {
    var started = false;
    form.addEventListener('input', function (event) {
      if (started || !event.target.matches('#f-name, #f-contact')) return;
      started = true;
      track('form_start', { form_id: 'lead_form' });
    });
  }

  if (!window.IntersectionObserver) return;
  var timers = new Map();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var element = entry.target;
      // Tall mobile sections use half the viewport rather than an unreachable half-section threshold.
      if (!entry.isIntersecting || entry.intersectionRect.height < Math.min(entry.boundingClientRect.height, innerHeight) * 0.5) {
        clearTimeout(timers.get(element)); timers.delete(element); return;
      }
      if (timers.has(element)) return;
      timers.set(element, setTimeout(function () {
        if (element.matches('.product')) {
          track('view_item_list', { item_list_id: 'best_items',
            items: [item(element, Array.from(document.querySelectorAll('.product')).indexOf(element))] });
        } else {
          track('section_view', { section_id: element.dataset.sectionId || element.id.replace(/-/g, '_') });
        }
        observer.unobserve(element); timers.delete(element);
      }, 1000));
    });
  }, { threshold: Array.from({ length: 101 }, function (_, i) { return i / 100; }) });
  document.querySelectorAll('#featured, [data-section-id], #best, #story, #how-to, #apply, .product').forEach(function (element) {
    observer.observe(element);
  });
})();
