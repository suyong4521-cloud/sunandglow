# Meta 픽셀 운영 설정

픽셀 ID: `1090501856926618`. 모든 HTML에서 픽셀을 초기화하고 `PageView`를 한 번 호출합니다.
GTM `GTM-TS736MN9`와 GA4 `G-YL5MC7J7NG` 코드는 그대로 유지합니다.

## GA4 이벤트 연동

`analytics.js`의 공통 `track()` 함수가 기존 GA4 이벤트 호출 직후 메타 이벤트를 호출합니다.

| GA4 | Meta |
|---|---|
| generate_lead | Lead |
| sign_up | CompleteRegistration |
| contact_click | Contact |
| view_item | ViewContent |
| add_to_cart | AddToCart |
| begin_checkout | InitiateCheckout |
| purchase | Purchase (`value` 유지, `currency: 'KRW'`) |
| search | Search |
| 그 밖의 이벤트 | 같은 이름으로 `trackCustom` |

`page_view`, 이름에 `scroll`이 포함된 이벤트와 스크롤 노출 이벤트인 `section_view`, `view_item_list`는 연동하지 않습니다.
기존 픽셀의 `PageView`를 중복 호출하지 않기 위한 설정입니다.
위 매핑이 새 GA4 이벤트를 만들어내지는 않습니다. 현재 신청 체험 완료는 `Lead`가 아닌 `demo_lead_complete`입니다.
이름·연락처 입력값과 GA4 이벤트 매개변수는 메타 연동 코드에서 복사하지 않으며, 구매에 한해 금액과 통화를 전달합니다.

## 진단

`analytics-check.html`은 GA4와 Meta를 함께 진단합니다. Meta 진단은 Google SDK 로딩 여부와 독립적으로
공통 함수를 통해 `meta_connection_test`를 한 번 생성합니다. Meta 재시도 버튼을 누르면 한 번 더 생성합니다.

- 픽셀 초기화, 진단 이벤트 생성, 해당 픽셀·이벤트의 `/tr` 요청 관찰을 구분합니다.
- 브라우저가 응답 상태를 공개하는 경우 HTTP 상태도 표시합니다. 상태를 공개하지 않으면 확인 불가로 표시합니다.
- `fbq.loaded`는 SDK 다운로드 전에 참이 되므로 초기화 성공 근거로 쓰지 않습니다.
- 이벤트 생성, 빈 전송 큐, 요청 관찰, HTTP 2xx는 Meta 이벤트 관리자 수신·처리 완료를 보장하지 않습니다.
- 실제 수신은 해당 픽셀에 접근 권한이 있는 Meta 이벤트 관리자에서만 확인할 수 있습니다.

실제 전송에는 `connect.facebook.net`, `www.facebook.com` 접속이 필요합니다.
클라우드에서 배포 사이트도 조회하려면 `suyong4521-cloud.github.io` 접속이 필요합니다.
네트워크 프록시의 `403`은 Meta가 이벤트를 거절했다는 의미가 아닙니다.

## 자동 검증

저장소 루트에서 실행합니다.

```sh
node --test tests/meta-events.cjs
node tests/analytics.cjs
node tests/meta-diagnostics.cjs
```

브라우저 테스트는 외부 분석 요청을 차단하거나 모의 응답으로 대체합니다.
앱의 호출·진단 동작을 검증하며 실제 Meta 계정 수신을 증명하는 테스트는 아닙니다.
