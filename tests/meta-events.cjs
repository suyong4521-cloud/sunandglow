const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '../analytics.js'), 'utf8');

function load(pixel = true) {
  const calls = [];
  const context = {
    URL, URLSearchParams,
    location: { hostname: '127.0.0.1', origin: 'http://127.0.0.1', pathname: '/', search: '' },
    document: {
      body: { dataset: {} }, referrer: '',
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild() {} },
      addEventListener() {}
    },
    gtag: (...args) => calls.push(['ga4', ...args])
  };
  if (pixel) context.fbq = (...args) => calls.push(['meta', ...args]);
  context.window = context;
  vm.runInNewContext(source, context, { filename: 'analytics.js' });
  assert.equal(calls.filter(c => c[0] === 'ga4' && c[1] === 'event' && c[2] === 'page_view').length, 1);
  assert.equal(calls.filter(c => c[0] === 'meta').length, 0);
  calls.length = 0;
  return { calls, context, track: context.sunGlowTrack };
}

test('standard events call the mapped Meta event immediately after GA4', () => {
  const { calls, track } = load();
  const mapping = {
    generate_lead: 'Lead', sign_up: 'CompleteRegistration', contact_click: 'Contact',
    view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', search: 'Search'
  };
  for (const [ga4, meta] of Object.entries(mapping)) {
    calls.length = 0;
    track(ga4);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].slice(0, 3), ['ga4', 'event', ga4]);
    assert.deepEqual(calls[1], ['meta', 'track', meta]);
  }
});

test('purchase retains its value (including zero) and sends KRW', () => {
  const { calls, track } = load();
  for (const value of [16900, 0]) {
    calls.length = 0;
    const params = { value, currency: 'KRW', transaction_id: 'test' };
    track('purchase', params);
    assert.equal(calls.length, 2);
    assert.equal(calls[0][3].value, value);
    assert.equal(calls[0][3].transaction_id, 'test');
    assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), ['meta', 'track', 'Purchase', { value, currency: 'KRW' }]);
    assert.deepEqual(params, { value, currency: 'KRW', transaction_id: 'test' });
  }
});

test('custom events retain their GA4 names without copying parameters to Meta', () => {
  const { calls, track } = load();
  for (const name of [
    'cta_click', 'navigation_click', 'select_item', 'form_start', 'privacy_notice_open',
    'privacy_notice_close', 'privacy_acknowledgement_change', 'demo_lead_complete',
    'lead_submit_attempt', 'form_validation_error', 'analytics_connection_test', 'constructor'
  ]) {
    calls.length = 0;
    track(name, { form_id: 'lead_form', event_callback() {} });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], ['meta', 'trackCustom', name]);
  }
});

test('page views and scroll-driven events stay GA4-only', () => {
  const { calls, track } = load();
  for (const name of ['page_view', 'scroll', 'scroll_depth', 'scroll_90', 'custom_scroll', 'section_view', 'view_item_list']) {
    calls.length = 0;
    track(name);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].slice(0, 3), ['ga4', 'event', name]);
  }
});

test('missing or disabled fbq never prevents GA4 events', () => {
  const { calls, context, track } = load(false);
  for (const pixel of [undefined, null, false]) {
    context.fbq = pixel;
    for (const name of ['generate_lead', 'purchase', 'cta_click']) {
      calls.length = 0;
      assert.doesNotThrow(() => track(name, { value: 16900 }));
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].slice(0, 3), ['ga4', 'event', name]);
    }
  }
});

test('GA4 payload and callbacks remain intact', () => {
  const { calls, track } = load();
  const callback = () => {};
  const params = { event_callback: callback, event_timeout: 800, form_id: 'lead_form' };
  track('demo_lead_complete', params);
  assert.deepEqual(calls[0].slice(0, 3), ['ga4', 'event', 'demo_lead_complete']);
  assert.equal(calls[0][3].send_to, 'G-YL5MC7J7NG');
  assert.equal(calls[0][3].flow_type, 'demo');
  assert.equal(calls[0][3].page_location, 'http://127.0.0.1/');
  assert.equal(calls[0][3].event_callback, callback);
  assert.equal(calls[0][3].event_timeout, 800);
  assert.deepEqual(params, { event_callback: callback, event_timeout: 800, form_id: 'lead_form' });
});
