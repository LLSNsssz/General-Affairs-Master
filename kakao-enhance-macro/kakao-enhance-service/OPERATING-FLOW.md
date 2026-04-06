# Operating Flow

기준일: 2026-03-20

운영 기본값은 이제 `빈 저장소`입니다.
즉, 더 이상 데모 플레이어가 자동으로 들어오지 않습니다.

첫 사용자 기본 흐름:

1. `등록 실전검 3`
2. `상태`
3. `강화 7`
4. `상태`

## 왜 이렇게 바꿨는가

- 운영 환경에서는 데모 데이터가 섞이면 헷갈립니다.
- 사용자마다 자기 플레이어를 직접 등록하는 흐름이 더 명확합니다.
- OpenBuilder 테스트와 운영 플로우가 같아집니다.

## 초기화

저장소를 비우려면:

```cmd
C:\Users\GS002\Documents\codex\kakao-enhance-macro\kakao-enhance-service\reset-store.cmd
```

저장 파일:

- `C:\Users\GS002\Documents\codex\kakao-enhance-macro\kakao-enhance-service\bin\data\store.json`

## 일괄 흐름 테스트

등록부터 강화까지 한 번에 검증:

```powershell
powershell.exe -ExecutionPolicy Bypass -File C:\Users\GS002\Documents\codex\kakao-enhance-macro\kakao-enhance-service\test-openbuilder-flow.ps1
```

예상 출력:

- 등록 성공
- 등록 직후 상태
- 강화 접수
- 강화 후 상태

사용자/플레이어/목표를 바꾸고 싶으면:

```powershell
powershell.exe -ExecutionPolicy Bypass -File C:\Users\GS002\Documents\codex\kakao-enhance-macro\kakao-enhance-service\test-openbuilder-flow.ps1 `
  -UserId "my-user" `
  -PlayerName "내검" `
  -CurrentLevel 1 `
  -TargetLevel 5
```

## 관리자센터 테스트 권장 순서

1. 스킬 URL 연결
2. 테스트 창에서 `등록 내검 1`
3. `상태`
4. `강화 5`
5. `상태`

이 순서가 가장 덜 헷갈립니다.
