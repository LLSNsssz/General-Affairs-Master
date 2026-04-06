[CmdletBinding()]
param(
  [string]$WindowTitleKeyword = ([string]::Concat([char]0xAE45, [char]0xD654, [char]0xBC29)),
  [string]$ProcessNameKeyword = "KakaoTalk",
  [string]$CommandText = "/강화",
  [int]$TargetLevel = -1,
  [Parameter(Mandatory = $true)]
  [ValidateRange(0, 32767)]
  [int]$RegionLeft,
  [Parameter(Mandatory = $true)]
  [ValidateRange(0, 32767)]
  [int]$RegionTop,
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 32767)]
  [int]$RegionWidth,
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 32767)]
  [int]$RegionHeight,
  [ValidateRange(0, 60)]
  [int]$CountdownSeconds = 5,
  [ValidateRange(100, 10000)]
  [int]$FocusDelayMs = 250,
  [ValidateRange(100, 30000)]
  [int]$ResponseDelayMs = 1800,
  [ValidateRange(0, 10000)]
  [int]$LoopDelayMs = 250,
  [ValidateRange(1, 100000)]
  [int]$MaxAttempts = 500,
  [ValidateRange(1, 1000)]
  [int]$MaxMisses = 8,
  [ValidateSet("auto", "screen", "window")]
  [string]$CaptureMode = "screen",
  [ValidateSet("auto", "foreground", "background")]
  [string]$SendMode = "foreground",
  [ValidateSet("full-paste", "slash-key")]
  [string]$CommandInputMode = "full-paste",
  [ValidateRange(0, 5000)]
  [int]$RandomDelayMs = 250,
  [switch]$AutoChatScan,
  [switch]$GhostForeground,
  [ValidateRange(1, 255)]
  [int]$GhostAlpha = 1,
  [switch]$SendOnly,
  [string[]]$InputClassHints = @("RichEdit50W", "RichEdit20W", "RichEdit20A", "Edit"),
  [switch]$PreviewOnly,
  [switch]$RestoreClipboard,
  [switch]$ListChildWindows,
  [switch]$ListWindows
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ScriptVersion = "2026-03-20 16:00"

function Get-ScriptValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $variable = Get-Variable -Scope Script -Name $Name -ErrorAction SilentlyContinue
  if ($null -eq $variable) {
    return $null
  }

  return $variable.Value
}

if (-not $SendOnly -and -not $PreviewOnly -and -not $ListChildWindows -and -not $ListWindows -and $TargetLevel -lt 0) {
  throw "실행 모드에서는 목표 강화 수치를 입력해야 합니다."
}

if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne [System.Threading.ApartmentState]::STA) {
  throw "이 스크립트는 STA 모드가 필요합니다. powershell.exe -STA -ExecutionPolicy Bypass -File run-enhance-macro.ps1 형태로 실행하세요."
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class KakaoMacroWin32
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

    public class ChildWindowInfo
    {
        public IntPtr Handle { get; set; }
        public string ClassName { get; set; }
    }

    public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);

    public const uint WM_SETTEXT = 0x000C;
    public const uint WM_SETFOCUS = 0x0007;
    public const uint WM_MOUSEMOVE = 0x0200;
    public const uint WM_LBUTTONDOWN = 0x0201;
    public const uint WM_LBUTTONUP = 0x0202;
    public const uint MK_LBUTTON = 0x0001;
    public const uint WM_KEYDOWN = 0x0100;
    public const uint WM_KEYUP = 0x0101;
    public const uint WM_CHAR = 0x0102;
    public const uint EM_REPLACESEL = 0x00C2;
    public const int VK_RETURN = 0x0D;
    public const int VK_OEM_2 = 0xBF;
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_LAYERED = 0x00080000;
    public const uint LWA_ALPHA = 0x00000002;

    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWndParent, EnumChildProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", EntryPoint = "GetWindowLong")]
    private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr")]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "SetWindowLong")]
    private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll")]
    public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

    [DllImport("user32.dll")]
    public static extern bool GetLayeredWindowAttributes(IntPtr hwnd, out uint crKey, out byte bAlpha, out uint dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, string lParam);

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern IntPtr SetFocus(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr SetActiveWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    public static IntPtr GetWindowLongPtrSafe(IntPtr hWnd, int nIndex)
    {
        if (IntPtr.Size == 8)
        {
            return GetWindowLongPtr64(hWnd, nIndex);
        }

        return new IntPtr(GetWindowLong32(hWnd, nIndex));
    }

    public static IntPtr SetWindowLongPtrSafe(IntPtr hWnd, int nIndex, IntPtr dwNewLong)
    {
        if (IntPtr.Size == 8)
        {
            return SetWindowLongPtr64(hWnd, nIndex, dwNewLong);
        }

        return new IntPtr(SetWindowLong32(hWnd, nIndex, dwNewLong.ToInt32()));
    }

    public static List<ChildWindowInfo> GetChildWindows(IntPtr parent)
    {
        var result = new List<ChildWindowInfo>();
        EnumChildWindows(parent, (hwnd, lparam) =>
        {
            var builder = new StringBuilder(256);
            GetClassName(hwnd, builder, builder.Capacity);
            result.Add(new ChildWindowInfo
            {
                Handle = hwnd,
                ClassName = builder.ToString()
            });
            return true;
        }, IntPtr.Zero);
        return result;
    }
}
"@

function Initialize-WinRtOcr {
  $existingEngine = Get-ScriptValue -Name "OcrEngine"
  $existingAsTaskMethod = Get-ScriptValue -Name "AsTaskMethod"
  if ($null -ne $existingEngine -and $null -ne $existingAsTaskMethod) {
    return [pscustomobject]@{
      OcrEngine    = $existingEngine
      AsTaskMethod = $existingAsTaskMethod
    }
  }

  try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
    $null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]
  } catch {
    throw "Windows OCR 기능을 불러오지 못했습니다. Windows PowerShell에서 실행해 주세요. $($_.Exception.Message)"
  }

  $asTaskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq "AsTask" -and
      $_.IsGenericMethodDefinition -and
      $_.GetParameters().Count -eq 1
    } |
    Select-Object -First 1

  if (-not $asTaskMethod) {
    throw "WinRT 비동기 변환 도우미를 찾지 못했습니다."
  }

  $ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if (-not $ocrEngine) {
    throw "OCR 엔진을 초기화하지 못했습니다. Windows 언어 팩에 OCR 기능이 있는지 확인하세요."
  }

  Set-Variable -Scope Script -Name AsTaskMethod -Value $asTaskMethod
  Set-Variable -Scope Script -Name OcrEngine -Value $ocrEngine

  return [pscustomobject]@{
    OcrEngine    = $ocrEngine
    AsTaskMethod = $asTaskMethod
  }
}

function Await-WinRt {
  param(
    [Parameter(Mandatory = $true)]
    [object]$AsyncOperation,
    [Parameter(Mandatory = $true)]
    [Type]$ResultType,
    [Parameter(Mandatory = $true)]
    [System.Reflection.MethodInfo]$AsTaskMethod
  )

  $task = $AsTaskMethod.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOperation))
  return $task.GetAwaiter().GetResult()
}

function Get-TargetProcess {
  param(
    [string]$Keyword,
    [Parameter(Mandatory = $true)]
    [string]$ProcessNameKeyword
  )

  $windows = Get-WindowCandidates
  $candidate = $null

  if (-not [string]::IsNullOrWhiteSpace($Keyword)) {
    $candidate = $windows |
      Where-Object {
        $_.MainWindowTitle -and
        $_.MainWindowTitle -like "*$Keyword*"
      } |
      Select-Object -First 1

    if ($null -eq $candidate) {
      throw "제목에 '$Keyword' 가 들어간 채팅방 창을 찾지 못했습니다. 방 이름이 정확한지 먼저 확인하세요."
    }
  }

  if ($null -eq $candidate -and [string]::IsNullOrWhiteSpace($Keyword) -and -not [string]::IsNullOrWhiteSpace($ProcessNameKeyword)) {
    $candidate = $windows |
      Where-Object {
        $_.ProcessName -and
        $_.ProcessName -like "*$ProcessNameKeyword*"
      } |
      Sort-Object MainWindowTitle |
      Select-Object -First 1
  }

  if (-not $candidate) {
    throw "프로세스 '$ProcessNameKeyword' 와 일치하는 열린 창을 찾지 못했습니다. 먼저 '카톡창 찾기'를 실행해 확인하세요."
  }

  return $candidate
}

function Get-WindowCandidates {
  return Get-Process |
    Where-Object {
      $_.MainWindowHandle -ne 0 -and
      ($_.MainWindowTitle -or $_.ProcessName)
    } |
    Sort-Object ProcessName, MainWindowTitle
}

function Show-WindowCandidates {
  $windows = Get-WindowCandidates
  if (-not $windows -or $windows.Count -eq 0) {
    Write-Host "현재 화면에 보이는 최상위 창을 찾지 못했습니다."
    return
  }

  foreach ($window in $windows) {
    Write-Host ("창 목록 | 프로세스={0} | ID={1} | 핸들={2} | 제목={3}" -f $window.ProcessName, $window.Id, $window.MainWindowHandle, $window.MainWindowTitle)
  }
}

function Get-WindowHandle {
  param(
    [Parameter(Mandatory = $true)]
    [System.Diagnostics.Process]$Process
  )

  return [IntPtr]$Process.MainWindowHandle
}

function Get-ChildWindows {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle
  )

  return [KakaoMacroWin32]::GetChildWindows($WindowHandle)
}

function Find-InputHandle {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [string[]]$ClassHints
  )

  $children = Get-ChildWindows -WindowHandle $WindowHandle
  foreach ($hint in $ClassHints) {
    $match = $children |
      Where-Object {
        $_.ClassName -eq $hint -or $_.ClassName -like "$hint*"
      } |
      Select-Object -Last 1

    if ($match) {
      return [IntPtr]$match.Handle
    }
  }

  return [IntPtr]::Zero
}

function Show-ChildWindows {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle
  )

  $children = Get-ChildWindows -WindowHandle $WindowHandle
  if (-not $children -or $children.Count -eq 0) {
    Write-Host "대상 창 안에서 자식 입력창을 찾지 못했습니다."
    return
  }

  foreach ($child in $children) {
    Write-Host ("입력창 후보 | 핸들={0} | 클래스={1}" -f $child.Handle, $child.ClassName)
  }
}

function Activate-Window {
  param(
    [Parameter(Mandatory = $true)]
    [System.Diagnostics.Process]$Process,
    [Parameter(Mandatory = $true)]
    [__ComObject]$Shell,
    [Parameter(Mandatory = $true)]
    [int]$DelayMs
  )

  if (-not $Shell.AppActivate($Process.Id)) {
    throw "대상 창 활성화에 실패했습니다: $($Process.MainWindowTitle)"
  }

  Start-Sleep -Milliseconds $DelayMs
}

function Enable-GhostForegroundWindow {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [int]$Alpha
  )

  $existingStyle = [KakaoMacroWin32]::GetWindowLongPtrSafe($WindowHandle, [KakaoMacroWin32]::GWL_EXSTYLE)
  $colorKey = [uint32]0
  $previousAlpha = [byte]255
  $previousFlags = [uint32]0
  $hadLayerState = [KakaoMacroWin32]::GetLayeredWindowAttributes($WindowHandle, [ref]$colorKey, [ref]$previousAlpha, [ref]$previousFlags)

  $newStyleValue = $existingStyle.ToInt64() -bor [KakaoMacroWin32]::WS_EX_LAYERED
  [void][KakaoMacroWin32]::SetWindowLongPtrSafe($WindowHandle, [KakaoMacroWin32]::GWL_EXSTYLE, [IntPtr]$newStyleValue)

  if (-not [KakaoMacroWin32]::SetLayeredWindowAttributes($WindowHandle, 0, [byte]$Alpha, [KakaoMacroWin32]::LWA_ALPHA)) {
    throw "전경 창 투명도 적용에 실패했습니다."
  }

  return [pscustomobject]@{
    ExStyle       = $existingStyle
    HadLayerState = $hadLayerState
    ColorKey      = $colorKey
    Alpha         = [int]$previousAlpha
    Flags         = $previousFlags
  }
}

function Restore-GhostForegroundWindow {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    $State
  )

  if ($null -eq $State) {
    return
  }

  [void][KakaoMacroWin32]::SetWindowLongPtrSafe($WindowHandle, [KakaoMacroWin32]::GWL_EXSTYLE, [IntPtr]$State.ExStyle)

  if ($State.HadLayerState -and (($State.Flags -band [KakaoMacroWin32]::LWA_ALPHA) -ne 0)) {
    [void][KakaoMacroWin32]::SetLayeredWindowAttributes($WindowHandle, [uint32]$State.ColorKey, [byte]$State.Alpha, [uint32]$State.Flags)
  }
}

function Ensure-OpaqueWindow {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle
  )

  $existingStyle = [KakaoMacroWin32]::GetWindowLongPtrSafe($WindowHandle, [KakaoMacroWin32]::GWL_EXSTYLE)
  $styleValue = $existingStyle.ToInt64()
  $hadLayeredStyle = (($styleValue -band [KakaoMacroWin32]::WS_EX_LAYERED) -ne 0)

  if ($hadLayeredStyle) {
    [void][KakaoMacroWin32]::SetLayeredWindowAttributes($WindowHandle, 0, [byte]255, [KakaoMacroWin32]::LWA_ALPHA)
    $restoredStyle = $styleValue -band (-bnot [KakaoMacroWin32]::WS_EX_LAYERED)
    [void][KakaoMacroWin32]::SetWindowLongPtrSafe($WindowHandle, [KakaoMacroWin32]::GWL_EXSTYLE, [IntPtr]$restoredStyle)
  }

  return $hadLayeredStyle
}

function Get-WindowRectangle {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle
  )

  $rect = New-Object KakaoMacroWin32+RECT
  if (-not [KakaoMacroWin32]::GetWindowRect($WindowHandle, [ref]$rect)) {
    throw "창 위치를 읽지 못했습니다."
  }

  return [System.Drawing.Rectangle]::FromLTRB($rect.Left, $rect.Top, $rect.Right, $rect.Bottom)
}

function Click-InputHandle {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$InputHandle,
    [Parameter(Mandatory = $true)]
    [int]$DelayMs
  )

  $inputRect = Get-WindowRectangle -WindowHandle $InputHandle
  if ($inputRect.Width -le 0 -or $inputRect.Height -le 0) {
    return
  }

  $originalPosition = [System.Windows.Forms.Cursor]::Position
  $clickPoint = [System.Drawing.Point]::new(
    ($inputRect.Left + [int]($inputRect.Width / 2)),
    ($inputRect.Top + [int]($inputRect.Height / 2))
  )

  try {
    [KakaoMacroWin32]::SetCursorPos($clickPoint.X, $clickPoint.Y) | Out-Null
    Start-Sleep -Milliseconds 40
    [KakaoMacroWin32]::mouse_event([KakaoMacroWin32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 30
    [KakaoMacroWin32]::mouse_event([KakaoMacroWin32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds $DelayMs
  } finally {
    [System.Windows.Forms.Cursor]::Position = $originalPosition
  }
}

function Focus-InputHandle {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [IntPtr]$InputHandle,
    [Parameter(Mandatory = $true)]
    [int]$DelayMs
  )

  if ($InputHandle -eq [IntPtr]::Zero) {
    return $false
  }

  $attached = $false
  $currentThreadId = [KakaoMacroWin32]::GetCurrentThreadId()
  $windowProcessId = [uint32]0
  $targetThreadId = [KakaoMacroWin32]::GetWindowThreadProcessId($InputHandle, [ref]$windowProcessId)

  try {
    [void][KakaoMacroWin32]::SetForegroundWindow($WindowHandle)
    [void][KakaoMacroWin32]::SetActiveWindow($WindowHandle)

    if ($targetThreadId -ne 0 -and $targetThreadId -ne $currentThreadId) {
      $attached = [KakaoMacroWin32]::AttachThreadInput($currentThreadId, $targetThreadId, $true)
    }

    [void][KakaoMacroWin32]::SetFocus($InputHandle)
    [void][KakaoMacroWin32]::SendMessage($InputHandle, [KakaoMacroWin32]::WM_SETFOCUS, [IntPtr]::Zero, [IntPtr]::Zero)
    Start-Sleep -Milliseconds $DelayMs
    return $true
  } finally {
    if ($attached) {
      [void][KakaoMacroWin32]::AttachThreadInput($currentThreadId, $targetThreadId, $false)
    }
  }
}

function Get-ClientRectangle {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle
  )

  $clientRect = New-Object KakaoMacroWin32+RECT
  if (-not [KakaoMacroWin32]::GetClientRect($WindowHandle, [ref]$clientRect)) {
    throw "대상 창 크기를 읽지 못했습니다."
  }

  return [System.Drawing.Rectangle]::new(
    0,
    0,
    ($clientRect.Right - $clientRect.Left),
    ($clientRect.Bottom - $clientRect.Top)
  )
}

function Get-ClientOriginOnScreen {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle
  )

  $point = New-Object KakaoMacroWin32+POINT
  $point.X = 0
  $point.Y = 0

  if (-not [KakaoMacroWin32]::ClientToScreen($WindowHandle, [ref]$point)) {
    throw "창 좌표를 화면 좌표로 변환하지 못했습니다."
  }

  return [System.Drawing.Point]::new($point.X, $point.Y)
}

function Convert-ScreenRectangleToClientRectangle {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$ScreenRectangle
  )

  $origin = Get-ClientOriginOnScreen -WindowHandle $WindowHandle
  return [System.Drawing.Rectangle]::new(
    ($ScreenRectangle.Left - $origin.X),
    ($ScreenRectangle.Top - $origin.Y),
    $ScreenRectangle.Width,
    $ScreenRectangle.Height
  )
}

function Capture-ScreenRegion {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$Rectangle
  )

  $bitmap = New-Object System.Drawing.Bitmap($Rectangle.Width, $Rectangle.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.CopyFromScreen($Rectangle.Location, [System.Drawing.Point]::Empty, $Rectangle.Size)
    return $bitmap
  } finally {
    $graphics.Dispose()
  }
}

function Capture-WindowRegion {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$ScreenRectangle
  )

  if ([KakaoMacroWin32]::IsIconic($WindowHandle)) {
    throw "대상 창이 최소화되어 있습니다. 다른 창에 가려진 상태는 되지만 최소화 상태는 안 됩니다."
  }

  $clientBounds = Get-ClientRectangle -WindowHandle $WindowHandle
  $fullBitmap = New-Object System.Drawing.Bitmap($clientBounds.Width, $clientBounds.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($fullBitmap)
  $hdc = [IntPtr]::Zero

  try {
    $hdc = $graphics.GetHdc()
    $captured = [KakaoMacroWin32]::PrintWindow($WindowHandle, $hdc, 1)
    if (-not $captured) {
      throw "가려진 창 읽기에 실패했습니다."
    }
  } finally {
    if ($hdc -ne [IntPtr]::Zero) {
      $graphics.ReleaseHdc($hdc)
    }
    $graphics.Dispose()
  }

  try {
    $clientRegion = Convert-ScreenRectangleToClientRectangle -WindowHandle $WindowHandle -ScreenRectangle $ScreenRectangle
    $visibleRegion = [System.Drawing.Rectangle]::Intersect($clientBounds, $clientRegion)
    if ($visibleRegion.Width -le 0 -or $visibleRegion.Height -le 0) {
      throw "지정한 숫자 영역이 현재 잡힌 카카오톡 창 안에 없습니다. 카톡 창 위치를 맞춘 뒤 왼쪽 위/오른쪽 아래를 다시 저장하세요."
    }

    return $fullBitmap.Clone($visibleRegion, $fullBitmap.PixelFormat)
  } finally {
    $fullBitmap.Dispose()
  }
}

function Capture-RegionBitmap {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$Rectangle,
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [string]$CaptureMode
  )

  if ($CaptureMode -eq "window") {
    return (Capture-WindowRegion -WindowHandle $WindowHandle -ScreenRectangle $Rectangle)
  }

  if ($CaptureMode -eq "screen") {
    return (Capture-ScreenRegion -Rectangle $Rectangle)
  }

  try {
    return (Capture-WindowRegion -WindowHandle $WindowHandle -ScreenRectangle $Rectangle)
  } catch {
    return (Capture-ScreenRegion -Rectangle $Rectangle)
  }
}

function Get-ResponseMonitorRectangle {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [string[]]$InputClassHints,
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$ManualRectangle,
    [Parameter(Mandatory = $true)]
    [bool]$UseAutoChatScan
  )

  if (-not $UseAutoChatScan) {
    return $ManualRectangle
  }

  $clientBounds = Get-ClientRectangle -WindowHandle $WindowHandle
  $origin = Get-ClientOriginOnScreen -WindowHandle $WindowHandle

  $horizontalMargin = [Math]::Max(8, [int][Math]::Round($clientBounds.Width * 0.04))
  $left = $origin.X + $horizontalMargin
  $width = [Math]::Max(160, ($clientBounds.Width - ($horizontalMargin * 2)))
  $topLimit = $origin.Y + [Math]::Max(24, [int][Math]::Round($clientBounds.Height * 0.10))
  $bottom = $origin.Y + $clientBounds.Height - 16

  $inputHandle = Find-InputHandle -WindowHandle $WindowHandle -ClassHints $InputClassHints
  if ($inputHandle -ne [IntPtr]::Zero) {
    $inputRect = Get-WindowRectangle -WindowHandle $inputHandle
    $bottom = [Math]::Min($bottom, ($inputRect.Top - 8))
  }

  $desiredHeight = [Math]::Max(240, [Math]::Min(620, [int][Math]::Round($clientBounds.Height * 0.62)))
  $top = [Math]::Max($topLimit, ($bottom - $desiredHeight))
  $height = [Math]::Max(140, ($bottom - $top))

  return [System.Drawing.Rectangle]::new($left, $top, $width, $height)
}

function Get-ResponseTextRectangle {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$Rectangle
  )

  if ($Rectangle.Height -lt 150) {
    return $Rectangle
  }

  $topOffset = [Math]::Max(52, [int][Math]::Round($Rectangle.Height * 0.30))
  $bottomInset = [Math]::Max(10, [int][Math]::Round($Rectangle.Height * 0.03))
  $leftInset = [Math]::Max(4, [int][Math]::Round($Rectangle.Width * 0.02))
  $width = [Math]::Max(120, ($Rectangle.Width - ($leftInset * 2)))
  $height = [Math]::Max(110, ($Rectangle.Height - $topOffset - $bottomInset))

  return [System.Drawing.Rectangle]::new(
    ($Rectangle.Left + $leftInset),
    ($Rectangle.Top + $topOffset),
    $width,
    $height
  )
}

function Get-ResponseButtonRectangle {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$Rectangle
  )

  if ($Rectangle.Height -lt 120) {
    return $Rectangle
  }

  $topInset = [Math]::Max(10, [int][Math]::Round($Rectangle.Height * 0.06))
  $bottomInset = [Math]::Max(8, [int][Math]::Round($Rectangle.Height * 0.02))
  $leftInset = [Math]::Max(4, [int][Math]::Round($Rectangle.Width * 0.02))
  $width = [Math]::Max(120, ($Rectangle.Width - ($leftInset * 2)))
  $height = [Math]::Max(120, ($Rectangle.Height - $topInset - $bottomInset))

  return [System.Drawing.Rectangle]::new(
    ($Rectangle.Left + $leftInset),
    ($Rectangle.Top + $topInset),
    $width,
    $height
  )
}

function Get-LevelFocusRectangle {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$Rectangle
  )

  $focusedWidth = $Rectangle.Width
  $focusedHeight = $Rectangle.Height

  # If the user selects a full line or bubble, bias OCR toward the left/top where [+N] appears.
  if ($Rectangle.Width -gt 120) {
    $focusedWidth = [Math]::Max(60, [Math]::Min(110, [int][Math]::Round($Rectangle.Width * 0.42)))
  } elseif ($Rectangle.Width -gt 90) {
    $focusedWidth = [Math]::Max(50, [Math]::Min(90, [int][Math]::Round($Rectangle.Width * 0.55)))
  }

  if ($Rectangle.Height -gt 40) {
    $focusedHeight = [Math]::Max(20, [Math]::Min(36, [int][Math]::Round($Rectangle.Height * 0.50)))
  } elseif ($Rectangle.Height -gt 30) {
    $focusedHeight = [Math]::Max(20, [Math]::Min(30, [int][Math]::Round($Rectangle.Height * 0.70)))
  }

  return [System.Drawing.Rectangle]::new(
    $Rectangle.Left,
    $Rectangle.Top,
    [Math]::Max(1, $focusedWidth),
    [Math]::Max(1, $focusedHeight)
  )
}

function Prepare-BitmapForOcr {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Bitmap]$Bitmap
  )

  $scale = 3
  $scaledBitmap = New-Object System.Drawing.Bitmap(($Bitmap.Width * $scale), ($Bitmap.Height * $scale))
  $graphics = [System.Drawing.Graphics]::FromImage($scaledBitmap)

  try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.DrawImage($Bitmap, 0, 0, $scaledBitmap.Width, $scaledBitmap.Height)
  } finally {
    $graphics.Dispose()
  }

  $preparedBitmap = New-Object System.Drawing.Bitmap($scaledBitmap.Width, $scaledBitmap.Height)

  try {
    for ($x = 0; $x -lt $scaledBitmap.Width; $x++) {
      for ($y = 0; $y -lt $scaledBitmap.Height; $y++) {
        $pixel = $scaledBitmap.GetPixel($x, $y)
        $luminance = [int](($pixel.R * 0.30) + ($pixel.G * 0.59) + ($pixel.B * 0.11))
        if ($luminance -ge 185) {
          $preparedBitmap.SetPixel($x, $y, [System.Drawing.Color]::White)
        } else {
          $preparedBitmap.SetPixel($x, $y, [System.Drawing.Color]::Black)
        }
      }
    }

    return $preparedBitmap
  } finally {
    $scaledBitmap.Dispose()
  }
}

function Get-BitmapBestText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Bitmap]$Bitmap
  )

  $preparedBitmap = $null
  $bestText = ""

  try {
    try {
      $preparedBitmap = Prepare-BitmapForOcr -Bitmap $Bitmap
    } catch {
      $preparedBitmap = $null
    }

    $bitmapsToScan = [System.Collections.Generic.List[System.Drawing.Bitmap]]::new()
    if ($null -ne $preparedBitmap) {
      [void]$bitmapsToScan.Add($preparedBitmap)
    }
    [void]$bitmapsToScan.Add($Bitmap)

    foreach ($bitmapToScan in $bitmapsToScan) {
      $text = Convert-BitmapToText -Bitmap $bitmapToScan
      if ($null -eq $text) {
        $text = ""
      }

      if ([string]::IsNullOrWhiteSpace($text)) {
        continue
      }

      if ([string]::IsNullOrWhiteSpace($bestText) -or $text.Length -gt $bestText.Length) {
        $bestText = $text
      }
    }

    return $bestText
  } finally {
    if ($null -ne $preparedBitmap) {
      $preparedBitmap.Dispose()
    }
  }
}

function Get-BitmapOcrWords {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Bitmap]$Bitmap,
    [Parameter(Mandatory = $true)]
    [int]$OffsetLeft,
    [Parameter(Mandatory = $true)]
    [int]$OffsetTop
  )

  $ocrContext = Initialize-WinRtOcr
  $preparedBitmap = $null
  $variants = [System.Collections.Generic.List[object]]::new()
  $wordResults = [System.Collections.Generic.List[object]]::new()
  $seenKeys = [System.Collections.Generic.HashSet[string]]::new()

  try {
    [void]$variants.Add([pscustomobject]@{
      Bitmap = $Bitmap
      Scale  = 1
    })

    try {
      $preparedBitmap = Prepare-BitmapForOcr -Bitmap $Bitmap
      if ($null -ne $preparedBitmap) {
        [void]$variants.Add([pscustomobject]@{
          Bitmap = $preparedBitmap
          Scale  = 3
        })
      }
    } catch {
      $preparedBitmap = $null
    }

    foreach ($variant in $variants) {
      $tempPath = Join-Path $env:TEMP ("kakao-enhance-words-{0}.png" -f [guid]::NewGuid().ToString("N"))
      $stream = $null

      try {
        $variant.Bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $file = Await-WinRt -AsyncOperation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempPath)) -ResultType ([Windows.Storage.StorageFile]) -AsTaskMethod $ocrContext.AsTaskMethod
        $stream = Await-WinRt -AsyncOperation ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) -ResultType ([Windows.Storage.Streams.IRandomAccessStream]) -AsTaskMethod $ocrContext.AsTaskMethod
        $decoder = Await-WinRt -AsyncOperation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) -ResultType ([Windows.Graphics.Imaging.BitmapDecoder]) -AsTaskMethod $ocrContext.AsTaskMethod
        $softwareBitmap = Await-WinRt -AsyncOperation ($decoder.GetSoftwareBitmapAsync()) -ResultType ([Windows.Graphics.Imaging.SoftwareBitmap]) -AsTaskMethod $ocrContext.AsTaskMethod
        $ocrResult = Await-WinRt -AsyncOperation ($ocrContext.OcrEngine.RecognizeAsync($softwareBitmap)) -ResultType ([Windows.Media.Ocr.OcrResult]) -AsTaskMethod $ocrContext.AsTaskMethod

        foreach ($line in $ocrResult.Lines) {
          foreach ($word in $line.Words) {
            $wordText = ($word.Text -replace "\r", "").Trim()
            if ([string]::IsNullOrWhiteSpace($wordText)) {
              continue
            }

            $rect = $word.BoundingRect
            $left = $OffsetLeft + [int][Math]::Round($rect.X / $variant.Scale)
            $top = $OffsetTop + [int][Math]::Round($rect.Y / $variant.Scale)
            $width = [Math]::Max(1, [int][Math]::Round($rect.Width / $variant.Scale))
            $height = [Math]::Max(1, [int][Math]::Round($rect.Height / $variant.Scale))
            $normalizedText = Get-NormalizedOcrText -Text $wordText
            $key = "{0}|{1}|{2}" -f $normalizedText, ([int][Math]::Round($left / 8)), ([int][Math]::Round($top / 8))

            if (-not $seenKeys.Add($key)) {
              continue
            }

            [void]$wordResults.Add([pscustomobject]@{
              Text           = $wordText
              NormalizedText = $normalizedText
              Left           = $left
              Top            = $top
              Width          = $width
              Height         = $height
              CenterX        = $left + [int]($width / 2)
              CenterY        = $top + [int]($height / 2)
            })
          }
        }
      } finally {
        if ($null -ne $stream) {
          $stream.Dispose()
        }

        Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
      }
    }

    return @($wordResults | Sort-Object Top, Left)
  } finally {
    if ($null -ne $preparedBitmap) {
      $preparedBitmap.Dispose()
    }
  }
}

function Get-ActionLabelFromWordText {
  param(
    [AllowEmptyString()]
    [string]$Text
  )

  $normalized = Get-NormalizedOcrText -Text $Text
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return $null
  }

  if ($normalized -eq "강화" -or ($normalized.Length -le 3 -and $normalized.Contains("강") -and $normalized.Contains("화"))) {
    return "강화"
  }

  if (
    $normalized -eq "복념" -or
    $normalized -eq "묵념" -or
    (
      $normalized.Length -le 4 -and
      (
        $normalized.Contains("복") -or
        $normalized.Contains("목") -or
        $normalized.Contains("묵") -or
        $normalized.Contains("북")
      ) -and
      (
        $normalized.Contains("념") -or
        $normalized.Contains("넴")
      )
    )
  ) {
    return "복념"
  }

  if (($normalized.StartsWith("자랑") -or $normalized.StartsWith("자랑하")) -and $normalized.Length -le 5) {
    return "자랑하기"
  }

  if ($normalized.StartsWith("배틀") -and $normalized.Length -le 3) {
    return "배틀"
  }

  return $null
}

function Find-ActionHandle {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle
  )

  $children = Get-ChildWindows -WindowHandle $WindowHandle
  $classHints = @("EVA_VH_ListControl_Dblclk", "_EVA_CustomScrollCtrl")

  foreach ($hint in $classHints) {
    $match = $children |
      Where-Object {
        $_.ClassName -eq $hint -or $_.ClassName -like "$hint*"
      } |
      Select-Object -Last 1

    if ($match) {
      return [IntPtr]$match.Handle
    }
  }

  return [IntPtr]::Zero
}

function Get-ClickLParam {
  param(
    [Parameter(Mandatory = $true)]
    [int]$ClientX,
    [Parameter(Mandatory = $true)]
    [int]$ClientY
  )

  $packed = (($ClientY -band 0xFFFF) -shl 16) -bor ($ClientX -band 0xFFFF)
  return [IntPtr][int64]$packed
}

function Invoke-BackgroundClientClick {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [System.Drawing.Point]$ScreenPoint,
    [IntPtr]$PreferredHandle = [IntPtr]::Zero,
    [int]$DelayMs = 110
  )

  $clickHandle = $PreferredHandle
  if ($clickHandle -eq [IntPtr]::Zero) {
    $clickHandle = $WindowHandle
  }

  $handleRect = Get-WindowRectangle -WindowHandle $clickHandle
  if (-not $handleRect.Contains($ScreenPoint)) {
    $clickHandle = $WindowHandle
    $handleRect = Get-WindowRectangle -WindowHandle $clickHandle
  }

  if (-not $handleRect.Contains($ScreenPoint)) {
    throw "버튼 클릭 좌표가 현재 카카오톡 창 안에 없습니다."
  }

  $clientOrigin = Get-ClientOriginOnScreen -WindowHandle $clickHandle
  $clientX = $ScreenPoint.X - $clientOrigin.X
  $clientY = $ScreenPoint.Y - $clientOrigin.Y
  $clientRect = Get-ClientRectangle -WindowHandle $clickHandle

  if ($clientX -lt 0 -or $clientY -lt 0 -or $clientX -ge $clientRect.Width -or $clientY -ge $clientRect.Height) {
    throw "버튼 클릭 좌표를 창 내부 좌표로 변환하지 못했습니다."
  }

  $lParam = Get-ClickLParam -ClientX $clientX -ClientY $clientY
  [void][KakaoMacroWin32]::PostMessage($clickHandle, [KakaoMacroWin32]::WM_MOUSEMOVE, [IntPtr]::Zero, $lParam)
  Start-Sleep -Milliseconds 25
  [void][KakaoMacroWin32]::PostMessage($clickHandle, [KakaoMacroWin32]::WM_LBUTTONDOWN, [IntPtr][KakaoMacroWin32]::MK_LBUTTON, $lParam)
  Start-Sleep -Milliseconds 45
  [void][KakaoMacroWin32]::PostMessage($clickHandle, [KakaoMacroWin32]::WM_LBUTTONUP, [IntPtr]::Zero, $lParam)
  Start-Sleep -Milliseconds ([Math]::Max(45, $DelayMs))

  return [pscustomobject]@{
    TargetHandle = $clickHandle
    ClientX      = $clientX
    ClientY      = $clientY
    ScreenX      = $ScreenPoint.X
    ScreenY      = $ScreenPoint.Y
  }
}

function Find-ResponseActionButton {
  param(
    [Parameter(Mandatory = $true)]
    $Snapshot
  )

  $words = @($Snapshot.Words)
  if ($words.Count -eq 0) {
    return $null
  }

  $scanRectangle = if ($Snapshot.PSObject.Properties.Match("ButtonScanRectangle").Count -gt 0) { $Snapshot.ButtonScanRectangle } else { $Snapshot.ScanRectangle }
  $candidateWords = @($words | Where-Object {
    $_.CenterY -ge ($scanRectangle.Top + [int][Math]::Round($scanRectangle.Height * 0.14))
  })
  if ($candidateWords.Count -eq 0) {
    $candidateWords = $words
  }

  $candidates = @(foreach ($word in $candidateWords) {
    $actionLabel = Get-ActionLabelFromWordText -Text $word.Text
    if ($null -eq $actionLabel) {
      continue
    }

    [pscustomobject]@{
      Label     = $actionLabel
      Text      = $word.Text
      Word      = $word
      ClickPoint = [System.Drawing.Point]::new(
        $word.CenterX,
        ($word.CenterY + [Math]::Max(0, [int][Math]::Round($word.Height * 0.08)))
      )
    }
  })

  if (-not $candidates -or $candidates.Count -eq 0) {
    return $null
  }

  $matches = @($candidates | Where-Object { $_.Label -eq "강화" })
  if (-not $matches -or $matches.Count -eq 0) {
    return $null
  }

  return ($matches | Sort-Object @{ Expression = { $_.ClickPoint.Y }; Descending = $true }, @{ Expression = { $_.ClickPoint.X }; Descending = $true } | Select-Object -First 1)
}

function Convert-BitmapToText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Bitmap]$Bitmap
  )

  $ocrContext = Initialize-WinRtOcr

  $tempPath = Join-Path $env:TEMP ("kakao-enhance-{0}.png" -f [guid]::NewGuid().ToString("N"))
  $stream = $null

  try {
    $Bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $file = Await-WinRt -AsyncOperation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempPath)) -ResultType ([Windows.Storage.StorageFile]) -AsTaskMethod $ocrContext.AsTaskMethod
    $stream = Await-WinRt -AsyncOperation ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) -ResultType ([Windows.Storage.Streams.IRandomAccessStream]) -AsTaskMethod $ocrContext.AsTaskMethod
    try {
      $decoder = Await-WinRt -AsyncOperation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) -ResultType ([Windows.Graphics.Imaging.BitmapDecoder]) -AsTaskMethod $ocrContext.AsTaskMethod
      $softwareBitmap = Await-WinRt -AsyncOperation ($decoder.GetSoftwareBitmapAsync()) -ResultType ([Windows.Graphics.Imaging.SoftwareBitmap]) -AsTaskMethod $ocrContext.AsTaskMethod
      $ocrResult = Await-WinRt -AsyncOperation ($ocrContext.OcrEngine.RecognizeAsync($softwareBitmap)) -ResultType ([Windows.Media.Ocr.OcrResult]) -AsTaskMethod $ocrContext.AsTaskMethod
      return (($ocrResult.Text -replace "\r", "").Trim())
    } finally {
      if ($stream) {
        $stream.Dispose()
      }
    }
  } finally {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
}

function Get-DetectedLevel {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string]$Text
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $null
  }

  $candidates = [System.Collections.Generic.List[int]]::new()
  $patterns = @(
    "\+\s*(\d{1,3})",
    "LV[^0-9]*(\d{1,3})",
    "(?<!\d)(\d{1,3})(?!\d)"
  )

  foreach ($pattern in $patterns) {
    foreach ($match in [regex]::Matches($Text, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
      if ($match.Success) {
        [void]$candidates.Add([int]$match.Groups[1].Value)
      }
    }
  }

  if ($candidates.Count -eq 0) {
    return $null
  }

  return ($candidates | Sort-Object -Unique | Select-Object -Last 1)
}

function Get-SuccessLevel {
  param(
    [AllowEmptyString()]
    [string]$Text
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $null
  }

  $normalized = Get-NormalizedOcrText -Text $Text
  $bestMatchIndex = -1
  $bestLevel = $null
  $patterns = @(
    "강화성공.*?\+?(\d{1,3})[→>-]+\+?(\d{1,3})",
    "획득검[:：]?\[\+?(\d{1,3})\]",
    "⚔️획득검[:：]?\[\+?(\d{1,3})\]",
    "〖.*?\+?(\d{1,3})[→>-]+\+?(\d{1,3})〗"
  )

  foreach ($pattern in $patterns) {
    $matches = [regex]::Matches($normalized, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($matches.Count -eq 0) {
      continue
    }

    $match = $matches[$matches.Count - 1]
    if ($match.Index -lt $bestMatchIndex) {
      continue
    }

    $candidateLevel = $null
    if ($match.Groups.Count -ge 2 -and $match.Groups[1].Success) {
      $candidateLevel = [int]$match.Groups[1].Value
    }

    if ($match.Groups.Count -ge 3 -and $match.Groups[2].Success) {
      $candidateLevel = [int]$match.Groups[2].Value
    }

    if ($null -ne $candidateLevel) {
      $bestMatchIndex = $match.Index
      $bestLevel = $candidateLevel
    }
  }

  return $bestLevel
}

function Get-LastKeywordIndex {
  param(
    [AllowEmptyString()]
    [string]$Text,
    [Parameter(Mandatory = $true)]
    [string[]]$Keywords
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return -1
  }

  $bestIndex = -1
  foreach ($keyword in $Keywords) {
    if ([string]::IsNullOrWhiteSpace($keyword)) {
      continue
    }

    $index = $Text.LastIndexOf($keyword, [System.StringComparison]::OrdinalIgnoreCase)
    if ($index -gt $bestIndex) {
      $bestIndex = $index
    }
  }

  return $bestIndex
}

function Get-NormalizedOcrText {
  param(
    [AllowEmptyString()]
    [string]$Text
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  return (($Text -replace "\s+", "").Trim())
}

function Get-BitmapAverageHash {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Bitmap]$Bitmap
  )

  $hashSize = 8
  $resizedBitmap = New-Object System.Drawing.Bitmap($hashSize, $hashSize)
  $graphics = [System.Drawing.Graphics]::FromImage($resizedBitmap)

  try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.DrawImage($Bitmap, 0, 0, $hashSize, $hashSize)
  } finally {
    $graphics.Dispose()
  }

  try {
    $values = New-Object int[] ($hashSize * $hashSize)
    $index = 0
    $sum = 0

    for ($y = 0; $y -lt $hashSize; $y++) {
      for ($x = 0; $x -lt $hashSize; $x++) {
        $pixel = $resizedBitmap.GetPixel($x, $y)
        $luminance = [int](($pixel.R * 0.30) + ($pixel.G * 0.59) + ($pixel.B * 0.11))
        $values[$index] = $luminance
        $sum += $luminance
        $index++
      }
    }

    $average = [int][Math]::Round($sum / $values.Length)
    $builder = New-Object System.Text.StringBuilder

    foreach ($value in $values) {
      if ($value -ge $average) {
        [void]$builder.Append("1")
      } else {
        [void]$builder.Append("0")
      }
    }

    return $builder.ToString()
  } finally {
    $resizedBitmap.Dispose()
  }
}

function Get-HashDistance {
  param(
    [string]$LeftHash,
    [string]$RightHash
  )

  if ([string]::IsNullOrWhiteSpace($LeftHash) -or [string]::IsNullOrWhiteSpace($RightHash)) {
    if ([string]::IsNullOrWhiteSpace($LeftHash) -and [string]::IsNullOrWhiteSpace($RightHash)) {
      return 0
    }

    return 64
  }

  $length = [Math]::Min($LeftHash.Length, $RightHash.Length)
  $distance = 0

  for ($index = 0; $index -lt $length; $index++) {
    if ($LeftHash[$index] -ne $RightHash[$index]) {
      $distance++
    }
  }

  $distance += [Math]::Abs($LeftHash.Length - $RightHash.Length)
  return $distance
}

function Get-ResponseCase {
  param(
    [AllowEmptyString()]
    [string]$Text,
    [Nullable[int]]$Level
  )

  $normalized = Get-NormalizedOcrText -Text $Text
  $successLevel = Get-SuccessLevel -Text $Text
  $label = "미분류"
  $readyForNextCommand = $false
  $requiresFollowUpWait = $false
  $caseCandidates = @(
    [pscustomobject]@{ Label = "추가 응답 대기"; Index = Get-LastKeywordIndex -Text $normalized -Keywords @("잠시", "시간을갖겠", "시간을갖", "기다") },
    [pscustomobject]@{ Label = "강화 성공"; Index = [Math]::Max((Get-LastKeywordIndex -Text $normalized -Keywords @("강화성공")), (Get-LastKeywordIndex -Text $normalized -Keywords @("획득검"))) },
    [pscustomobject]@{ Label = "파괴"; Index = Get-LastKeywordIndex -Text $normalized -Keywords @("강화파괴", "파괴") },
    [pscustomobject]@{ Label = "유지"; Index = [Math]::Max((Get-LastKeywordIndex -Text $normalized -Keywords @("강화유지")), (Get-LastKeywordIndex -Text $normalized -Keywords @("레벨이유지되었습니다"))) },
    [pscustomobject]@{ Label = "복념"; Index = Get-LastKeywordIndex -Text $normalized -Keywords @("복념") },
    [pscustomobject]@{ Label = "배틀 카드"; Index = Get-LastKeywordIndex -Text $normalized -Keywords @("배틀") },
    [pscustomobject]@{ Label = "자랑하기 카드"; Index = Get-LastKeywordIndex -Text $normalized -Keywords @("자랑하기", "자랑") }
  )

  $latestCase = $caseCandidates |
    Where-Object { $_.Index -ge 0 } |
    Sort-Object Index -Descending |
    Select-Object -First 1

  if ($null -ne $latestCase) {
    $label = $latestCase.Label
  } elseif ($null -ne $Level) {
    $label = "레벨 응답"
  } elseif ([string]::IsNullOrWhiteSpace($normalized)) {
    $label = "빈 OCR"
  }

  if ($label -eq "추가 응답 대기") {
    $requiresFollowUpWait = $true
  }

  if ($null -ne $Level) {
    $readyForNextCommand = $true
  }

  if ($label -eq "강화 성공") {
    $readyForNextCommand = $true
  }

  if (
    $normalized.Contains("강화") -or
    $normalized.Contains("복념") -or
    $normalized.Contains("배틀") -or
    $normalized.Contains("자랑")
  ) {
    $readyForNextCommand = $true
  }

  if ($requiresFollowUpWait) {
    $readyForNextCommand = $false
  }

  return [pscustomobject]@{
    Label                = $label
    ReadyForNextCommand  = $readyForNextCommand
    RequiresFollowUpWait = $requiresFollowUpWait
    NormalizedText       = $normalized
  }
}

function Get-ResponseSnapshot {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$Rectangle,
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [string]$CaptureMode,
    [switch]$IncludeWords
  )

  $scanRectangle = Get-ResponseTextRectangle -Rectangle $Rectangle
  $buttonScanRectangle = Get-ResponseButtonRectangle -Rectangle $Rectangle
  $bitmap = Capture-RegionBitmap -Rectangle $scanRectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode
  $buttonBitmap = $null

  try {
    $signature = Get-BitmapAverageHash -Bitmap $bitmap
    $fullText = Get-BitmapBestText -Bitmap $bitmap
    $monitorText = ""
    $words = @()
    $displayText = $fullText
    $focusText = ""
    $level = $null

    if (
      $buttonScanRectangle.Left -ne $scanRectangle.Left -or
      $buttonScanRectangle.Top -ne $scanRectangle.Top -or
      $buttonScanRectangle.Width -ne $scanRectangle.Width -or
      $buttonScanRectangle.Height -ne $scanRectangle.Height
    ) {
      try {
        $buttonBitmap = Capture-RegionBitmap -Rectangle $buttonScanRectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode
        $monitorText = Get-BitmapBestText -Bitmap $buttonBitmap
      } catch {
        $monitorText = ""
        if ($null -ne $buttonBitmap) {
          $buttonBitmap.Dispose()
          $buttonBitmap = $null
        }
      }
    } else {
      $monitorText = $fullText
    }

    if ($IncludeWords) {
      try {
        if (
          $buttonScanRectangle.Left -eq $scanRectangle.Left -and
          $buttonScanRectangle.Top -eq $scanRectangle.Top -and
          $buttonScanRectangle.Width -eq $scanRectangle.Width -and
          $buttonScanRectangle.Height -eq $scanRectangle.Height
        ) {
          $words = @(Get-BitmapOcrWords -Bitmap $bitmap -OffsetLeft $buttonScanRectangle.Left -OffsetTop $buttonScanRectangle.Top)
        } else {
          $buttonBitmap = Capture-RegionBitmap -Rectangle $buttonScanRectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode
          $words = @(Get-BitmapOcrWords -Bitmap $buttonBitmap -OffsetLeft $buttonScanRectangle.Left -OffsetTop $buttonScanRectangle.Top)
        }
      } catch {
        $words = @()
      }
    }

    $relativeRectangle = [System.Drawing.Rectangle]::new(0, 0, $bitmap.Width, $bitmap.Height)
    $focusedRectangle = Get-LevelFocusRectangle -Rectangle $relativeRectangle
    $focusedRectangle = [System.Drawing.Rectangle]::Intersect($relativeRectangle, $focusedRectangle)

    if ($focusedRectangle.Width -gt 0 -and $focusedRectangle.Height -gt 0) {
      $focusBitmap = $null
      try {
        $focusBitmap = $bitmap.Clone($focusedRectangle, $bitmap.PixelFormat)
        $focusText = Get-BitmapBestText -Bitmap $focusBitmap
      } finally {
        if ($null -ne $focusBitmap) {
          $focusBitmap.Dispose()
        }
      }
    }

    if ([string]::IsNullOrWhiteSpace($displayText) -and -not [string]::IsNullOrWhiteSpace($focusText)) {
      $displayText = $focusText
    }

    $textCandidates = @(@($monitorText, $fullText, $focusText) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
    if ($textCandidates.Count -gt 0) {
      $displayText = ($textCandidates -join "`n")
    }

    $caseInfo = Get-ResponseCase -Text $displayText -Level $null

    if ($caseInfo.Label -eq "강화 성공") {
      foreach ($candidateText in @($displayText, $monitorText, $fullText, $focusText)) {
        $candidateLevel = Get-SuccessLevel -Text $candidateText
        if ($null -ne $candidateLevel) {
          $level = $candidateLevel
          break
        }
      }

      $caseInfo = Get-ResponseCase -Text $displayText -Level $level
    }

    return [pscustomobject]@{
      Text          = $displayText
      FullText      = $fullText
      MonitorText   = $monitorText
      FocusText     = $focusText
      Level         = $level
      Signature     = $signature
      Case          = $caseInfo
      Words         = @($words)
      MonitorRectangle = $Rectangle
      ScanRectangle = $scanRectangle
      ButtonScanRectangle = $buttonScanRectangle
    }
  } finally {
    if ($null -ne $buttonBitmap) {
      $buttonBitmap.Dispose()
    }
    $bitmap.Dispose()
  }
}

function Wait-RandomLoopGap {
  param(
    [Parameter(Mandatory = $true)]
    [int]$BaseDelayMs,
    [Parameter(Mandatory = $true)]
    [int]$RandomJitterMs
  )

  $gapJitterMs = [Math]::Max(40, [Math]::Min(220, $RandomJitterMs))
  $gapMs = Get-EffectiveDelayMs -BaseDelayMs $BaseDelayMs -RandomJitterMs $gapJitterMs
  if ($gapMs -gt 0) {
    Start-Sleep -Milliseconds $gapMs
  }

  return $gapMs
}

function Wait-ForNextBotResponse {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$Rectangle,
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [string]$CaptureMode,
    [Parameter(Mandatory = $true)]
    $BaselineSnapshot,
    [Parameter(Mandatory = $true)]
    [int]$BaseDelayMs,
    [Parameter(Mandatory = $true)]
    [int]$RandomJitterMs
  )

  $initialWaitMs = Get-EffectiveDelayMs -BaseDelayMs $BaseDelayMs -RandomJitterMs $RandomJitterMs
  if ($initialWaitMs -gt 0) {
    Start-Sleep -Milliseconds $initialWaitMs
  }

  $pollBaseMs = [Math]::Max(220, [Math]::Min(850, [int][Math]::Round($BaseDelayMs * 0.22)))
  $pollJitterMs = [Math]::Max(60, [Math]::Min(220, [int][Math]::Round([Math]::Max(80, $RandomJitterMs) * 0.65)))
  $settleBaseMs = [Math]::Max(180, [Math]::Min(620, [int][Math]::Round($BaseDelayMs * 0.12)))
  $changeThreshold = 2
  $timeoutMs = [Math]::Max(9000, ($BaseDelayMs * 6))
  $currentBaseline = $BaselineSnapshot
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  $lastSnapshot = $currentBaseline

  while ($stopwatch.ElapsedMilliseconds -lt $timeoutMs) {
    $snapshot = Get-ResponseSnapshot -Rectangle $Rectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode
    $lastSnapshot = $snapshot
    $distance = Get-HashDistance -LeftHash $currentBaseline.Signature -RightHash $snapshot.Signature
    $baselineText = $currentBaseline.Case.NormalizedText
    $currentText = $snapshot.Case.NormalizedText
    $textChanged = $false

    if (-not [string]::IsNullOrWhiteSpace($currentText)) {
      if ([string]::IsNullOrWhiteSpace($baselineText)) {
        $textChanged = $true
      } elseif ($currentText -ne $baselineText) {
        $textChanged = $true
      }
    } elseif ($distance -ge $changeThreshold) {
      $textChanged = $true
    }

    if ($textChanged -or $distance -ge $changeThreshold) {
      $settleWaitMs = Get-EffectiveDelayMs -BaseDelayMs $settleBaseMs -RandomJitterMs ([Math]::Max(40, [int][Math]::Round($pollJitterMs / 2)))
      if ($settleWaitMs -gt 0) {
        Start-Sleep -Milliseconds $settleWaitMs
      }

      $snapshot = Get-ResponseSnapshot -Rectangle $Rectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode
      $totalWaitMs = $initialWaitMs + [int]$stopwatch.ElapsedMilliseconds + $settleWaitMs

      if ($snapshot.Case.RequiresFollowUpWait) {
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] 응답 변화 감지 | 경우의 수: $($snapshot.Case.Label) | 본문: $($snapshot.Text -replace '\n', ' | ')"
        $currentBaseline = $snapshot
        continue
      }

      return [pscustomobject]@{
        Snapshot       = $snapshot
        WaitedMs       = $totalWaitMs
        ChangeDistance = $distance
      }
    }

    $pollMs = Get-EffectiveDelayMs -BaseDelayMs $pollBaseMs -RandomJitterMs $pollJitterMs
    Start-Sleep -Milliseconds $pollMs
  }

  if ($null -eq $lastSnapshot) {
    $lastSnapshot = Get-ResponseSnapshot -Rectangle $Rectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode
  }

  $finalDistance = Get-HashDistance -LeftHash $currentBaseline.Signature -RightHash $lastSnapshot.Signature
  $finalTextChanged = -not [string]::IsNullOrWhiteSpace($lastSnapshot.Case.NormalizedText) -and ($lastSnapshot.Case.NormalizedText -ne $currentBaseline.Case.NormalizedText)
  $hasRecognizedCase = $lastSnapshot.Case.Label -in @("강화 성공", "유지", "파괴", "복념", "배틀 카드", "자랑하기 카드")

  if ($hasRecognizedCase -or $finalTextChanged -or $finalDistance -ge 1) {
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] 응답 대기 타임아웃 보정 | 경우의 수: $($lastSnapshot.Case.Label) | 변화거리: $finalDistance | 마지막 OCR: $($lastSnapshot.Text -replace '\n', ' | ')"
    return [pscustomobject]@{
      Snapshot       = $lastSnapshot
      WaitedMs       = [int]$stopwatch.ElapsedMilliseconds
      ChangeDistance = $finalDistance
      TimedOut       = $true
    }
  }

  throw "다음 봇 응답이 ${timeoutMs}ms 안에 오지 않았습니다. 응답은 왔는데 감지가 늦을 수 있으니 잠시 후 다시 시도해 보세요."
}

function Read-ScreenLevel {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$Rectangle,
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [string]$CaptureMode
  )

  $snapshot = Get-ResponseSnapshot -Rectangle $Rectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode
  return [pscustomobject]@{
    Text  = $snapshot.Text
    Level = $snapshot.Level
  }
}

function Get-ActionableSnapshot {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Rectangle]$Rectangle,
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    [string]$CaptureMode,
    [Parameter(Mandatory = $true)]
    [int]$BaseDelayMs,
    [Parameter(Mandatory = $true)]
    [int]$RandomJitterMs,
    [Parameter(Mandatory = $true)]
    [int]$Attempt
  )

  $snapshot = Get-ResponseSnapshot -Rectangle $Rectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode -IncludeWords

  while ($true) {
    $actionButton = Find-ResponseActionButton -Snapshot $snapshot
    if ($null -ne $actionButton) {
      return $snapshot
    }

    $buttonWords = @(
      @($snapshot.Words |
        Where-Object {
          $_.CenterY -ge (
            $snapshot.ButtonScanRectangle.Top + [int][Math]::Round($snapshot.ButtonScanRectangle.Height * 0.14)
          )
        } |
        Sort-Object Top, Left |
        Select-Object -Last 8 |
        ForEach-Object { $_.Text })
    )
    $buttonHint = if ($buttonWords.Count -gt 0) { ($buttonWords -join ", ") } else { "(none)" }
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] 시도 $Attempt | 강화 버튼 대기 중 | 현재 경우의 수: $($snapshot.Case.Label) | 하단 OCR: $buttonHint"
    $responseResult = Wait-ForNextBotResponse -Rectangle $Rectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode -BaselineSnapshot $snapshot -BaseDelayMs $BaseDelayMs -RandomJitterMs $RandomJitterMs
    Write-ResponseWaitLog -Attempt $Attempt -ResponseResult $responseResult
    Write-LoopLog -Attempt $Attempt -Level $responseResult.Snapshot.Level -Text $responseResult.Snapshot.Text
    $snapshot = Get-ResponseSnapshot -Rectangle $Rectangle -WindowHandle $WindowHandle -CaptureMode $CaptureMode -IncludeWords
  }
}

function Invoke-ResponseActionButton {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)]
    $Snapshot,
    [Parameter(Mandatory = $true)]
    [int]$DelayMs
  )

  $button = Find-ResponseActionButton -Snapshot $Snapshot
  if ($null -eq $button) {
    $bottomWords = @(@($Snapshot.Words | Sort-Object Top, Left | Select-Object -Last 8 | ForEach-Object { $_.Text }))
    $hintText = if ($bottomWords.Count -gt 0) { ($bottomWords -join ", ") } else { "(none)" }
    throw "최근 봇 카드에서 강화 버튼을 찾지 못했습니다. 카드 하단 버튼이 보이도록 하고 다시 시도하세요. 하단 OCR 후보: $hintText"
  }

  $actionHandle = Find-ActionHandle -WindowHandle $WindowHandle
  $clickResult = Invoke-BackgroundClientClick -WindowHandle $WindowHandle -PreferredHandle $actionHandle -ScreenPoint $button.ClickPoint -DelayMs $DelayMs

  return [pscustomobject]@{
    Label       = $button.Label
    SourceText  = $button.Text
    ScreenPoint = $button.ClickPoint
    TargetHandle = $clickResult.TargetHandle
    ClientX     = $clickResult.ClientX
    ClientY     = $clickResult.ClientY
  }
}

function Send-CommandToChat {
  param(
    [Parameter(Mandatory = $true)]
    [System.Diagnostics.Process]$Process,
    [Parameter(Mandatory = $true)]
    [__ComObject]$Shell,
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [Parameter(Mandatory = $true)]
    [string]$SendMode,
    [Parameter(Mandatory = $true)]
    [string]$CommandInputMode,
    [Parameter(Mandatory = $true)]
    [string[]]$InputClassHints,
    [Parameter(Mandatory = $true)]
    [int]$DelayMs
  )

  $windowHandle = Get-WindowHandle -Process $Process
  $usedBackgroundSend = $false
  $preferForeground = $SendMode -eq "foreground" -or ($Text.StartsWith("/") -and $SendMode -ne "background")

  if (-not $preferForeground) {
    $inputHandle = Find-InputHandle -WindowHandle $windowHandle -ClassHints $InputClassHints
    if ($inputHandle -ne [IntPtr]::Zero) {
      [void][KakaoMacroWin32]::SendMessage($inputHandle, [KakaoMacroWin32]::WM_SETTEXT, [IntPtr]::Zero, "")
      Start-Sleep -Milliseconds 40

      if ($Text.StartsWith("/")) {
        [void][KakaoMacroWin32]::PostMessage($inputHandle, [KakaoMacroWin32]::WM_KEYDOWN, [IntPtr][KakaoMacroWin32]::VK_OEM_2, [IntPtr]::Zero)
        [void][KakaoMacroWin32]::PostMessage($inputHandle, [KakaoMacroWin32]::WM_CHAR, [IntPtr][int][char]"/", [IntPtr]::Zero)
        [void][KakaoMacroWin32]::PostMessage($inputHandle, [KakaoMacroWin32]::WM_KEYUP, [IntPtr][KakaoMacroWin32]::VK_OEM_2, [IntPtr]::Zero)
        Start-Sleep -Milliseconds 30

        if ($Text.Length -gt 1) {
          [void][KakaoMacroWin32]::SendMessage($inputHandle, [KakaoMacroWin32]::EM_REPLACESEL, [IntPtr]::new(1), $Text.Substring(1))
        }
      } else {
        [void][KakaoMacroWin32]::SendMessage($inputHandle, [KakaoMacroWin32]::EM_REPLACESEL, [IntPtr]::new(1), $Text)
      }

      Start-Sleep -Milliseconds 60
      [void][KakaoMacroWin32]::PostMessage($inputHandle, [KakaoMacroWin32]::WM_KEYDOWN, [IntPtr][KakaoMacroWin32]::VK_RETURN, [IntPtr]::Zero)
      [void][KakaoMacroWin32]::PostMessage($inputHandle, [KakaoMacroWin32]::WM_CHAR, [IntPtr][KakaoMacroWin32]::VK_RETURN, [IntPtr]::Zero)
      [void][KakaoMacroWin32]::PostMessage($inputHandle, [KakaoMacroWin32]::WM_KEYUP, [IntPtr][KakaoMacroWin32]::VK_RETURN, [IntPtr]::Zero)
      Start-Sleep -Milliseconds 100
      [void][KakaoMacroWin32]::PostMessage($inputHandle, [KakaoMacroWin32]::WM_KEYDOWN, [IntPtr][KakaoMacroWin32]::VK_RETURN, [IntPtr]::Zero)
      [void][KakaoMacroWin32]::PostMessage($inputHandle, [KakaoMacroWin32]::WM_CHAR, [IntPtr][KakaoMacroWin32]::VK_RETURN, [IntPtr]::Zero)
      [void][KakaoMacroWin32]::PostMessage($inputHandle, [KakaoMacroWin32]::WM_KEYUP, [IntPtr][KakaoMacroWin32]::VK_RETURN, [IntPtr]::Zero)
      $usedBackgroundSend = $true
    } elseif ($SendMode -eq "background") {
      throw "배경 입력용 채팅 입력창을 찾지 못했습니다. '입력창 찾기'를 눌러 클래스 목록을 먼저 확인하세요."
    }
  }

  if ($usedBackgroundSend) {
    return
  }

  Activate-Window -Process $Process -Shell $Shell -DelayMs $DelayMs
  $inputHandle = Find-InputHandle -WindowHandle $windowHandle -ClassHints $InputClassHints
  if ($inputHandle -ne [IntPtr]::Zero) {
    [void](Focus-InputHandle -WindowHandle $windowHandle -InputHandle $inputHandle -DelayMs $DelayMs)
  }
  Start-Sleep -Milliseconds 80
  $Shell.SendKeys("^{a}")
  Start-Sleep -Milliseconds 60
  $Shell.SendKeys("{BACKSPACE}")
  Start-Sleep -Milliseconds 60

  if ($CommandInputMode -eq "slash-key" -and $Text.StartsWith("/")) {
    $Shell.SendKeys("/")
    Start-Sleep -Milliseconds 80

    if ($Text.Length -gt 1) {
      Set-Clipboard -Value $Text.Substring(1)
      Start-Sleep -Milliseconds 80
      $Shell.SendKeys("^v")
    }
  } else {
    Set-Clipboard -Value $Text
    Start-Sleep -Milliseconds 80
    $Shell.SendKeys("^v")
  }

  Start-Sleep -Milliseconds 100
  $Shell.SendKeys("~")
  Start-Sleep -Milliseconds 120
  $Shell.SendKeys("~")
}

function Get-EffectiveDelayMs {
  param(
    [Parameter(Mandatory = $true)]
    [int]$BaseDelayMs,
    [Parameter(Mandatory = $true)]
    [int]$RandomJitterMs
  )

  if ($RandomJitterMs -le 0) {
    return $BaseDelayMs
  }

  $offset = Get-Random -Minimum (-$RandomJitterMs) -Maximum ($RandomJitterMs + 1)
  return [Math]::Max(0, ($BaseDelayMs + $offset))
}

function Write-LoopLog {
  param(
    [int]$Attempt,
    [Nullable[int]]$Level,
    [string]$Text
  )

  $timestamp = Get-Date -Format "HH:mm:ss"
  if ($null -eq $Level) {
    $levelLabel = "none"
  } else {
    $levelLabel = $Level
  }

  if ([string]::IsNullOrWhiteSpace($Text)) {
    $ocrLabel = "(empty text)"
  } else {
    $ocrLabel = $Text -replace "\n", " | "
  }
  Write-Host "[$timestamp] 시도 $Attempt | 감지 수치: $levelLabel | OCR: $ocrLabel"
}

function Write-ResponseWaitLog {
  param(
    [int]$Attempt,
    [Parameter(Mandatory = $true)]
    $ResponseResult
  )

  $timestamp = Get-Date -Format "HH:mm:ss"
  $caseLabel = $ResponseResult.Snapshot.Case.Label
  $distance = $ResponseResult.ChangeDistance
  $waitedMs = $ResponseResult.WaitedMs
  Write-Host "[$timestamp] 시도 $Attempt | 새 봇 응답 감지 | 경우의 수: $caseLabel | 변화거리: $distance | 응답 대기: $waitedMs ms"
}

$manualRegion = [System.Drawing.Rectangle]::new($RegionLeft, $RegionTop, $RegionWidth, $RegionHeight)
$shell = New-Object -ComObject WScript.Shell
Write-Host "스크립트 버전: $ScriptVersion"

if ($ListWindows) {
  Show-WindowCandidates
  return
}

$targetProcess = Get-TargetProcess -Keyword $WindowTitleKeyword -ProcessNameKeyword $ProcessNameKeyword
$targetHandle = Get-WindowHandle -Process $targetProcess
$restoredOpaque = Ensure-OpaqueWindow -WindowHandle $targetHandle
$previousClipboard = $null
$ghostState = $null
$effectiveCaptureMode = $CaptureMode
$useGhostForeground = $GhostForeground -and $SendMode -eq "foreground"
$useAutoChatScan = $AutoChatScan.IsPresent
$shouldRestoreClipboard = $RestoreClipboard -and -not $PreviewOnly -and -not $ListChildWindows -and -not $ListWindows -and $SendMode -eq "foreground"
$clipboardBackupAvailable = $false

if ($useGhostForeground -and $CaptureMode -eq "screen") {
  $effectiveCaptureMode = "window"
}

if ($shouldRestoreClipboard) {
  try {
    $previousClipboard = Get-Clipboard -Raw -ErrorAction Stop
    $clipboardBackupAvailable = $true
  } catch {
    $previousClipboard = $null
    $clipboardBackupAvailable = $false
  }
}

try {
  $monitorRegion = Get-ResponseMonitorRectangle -WindowHandle $targetHandle -InputClassHints $InputClassHints -ManualRectangle $manualRegion -UseAutoChatScan $useAutoChatScan
  Write-Host "대상 창: $($targetProcess.MainWindowTitle)"
  if ($restoredOpaque) {
    Write-Host "이전 실행에서 남아 있던 투명 상태를 지우고 카카오톡 창을 다시 불투명하게 복구했습니다."
  }
  if ($SendOnly) {
    Write-Host "전송 전용 모드입니다. 목표 수치 판단 없이 명령만 반복하되, 다음 봇 응답이 올 때까지는 다시 보내지 않습니다."
    if ($SendMode -eq "background") {
      Write-Host "동작 방식: background-button | 반복 횟수: 최대 $MaxAttempts"
    } else {
      Write-Host "입력 방식: $SendMode | 명령 입력: $CommandInputMode | 반복 횟수: 최대 $MaxAttempts"
    }
    Write-Host "기본 전송 간격: $ResponseDelayMs ms | 랜덤 지연: +/- $RandomDelayMs ms"
    if ($useAutoChatScan) {
      Write-Host "자동 채팅 감시 사용 중입니다. 입력창 위 최근 봇 응답 영역을 자동으로 읽습니다."
    } else {
      Write-Host "선택 영역은 최근 봇 응답 전체(제목, 본문, 버튼)를 포함하도록 잡아야 합니다."
    }
  } else {
    Write-Host "응답 감시 영역: X=$($monitorRegion.Left) Y=$($monitorRegion.Top) 너비=$($monitorRegion.Width) 높이=$($monitorRegion.Height)"
    if ($SendMode -eq "background") {
      Write-Host "읽기 방식: $effectiveCaptureMode | 동작 방식: background-button"
    } else {
      Write-Host "읽기 방식: $effectiveCaptureMode | 입력 방식: $SendMode | 명령 입력: $CommandInputMode"
    }
    Write-Host "기본 응답 대기: $ResponseDelayMs ms | 랜덤 지연: +/- $RandomDelayMs ms"
    if ($useAutoChatScan) {
      Write-Host "자동 채팅 감시 사용 중입니다. 수동 좌표 대신 입력창 위 최근 봇 응답 영역을 자동으로 읽습니다."
    } else {
      Write-Host "선택 영역은 최근 봇 응답 전체(제목, 본문, 버튼)를 포함하도록 잡는 편이 가장 안정적입니다."
    }
  }
  if ($PreviewOnly) {
    Write-Host "응답 읽기 테스트 모드입니다. 현재 선택한 봇 응답 영역을 한 번만 읽습니다."
  } elseif ($SendOnly) {
    if ($SendMode -eq "background") {
      Write-Host "버튼 동작: 현재 보이는 채팅 중 가장 아래 강화 버튼만 클릭"
    } else {
      Write-Host "명령어: $CommandText"
    }
  } else {
    if ($SendMode -eq "background") {
      Write-Host "목표 강화: $TargetLevel | 버튼 동작: 현재 보이는 채팅 중 가장 아래 강화 버튼만 클릭"
    } else {
      Write-Host "목표 강화: $TargetLevel | 명령어: $CommandText"
    }
  }
  if ($SendMode -eq "foreground") {
    Write-Host "전경 입력 방식입니다. 카카오톡을 앞으로 가져와서 실제 키 입력으로 보냅니다."
    if ($useGhostForeground) {
      Write-Host "전경 숨김 모드입니다. 카카오톡 창을 거의 투명하게 만들고 입력합니다."
      Write-Host "투명화 대상은 현재 찾은 채팅방 창 하나뿐입니다: $($targetProcess.MainWindowTitle)"
      if ($effectiveCaptureMode -ne $CaptureMode) {
        Write-Host "투명 창에서는 화면 OCR이 보이지 않아서 읽기 방식을 window 로 자동 전환했습니다."
      }
    }
  } else {
    Write-Host "배경 버튼 클릭 방식입니다. 현재 보이는 채팅 중 가장 아래 강화 버튼을 직접 누릅니다. 창이 가려져 있어도 되지만 최소화하면 안 됩니다."
  }

  if ($ListChildWindows) {
    Show-ChildWindows -WindowHandle $targetHandle
    return
  }

  if ($CountdownSeconds -gt 0) {
    for ($remaining = $CountdownSeconds; $remaining -ge 1; $remaining--) {
      Write-Host "$remaining초 후 시작"
      Start-Sleep -Seconds 1
    }
  }

  if ($SendMode -eq "foreground") {
    Activate-Window -Process $targetProcess -Shell $shell -DelayMs $FocusDelayMs
    if ($useGhostForeground) {
      $ghostState = Enable-GhostForegroundWindow -WindowHandle $targetHandle -Alpha $GhostAlpha
      Start-Sleep -Milliseconds 120
    }
  }

  if ($PreviewOnly) {
    $preview = Read-ScreenLevel -Rectangle $monitorRegion -WindowHandle $targetHandle -CaptureMode $effectiveCaptureMode
    Write-LoopLog -Attempt 0 -Level $preview.Level -Text $preview.Text
    return
  }

  if ($SendOnly) {
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
      $gapMs = Wait-RandomLoopGap -BaseDelayMs $LoopDelayMs -RandomJitterMs $RandomDelayMs
      if ($SendMode -eq "background") {
        $baselineSnapshot = Get-ActionableSnapshot -Rectangle $monitorRegion -WindowHandle $targetHandle -CaptureMode $effectiveCaptureMode -BaseDelayMs $ResponseDelayMs -RandomJitterMs $RandomDelayMs -Attempt $attempt
        $actionResult = Invoke-ResponseActionButton -WindowHandle $targetHandle -Snapshot $baselineSnapshot -DelayMs $FocusDelayMs
      } else {
        $baselineSnapshot = Get-ResponseSnapshot -Rectangle $monitorRegion -WindowHandle $targetHandle -CaptureMode $effectiveCaptureMode
        Send-CommandToChat -Process $targetProcess -Shell $shell -Text $CommandText -SendMode $SendMode -CommandInputMode $CommandInputMode -InputClassHints $InputClassHints -DelayMs $FocusDelayMs
      }
      $timestamp = Get-Date -Format "HH:mm:ss"
      if ($SendMode -eq "background") {
        Write-Host "[$timestamp] 시도 $attempt | 버튼 클릭 완료 | 직전 랜덤 텀: $gapMs ms | 버튼: $($actionResult.Label) | OCR: $($actionResult.SourceText)"
      } else {
        Write-Host "[$timestamp] 시도 $attempt | 전송 완료 | 직전 랜덤 텀: $gapMs ms | 명령어: $CommandText"
      }
      $responseResult = Wait-ForNextBotResponse -Rectangle $monitorRegion -WindowHandle $targetHandle -CaptureMode $effectiveCaptureMode -BaselineSnapshot $baselineSnapshot -BaseDelayMs $ResponseDelayMs -RandomJitterMs $RandomDelayMs
      Write-ResponseWaitLog -Attempt $attempt -ResponseResult $responseResult
      Write-LoopLog -Attempt $attempt -Level $responseResult.Snapshot.Level -Text $responseResult.Snapshot.Text
    }

    Write-Host "전송 전용 반복이 끝나서 중지합니다."
    return
  }

  $missCount = 0

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    $gapMs = Wait-RandomLoopGap -BaseDelayMs $LoopDelayMs -RandomJitterMs $RandomDelayMs
    if ($SendMode -eq "background") {
      $baselineSnapshot = Get-ActionableSnapshot -Rectangle $monitorRegion -WindowHandle $targetHandle -CaptureMode $effectiveCaptureMode -BaseDelayMs $ResponseDelayMs -RandomJitterMs $RandomDelayMs -Attempt $attempt
      if ($null -ne $baselineSnapshot.Level -and $baselineSnapshot.Level -ge $TargetLevel) {
        Write-Host "이미 목표 강화 수치($TargetLevel)에 도달한 상태라서 중지합니다."
        break
      }
      $actionResult = Invoke-ResponseActionButton -WindowHandle $targetHandle -Snapshot $baselineSnapshot -DelayMs $FocusDelayMs
    } else {
      $baselineSnapshot = Get-ResponseSnapshot -Rectangle $monitorRegion -WindowHandle $targetHandle -CaptureMode $effectiveCaptureMode
      Send-CommandToChat -Process $targetProcess -Shell $shell -Text $CommandText -SendMode $SendMode -CommandInputMode $CommandInputMode -InputClassHints $InputClassHints -DelayMs $FocusDelayMs
    }
    $timestamp = Get-Date -Format "HH:mm:ss"
    if ($SendMode -eq "background") {
      Write-Host "[$timestamp] 시도 $attempt | 버튼 클릭 완료 | 직전 랜덤 텀: $gapMs ms | 버튼: $($actionResult.Label) | OCR: $($actionResult.SourceText)"
    } else {
      Write-Host "[$timestamp] 시도 $attempt | 전송 완료 | 직전 랜덤 텀: $gapMs ms | 명령어: $CommandText"
    }
    $responseResult = Wait-ForNextBotResponse -Rectangle $monitorRegion -WindowHandle $targetHandle -CaptureMode $effectiveCaptureMode -BaselineSnapshot $baselineSnapshot -BaseDelayMs $ResponseDelayMs -RandomJitterMs $RandomDelayMs
    Write-ResponseWaitLog -Attempt $attempt -ResponseResult $responseResult
    $scan = $responseResult.Snapshot
    Write-LoopLog -Attempt $attempt -Level $scan.Level -Text $scan.Text

    if ($null -eq $scan.Level) {
      if ($scan.Case.Label -eq "강화 성공") {
        $missCount++
        if ($missCount -ge $MaxMisses) {
          throw "강화 성공 응답은 잡혔지만 강화 단계 숫자를 $MaxMisses번 연속으로 읽지 못했습니다. 성공 본문과 획득 검 문구가 함께 들어오게 영역을 다시 잡아 보세요."
        }
      } elseif ($scan.Case.Label -in @("유지", "파괴", "복념", "배틀 카드", "자랑하기 카드")) {
        $missCount = 0
      } else {
        $missCount++
        if ($missCount -ge $MaxMisses) {
          throw "OCR이 $MaxMisses번 연속으로 숫자를 못 읽었습니다. 선택 영역을 최근 봇 응답 전체로 다시 잡아 보세요."
        }
      }
    } else {
      $missCount = 0
      if ($scan.Level -ge $TargetLevel) {
        Write-Host "목표 강화 수치($TargetLevel)에 도달해서 중지합니다."
        break
      }
    }
  }
} finally {
  if ($useGhostForeground) {
    Restore-GhostForegroundWindow -WindowHandle $targetHandle -State $ghostState
  }

  if ($shouldRestoreClipboard -and $clipboardBackupAvailable) {
    if ($null -ne $previousClipboard) {
      Set-Clipboard -Value $previousClipboard
    }
  }
}
