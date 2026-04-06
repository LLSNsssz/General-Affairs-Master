# Kakao Enhance Macro

카카오톡 채팅방에서 지정한 명령어를 반복 입력하고, 화면의 지정 영역을 OCR로 읽어서 목표 강화 수치에 도달하면 멈추는 매크로입니다.

기본 진입점은 `C# WinForms` GUI이고, 실제 OCR/배경 전송은 내부 `PowerShell` 백엔드가 처리합니다.

## 파일

- `KakaoEnhanceStudio.cs`: `C# WinForms` GUI 소스
- `KakaoEnhanceStudio.exe`: 실행 시 자동 빌드되는 GUI
- `start-gui.cmd`: GUI 실행용 진입점
- `invoke-enhance-job.ps1`: GUI가 호출하는 래퍼
- `run-enhance-macro.ps1`: 실제 자동 입력 백엔드
- `show-cursor-position.ps1`: OCR 영역 좌표 확인용 보조 스크립트

## 권장 사용

1. `start-gui.cmd`를 실행합니다.
3. GUI에서 설정을 저장하고 `Run Hidden`, `Preview OCR`, `List Windows`, `List Child`를 사용합니다.

좌표는 버튼을 누른 뒤 마우스를 옮기는 방식이 아니라, `화면에서 숫자영역 드래그 선택`으로 잡습니다.
`PowerShell` 콘솔에 긴 멀티라인 명령을 직접 치는 방식은 `PSReadLine` 문제를 만들 수 있어서 권장하지 않습니다.

## 전제

- Windows `PowerShell`에서 실행해야 합니다.
- `powershell.exe -STA`로 실행해야 합니다.
- 카카오톡 PC 창 제목에 구분 가능한 키워드가 있어야 합니다.
  - 가장 안정적인 값은 채팅방 이름 일부입니다.
- 시작 전에 채팅방 입력창에 커서를 한 번 찍어 둬야 합니다.

## 좌표 잡는 방법

1. 카카오톡에서 현재 강화 수치가 표시되는 영역을 화면에 띄웁니다.
2. `show-cursor-position.ps1`를 실행합니다.
3. 숫자 표시 영역의 좌상단 좌표를 기록합니다.
4. 숫자 표시 영역의 우하단 좌표를 기록합니다.
5. `width = 우하단X - 좌상단X`, `height = 우하단Y - 좌상단Y`로 계산합니다.

예시:

```powershell
powershell.exe -STA -ExecutionPolicy Bypass -File .\show-cursor-position.ps1
```

## GUI 실행

```cmd
start-gui.cmd
```

GUI 안에서 다음 순서로 사용합니다.

1. `카톡창 찾기`
2. `화면에서 숫자영역 드래그 선택`
3. `숫자 읽기 테스트`
4. `자동강화 시작`

봇 명령어(`/강화` 같은 슬래시 명령)는 보통 `읽기 방식 = screen`, `입력 방식 = foreground`가 가장 안정적입니다.

## OCR 먼저 확인

자동 입력 전에 OCR이 제대로 읽히는지 한 번 확인하는 편이 좋습니다.

```powershell
powershell.exe -STA -ExecutionPolicy Bypass -File .\run-enhance-macro.ps1 `
  -WindowTitleKeyword "깅화방" `
  -RegionLeft 1200 `
  -RegionTop 180 `
  -RegionWidth 180 `
  -RegionHeight 70 `
  -CaptureMode screen `
  -PreviewOnly
```

출력 로그에 `감지 레벨`과 `OCR` 문자열이 보입니다. 숫자가 안 잡히면 영역을 더 좁히거나 넓히고 다시 확인합니다.

## 실제 실행

```powershell
powershell.exe -STA -ExecutionPolicy Bypass -File .\run-enhance-macro.ps1 `
  -WindowTitleKeyword "깅화방" `
  -CommandText "/강화" `
  -TargetLevel 25 `
  -RegionLeft 1200 `
  -RegionTop 180 `
  -RegionWidth 180 `
  -RegionHeight 70 `
  -CaptureMode screen `
  -SendMode foreground `
  -ResponseDelayMs 2200 `
  -MaxAttempts 800 `
  -RestoreClipboard
```

## 주요 옵션

- `WindowTitleKeyword`: 활성화할 창 제목 키워드
- `ProcessNameKeyword`: 제목 매칭이 실패할 때 사용할 프로세스명 키워드
- `CommandText`: 반복 입력할 명령어
- `TargetLevel`: 도달 시 멈출 목표 강화 수치
- `RegionLeft`, `RegionTop`, `RegionWidth`, `RegionHeight`: OCR로 읽을 화면 영역
- `ResponseDelayMs`: 명령 입력 후 응답을 기다리는 시간
- `MaxAttempts`: 최대 시도 횟수
- `MaxMisses`: OCR이 연속 실패할 때 중단하기까지의 횟수
- `CaptureMode`: `screen`은 현재 보이는 화면을 읽고, `window`는 가려진 창을 `PrintWindow`로 읽으려고 시도합니다.
- `SendMode`: `foreground`는 실제 키 입력이라 `/강화` 같은 봇 명령에 더 안정적이고, `background`는 일반 텍스트 전송용에 가깝습니다.
- `ListChildWindows`: 대상 창의 자식 컨트롤 클래스를 출력하고 종료
- `ListWindows`: 현재 보이는 최상위 창의 프로세스명과 제목을 출력하고 종료
- `PreviewOnly`: OCR만 1회 확인
- `RestoreClipboard`: 실행 전 클립보드 내용을 종료 시 복구

## 조정 팁

- OCR 영역은 현재 강화 수치만 보이도록 최대한 좁게 잡는 편이 안정적입니다.
- 창 제목 키워드는 `카카오톡`보다 채팅방 이름 일부를 쓰는 편이 정확합니다.
- 제목이 안 잡히면 `-ListWindows`로 실제 창 제목과 프로세스명을 먼저 확인하세요.
- 응답이 느리면 `ResponseDelayMs`를 2000 이상으로 늘리세요.
- OCR이 다른 숫자를 잡으면 영역을 다시 잡아야 합니다.
- 슬래시 봇 명령이 plain text처럼 들어가면 `-SendMode foreground`로 바꾸고, 숫자 감지가 비면 `-CaptureMode screen`으로 먼저 확인하세요.
- 창이 가려진 상태로 돌리려면 `-CaptureMode window -SendMode background` 조합을 따로 시도할 수 있지만, 봇 명령 인식률은 떨어질 수 있습니다.
- 배경 전송이 안 되면 아래처럼 자식 컨트롤 클래스를 확인한 뒤 `InputClassHints`를 조정해야 할 수 있습니다.

```powershell
powershell.exe -STA -ExecutionPolicy Bypass -File .\run-enhance-macro.ps1 `
  -RegionLeft 1200 `
  -RegionTop 180 `
  -RegionWidth 180 `
  -RegionHeight 70 `
  -ListWindows
```

```powershell
powershell.exe -STA -ExecutionPolicy Bypass -File .\run-enhance-macro.ps1 `
  -WindowTitleKeyword "깅화방" `
  -RegionLeft 1200 `
  -RegionTop 180 `
  -RegionWidth 180 `
  -RegionHeight 70 `
  -ListChildWindows
```
