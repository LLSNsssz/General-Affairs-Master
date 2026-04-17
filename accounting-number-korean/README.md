# 회계 숫자 한글 변환기

`C:\Users\GS002\Documents\codex\accounting-number-korean`

정수 금액을 입력하면 아래 3가지를 바로 만들어 주는 Windows 프로그램입니다.

- 일반 표기: `백이십삼만사천오백육십칠원`
- 회계 표기: `일백이십삼만사천오백육십칠원`
- 일금 표기: `일금 일백이십삼만사천오백육십칠원정`

## 실행

### 바로 실행

```cmd
C:\Users\GS002\Documents\codex\accounting-number-korean\run.cmd
```

### 전역 단축키 실행

```cmd
C:\Users\GS002\Documents\codex\accounting-number-korean\run-hotkey.cmd
```

핫키 앱이 실행되면 트레이에 상주합니다.

- `Ctrl + Alt + H`
  선택한 숫자를 회계 한글 금액으로 바로 치환

예:

- `1234567` 선택 후 `Ctrl + Alt + H`
- 결과: `일백이십삼만사천오백육십칠원`

### 수동 빌드

```cmd
C:\Users\GS002\Documents\codex\accounting-number-korean\build.cmd
```

빌드 결과:

`C:\Users\GS002\Documents\codex\accounting-number-korean\bin\AccountingNumberKorean.exe`

`C:\Users\GS002\Documents\codex\accounting-number-korean\bin\AccountingNumberHotkey.exe`

## 입력 예시

- `1234567`
- `1,234,567`
- `1234567원`

## 메모

- 정수만 지원합니다.
- 음수도 변환은 가능하지만, 일반적인 회계 문서 용도는 정수 양수 기준입니다.
- 핫키 앱은 현재 선택 영역을 `Ctrl+C`로 읽고 `Ctrl+V`로 치환합니다.
