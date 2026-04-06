#Requires AutoHotkey v2.0
#SingleInstance Force

global App := Map()
App["BaseDir"] := A_ScriptDir
App["SettingsPath"] := App["BaseDir"] "\studio-settings.ini"
App["TempConfigPath"] := A_Temp "\kakao-enhance-studio-config.json"
App["WrapperPath"] := App["BaseDir"] "\invoke-enhance-job.ps1"
App["Exec"] := 0
App["CurrentMode"] := ""
App["PollFn"] := PollExec
App["TopLeftX"] := 0
App["TopLeftY"] := 0

cfg := LoadSettings()
gui := Gui("+Resize +MinSize760x640", "Kakao Enhance Studio")
gui.BackColor := "F4E4BE"
gui.MarginX := 18
gui.MarginY := 16
gui.SetFont("s10", "Segoe UI")
gui.OnEvent("Close", OnGuiClose)
gui.OnEvent("Size", OnGuiSize)
App["Gui"] := gui

title := gui.AddText("xm ym w520 +0x200", "Hidden KakaoTalk macro controller")
title.SetFont("s15 w700", "Segoe UI Semibold")
subTitle := gui.AddText("xm y+4 w690 c5E4A2F", "AutoHotkey v2 front-end for the PowerShell OCR/background-send backend")

gui.SetFont("s10", "Segoe UI")

gui.AddText("xm y+18 w100", "Window title")
windowTitle := gui.AddEdit("x+8 yp-3 w190", cfg["windowTitleKeyword"])
gui.AddText("x+18 yp+3 w100", "Process name")
processName := gui.AddEdit("x+8 yp-3 w150", cfg["processNameKeyword"])
gui.AddText("x+18 yp+3 w80", "Command")
commandText := gui.AddEdit("x+8 yp-3 w100", cfg["commandText"])

gui.AddText("xm y+14 w100", "Target level")
targetLevel := gui.AddEdit("x+8 yp-3 w70 Number", cfg["targetLevel"])
gui.AddText("x+18 yp+3 w110", "Response delay")
responseDelay := gui.AddEdit("x+8 yp-3 w80 Number", cfg["responseDelayMs"])
gui.AddText("x+10 yp+3 w30", "ms")
gui.AddText("x+18 yp w100", "Countdown")
countdown := gui.AddEdit("x+8 yp-3 w60 Number", cfg["countdownSeconds"])
gui.AddText("x+10 yp+3 w60", "sec")

gui.AddText("xm y+14 w100", "Capture mode")
captureMode := gui.AddComboBox("x+8 yp-3 w110 Choose1", ["window", "auto", "screen"])
SetComboValue(captureMode, cfg["captureMode"])
gui.AddText("x+18 yp+3 w90", "Send mode")
sendMode := gui.AddComboBox("x+8 yp-3 w130 Choose1", ["background", "auto", "foreground"])
SetComboValue(sendMode, cfg["sendMode"])
restoreOption := "x+18 yp+2" . (cfg["restoreClipboard"] ? " Checked" : "")
restoreClipboard := gui.AddCheckBox(restoreOption, "Restore clipboard")

gui.AddText("xm y+18 w100", "Region left")
regionLeft := gui.AddEdit("x+8 yp-3 w75 Number", cfg["regionLeft"])
gui.AddText("x+12 yp+3 w70", "Top")
regionTop := gui.AddEdit("x+8 yp-3 w75 Number", cfg["regionTop"])
gui.AddText("x+12 yp+3 w70", "Width")
regionWidth := gui.AddEdit("x+8 yp-3 w75 Number", cfg["regionWidth"])
gui.AddText("x+12 yp+3 w70", "Height")
regionHeight := gui.AddEdit("x+8 yp-3 w75 Number", cfg["regionHeight"])

pickTopLeft := gui.AddButton("xm y+12 w140 h28", "Use Mouse As Left/Top")
pickBottomRight := gui.AddButton("x+10 yp w160 h28", "Use Mouse As Right/Bottom")
saveButton := gui.AddButton("x+10 yp w80 h28", "Save")
previewButton := gui.AddButton("x+10 yp w90 h28", "Preview OCR")
listWindowsButton := gui.AddButton("x+10 yp w90 h28", "List Windows")
listChildButton := gui.AddButton("x+10 yp w100 h28", "List Child")

gui.AddText("xm y+18 w100", "Input classes")
inputClasses := gui.AddEdit("x+8 yp-3 w610", cfg["inputClassHints"])

runButton := gui.AddButton("xm y+16 w160 h34 Default", "Run Hidden")
stopButton := gui.AddButton("x+12 yp w100 h34", "Stop")
statusText := gui.AddText("x+16 yp+8 w400 c5E4A2F", "Idle")

logTitle := gui.AddText("xm y+20 w120 +0x200", "Output")
logBox := gui.AddEdit("xm y+6 w700 r20 ReadOnly -Wrap WantReturn VScroll", "")

App["Controls"] := Map(
  "windowTitleKeyword", windowTitle,
  "processNameKeyword", processName,
  "commandText", commandText,
  "targetLevel", targetLevel,
  "responseDelayMs", responseDelay,
  "countdownSeconds", countdown,
  "captureMode", captureMode,
  "sendMode", sendMode,
  "restoreClipboard", restoreClipboard,
  "regionLeft", regionLeft,
  "regionTop", regionTop,
  "regionWidth", regionWidth,
  "regionHeight", regionHeight,
  "inputClassHints", inputClasses,
  "status", statusText,
  "log", logBox,
  "run", runButton,
  "stop", stopButton,
  "preview", previewButton,
  "listWindows", listWindowsButton,
  "listChild", listChildButton
)

pickTopLeft.OnEvent("Click", UseMouseAsTopLeft)
pickBottomRight.OnEvent("Click", UseMouseAsBottomRight)
saveButton.OnEvent("Click", SaveClicked)
previewButton.OnEvent("Click", PreviewClicked)
listWindowsButton.OnEvent("Click", ListWindowsClicked)
listChildButton.OnEvent("Click", ListChildClicked)
runButton.OnEvent("Click", RunClicked)
stopButton.OnEvent("Click", StopClicked)

gui.Show("w736 h700")
AppendLog("Studio ready. Save once after adjusting values.")
return

OnGuiClose(*) {
  global App
  StopCurrentExec()
  ExitApp()
}

OnGuiSize(guiObj, minMax, width, height) {
  global App
  if !App.Has("Controls") {
    return
  }

  controls := App["Controls"]
  log := controls["log"]
  status := controls["status"]
  runButton := controls["run"]
  stopButton := controls["stop"]
  preview := controls["preview"]
  listWindows := controls["listWindows"]
  listChild := controls["listChild"]

  status.Move(, , width - 344)
  log.Move(, , width - 36, height - log.Pos.Y - 22)

  previewX := width - 342
  preview.Move(previewX)
  listWindows.Move(previewX + 100)
  listChild.Move(previewX + 200)
  stopButton.Move(runButton.Pos.X + 172)
}

LoadSettings() {
  global App
  defaults := Map(
    "windowTitleKeyword", "",
    "processNameKeyword", "KakaoTalk",
    "commandText", Chr(0xAC15) Chr(0xD654),
    "targetLevel", "25",
    "responseDelayMs", "2200",
    "countdownSeconds", "0",
    "captureMode", "window",
    "sendMode", "background",
    "restoreClipboard", 1,
    "regionLeft", "1200",
    "regionTop", "180",
    "regionWidth", "180",
    "regionHeight", "70",
    "inputClassHints", "RichEdit50W,RichEdit20W,RichEdit20A,Edit"
  )

  path := App["SettingsPath"]
  if !FileExist(path) {
    return defaults
  }

  for key, value in defaults {
    if (key = "restoreClipboard") {
      defaults[key] := (IniRead(path, "studio", key, value) = "1") ? 1 : 0
    } else {
      defaults[key] := IniRead(path, "studio", key, value)
    }
  }

  return defaults
}

CollectSettings() {
  global App
  c := App["Controls"]
  return Map(
    "windowTitleKeyword", Trim(c["windowTitleKeyword"].Text),
    "processNameKeyword", Trim(c["processNameKeyword"].Text),
    "commandText", c["commandText"].Text,
    "targetLevel", Trim(c["targetLevel"].Text),
    "responseDelayMs", Trim(c["responseDelayMs"].Text),
    "countdownSeconds", Trim(c["countdownSeconds"].Text),
    "captureMode", Trim(c["captureMode"].Text),
    "sendMode", Trim(c["sendMode"].Text),
    "restoreClipboard", c["restoreClipboard"].Value ? 1 : 0,
    "regionLeft", Trim(c["regionLeft"].Text),
    "regionTop", Trim(c["regionTop"].Text),
    "regionWidth", Trim(c["regionWidth"].Text),
    "regionHeight", Trim(c["regionHeight"].Text),
    "inputClassHints", Trim(c["inputClassHints"].Text)
  )
}

SaveSettingsToIni(config) {
  global App
  for key, value in config {
    IniWrite(value, App["SettingsPath"], "studio", key)
  }
}

SaveClicked(*) {
  config := CollectSettings()
  SaveSettingsToIni(config)
  SetStatus("Saved settings.")
}

PreviewClicked(*) {
  StartMode("preview")
}

ListWindowsClicked(*) {
  StartMode("list-windows")
}

ListChildClicked(*) {
  StartMode("list-child")
}

RunClicked(*) {
  StartMode("run")
}

StopClicked(*) {
  if StopCurrentExec() {
    SetStatus("Stopped.")
    AppendLog("Stopped the active run.")
  } else {
    SetStatus("Nothing is running.")
  }
}

StartMode(mode) {
  global App
  if App["Exec"] {
    SetStatus("Another job is already running.")
    return
  }

  config := CollectSettings()
  if !ValidateConfig(config, mode) {
    return
  }

  SaveSettingsToIni(config)
  WriteRuntimeConfig(config)

  command := BuildPowerShellCommand(mode)
  shell := ComObject("WScript.Shell")

  try {
    exec := shell.Exec(command)
  } catch Error as err {
    AppendLog("Failed to start PowerShell wrapper.`r`n" err.Message)
    SetStatus("Start failed.")
    return
  }

  App["Exec"] := exec
  App["CurrentMode"] := mode
  SetButtonsEnabled(false)
  App["Controls"]["stop"].Enabled := true
  SetTimer(App["PollFn"], 250)
  SetStatus("Running " ModeLabel(mode) "...")
  AppendLog("Started " ModeLabel(mode) ".")
}

ValidateConfig(config, mode) {
  if (mode = "run" || mode = "preview" || mode = "list-child") {
    for key in ["regionLeft", "regionTop", "regionWidth", "regionHeight"] {
      if !IsIntegerText(config[key]) {
        SetStatus("Region values must be integers.")
        return false
      }
    }
  }

  if (mode = "run" || mode = "preview") {
    if !IsIntegerText(config["responseDelayMs"]) {
      SetStatus("Response delay must be an integer.")
      return false
    }

    if !IsIntegerText(config["countdownSeconds"]) {
      SetStatus("Countdown must be an integer.")
      return false
    }
  }

  if (mode = "run") {
    if !IsIntegerText(config["targetLevel"]) {
      SetStatus("Target level must be an integer.")
      return false
    }

    if (config["windowTitleKeyword"] = "" && config["processNameKeyword"] = "") {
      SetStatus("Set either a window title or a process name.")
      return false
    }
  }

  return true
}

IsIntegerText(value) {
  return RegExMatch(Trim(value), "^-?\d+$")
}

BuildPowerShellCommand(mode) {
  global App
  wrapper := QuoteForCommand(App["WrapperPath"])
  config := QuoteForCommand(App["TempConfigPath"])
  return "powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File " wrapper " -Mode " QuoteForCommand(mode) " -ConfigPath " config
}

WriteRuntimeConfig(config) {
  global App
  classes := []
  for _, item in StrSplit(config["inputClassHints"], ",") {
    value := Trim(item)
    if (value != "") {
      classes.Push(value)
    }
  }

  json := "{`n"
  json .= "  ""windowTitleKeyword"": " . JsonString(config["windowTitleKeyword"]) . ",`n"
  json .= "  ""processNameKeyword"": " . JsonString(config["processNameKeyword"]) . ",`n"
  json .= "  ""commandText"": " . JsonString(config["commandText"]) . ",`n"
  json .= "  ""targetLevel"": " . NumericJsonValue(config["targetLevel"], 25) . ",`n"
  json .= "  ""regionLeft"": " . NumericJsonValue(config["regionLeft"], 1) . ",`n"
  json .= "  ""regionTop"": " . NumericJsonValue(config["regionTop"], 1) . ",`n"
  json .= "  ""regionWidth"": " . NumericJsonValue(config["regionWidth"], 1) . ",`n"
  json .= "  ""regionHeight"": " . NumericJsonValue(config["regionHeight"], 1) . ",`n"
  json .= "  ""responseDelayMs"": " . NumericJsonValue(config["responseDelayMs"], 2200) . ",`n"
  json .= "  ""countdownSeconds"": " . NumericJsonValue(config["countdownSeconds"], 0) . ",`n"
  json .= "  ""captureMode"": " . JsonString(config["captureMode"]) . ",`n"
  json .= "  ""sendMode"": " . JsonString(config["sendMode"]) . ",`n"
  json .= "  ""restoreClipboard"": " . (config["restoreClipboard"] ? "true" : "false") . ",`n"
  json .= "  ""inputClassHints"": " . JsonArray(classes) . "`n"
  json .= "}`n"

  if FileExist(App["TempConfigPath"]) {
    FileDelete(App["TempConfigPath"])
  }
  FileAppend(json, App["TempConfigPath"], "UTF-8")
}

JsonArray(items) {
  parts := []
  for _, item in items {
    parts.Push(JsonString(item))
  }
  return "[" . Join(parts, ", ") . "]"
}

JsonString(value) {
  escaped := StrReplace(value, "\", "\\")
  escaped := StrReplace(escaped, Chr(34), "\" Chr(34))
  escaped := StrReplace(escaped, "`r", "\r")
  escaped := StrReplace(escaped, "`n", "\n")
  return Chr(34) . escaped . Chr(34)
}

Join(items, delimiter) {
  result := ""
  for index, item in items {
    if (index > 1) {
      result .= delimiter
    }
    result .= item
  }
  return result
}

NumericJsonValue(value, fallback) {
  trimmed := Trim(value)
  return RegExMatch(trimmed, "^-?\d+$") ? trimmed : fallback
}

QuoteForCommand(value) {
  return Chr(34) . StrReplace(value, Chr(34), "\" Chr(34)) . Chr(34)
}

ModeLabel(mode) {
  switch mode {
    case "run":
      return "hidden run"
    case "preview":
      return "OCR preview"
    case "list-windows":
      return "window list"
    case "list-child":
      return "child window list"
    default:
      return mode
  }
}

PollExec(*) {
  global App
  exec := App["Exec"]
  if !exec {
    return
  }

  try {
    status := exec.Status
  } catch {
    FinishExec("The PowerShell host exited unexpectedly.", true)
    return
  }

  if (status = 0) {
    return
  }

  output := ""
  try {
    output := exec.StdOut.ReadAll()
  } catch {
    output := "(stdout read failed)"
  }

  errors := ""
  try {
    errors := exec.StdErr.ReadAll()
  } catch {
    errors := ""
  }

  combined := Trim(output "`r`n" errors)
  if (combined = "") {
    combined := "(no output)"
  }

  FinishExec(combined, false)
}

FinishExec(output, crashed) {
  global App
  SetTimer(App["PollFn"], 0)
  App["Exec"] := 0

  if crashed {
    SetStatus("Run crashed.")
  } else {
    SetStatus("Done.")
  }

  SetButtonsEnabled(true)
  App["Controls"]["stop"].Enabled := false
  AppendLog(output)
}

StopCurrentExec() {
  global App
  exec := App["Exec"]
  if !exec {
    return false
  }

  try {
    exec.Terminate()
  } catch {
  }

  SetTimer(App["PollFn"], 0)
  App["Exec"] := 0
  SetButtonsEnabled(true)
  App["Controls"]["stop"].Enabled := false
  return true
}

SetButtonsEnabled(enabled) {
  global App
  for key in ["run", "preview", "listWindows", "listChild"] {
    App["Controls"][key].Enabled := enabled
  }
}

AppendLog(text) {
  global App
  log := App["Controls"]["log"]
  stamp := FormatTime(, "HH:mm:ss")
  prefix := "[" stamp "] "
  current := log.Text
  if (current = "") {
    log.Text := prefix text
  } else {
    log.Text := current "`r`n`r`n" prefix text
  }
  SendMessage(0x115, 7, 0, log.Hwnd)
}

SetStatus(text) {
  global App
  App["Controls"]["status"].Text := text
}

UseMouseAsTopLeft(*) {
  global App
  MouseGetPos(&x, &y)
  App["TopLeftX"] := x
  App["TopLeftY"] := y
  App["Controls"]["regionLeft"].Text := x
  App["Controls"]["regionTop"].Text := y
  SetStatus("Stored left/top from the current cursor position.")
}

UseMouseAsBottomRight(*) {
  global App
  MouseGetPos(&x, &y)
  left := IntegerOrZero(App["Controls"]["regionLeft"].Text)
  top := IntegerOrZero(App["Controls"]["regionTop"].Text)
  width := x - left
  height := y - top

  if (width <= 0 || height <= 0) {
    SetStatus("Move the cursor below and to the right of the saved left/top point.")
    return
  }

  App["Controls"]["regionWidth"].Text := width
  App["Controls"]["regionHeight"].Text := height
  SetStatus("Computed width/height from the current cursor position.")
}

IntegerOrZero(value) {
  return IsIntegerText(value) ? Integer(value) : 0
}

Integer(value) {
  return value + 0
}

SetComboValue(ctrl, value) {
  ctrl.Text := value
}
