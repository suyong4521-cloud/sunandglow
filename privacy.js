/*
  신청 폼 처리. 입력값은 어디로도 보내지 않습니다.
  - 폼 입력칸에는 name 속성이 없어서, 스크립트가 꺼져 있어도 값이 주소창·서버로 넘어가지 않습니다.
  - 제출 → 개인정보 안내 팝업 → 동의 → 입력값 즉시 삭제 → result.html 이동.
  - 나중에 폼을 Make·구글시트 등에 연결하면 팝업 문구(index.html의 #privacy-modal)를 반드시 고쳐야 합니다.
*/
(function () {
  var form = document.getElementById('lead-form');
  var modal = document.getElementById('privacy-modal');
  if (!modal) return;
  var agree = document.getElementById('privacy-agree');
  var ok = document.getElementById('privacy-ok');
  var cancel = document.getElementById('privacy-cancel');
  var mode = 'info';
  var completing = false;

  function track(name, params) {
    if (typeof window.sunGlowTrack === 'function') window.sunGlowTrack(name, params);
  }

  function wipe() {
    if (!form) return;
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    });
    form.reset();
  }

  function open(m, placement) {
    mode = m;
    agree.checked = false;
    ok.disabled = true;
    ok.textContent = m === 'submit' ? '동의하고 완료하기' : '확인했습니다';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    agree.focus();
    track('privacy_notice_open', { modal_mode: mode, placement: placement || 'lead_form' });
  }

  function close(method) {
    if (!modal.classList.contains('open') || completing) return;
    track('privacy_notice_close', { modal_mode: mode, close_method: method });
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  agree.addEventListener('change', function () {
    ok.disabled = !agree.checked;
    track('privacy_acknowledgement_change', { modal_mode: mode, checked: agree.checked });
  });
  cancel.addEventListener('click', function () { close('button'); });
  modal.addEventListener('click', function (e) { if (e.target === modal) close('backdrop'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close('escape'); });

  ok.addEventListener('click', function () {
    if (!agree.checked || completing) return;
    if (mode !== 'submit') { close('confirm'); return; }
    completing = true;
    ok.disabled = true;
    wipe();
    var navigated = false;
    function finish() {
      if (navigated) return;
      navigated = true;
      location.replace('result.html');
    }
    // Always finish even when analytics is blocked or never invokes its callback.
    setTimeout(finish, 1000);
    try {
      track('demo_lead_complete', {
        form_id: 'lead_form', product_id: 'daily_set',
        event_callback: finish, event_timeout: 800
      });
    } catch (_) { finish(); }
  });

  document.querySelectorAll('[data-privacy-open]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); open('info', b.closest('footer') ? 'footer' : 'lead_form'); });
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = form.checkValidity();
      track('lead_submit_attempt', { form_id: 'lead_form', validation_result: valid ? 'valid' : 'invalid' });
      if (!valid) {
        form.querySelectorAll('input').forEach(function (input) {
          if (input.validity.valid) return;
          track('form_validation_error', { form_id: 'lead_form',
            field_id: input.id === 'f-name' ? 'name' : 'contact',
            error_type: input.validity.valueMissing ? 'required' : 'pattern' });
        });
        form.reportValidity(); return;
      }
      open('submit');
    });
  }

  // 검토 메모 패널 닫기 (검토용 빌드에만 있음)
  var rp = document.querySelector('.review-panel button');
  if (rp) rp.addEventListener('click', function () { rp.parentNode.remove(); });
})();
