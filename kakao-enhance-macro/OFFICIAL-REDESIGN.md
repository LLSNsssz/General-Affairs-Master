# Official Redesign

## 결론

기존 `카카오톡 PC 창 + 백그라운드 입력 + /강화` 구조는 공식 지원 경로가 아닙니다.
공식적으로 갈 수 있는 방향은 `카카오톡은 진입점`, `실제 강화 처리는 우리 서버`로 분리하는 방식입니다.

즉 목표를 이렇게 바꿉니다.

- 기존 목표: 기존 채팅방 플레이봇에 `/강화`를 몰래 주입
- 새 목표: 사용자가 카카오톡에서 요청하면 우리 서버가 강화 작업을 처리하고 결과를 돌려줌

## 왜 기존 방식이 막히는가

- Kakao Developers 공식 범위에는 `카카오톡 PC 기존 채팅방에 제3자 명령을 주입`하는 API가 없습니다.
- 메시지 API, 카카오톡 채널, 공유 기능은 있지만 PC 클라이언트 입력 자동화 API는 없습니다.
- 실제 테스트에서도 background 입력은 plain text 전송까지만 되고, 슬래시 명령 파서까지 안정적으로 타지 않았습니다.

공식 문서:

- [지원 범위](https://developers.kakao.com/docs/latest/ko/getting-started/scope-of-support)
- [카카오톡 메시지 REST API](https://developers.kakao.com/docs/latest/ko/kakaotalk-message/rest-api)
- [메시지 제품 소개](https://developers.kakao.com/product/message)
- [카카오톡 채널 제품 소개](https://developers.kakao.com/product/kakaoTalkChannel)

기준 확인일: 2026-03-19

## 권장 구조

### 구조 A

`카카오톡 채널/챗봇 -> 우리 서버 API -> 강화 작업 큐 -> 상태 저장 -> 결과 응답`

흐름:

1. 사용자가 카카오톡 채널 또는 챗봇에 `강화 19` 같은 명령을 보냅니다.
2. 채널 webhook 또는 봇 서버가 우리 API에 요청을 보냅니다.
3. 우리 서버는 강화 작업을 큐에 넣습니다.
4. 작업자가 강화 로직을 처리합니다.
5. 결과를 상태 저장소에 기록합니다.
6. 채널 응답 또는 메시지 API로 결과를 사용자에게 보냅니다.

장점:

- 공식 구조에 가깝습니다.
- 백그라운드 창 주입이 필요 없습니다.
- 로직, 권한, 실패 처리, 로그를 서버에서 관리할 수 있습니다.

### 구조 B

`웹/앱 UI -> 우리 서버 -> 카카오톡 메시지 API`

이 구조는 카카오톡을 명령 입력창이 아니라 결과 통지 채널로만 씁니다.

흐름:

1. 사용자가 웹 또는 앱에서 강화 요청을 보냅니다.
2. 서버가 강화 작업을 수행합니다.
3. 결과를 카카오톡 메시지 API로 보냅니다.

장점:

- UI와 권한을 우리가 완전히 통제할 수 있습니다.
- 카카오톡은 알림 채널로만 사용하므로 구조가 단순합니다.

## 이번에 만든 스캐폴드

현재 폴더에 `kakao-enhance-service`라는 새 서비스 뼈대를 추가했습니다.

경로:

- `C:\Users\GS002\Documents\codex\kakao-enhance-macro\kakao-enhance-service`

포함 내용:

- `C# self-hosted HTTP 서비스`
- `플레이어 등록 API`
- `강화 요청 API`
- `작업 큐 + 백그라운드 worker`
- `store.json` 기반 상태 영속화
- `카카오 채널 webhook 흉내 엔드포인트`

이 스캐폴드는 지금 환경에서 `csc.exe`로 바로 빌드할 수 있게 만들었습니다. `dotnet SDK`가 없는 현재 환경에서는 이 방식이 가장 현실적입니다.

## 엔드포인트

- `GET /health`
- `GET /players`
- `GET /players/{playerId}`
- `POST /players/{playerId}`
- `GET /jobs`
- `GET /jobs/{jobId}`
- `POST /commands/enhance`
- `POST /kakao/channel/webhook`
- `GET /delivery-logs`

## 추천 다음 단계

1. 메모리 저장소를 `SQLite` 또는 실제 DB로 교체
2. `webhook` 입력 형식을 실제 카카오 채널 스펙에 맞춤
3. 결과 발송 어댑터 추가
4. 현재의 모의 강화 로직을 실제 비즈니스 로직으로 교체
5. 준비가 되면 `ASP.NET Core`로 이관

## 현실적인 판단

`기존 카카오톡 PC 클라이언트에 백그라운드로 /강화를 먹이는 방법`을 계속 파는 것보다,
`강화 기능 자체를 우리 서비스로 끌고 와서 카카오톡은 진입점과 알림 채널로만 쓰는 것`이 맞습니다.
