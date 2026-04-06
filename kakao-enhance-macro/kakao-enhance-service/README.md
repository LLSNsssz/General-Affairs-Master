# Kakao Enhance Service

`PC 카카오톡 백그라운드 입력`을 버리고, `메시지 진입점 + 서버 처리` 구조로 바꾼 재설계 스캐폴드입니다.

핵심 방향:

- 카카오톡은 명령을 입력하는 UI 채널로만 사용
- 실제 강화 로직은 우리 서버가 처리
- 강화 요청은 작업 큐에 적재
- 상태와 결과는 서버에서 조회하거나 메시지로 회신

현재 구현 범위:

- `HttpListener` 기반 C# self-hosted HTTP 서비스
- 강화 작업 큐와 메모리 저장소
- `data/store.json` 파일 영속 저장
- 채널 메시지 형태를 흉내 낸 webhook 엔드포인트
- 플레이어 등록, 상태 조회, 강화 요청 API

## 폴더

- `src/KakaoEnhanceService`: 서비스 코드
- `build.cmd`: `csc.exe`로 빌드
- `run.cmd`: 서비스 실행
- `bin/data/store.json`: 서비스 상태 저장 파일
- `start-tunnel.cmd`: Cloudflare quick tunnel 시작
- `stop-tunnel.cmd`: Cloudflare quick tunnel 중지
- `OPENBUILDER-BLOCKS.md`: 관리자센터 블록/발화 설계안
- `test-openbuilder.ps1`: 샘플 오픈빌더 요청 테스트 스크립트

## 빌드

```cmd
build.cmd
```

## 실행

```cmd
run.cmd
```

기본 주소는 `http://localhost:5088/`입니다.
플레이어, 작업, 전송 로그는 `bin/data/store.json`에 저장됩니다.
브라우저로 루트 주소를 열면 웹 UI가 보입니다.

## 공개 HTTPS 주소 열기

서비스를 외부에서 받을 테스트가 필요하면 quick tunnel을 열 수 있습니다.

```cmd
start-tunnel.cmd
```

성공하면 `trycloudflare.com` 주소가 출력됩니다.
오픈빌더 스킬 URL은 다음처럼 잡으면 됩니다.

```text
https://발급된주소.trycloudflare.com/kakao/openbuilder/skill
```

중지:

```cmd
stop-tunnel.cmd
```

## 주요 엔드포인트

- `GET /health`
- `GET /app`
- `GET /players`
- `GET /players/{playerId}`
- `POST /players/{playerId}`
- `GET /jobs`
- `GET /jobs/{jobId}`
- `POST /commands/enhance`
- `POST /kakao/channel/webhook`
- `POST /kakao/openbuilder/skill`
- `GET /delivery-logs`

## PowerShell 예시

플레이어 등록:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5088/players/sword-main `
  -ContentType "application/json; charset=utf-8" `
  -Body '{"userId":"demo-user","displayName":"은둔의 싹 검","currentLevel":1}'
```

강화 요청:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5088/commands/enhance `
  -ContentType "application/json; charset=utf-8" `
  -Body '{"userId":"demo-user","playerId":"sword-main","targetLevel":19,"requestedBy":"demo-user","source":"manual"}'
```

채널 webhook 흉내:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5088/kakao/channel/webhook `
  -ContentType "application/json; charset=utf-8" `
  -Body '{"userId":"demo-user","message":"강화 19"}'
```

오픈빌더 스타일 요청:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5088/kakao/openbuilder/skill `
  -ContentType "application/json; charset=utf-8" `
  -Body '{
    "action": {
      "id": "enhance-skill",
      "name": "enhance",
      "params": {
        "targetLevel": "19"
      },
      "detailParams": {
        "targetLevel": {
          "origin": "19",
          "value": "19",
          "groupName": ""
        }
      }
    },
    "intent": {
      "id": "intent-1",
      "name": "enhance"
    },
    "bot": {
      "id": "bot-1",
      "name": "enhance-bot"
    },
    "userRequest": {
      "utterance": "강화 19",
      "user": {
        "id": "demo-user",
        "type": "aiin",
        "properties": {
          "botUserKey": "demo-user"
        }
      }
    }
  }'
```

샘플 파일로 테스트:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\test-openbuilder.ps1 -Scenario register
powershell.exe -ExecutionPolicy Bypass -File .\test-openbuilder.ps1 -Scenario status
powershell.exe -ExecutionPolicy Bypass -File .\test-openbuilder.ps1 -Scenario enhance
```

## 다음 단계

- 메모리 저장소를 DB로 교체
- webhook 응답 포맷을 실제 카카오 채널 구조에 맞춤
- 메시지 발송 어댑터 추가
- 현재의 모의 강화 엔진을 실제 강화 도메인 로직으로 교체
