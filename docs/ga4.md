# GA4 운영 설정

측정 ID: `G-YL5MC7J7NG`. `analytics.js`를 두 페이지에서 공통 사용합니다.
실제 판매·리드 접수가 없는 교육용 흐름이며 `purchase`, `generate_lead`, `add_to_cart`는 전송하지 않습니다.

## 배포 후 GA4에서 할 일

1. 웹 데이터 스트림이 `https://suyong4521-cloud.github.io/sunandglow/`를 대상으로 하는지 확인합니다.
2. 향상된 측정에서 **양식 상호작용**을 끕니다. `form_start`를 직접 수집하므로 중복 방지가 필요합니다.
3. 향상된 측정의 페이지 조회 고급 설정에서 **브라우저 기록 이벤트 기반 페이지 변경**을 끕니다. 내부 앵커 이동은 `navigation_click`/`cta_click`으로 분석합니다.
4. `demo_lead_complete`를 주요 이벤트로 등록합니다. 완료 페이지 `page_view`는 주요 이벤트로 등록하지 않습니다. 예전 `generate_lead` 또는 완료 URL 기반 주요 이벤트 설정이 있다면 중복 성과 집계 여부를 확인합니다.
5. 보고서에 필요한 이벤트 범위 맞춤 측정기준을 등록합니다: `placement`, `cta_id`, `target_section`, `product_id`, `content_id`, `section_id`, `form_id`, `modal_mode`, `validation_result`, `field_id`, `error_type`, `close_method`, `page_type`, `flow_type`.
6. DebugView/실시간 보고서에서 실제 수신을 확인합니다. 로컬 호스트에서는 `debug_mode=true`이며, 운영 사이트 점검에는 Tag Assistant를 사용할 수 있습니다. 개발자 트래픽 필터 설정을 확인해 테스트 방문이 운영 지표에 섞이지 않게 합니다.

이 저장소 변경은 GA4 관리자 설정을 변경하지 않습니다. 관리자 권한과 실제 배포 후 수신 검증은 별도로 필요합니다.

## 이벤트 명세

| 이벤트 | 발생 조건 | 추가 파라미터 |
|---|---|---|
| `page_view` | 랜딩/완료 페이지당 한 번 | `page_type` |
| `navigation_click` | 로고, 메뉴, 본문 바로가기, 완료 페이지 홈 이동 | `placement`, `cta_id`, `target_section` |
| `cta_click` | 소개/활용/스토리/하단 CTA, 상단 신청 아이콘 | 위 파라미터 + 해당 시 `product_id`, `content_id` |
| `select_item` | BEST ITEMS 상품 카드 클릭 | `item_list_id=best_items`, `items` + CTA 메타데이터 |
| `view_item_list` | 각 상품 카드가 1초 노출 | `item_list_id=best_items`, `items` (노출된 상품만) |
| `section_view` | 주요 섹션이 1초 노출 | `section_id` |
| `form_start` | 폼 필드 첫 입력, 페이지당 한 번 | `form_id=lead_form` |
| `lead_submit_attempt` | 구매하기로 폼 제출 시도 | `form_id`, `validation_result=valid/invalid` |
| `form_validation_error` | 제출 시 유효하지 않은 필드별 | `form_id`, `field_id=name/contact`, `error_type=required/pattern` |
| `privacy_notice_open` | 안내용/제출용 팝업 열기 | `modal_mode=info/submit`, `placement` |
| `privacy_acknowledgement_change` | 안내 확인 체크 변경 | `modal_mode`, `checked` |
| `privacy_notice_close` | 팝업 닫기 | `modal_mode`, `close_method=button/confirm/backdrop/escape` |
| `demo_lead_complete` | 제출 모드에서 동의 후 입력값 삭제 | `form_id`, `product_id=daily_set` |

공통값은 `flow_type=demo`, `page_type=landing/result`입니다. 상품 ID는 `daily_set`, `full_60ml`, `mini_15ml`이며 가격·매출 파라미터를 보내지 않습니다. CTA의 고유 식별자는 HTML의 `data-cta-id`로 관리합니다.

노출 조건은 요소 높이의 50%가 1초간 보이는 것입니다. 화면보다 긴 모바일 요소는 뷰포트 높이의 50%를 기준으로 합니다. 페이지당 요소별 한 번만 수집하며, 상품 노출은 실제 보인 상품만 `items`에 포함합니다.

## 입력값 보호와 완료 처리

이름·연락처·해시·사용자 입력 문자열을 수집하지 않습니다. URL에서 임의 쿼리와 해시를 제거하고 표준 UTM과 광고 클릭 ID만 유지합니다. UTM에도 개인정보를 넣지 마세요. 참조 URL의 쿼리·해시도 제거합니다. Google Signals와 광고 개인 최적화 신호는 비활성화합니다. GA4는 접속·기기 정보와 분석 쿠키를 사용할 수 있으므로 팝업에 통계 측정 안내를 추가했습니다. 신청 체험 체크는 분석 쿠키 수집 동의가 아닙니다.

`demo_lead_complete`는 입력값 삭제 후 한 번 발생합니다. 연속 클릭은 차단하며, 전송 콜백 또는 최대 1초 대기 후 완료 페이지로 이동합니다. 분석 도구가 차단되어도 이동합니다. 완료 페이지 직접 방문/새로고침에서는 완료 이벤트를 발생시키지 않습니다.

## 검증 범위

브라우저 테스트는 외부 GA4 로더를 대체하거나 차단하고 `dataLayer`에 기록되는 이벤트명·파라미터, 중복, 입력값 삭제와 이동을 검사합니다. 실제 Google 수신 여부나 관리자 주요 이벤트 설정 완료를 증명하는 테스트는 아닙니다.

브라우저 회귀 테스트 실행: `node tests/analytics.cjs` (Python 3, Playwright, Chromium 필요). Chromium 경로가 다르면 `CHROMIUM_PATH`를 지정합니다. 테스트가 임시 포트의 서버를 시작·정리하고 외부 요청을 차단하므로 운영 GA4에 테스트 이벤트를 보내지 않습니다.

## 연결 문제 진단

`analytics-check.html`은 분석 코드 실행, Google 태그 로딩 성공/실패, 진단 이벤트 생성, 브라우저 Resource Timing에 나타난 Google 수집 요청을 구분해 표시합니다. 진단 페이지에서만 `debug_mode=true`로 `analytics_connection_test`를 한 번 생성하며 버튼으로 재시도할 수 있습니다. 일반 방문은 진단 모드로 바뀌지 않습니다.

요청이 관찰되어도 Google 수신·처리가 성공했다는 뜻은 아닙니다. GA4에서 해당 측정 ID의 속성·스트림과 활성 데이터 필터를 확인해야 합니다. 진단 이벤트를 주요 이벤트로 지정하지 마세요. 개발자 트래픽 제외 필터가 활성화되면 DebugView를 사용하세요.

자동 테스트는 태그 로딩 실패와 모의 로더·모의 수집 요청으로 진단 표시를 검증합니다. 실제 Google 수신을 검증하지 않습니다.
