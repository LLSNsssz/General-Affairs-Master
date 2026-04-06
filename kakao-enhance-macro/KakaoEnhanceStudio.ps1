[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:BaseDir = Split-Path -Parent $PSCommandPath
$script:SettingsPath = Join-Path $script:BaseDir "studio-settings.json"
$script:WrapperPath = Join-Path $script:BaseDir "invoke-enhance-job.ps1"
$script:State = @{
  Process = $null
  StdOutPath = $null
  StdErrPath = $null
}

function Get-DefaultSettings {
  return [ordered]@{
    windowTitleKeyword = "깅화방"
    processNameKeyword = "KakaoTalk"
    commandText = "/강화"
    targetLevel = 19
    responseDelayMs = 2200
    countdownSeconds = 0
    captureMode = "window"
    sendMode = "background"
    restoreClipboard = $true
    regionLeft = 1200
    regionTop = 180
    regionWidth = 180
    regionHeight = 70
    inputClassHints = @("RichEdit50W", "RichEdit20W", "RichEdit20A", "Edit")
  }
}

function ConvertFrom-SettingsObject {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Object
  )

  $defaults = Get-DefaultSettings
  foreach ($key in @($defaults.Keys)) {
    $property = $Object.PSObject.Properties[$key]
    if ($null -eq $property -or $null -eq $property.Value) {
      continue
    }

    if ($key -eq "inputClassHints") {
      $defaults[$key] = @($property.Value)
    } else {
      $defaults[$key] = $property.Value
    }
  }

  return $defaults
}

function Load-Settings {
  if (-not (Test-Path -LiteralPath $script:SettingsPath)) {
    return Get-DefaultSettings
  }

  try {
    $raw = Get-Content -LiteralPath $script:SettingsPath -Raw -Encoding UTF8
    $json = $raw | ConvertFrom-Json
    return ConvertFrom-SettingsObject -Object $json
  } catch {
    return Get-DefaultSettings
  }
}

function Save-Settings {
  param(
    [Parameter(Mandatory = $true)]
    [System.Collections.IDictionary]$Settings
  )

  $json = $Settings | ConvertTo-Json -Depth 4
  Set-Content -LiteralPath $script:SettingsPath -Value $json -Encoding UTF8
}

function Get-ControlsValue {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Forms.Control]$Control
  )

  if ($Control -is [System.Windows.Forms.CheckBox]) {
    return [bool]$Control.Checked
  }

  return $Control.Text.Trim()
}

function Get-IntValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [Parameter(Mandatory = $true)]
    [int]$Fallback
  )

  $parsed = 0
  if ([int]::TryParse($Text, [ref]$parsed)) {
    return $parsed
  }

  return $Fallback
}

function Collect-SettingsFromForm {
  $inputHints = @()
  foreach ($piece in $script:Controls.InputClassHints.Text.Split(",")) {
    $trimmed = $piece.Trim()
    if ($trimmed) {
      $inputHints += $trimmed
    }
  }

  return [ordered]@{
    windowTitleKeyword = Get-ControlsValue $script:Controls.WindowTitle
    processNameKeyword = Get-ControlsValue $script:Controls.ProcessName
    commandText = $script:Controls.CommandText.Text
    targetLevel = Get-IntValue -Text $script:Controls.TargetLevel.Text -Fallback 25
    responseDelayMs = Get-IntValue -Text $script:Controls.ResponseDelay.Text -Fallback 2200
    countdownSeconds = Get-IntValue -Text $script:Controls.Countdown.Text -Fallback 0
    captureMode = $script:Controls.CaptureMode.Text
    sendMode = $script:Controls.SendMode.Text
    restoreClipboard = [bool]$script:Controls.RestoreClipboard.Checked
    regionLeft = Get-IntValue -Text $script:Controls.RegionLeft.Text -Fallback 1
    regionTop = Get-IntValue -Text $script:Controls.RegionTop.Text -Fallback 1
    regionWidth = Get-IntValue -Text $script:Controls.RegionWidth.Text -Fallback 1
    regionHeight = Get-IntValue -Text $script:Controls.RegionHeight.Text -Fallback 1
    inputClassHints = $inputHints
  }
}

function Set-Status {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $script:Controls.Status.Text = $Text
}

function Append-Log {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $stamp = Get-Date -Format "HH:mm:ss"
  $prefix = "[$stamp] "
  if ([string]::IsNullOrWhiteSpace($script:Controls.Log.Text)) {
    $script:Controls.Log.Text = $prefix + $Text
  } else {
    $script:Controls.Log.AppendText([Environment]::NewLine + [Environment]::NewLine + $prefix + $Text)
  }

  $script:Controls.Log.SelectionStart = $script:Controls.Log.TextLength
  $script:Controls.Log.ScrollToCaret()
}

function Set-ButtonsState {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Idle
  )

  $script:Controls.Run.Enabled = $Idle
  $script:Controls.Preview.Enabled = $Idle
  $script:Controls.ListWindows.Enabled = $Idle
  $script:Controls.ListChild.Enabled = $Idle
  $script:Controls.Stop.Enabled = -not $Idle
}

function Validate-SettingsForMode {
  param(
    [Parameter(Mandatory = $true)]
    [System.Collections.IDictionary]$Settings,
    [Parameter(Mandatory = $true)]
    [string]$Mode
  )

  if ($Mode -eq "run" -and -not $Settings.windowTitleKeyword -and -not $Settings.processNameKeyword) {
    Set-Status "채팅방 이름 또는 프로세스명을 입력하세요."
    return $false
  }

  if ($Settings.regionWidth -le 0 -or $Settings.regionHeight -le 0) {
    Set-Status "숫자 영역의 너비와 높이는 1 이상이어야 합니다."
    return $false
  }

  return $true
}

function Get-ModeLabel {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Mode
  )

  switch ($Mode) {
    "run" { return "자동강화" }
    "preview" { return "숫자 읽기 테스트" }
    "list-windows" { return "카톡창 찾기" }
    "list-child" { return "입력창 찾기" }
    default { return $Mode }
  }
}

function Invoke-UiAction {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  try {
    & $Action
  } catch {
    Append-Log ("오류 발생`r`n" + $_.Exception.Message)
    Set-Status "오류 발생"
  }
}

function Start-BackendMode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Mode
  )

  if ($script:State.Process -and -not $script:State.Process.HasExited) {
    Set-Status "이미 실행 중인 작업이 있습니다."
    return
  }

  $settings = Collect-SettingsFromForm
  if (-not (Validate-SettingsForMode -Settings $settings -Mode $Mode)) {
    return
  }

  Save-Settings -Settings $settings

  $script:State.StdOutPath = Join-Path $env:TEMP ("kakao-enhance-stdout-{0}.log" -f ([guid]::NewGuid().ToString("N")))
  $script:State.StdErrPath = Join-Path $env:TEMP ("kakao-enhance-stderr-{0}.log" -f ([guid]::NewGuid().ToString("N")))

  $arguments = @(
    "-NoProfile",
    "-STA",
    "-ExecutionPolicy", "Bypass",
    "-File", $script:WrapperPath,
    "-Mode", $Mode,
    "-ConfigPath", $script:SettingsPath
  )

  try {
    $script:State.Process = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -RedirectStandardOutput $script:State.StdOutPath -RedirectStandardError $script:State.StdErrPath -WindowStyle Hidden -PassThru
  } catch {
    Append-Log ("실행 시작 실패`r`n" + $_.Exception.Message)
    Set-Status "시작 실패"
    return
  }

  $script:Timer.Start()
  Set-ButtonsState -Idle $false
  Set-Status ((Get-ModeLabel -Mode $Mode) + " 실행 중...")
  Append-Log ((Get-ModeLabel -Mode $Mode) + " 시작")
}

function Finish-Backend {
  $script:Timer.Stop()

  $output = @()
  foreach ($path in @($script:State.StdOutPath, $script:State.StdErrPath)) {
    if ($path -and (Test-Path -LiteralPath $path)) {
      $output += Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    }
  }

  $combined = ($output -join [Environment]::NewLine).Trim()
  if (-not $combined) {
    $combined = "(no output)"
  }

  Append-Log $combined
  Set-Status "완료"
  Set-ButtonsState -Idle $true
  $script:State.Process = $null
  $script:State.StdOutPath = $null
  $script:State.StdErrPath = $null
}

function Stop-Backend {
  if (-not $script:State.Process) {
    Set-Status "현재 실행 중인 작업이 없습니다."
    return
  }

  try {
    Stop-Process -Id $script:State.Process.Id -Force -ErrorAction Stop
    Append-Log "실행 중인 작업을 중지했습니다."
  } catch {
    Append-Log ("중지 실패`r`n" + $_.Exception.Message)
  }

  Finish-Backend
}

function Set-TopLeftFromCursor {
  $point = [System.Windows.Forms.Cursor]::Position
  $script:Controls.RegionLeft.Text = [string]$point.X
  $script:Controls.RegionTop.Text = [string]$point.Y
  Set-Status "현재 마우스 위치를 왼쪽 위로 저장했습니다."
}

function Set-SizeFromCursor {
  $point = [System.Windows.Forms.Cursor]::Position
  $left = Get-IntValue -Text $script:Controls.RegionLeft.Text -Fallback 0
  $top = Get-IntValue -Text $script:Controls.RegionTop.Text -Fallback 0
  $width = $point.X - $left
  $height = $point.Y - $top

  if ($width -le 0 -or $height -le 0) {
    Set-Status "마우스를 저장한 왼쪽 위보다 더 오른쪽 아래로 옮긴 뒤 다시 누르세요."
    return
  }

  $script:Controls.RegionWidth.Text = [string]$width
  $script:Controls.RegionHeight.Text = [string]$height
  Set-Status "현재 마우스 위치로 너비와 높이를 계산했습니다."
}

function New-Label {
  param(
    [string]$Text,
    [int]$X,
    [int]$Y,
    [int]$Width = 90
  )

  $label = New-Object System.Windows.Forms.Label
  $label.Text = $Text
  $label.Location = New-Object System.Drawing.Point($X, $Y)
  $label.Size = New-Object System.Drawing.Size($Width, 22)
  return $label
}

function New-TextBox {
  param(
    [string]$Text,
    [int]$X,
    [int]$Y,
    [int]$Width
  )

  $box = New-Object System.Windows.Forms.TextBox
  $box.Text = $Text
  $box.Location = New-Object System.Drawing.Point($X, $Y)
  $box.Size = New-Object System.Drawing.Size($Width, 26)
  return $box
}

function New-Button {
  param(
    [string]$Text,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height = 30
  )

  $button = New-Object System.Windows.Forms.Button
  $button.Text = $Text
  $button.Location = New-Object System.Drawing.Point($X, $Y)
  $button.Size = New-Object System.Drawing.Size($Width, $Height)
  return $button
}

$settings = Load-Settings

$form = New-Object System.Windows.Forms.Form
$form.Text = "카카오 자동강화"
$form.StartPosition = "CenterScreen"
$form.Size = New-Object System.Drawing.Size(760, 720)
$form.MinimumSize = New-Object System.Drawing.Size(760, 720)
$form.BackColor = [System.Drawing.ColorTranslator]::FromHtml("#F4E4BE")
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)

$title = New-Object System.Windows.Forms.Label
$title.Text = "카카오 자동강화"
$title.Font = New-Object System.Drawing.Font("Segoe UI Semibold", 15)
$title.Location = New-Object System.Drawing.Point(18, 14)
$title.Size = New-Object System.Drawing.Size(520, 32)
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "순서: 1) 채팅방 이름 확인  2) 숫자영역 왼쪽 위 저장  3) 숫자영역 오른쪽 아래 저장  4) 숫자 읽기 테스트  5) 자동강화 시작"
$subtitle.ForeColor = [System.Drawing.ColorTranslator]::FromHtml("#5E4A2F")
$subtitle.Location = New-Object System.Drawing.Point(18, 48)
$subtitle.Size = New-Object System.Drawing.Size(710, 36)
$form.Controls.Add($subtitle)

$script:Controls = @{}

$form.Controls.Add((New-Label -Text "채팅방 이름" -X 18 -Y 90))
$script:Controls.WindowTitle = New-TextBox -Text ([string]$settings.windowTitleKeyword) -X 118 -Y 86 -Width 170
$form.Controls.Add($script:Controls.WindowTitle)
$form.Controls.Add((New-Label -Text "프로세스명" -X 308 -Y 90))
$script:Controls.ProcessName = New-TextBox -Text ([string]$settings.processNameKeyword) -X 406 -Y 86 -Width 120
$form.Controls.Add($script:Controls.ProcessName)
$form.Controls.Add((New-Label -Text "강화 명령" -X 544 -Y 90 -Width 70))
$script:Controls.CommandText = New-TextBox -Text ([string]$settings.commandText) -X 612 -Y 86 -Width 100
$form.Controls.Add($script:Controls.CommandText)

$form.Controls.Add((New-Label -Text "목표 강화" -X 18 -Y 126))
$script:Controls.TargetLevel = New-TextBox -Text ([string]$settings.targetLevel) -X 118 -Y 122 -Width 70
$form.Controls.Add($script:Controls.TargetLevel)
$form.Controls.Add((New-Label -Text "응답 대기" -X 206 -Y 126))
$script:Controls.ResponseDelay = New-TextBox -Text ([string]$settings.responseDelayMs) -X 304 -Y 122 -Width 70
$form.Controls.Add($script:Controls.ResponseDelay)
$form.Controls.Add((New-Label -Text "시작 대기" -X 392 -Y 126))
$script:Controls.Countdown = New-TextBox -Text ([string]$settings.countdownSeconds) -X 472 -Y 122 -Width 60
$form.Controls.Add($script:Controls.Countdown)

$form.Controls.Add((New-Label -Text "읽기 방식" -X 18 -Y 162))
$script:Controls.CaptureMode = New-Object System.Windows.Forms.ComboBox
$script:Controls.CaptureMode.Location = New-Object System.Drawing.Point(118, 158)
$script:Controls.CaptureMode.Size = New-Object System.Drawing.Size(110, 26)
$script:Controls.CaptureMode.DropDownStyle = "DropDownList"
[void]$script:Controls.CaptureMode.Items.AddRange(@("window", "auto", "screen"))
$script:Controls.CaptureMode.SelectedItem = [string]$settings.captureMode
$form.Controls.Add($script:Controls.CaptureMode)

$form.Controls.Add((New-Label -Text "입력 방식" -X 248 -Y 162))
$script:Controls.SendMode = New-Object System.Windows.Forms.ComboBox
$script:Controls.SendMode.Location = New-Object System.Drawing.Point(326, 158)
$script:Controls.SendMode.Size = New-Object System.Drawing.Size(120, 26)
$script:Controls.SendMode.DropDownStyle = "DropDownList"
[void]$script:Controls.SendMode.Items.AddRange(@("background", "auto", "foreground"))
$script:Controls.SendMode.SelectedItem = [string]$settings.sendMode
$form.Controls.Add($script:Controls.SendMode)

$script:Controls.RestoreClipboard = New-Object System.Windows.Forms.CheckBox
$script:Controls.RestoreClipboard.Text = "클립보드 복구"
$script:Controls.RestoreClipboard.Location = New-Object System.Drawing.Point(470, 160)
$script:Controls.RestoreClipboard.Size = New-Object System.Drawing.Size(160, 24)
$script:Controls.RestoreClipboard.Checked = [bool]$settings.restoreClipboard
$form.Controls.Add($script:Controls.RestoreClipboard)

$form.Controls.Add((New-Label -Text "숫자영역 X" -X 18 -Y 200))
$script:Controls.RegionLeft = New-TextBox -Text ([string]$settings.regionLeft) -X 118 -Y 196 -Width 70
$form.Controls.Add($script:Controls.RegionLeft)
$form.Controls.Add((New-Label -Text "Y" -X 206 -Y 200 -Width 40))
$script:Controls.RegionTop = New-TextBox -Text ([string]$settings.regionTop) -X 246 -Y 196 -Width 70
$form.Controls.Add($script:Controls.RegionTop)
$form.Controls.Add((New-Label -Text "너비" -X 334 -Y 200 -Width 50))
$script:Controls.RegionWidth = New-TextBox -Text ([string]$settings.regionWidth) -X 384 -Y 196 -Width 70
$form.Controls.Add($script:Controls.RegionWidth)
$form.Controls.Add((New-Label -Text "높이" -X 472 -Y 200 -Width 50))
$script:Controls.RegionHeight = New-TextBox -Text ([string]$settings.regionHeight) -X 524 -Y 196 -Width 70
$form.Controls.Add($script:Controls.RegionHeight)

$script:Controls.PickTopLeft = New-Button -Text "1) 왼쪽 위 저장" -X 18 -Y 236 -Width 130
$script:Controls.PickBottomRight = New-Button -Text "2) 오른쪽 아래 저장" -X 158 -Y 236 -Width 145
$script:Controls.Save = New-Button -Text "저장" -X 313 -Y 236 -Width 60
$script:Controls.Preview = New-Button -Text "3) 숫자 읽기 테스트" -X 383 -Y 236 -Width 130
$script:Controls.ListWindows = New-Button -Text "카톡창 찾기" -X 523 -Y 236 -Width 90
$script:Controls.ListChild = New-Button -Text "입력창 찾기" -X 623 -Y 236 -Width 90
$form.Controls.AddRange(@(
  $script:Controls.PickTopLeft,
  $script:Controls.PickBottomRight,
  $script:Controls.Save,
  $script:Controls.Preview,
  $script:Controls.ListWindows,
  $script:Controls.ListChild
))

$form.Controls.Add((New-Label -Text "고급 설정" -X 18 -Y 278))
$script:Controls.InputClassHints = New-TextBox -Text (($settings.inputClassHints -join ", ")) -X 118 -Y 274 -Width 594
$form.Controls.Add($script:Controls.InputClassHints)

$advancedHint = New-Object System.Windows.Forms.Label
$advancedHint.Text = "보통은 안 바꿔도 됩니다. 입력이 안 될 때만 수정하세요."
$advancedHint.ForeColor = [System.Drawing.ColorTranslator]::FromHtml("#5E4A2F")
$advancedHint.Location = New-Object System.Drawing.Point(118, 302)
$advancedHint.Size = New-Object System.Drawing.Size(594, 18)
$form.Controls.Add($advancedHint)

$script:Controls.Run = New-Button -Text "4) 자동강화 시작" -X 18 -Y 326 -Width 170 -Height 34
$script:Controls.Stop = New-Button -Text "정지" -X 198 -Y 326 -Width 90 -Height 34
$script:Controls.Stop.Enabled = $false
$script:Controls.Status = New-Object System.Windows.Forms.Label
$script:Controls.Status.Text = "대기 중"
$script:Controls.Status.ForeColor = [System.Drawing.ColorTranslator]::FromHtml("#5E4A2F")
$script:Controls.Status.Location = New-Object System.Drawing.Point(306, 333)
$script:Controls.Status.Size = New-Object System.Drawing.Size(426, 24)
$form.Controls.AddRange(@(
  $script:Controls.Run,
  $script:Controls.Stop,
  $script:Controls.Status
))

$outputTitle = New-Object System.Windows.Forms.Label
$outputTitle.Text = "실행 로그"
$outputTitle.Font = New-Object System.Drawing.Font("Segoe UI Semibold", 10)
$outputTitle.Location = New-Object System.Drawing.Point(18, 378)
$outputTitle.Size = New-Object System.Drawing.Size(100, 22)
$form.Controls.Add($outputTitle)

$script:Controls.Log = New-Object System.Windows.Forms.TextBox
$script:Controls.Log.Location = New-Object System.Drawing.Point(18, 404)
$script:Controls.Log.Multiline = $true
$script:Controls.Log.ReadOnly = $true
$script:Controls.Log.ScrollBars = "Vertical"
$script:Controls.Log.Size = New-Object System.Drawing.Size(694, 270)
$script:Controls.Log.BackColor = [System.Drawing.Color]::White
$form.Controls.Add($script:Controls.Log)

$script:Controls.Save.Add_Click({
  Invoke-UiAction {
    $settings = Collect-SettingsFromForm
    Save-Settings -Settings $settings
    Set-Status "설정을 저장했습니다."
  }
})

$script:Controls.Preview.Add_Click({ Invoke-UiAction { Start-BackendMode -Mode "preview" } })
$script:Controls.ListWindows.Add_Click({ Invoke-UiAction { Start-BackendMode -Mode "list-windows" } })
$script:Controls.ListChild.Add_Click({ Invoke-UiAction { Start-BackendMode -Mode "list-child" } })
$script:Controls.Run.Add_Click({ Invoke-UiAction { Start-BackendMode -Mode "run" } })
$script:Controls.Stop.Add_Click({ Invoke-UiAction { Stop-Backend } })
$script:Controls.PickTopLeft.Add_Click({ Invoke-UiAction { Set-TopLeftFromCursor } })
$script:Controls.PickBottomRight.Add_Click({ Invoke-UiAction { Set-SizeFromCursor } })

$script:Timer = New-Object System.Windows.Forms.Timer
$script:Timer.Interval = 350
$script:Timer.Add_Tick({
  if ($script:State.Process -and $script:State.Process.HasExited) {
    Finish-Backend
  }
})

$form.Add_FormClosing({
  if ($script:State.Process -and -not $script:State.Process.HasExited) {
    try {
      Stop-Process -Id $script:State.Process.Id -Force -ErrorAction SilentlyContinue
    } catch {
    }
  }
})

Append-Log "준비 완료. 1) 카톡창 찾기  2) 왼쪽 위 저장  3) 오른쪽 아래 저장  4) 숫자 읽기 테스트  5) 자동강화 시작"
[void]$form.ShowDialog()
