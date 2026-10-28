// Requires Python 3, Playwright, and Chromium (preinstalled in the cloud environment).
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const path = require('node:path');
const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
  cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore']
});
let browser;
(async () => {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Server startup timeout')), 10000);
    server.on('error', reject);
    server.stdout.on('data', chunk => {
      const match = chunk.toString().match(/port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const base = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext();
  // Do not send test traffic or synthetic values to Google.
  await context.route('https://**/*', route => route.abort());
  await context.addInitScript(() => {
    window.__events = [];
    window.gtag = function () {
      const args = Array.from(arguments);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(args);
      if (args[0] === 'event') window.__events.push({ name: args[1], params: args[2],
        inputs: [...document.querySelectorAll('#lead-form input')].map(i => i.value) });
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const events = name => page.evaluate(name => window.__events.filter(e => e.name === name), name);
  await page.goto(base + '/?name=PRIVATE_QUERY&utm_source=test#PRIVATE_HASH');
  assert.equal((await events('page_view')).length, 1);
  const pv = (await events('page_view'))[0].params;
  assert(!JSON.stringify(pv).includes('PRIVATE'));
  assert(pv.page_location.includes('utm_source=test'));
  assert.equal(await page.locator('script[src*="googletagmanager"]').getAttribute('src'),
    'https://www.googletagmanager.com/gtag/js?id=G-YL5MC7J7NG');

  // Every annotated link reports exactly one event, including clicks on its children.
  const links = await page.locator('[data-event]').evaluateAll(a => a.map(e => ({
    id: e.dataset.ctaId, name: e.dataset.event, product: e.dataset.productId
  })));
  assert.equal(links.length, 22);
  for (const link of links) {
    const before = (await events(link.name)).length;
    await page.evaluate(id => {
      const el = document.querySelector(`[data-cta-id="${id}"]`);
      el.addEventListener('click', e => e.preventDefault(), { once: true });
      (el.querySelector('img,span,svg') || el).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }, link.id);
    const result = await events(link.name);
    assert.equal(result.length, before + 1);
    assert.equal(result.at(-1).params.cta_id, link.id);
    if (link.name === 'select_item') assert.equal(result.at(-1).params.items[0].item_id, link.product);
  }
  assert.equal((await events('page_view')).length, 1);
  await page.locator('#cta-submit').click();
  assert.equal((await events('lead_submit_attempt')).at(-1).params.validation_result, 'invalid');
  assert.equal((await events('form_validation_error')).length, 2);
  assert.equal(await page.locator('#privacy-modal').getAttribute('aria-hidden'), 'true');

  for (const method of ['button', 'escape', 'backdrop', 'confirm']) {
    await page.locator('[data-privacy-open]').first().click();
    if (method === 'button') await page.locator('#privacy-cancel').click();
    if (method === 'escape') await page.keyboard.press('Escape');
    if (method === 'backdrop') await page.locator('#privacy-modal').click({ position: { x: 2, y: 2 } });
    if (method === 'confirm') { await page.locator('#privacy-agree').check(); await page.locator('#privacy-ok').click(); }
    assert.equal((await events('privacy_notice_close')).at(-1).params.close_method, method);
  }
  assert.equal((await events('demo_lead_complete')).length, 0);
  await page.locator('#f-name').fill('PRIVATE_NAME');
  await page.locator('#f-contact').fill('010-9876-5432');
  assert.equal((await events('form_start')).length, 1);
  await page.locator('#cta-submit').click();
  assert.equal((await events('lead_submit_attempt')).at(-1).params.validation_result, 'valid');
  await page.locator('#privacy-cancel').click();
  assert.equal(await page.locator('#f-name').inputValue(), 'PRIVATE_NAME');
  await page.locator('#cta-submit').click();
  await page.locator('#privacy-agree').check();
  await page.evaluate(() => { document.getElementById('privacy-ok').click(); document.getElementById('privacy-ok').click(); });
  const complete = await events('demo_lead_complete');
  assert.equal(complete.length, 1);
  assert.deepEqual(complete[0].inputs, ['', '']);
  const allParams = await page.evaluate(() => JSON.stringify(window.__events.map(e => e.params)));
  assert(!allParams.includes('PRIVATE_NAME') && !allParams.includes('010-9876-5432'));
  await page.waitForURL('**/result.html'); // Loader is blocked: fallback must still navigate.
  assert.equal((await events('demo_lead_complete')).length, 0);
  for (const id of ['result_logo', 'result_home']) {
    await page.locator(`[data-cta-id="${id}"]`).evaluate(el => {
      el.addEventListener('click', e => e.preventDefault(), { once: true }); el.click();
    });
    assert.equal((await events('navigation_click')).at(-1).params.cta_id, id);
  }
  await page.reload();
  assert.equal((await events('demo_lead_complete')).length, 0);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/');
    await page.locator('#apply').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__events.some(e => e.name === 'section_view' && e.params.section_id === 'apply'));
    await page.waitForTimeout(1100);
    assert.equal((await events('section_view')).filter(e => e.params.section_id === 'apply').length, 1);
    await page.locator('.product').first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__events.some(e => e.name === 'view_item_list'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  // The mobile shortcut scrolls to the original form, then gets out of its way.
  await page.goto(base + '/');
  await page.locator('#mobile-apply a').click();
  await page.waitForFunction(() => document.getElementById('mobile-apply').hidden);
  assert.equal(await page.locator('#cta-submit').textContent().then(t => t.includes('구매신청')), true);
  await page.locator('#f-name').fill('테스트');
  assert.equal(await page.locator('#mobile-apply').isVisible(), false);
  await page.locator('#f-name').blur();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => !document.getElementById('mobile-apply').hidden);
  assert.equal(await page.locator('#mobile-apply').isVisible(), true);
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(await page.locator('#mobile-apply').isVisible(), false);
  await page.setViewportSize({ width: 390, height: 900 });
  assert.deepEqual(errors, []);
  // Exercise the successful delivery callback as well as the timeout path above.
  await page.goto(base + '/');
  await page.locator('#f-name').fill('테스트');
  await page.locator('#f-contact').fill('010-1234-5678');
  await page.locator('#cta-submit').click();
  await page.locator('#privacy-agree').check();
  await page.locator('#privacy-ok').click();
  await page.evaluate(() => {
    const event = window.__events.find(e => e.name === 'demo_lead_complete');
    event.params.event_callback();
    event.params.event_callback();
  });
  await page.waitForURL('**/result.html');
  // Diagnostic UI distinguishes blocked loader from loaded script / observed request.
  await page.goto(base + '/analytics-check.html');
  await page.waitForFunction(() => window.sunGlowAnalyticsStatus.loader === 'failed');
  await page.waitForFunction(() => document.getElementById('loader').textContent === '로드 실패');
  assert((await page.locator('#result').textContent()).includes('불러오지 못했습니다'));
  await context.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({
    contentType: 'text/javascript', body: '// Simulated loader, not Google ingestion.'
  }));
  await context.route('https://www.google-analytics.com/g/collect?*', route => route.fulfill({
    status: 204, headers: { 'access-control-allow-origin': '*' }
  }));
  await page.goto(base + '/analytics-check.html');
  await page.waitForFunction(() => window.__events.some(e => e.name === 'analytics_connection_test'));
  assert.equal((await events('analytics_connection_test')).length, 1);
  assert.equal((await events('page_view'))[0].params.page_type, 'diagnostic');
  assert((await page.locator('#loader').textContent()).includes('로딩 완료'));
  await page.evaluate(() => fetch('https://www.google-analytics.com/g/collect?tid=G-YL5MC7J7NG'));
  await page.waitForFunction(() => document.getElementById('collection').textContent.includes('요청 발생 관찰됨'));
  await page.locator('#retry').click();
  assert.equal((await events('analytics_connection_test')).length, 2);
  assert.equal((await events('demo_lead_complete')).length, 0);
  // Test that a complete analytics script failure still permits submission.
  await context.route('**/analytics.js', route => route.abort());
  await page.goto(base + '/');
  await page.locator('#f-name').fill('테스트');
  await page.locator('#f-contact').fill('010-1234-5678');
  await page.locator('#cta-submit').click();
  await page.locator('#privacy-agree').check();
  await page.locator('#privacy-ok').click();
  await page.waitForURL('**/result.html');
  console.log('PASS: 24 links, configuration, URL sanitization, form validation, modal actions, single completion, input deletion, blocked analytics fallback, result reload, desktop/mobile exposure and layout.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.kill();
});
