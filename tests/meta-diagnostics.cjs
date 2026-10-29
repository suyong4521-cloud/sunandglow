// All external requests are blocked or fulfilled locally. No real Meta traffic is sent.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const pixelId = '1090501856926618';
const sdk = 'https://connect.facebook.net/en_US/fbevents.js';
const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
  cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore']
});
let browser;

const simulatedSdk = `(() => {
  let id;
  const process = (...args) => {
    if (args[0] === 'init') id = args[1];
    if (args[0] === 'track' || args[0] === 'trackCustom') {
      window.__metaSent = window.__metaSent || [];
      window.__metaSent.push(args);
      fetch('https://www.facebook.com/tr/?id=' + id + '&ev=' + args[1]).catch(() => {});
    }
  };
  window.fbq.callMethod = process;
  window.fbq.queue.splice(0).forEach(args => process(...args));
})();`;

async function context() {
  const ctx = await browser.newContext();
  await ctx.route('https://**/*', route => route.abort());
  return ctx;
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

async function unverified(page) {
  assert.equal(await page.locator('#meta-ingestion').textContent(), 'Meta 이벤트 관리자 확인 필요');
  assert.equal(await page.evaluate(() => window.sunGlowMetaStatus.ingestion), 'unverified');
}

(async () => {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server startup timeout')), 10000);
    server.on('error', reject);
    server.stdout.on('data', data => {
      const match = data.toString().match(/port (\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const url = `http://127.0.0.1:${port}/analytics-check.html`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });

  // A bootstrap queue and fbq.loaded=true must not count as a downloaded SDK.
  {
    const ctx = await context();
    await ctx.route(sdk, async route => {
      await new Promise(resolve => setTimeout(resolve, 150));
      await route.abort();
    });
    const page = await ctx.newPage();
    const errors = collectErrors(page);
    await page.goto(url);
    await page.waitForFunction(() => window.sunGlowMetaStatus && window.sunGlowMetaStatus.loader === 'failed');
    assert.equal(await page.evaluate(() => window.fbq.loaded), true);
    const state = await page.evaluate(() => window.sunGlowMetaStatus);
    assert.equal(state.pixelId, pixelId);
    assert.equal(state.requestObserved, false);
    assert.equal(state.responseStatus, null);
    await unverified(page);
    assert.deepEqual(errors, []);
    console.log('PASS: blocked SDK is not mistaken for initialized Meta Pixel');
    await ctx.close();
  }

  // A simulated loaded SDK exercises the actual browser request/Resource Timing path.
  {
    const ctx = await context();
    await ctx.route(sdk, route => route.fulfill({ contentType: 'text/javascript', body: simulatedSdk }));
    await ctx.route(/^https:\/\/www\.facebook\.com\/tr\/\?/, route => route.fulfill({
      status: 200, body: '', headers: { 'access-control-allow-origin': '*', 'timing-allow-origin': '*' }
    }));
    const page = await ctx.newPage();
    const errors = collectErrors(page);
    await page.goto(url);
    await page.waitForFunction(() => window.sunGlowMetaStatus && window.sunGlowMetaStatus.loader === 'loaded' && window.sunGlowMetaStatus.requestObserved);
    assert.equal(await page.evaluate(() => window.sunGlowMetaStatus.testCount), 1);
    assert.equal(await page.evaluate(() => window.__metaSent.filter(e => e[1] === 'meta_connection_test').length), 1);
    await unverified(page);
    await page.locator('#meta-retry').click();
    await page.waitForFunction(() => window.sunGlowMetaStatus.testCount === 2);
    assert.equal(await page.evaluate(() => window.__metaSent.filter(e => e[1] === 'meta_connection_test').length), 2);
    await unverified(page);
    assert.deepEqual(errors, []);
    console.log('PASS: initialized SDK sends one diagnostic event and one per retry; receipt remains unverified');
    await ctx.close();
  }

  // Inject Resource Timing entries deterministically, including opaque status 0.
  {
    const ctx = await context();
    await ctx.addInitScript(() => {
      window.__resourceCallbacks = [];
      const NativeObserver = window.PerformanceObserver;
      window.PerformanceObserver = class extends NativeObserver {
        constructor(callback) { super(callback); window.__resourceCallbacks.push(callback); }
      };
    });
    await ctx.route(sdk, route => route.fulfill({ contentType: 'text/javascript', body: '// Script loaded, SDK not initialized.' }));
    const page = await ctx.newPage();
    const errors = collectErrors(page);
    await page.goto(url);
    await page.waitForFunction(() => window.sunGlowMetaStatus && window.__resourceCallbacks.length >= 2);
    assert.notEqual(await page.evaluate(() => window.sunGlowMetaStatus.loader), 'loaded');
    const inspect = entries => page.evaluate(entries => {
      for (const callback of window.__resourceCallbacks) callback({ getEntries: () => entries });
    }, entries);
    await inspect([
      { name: `https://www.facebook.com/tr/?id=WRONG&ev=meta_connection_test`, responseStatus: 200 },
      { name: `https://notfacebook.com/tr/?id=${pixelId}&ev=meta_connection_test`, responseStatus: 200 },
      { name: `https://www.facebook.com/not-tr?id=${pixelId}&ev=meta_connection_test`, responseStatus: 200 },
      { name: `https://www.facebook.com/tr/?id=${pixelId}&ev=PageView`, responseStatus: 200 }
    ]);
    assert.equal(await page.evaluate(() => window.sunGlowMetaStatus.requestObserved), false);
    await inspect([{ name: `https://www.facebook.com/tr/?id=${pixelId}&ev=meta_connection_test`, responseStatus: 0 }]);
    assert.equal(await page.evaluate(() => window.sunGlowMetaStatus.requestObserved), true);
    assert.equal(await page.evaluate(() => window.sunGlowMetaStatus.responseStatus), null);
    await inspect([{ name: `https://www.facebook.com/tr/?id=${pixelId}&ev=meta_connection_test`, responseStatus: 200 }]);
    assert.equal(await page.evaluate(() => window.sunGlowMetaStatus.responseStatus), 200);
    await unverified(page);
    await inspect([{ name: `https://www.facebook.com/tr/?id=${pixelId}&ev=meta_connection_test`, responseStatus: 403 }]);
    assert.equal(await page.evaluate(() => window.sunGlowMetaStatus.responseStatus), 403);
    assert((await page.locator('#meta-result').textContent()).includes('HTTP 오류'));
    await unverified(page);
    assert.deepEqual(errors, []);
    console.log('PASS: wrong requests ignored; opaque status stays unknown; HTTP 200 is not ingestion; HTTP errors reported');
    await ctx.close();
  }

  // Removing the bootstrap must leave the rest of the diagnostic page usable.
  {
    const ctx = await context();
    await ctx.route('**/analytics-check.html', async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/<!-- Meta Pixel Code -->[\s\S]*?<!-- End Meta Pixel Code -->/, '');
      await route.fulfill({ response, body });
    });
    const page = await ctx.newPage();
    const errors = collectErrors(page);
    await page.goto(url);
    await page.waitForFunction(() => window.sunGlowMetaStatus);
    assert.equal(await page.evaluate(() => typeof window.fbq), 'undefined');
    assert.notEqual(await page.evaluate(() => window.sunGlowMetaStatus.loader), 'loaded');
    await page.locator('#meta-retry').click();
    await unverified(page);
    assert.deepEqual(errors, []);
    console.log('PASS: absent fbq does not break the diagnostic page');
    await ctx.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.kill();
});
