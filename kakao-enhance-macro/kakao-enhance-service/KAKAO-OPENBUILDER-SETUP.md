# Kakao OpenBuilder Setup

기준일: 2026-03-20

현재 공개 스킬 URL:

- `https://degrees-united-sunday-tools.trycloudflare.com/kakao/openbuilder/skill`

주의:

- 위 주소는 `quick tunnel`이라 임시 주소입니다.
- 터널을 다시 열면 주소가 바뀔 수 있습니다.
- 바뀌면 챗봇 관리자센터의 Skill URL도 같이 수정해야 합니다.

## 1. 챗봇 관리자센터에서 스킬 만들기

1. 챗봇 관리자센터에 로그인
2. 대상 봇 선택
3. `스킬` 탭 이동
4. `생성` 클릭
5. 아래처럼 입력

권장값:

- 스킬명: `enhance-skill`
- URL: `https://degrees-united-sunday-tools.trycloudflare.com/kakao/openbuilder/skill`
- Test URL: `https://degrees-united-sunday-tools.trycloudflare.com/kakao/openbuilder/skill`

저장 후:

- `스킬서버로 전송`으로 응답 확인

## 2. 가장 단순한 연결 방식

처음에는 블록을 여러 개 쪼개지 말고, 한 개 스킬 블록으로 몰아서 테스트하는 게 안전합니다.

권장 블록:

- 블록명: `강화 메인`
- 연결 스킬: `enhance-skill`

이 블록에 넣을 발화 예시:

- `등록 검 1`
- `상태`
- `강화 5`
- `강화 19`
- `도움말`

## 3. 현재 서버가 이해하는 명령

등록:

```text
등록 {이름} {현재레벨}
```

예:

```text
등록 실전검 3
```

상태:

```text
상태
```

강화:

```text
강화 {목표레벨}
```

예:

```text
강화 19
```

## 4. 응답 형식

현재 서버는 오픈빌더에서 바로 쓸 수 있는 아래 형식으로 응답합니다.

- `version: "2.0"`
- `template.outputs[0].simpleText.text`
- `template.quickReplies`

즉, 별도 템플릿 가공 없이 스킬 응답을 바로 보여주는 구조입니다.

## 5. 빠른 테스트 순서

1. 챗봇 관리자센터에서 스킬 생성
2. URL/Test URL에 현재 스킬 URL 입력
3. `강화 메인` 블록 생성
4. 발화 예시 추가
5. 관리자센터 테스트 창에서 아래 순서로 입력

```text
등록 실전검 3
상태
강화 7
상태
```

예상:

- 등록 성공 문구
- 현재 강화 수치 안내
- 강화 요청 접수 문구
- 이후 상태 조회 시 올라간 수치 확인

## 6. 지금 바로 브라우저/PowerShell로 확인하는 주소

로컬 UI:

- `http://localhost:5088/app/`

로컬 health:

- `http://localhost:5088/health`

공개 health:

- `https://degrees-united-sunday-tools.trycloudflare.com/health`

공개 skill:

- `https://degrees-united-sunday-tools.trycloudflare.com/kakao/openbuilder/skill`

## 7. 주소가 바뀌었는지 확인하는 파일

터널 현재 주소:

- `C:\Users\GS002\Documents\codex\kakao-enhance-macro\kakao-enhance-service\bin\cloudflared-url.txt`

## 8. 터널 다시 열기 / 끄기

시작:

```cmd
C:\Users\GS002\Documents\codex\kakao-enhance-macro\kakao-enhance-service\start-tunnel.cmd
```

중지:

```cmd
C:\Users\GS002\Documents\codex\kakao-enhance-macro\kakao-enhance-service\stop-tunnel.cmd
```
