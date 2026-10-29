(function () {
  'use strict';
  var started = Date.now();
  var status = window.sunGlowMetaStatus = {
    pixelId: '1090501856926618', loader: 'loading', testCount: 0,
    requestObserved: false, responseStatus: null, ingestion: 'unverified'
  };
  var script = document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]');
  var sendFailed = false;

  function text(id, value) { document.getElementById(id).textContent = value; }
  function inspect(entries) {
    entries.forEach(function (entry) {
      try {
        var url = new URL(entry.name);
        if (!/(^|\.)facebook\.com$/.test(url.hostname) || !/^\/tr\/?$/.test(url.pathname) ||
            url.searchParams.get('id') !== status.pixelId ||
            url.searchParams.get('ev') !== 'meta_connection_test') return;
        // Observing a request is not evidence that Meta processed the event.
        status.requestObserved = true;
        if (entry.responseStatus >= 100) status.responseStatus = entry.responseStatus;
      } catch (_) {}
    });
  }
  function render() {
    // The bootstrap sets fbq.loaded before downloading the SDK; do not use it here.
    if (window.fbq && typeof window.fbq.callMethod === 'function') status.loader = 'loaded';
    inspect(performance.getEntriesByType('resource'));
    var delayed = Date.now() - started > 10000;
    text('meta-pixel', status.pixelId);
    text('meta-loader', {
      loading: delayed ? '로드 확인 안 됨 (차단·지연 가능)' : '로딩 확인 중',
      loaded: '초기화 완료', failed: '로드 실패', script_loaded: '파일 로드됨 (초기화 확인 중)'
    }[status.loader]);
    text('meta-test', status.testCount ? 'meta_connection_test 생성 ' + status.testCount + '회 (전송 대기 가능)' : '생성되지 않음');
    text('meta-collection', status.requestObserved ? '요청 발생 관찰됨 (수신 확인 아님)' : '아직 관찰되지 않음');
    text('meta-response', status.responseStatus ? 'HTTP ' + status.responseStatus + ' (처리 완료 확인 아님)' : '브라우저에서 응답 상태 확인 불가');
    text('meta-ingestion', 'Meta 이벤트 관리자 확인 필요');
    if (typeof window.fbq !== 'function') {
      text('meta-result', 'Meta 픽셀 코드가 실행되지 않았습니다.');
    } else if (sendFailed) {
      text('meta-result', '진단 이벤트를 생성하지 못했습니다.');
    } else if (status.responseStatus >= 400) {
      text('meta-result', 'Meta 전송 요청에서 HTTP 오류가 관찰됐습니다.');
    } else if (status.requestObserved) {
      text('meta-result', '이 픽셀의 진단 이벤트 요청이 관찰됐습니다. Meta 계정의 실제 수신·처리는 별도 확인이 필요합니다.');
    } else if (status.loader === 'failed') {
      text('meta-result', 'Meta 픽셀 파일을 불러오지 못했습니다. 광고 차단·추적 방지·네트워크 제한을 확인해야 합니다.');
    } else if (delayed) {
      text('meta-result', '진단 이벤트의 전송 요청을 확인하지 못했습니다. 차단·지연 또는 브라우저 관찰 제한 가능성이 있습니다.');
    } else {
      text('meta-result', 'Meta 픽셀 초기화와 진단 이벤트 전송 요청을 확인 중입니다.');
    }
  }
  function sendTest() {
    if (typeof window.sunGlowTrack !== 'function' || typeof window.fbq !== 'function') {
      sendFailed = true;
      return;
    }
    try {
      // Exercise the same GA4-to-Meta bridge as site clicks; never use form inputs.
      window.sunGlowTrack('meta_connection_test', { test_source: 'connection_check', debug_mode: true });
      status.testCount += 1;
      sendFailed = false;
    } catch (_) { sendFailed = true; }
  }
  if (script) {
    script.addEventListener('load', function () { status.loader = 'script_loaded'; render(); });
    script.addEventListener('error', function () { status.loader = 'failed'; render(); });
  }
  if (window.PerformanceObserver) {
    try {
      var observer = new PerformanceObserver(function (list) { inspect(list.getEntries()); render(); });
      observer.observe({ type: 'resource', buffered: true });
    } catch (_) {}
  }
  document.getElementById('meta-retry').addEventListener('click', function () { sendTest(); render(); });
  sendTest();
  render();
  var timer = setInterval(function () {
    render();
    if (Date.now() - started > 30000) clearInterval(timer);
  }, 500);
})();
