# OpenBuilder Split Blocks

기준일: 2026-03-20

이 문서는 `등록 / 상태 / 강화`를 각각 별도 블록으로 나눠서 운영할 때의 권장 설계안입니다.

## 권장 블록 구성

### 1. 등록 블록

- 블록명: `플레이어 등록`
- 연결 스킬: `enhance-skill`
- action.name 권장값: `register`

권장 파라미터:

- `playerName`
- `currentLevel`

테스트 발화:

- `등록`
- `플레이어 등록`
- `무기 등록`

## 2. 상태 블록

- 블록명: `현재 상태`
- 연결 스킬: `enhance-skill`
- action.name 권장값: `status`

선택 파라미터:

- `playerId`

테스트 발화:

- `상태`
- `현재 상태`
- `내 무기 상태`

## 3. 강화 블록

- 블록명: `강화 실행`
- 연결 스킬: `enhance-skill`
- action.name 권장값: `enhance`

권장 파라미터:

- `targetLevel`
- 선택: `playerId`

테스트 발화:

- `강화`
- `강화 실행`
- `목표 강화`

## 현재 서버가 읽는 action 기반 규칙

등록:

- `action.name = register`
- `params.playerName`
- `params.currentLevel`

상태:

- `action.name = status`
- 선택: `params.playerId`

강화:

- `action.name = enhance`
- `params.targetLevel`
- 선택: `params.playerId`

## 실전 권장

초기 운영은 이렇게 가는 게 가장 안전합니다.

1. 등록 블록
2. 상태 블록
3. 강화 블록
4. fallback 블록

즉, 사용자는:

1. 등록 블록에서 플레이어 이름과 현재 레벨 입력
2. 상태 블록에서 현재 값 확인
3. 강화 블록에서 목표값 입력

## 주의

- 등록 전에 상태/강화 블록을 호출하면 당연히 플레이어가 없다고 응답합니다.
- 테스트는 반드시 `등록 -> 상태 -> 강화 -> 상태` 순서로 해야 합니다.
- 분리 블록 테스트를 병렬로 보내면 안 됩니다.
