(function () {
  'use strict';
  var started = Date.now();
  var tested = false;
  var observed = false;
  function text(id, value) { document.getElementById(id).textContent = value; }
  // Resource Timing can observe a request, but cannot prove Google ingestion.
  function inspect(entries) {
    entries.forEach(function (entry) {
      try {
        var url = new URL(entry.name);
        if (/(^|\.)google-analytics\.com$/.test(url.hostname) && /\/g\/collect$/.test(url.pathname) &&
            url.searchParams.get('tid') === 'G-YL5MC7J7NG') observed = true;
      } catch (_) {}
    });
  }
  if (window.PerformanceObserver) {
    try {
      var observer = new PerformanceObserver(function (list) { inspect(list.getEntries()); });
      observer.observe({ type: 'resource', buffered: true });
    } catch (_) {}
  }
  function sendTest() {
    if (typeof window.sunGlowTrack !== 'function') return;
    window.sunGlowTrack('analytics_connection_test', { test_source: 'connection_check', debug_mode: true });
    tested = true;
  }
  document.getElementById('retry').addEventListener('click', function () { sendTest(); render(); });
  function render() {
    var status = window.sunGlowAnalyticsStatus;
    inspect(performance.getEntriesByType('resource'));
    text('code', status ? '정상 로딩' : '아직 로딩되지 않음');
    text('measurement', status ? status.measurementId : '확인 불가');
    text('loader', status ? ({ loading: '로딩 중', loaded: '로딩 완료', failed: '로드 실패' })[status.loader] : '시작되지 않음');
    text('test', tested ? 'analytics_connection_test 생성됨' : '대기 중');
    text('collection', observed ? '요청 발생 관찰됨 (수신 확인 아님)' : '아직 관찰되지 않음');
    if (!status) {
      text('result', '사이트 분석 코드가 로딩되지 않았습니다. 배포 파일 또는 브라우저 차단 여부를 확인해야 합니다.');
    } else if (status.loader === 'failed') {
      text('result', 'Google 태그를 불러오지 못했습니다. 광고 차단 확장 프로그램, 추적 방지 또는 네트워크 차단 가능성이 있습니다.');
    } else if (observed) {
      text('result', 'Google 전송 요청이 관찰됐습니다. GA4에서 같은 측정 ID의 속성을 보고 있는지와 데이터 필터를 확인해야 합니다.');
    } else if (status.loader === 'loaded' && Date.now() - started > 10000) {
      text('result', '태그는 로딩됐으나 전송 요청은 아직 관찰되지 않았습니다. 차단·지연 또는 브라우저 관찰 제한일 수 있습니다.');
    } else {
      text('result', 'Google 태그와 전송 요청을 확인 중입니다. 10초 정도 기다려 주세요.');
    }
    if (status && status.loader === 'loaded' && !tested) sendTest();
  }
  render();
  var timer = setInterval(function () {
    render();
    if (Date.now() - started > 30000) clearInterval(timer);
  }, 500);
})();
