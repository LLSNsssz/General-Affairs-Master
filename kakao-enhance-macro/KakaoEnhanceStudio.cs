using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace KakaoEnhanceStudio
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    internal sealed class StudioSettings
    {
        public StudioSettings()
        {
            windowTitleKeyword = "깅화방";
            processNameKeyword = "KakaoTalk";
            commandText = "/강화";
            targetLevel = 19;
            responseDelayMs = 2200;
            randomDelayMs = 900;
            countdownSeconds = 0;
            captureMode = "window";
            sendMode = "background";
            ghostForeground = false;
            ghostAlpha = 1;
            sendOnly = false;
            restoreClipboard = true;
            regionLeft = 1200;
            regionTop = 180;
            regionWidth = 180;
            regionHeight = 70;
            inputClassHints = new[] { "RichEdit50W", "RichEdit20W", "RichEdit20A", "Edit" };
        }

        public string windowTitleKeyword { get; set; }
        public string processNameKeyword { get; set; }
        public string commandText { get; set; }
        public int targetLevel { get; set; }
        public int responseDelayMs { get; set; }
        public int randomDelayMs { get; set; }
        public int countdownSeconds { get; set; }
        public string captureMode { get; set; }
        public string sendMode { get; set; }
        public bool ghostForeground { get; set; }
        public int ghostAlpha { get; set; }
        public bool sendOnly { get; set; }
        public bool restoreClipboard { get; set; }
        public int regionLeft { get; set; }
        public int regionTop { get; set; }
        public int regionWidth { get; set; }
        public int regionHeight { get; set; }
        public string[] inputClassHints { get; set; }
    }

    internal sealed class MainForm : Form
    {
        private readonly string _baseDir = AppDomain.CurrentDomain.BaseDirectory;
        private readonly string _settingsPath;
        private readonly string _wrapperPath;
        private readonly string _logFilePath;
        private readonly JavaScriptSerializer _serializer = new JavaScriptSerializer();

        private readonly TextBox _windowTitleBox = new TextBox();
        private readonly TextBox _processNameBox = new TextBox();
        private readonly TextBox _commandTextBox = new TextBox();
        private readonly NumericUpDown _targetLevelUpDown = new NumericUpDown();
        private readonly NumericUpDown _responseDelayUpDown = new NumericUpDown();
        private readonly NumericUpDown _countdownUpDown = new NumericUpDown();
        private readonly ComboBox _captureModeCombo = new ComboBox();
        private readonly ComboBox _sendModeCombo = new ComboBox();
        private readonly CheckBox _ghostForegroundCheck = new CheckBox();
        private readonly CheckBox _sendOnlyCheck = new CheckBox();
        private readonly CheckBox _restoreClipboardCheck = new CheckBox();
        private readonly NumericUpDown _regionLeftUpDown = new NumericUpDown();
        private readonly NumericUpDown _regionTopUpDown = new NumericUpDown();
        private readonly NumericUpDown _regionWidthUpDown = new NumericUpDown();
        private readonly NumericUpDown _regionHeightUpDown = new NumericUpDown();
        private readonly TextBox _logBox = new TextBox();
        private readonly Label _statusLabel = new Label();
        private readonly Button _saveButton = new Button();
        private readonly Button _listWindowsButton = new Button();
        private readonly Button _listChildButton = new Button();
        private readonly Button _selectRegionButton = new Button();
        private readonly Button _previewButton = new Button();
        private readonly Button _runButton = new Button();
        private readonly Button _stopButton = new Button();

        private Process _backendProcess;

        public MainForm()
        {
            _settingsPath = Path.Combine(_baseDir, "studio-settings.json");
            _wrapperPath = Path.Combine(_baseDir, "invoke-enhance-job.ps1");
            _logFilePath = Path.Combine(_baseDir, "last-run.log");

            Text = "카카오 자동강화";
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(760, 700);
            MinimumSize = new Size(776, 739);
            BackColor = ColorTranslator.FromHtml("#F4E4BE");
            Font = new Font("Segoe UI", 9F);

            try
            {
                File.WriteAllText(_logFilePath, string.Empty, new UTF8Encoding(true));
            }
            catch
            {
            }

            BuildUi();
            ApplySettings(LoadSettings());
            AppendLog("준비 완료. 순서대로만 누르면 됩니다.");
            AppendLog("1) 카톡창 찾기  2) 숫자영역 선택  3) 숫자 읽기 테스트  4) 자동강화 시작");
            AppendLog("로그 파일: " + _logFilePath);

            FormClosing += MainForm_FormClosing;
        }

        private void BuildUi()
        {
            Controls.Add(CreateTitleLabel("카카오 자동강화", new Point(18, 14), new Size(520, 32), 15F, FontStyle.Bold));
            Controls.Add(CreateTextLabel("순서: 카톡창 찾기 -> 숫자영역 선택 -> 숫자 읽기 테스트 -> 자동강화 시작", new Point(18, 48), new Size(710, 22), "#5E4A2F"));

            var targetGroup = CreateGroupBox("1. 대상 채팅방", new Rectangle(18, 82, 710, 94));
            targetGroup.Controls.Add(CreateFieldLabel("채팅방 이름", new Point(16, 30)));
            ConfigureTextBox(_windowTitleBox, new Rectangle(94, 26, 180, 26));
            targetGroup.Controls.Add(_windowTitleBox);

            targetGroup.Controls.Add(CreateFieldLabel("프로세스", new Point(298, 30)));
            ConfigureTextBox(_processNameBox, new Rectangle(362, 26, 110, 26));
            targetGroup.Controls.Add(_processNameBox);

            targetGroup.Controls.Add(CreateFieldLabel("강화 명령", new Point(494, 30)));
            ConfigureTextBox(_commandTextBox, new Rectangle(558, 26, 120, 26));
            targetGroup.Controls.Add(_commandTextBox);

            _listWindowsButton.Text = "카톡창 찾기";
            _listWindowsButton.Bounds = new Rectangle(94, 58, 120, 28);
            _listWindowsButton.Click += SafeUiAction((_, __) => StartBackend("list-windows"));
            targetGroup.Controls.Add(_listWindowsButton);

            _listChildButton.Text = "입력창 찾기";
            _listChildButton.Bounds = new Rectangle(222, 58, 120, 28);
            _listChildButton.Click += SafeUiAction((_, __) => StartBackend("list-child"));
            targetGroup.Controls.Add(_listChildButton);

            targetGroup.Controls.Add(CreateTextLabel("보통 채팅방 이름은 '깅화방', 프로세스는 'KakaoTalk' 그대로 두면 됩니다.", new Point(360, 63), new Size(320, 18), "#5E4A2F"));
            Controls.Add(targetGroup);

            var settingGroup = CreateGroupBox("2. 강화 설정", new Rectangle(18, 186, 710, 94));
            settingGroup.Controls.Add(CreateFieldLabel("목표 강화", new Point(16, 30)));
            ConfigureNumeric(_targetLevelUpDown, new Rectangle(94, 26, 70, 26), 0, 999, 19);
            settingGroup.Controls.Add(_targetLevelUpDown);

            settingGroup.Controls.Add(CreateFieldLabel("응답 대기", new Point(184, 30)));
            ConfigureNumeric(_responseDelayUpDown, new Rectangle(248, 26, 80, 26), 100, 30000, 2200);
            settingGroup.Controls.Add(_responseDelayUpDown);
            settingGroup.Controls.Add(CreateTextLabel("ms", new Point(334, 30), new Size(24, 20), "#000000"));

            settingGroup.Controls.Add(CreateFieldLabel("시작 대기", new Point(380, 30)));
            ConfigureNumeric(_countdownUpDown, new Rectangle(444, 26, 70, 26), 0, 60, 0);
            settingGroup.Controls.Add(_countdownUpDown);
            settingGroup.Controls.Add(CreateTextLabel("초", new Point(520, 30), new Size(24, 20), "#000000"));

            _sendOnlyCheck.Text = "전송만 반복";
            _sendOnlyCheck.Bounds = new Rectangle(558, 28, 120, 22);
            _sendOnlyCheck.CheckedChanged += (_, __) => UpdateModeControls();
            settingGroup.Controls.Add(_sendOnlyCheck);

            settingGroup.Controls.Add(CreateFieldLabel("읽기 방식", new Point(16, 61)));
            ConfigureCombo(_captureModeCombo, new Rectangle(94, 57, 110, 26), new[] { "screen", "auto", "window" }, "screen");
            settingGroup.Controls.Add(_captureModeCombo);

            settingGroup.Controls.Add(CreateFieldLabel("입력 방식", new Point(224, 61)));
            ConfigureCombo(_sendModeCombo, new Rectangle(288, 57, 120, 26), new[] { "background", "auto", "foreground" }, "background");
            _sendModeCombo.SelectedIndexChanged += (_, __) => UpdateModeControls();
            settingGroup.Controls.Add(_sendModeCombo);

            _ghostForegroundCheck.Text = "\uC804\uACBD \uCC3D \uC228\uAE40";
            _ghostForegroundCheck.Bounds = new Rectangle(430, 58, 120, 22);
            _ghostForegroundCheck.CheckedChanged += (_, __) =>
            {
                if (_ghostForegroundCheck.Checked)
                {
                    _sendModeCombo.SelectedItem = "foreground";
                    if (!_sendOnlyCheck.Checked)
                    {
                        _captureModeCombo.SelectedItem = "window";
                    }
                }
            };
            settingGroup.Controls.Add(_ghostForegroundCheck);

            _restoreClipboardCheck.Text = "클립보드 복구";
            _restoreClipboardCheck.Bounds = new Rectangle(556, 58, 120, 22);
            _restoreClipboardCheck.Checked = true;
            settingGroup.Controls.Add(_restoreClipboardCheck);
            settingGroup.Controls.Add(CreateTextLabel("전송만 반복을 켜면 OCR 없이 명령만 보냅니다.", new Point(520, 56), new Size(170, 30), "#5E4A2F"));
            Controls.Add(settingGroup);

            var regionGroup = CreateGroupBox("3. 숫자 영역 선택", new Rectangle(18, 290, 710, 118));
            regionGroup.Controls.Add(CreateFieldLabel("X", new Point(16, 30), 20));
            ConfigureNumeric(_regionLeftUpDown, new Rectangle(42, 26, 80, 26), 0, 32767, 1200);
            regionGroup.Controls.Add(_regionLeftUpDown);
            regionGroup.Controls.Add(CreateFieldLabel("Y", new Point(138, 30), 20));
            ConfigureNumeric(_regionTopUpDown, new Rectangle(164, 26, 80, 26), 0, 32767, 180);
            regionGroup.Controls.Add(_regionTopUpDown);
            regionGroup.Controls.Add(CreateFieldLabel("너비", new Point(262, 30), 32));
            ConfigureNumeric(_regionWidthUpDown, new Rectangle(302, 26, 80, 26), 1, 32767, 180);
            regionGroup.Controls.Add(_regionWidthUpDown);
            regionGroup.Controls.Add(CreateFieldLabel("높이", new Point(400, 30), 32));
            ConfigureNumeric(_regionHeightUpDown, new Rectangle(440, 26, 80, 26), 1, 32767, 70);
            regionGroup.Controls.Add(_regionHeightUpDown);

            _selectRegionButton.Text = "화면에서 숫자영역 드래그 선택";
            _selectRegionButton.Bounds = new Rectangle(16, 64, 220, 34);
            _selectRegionButton.Click += SafeUiAction((_, __) => SelectRegionFromScreen());
            regionGroup.Controls.Add(_selectRegionButton);

            _previewButton.Text = "숫자 읽기 테스트";
            _previewButton.Bounds = new Rectangle(246, 64, 130, 34);
            _previewButton.Click += SafeUiAction((_, __) => StartBackend("preview"));
            regionGroup.Controls.Add(_previewButton);

            _saveButton.Text = "설정 저장";
            _saveButton.Bounds = new Rectangle(386, 64, 100, 34);
            _saveButton.Click += SafeUiAction((_, __) =>
            {
                SaveSettings(CollectSettings());
                SetStatus("설정을 저장했습니다.");
                AppendLog("설정을 저장했습니다.");
            });
            regionGroup.Controls.Add(_saveButton);

            regionGroup.Controls.Add(CreateTextLabel("말풍선 전체 말고 현재 강화 숫자 줄만 드래그하세요.", new Point(500, 66), new Size(190, 36), "#5E4A2F"));
            Controls.Add(regionGroup);

            regionGroup.Text = "3. Auto Chat Scan";
            regionGroup.Height = 86;
            _regionLeftUpDown.Visible = false;
            _regionTopUpDown.Visible = false;
            _regionWidthUpDown.Visible = false;
            _regionHeightUpDown.Visible = false;
            _selectRegionButton.Visible = false;

            foreach (Control control in regionGroup.Controls)
            {
                if (ReferenceEquals(control, _previewButton) || ReferenceEquals(control, _saveButton))
                {
                    continue;
                }

                control.Visible = false;
            }

            _previewButton.Text = "\uCD5C\uADFC \uCC44\uD305 \uC77D\uAE30 \uD14C\uC2A4\uD2B8";
            _previewButton.Bounds = new Rectangle(452, 24, 150, 34);
            _saveButton.Text = "\uC124\uC815 \uC800\uC7A5";
            _saveButton.Bounds = new Rectangle(612, 24, 80, 34);
            regionGroup.Controls.Add(CreateTextLabel("\uC218\uB3D9 \uC88C\uD45C\uB294 \uB354 \uC774\uC0C1 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", new Point(16, 28), new Size(420, 20), "#5E4A2F"));
            regionGroup.Controls.Add(CreateTextLabel("\uCC3E\uC740 \uCC44\uD305\uBC29 \uCC3D\uC758 \uC785\uB825\uCC3D \uC704 \uCD5C\uADFC \uBD07 \uC751\uB2F5\uC744 \uC790\uB3D9 \uAC10\uC2DC\uD569\uB2C8\uB2E4.", new Point(16, 50), new Size(430, 20), "#5E4A2F"));

            var runGroup = CreateGroupBox("4. 실행", new Rectangle(18, 388, 710, 72));
            _runButton.Text = "자동강화 시작";
            _runButton.Bounds = new Rectangle(16, 24, 150, 34);
            _runButton.Click += SafeUiAction((_, __) => StartBackend("run"));
            runGroup.Controls.Add(_runButton);

            _stopButton.Text = "정지";
            _stopButton.Bounds = new Rectangle(176, 24, 90, 34);
            _stopButton.Enabled = false;
            _stopButton.Click += SafeUiAction((_, __) => StopBackend());
            runGroup.Controls.Add(_stopButton);

            _statusLabel.Text = "대기 중";
            _statusLabel.ForeColor = ColorTranslator.FromHtml("#5E4A2F");
            _statusLabel.Location = new Point(286, 30);
            _statusLabel.Size = new Size(400, 20);
            runGroup.Controls.Add(_statusLabel);
            Controls.Add(runGroup);

            Controls.Add(CreateTitleLabel("실행 로그", new Point(18, 476), new Size(120, 22), 10F, FontStyle.Bold));
            _logBox.Multiline = true;
            _logBox.ReadOnly = true;
            _logBox.ScrollBars = ScrollBars.Vertical;
            _logBox.BackColor = Color.White;
            _logBox.Bounds = new Rectangle(18, 504, 710, 176);
            Controls.Add(_logBox);
        }

        private static GroupBox CreateGroupBox(string text, Rectangle bounds)
        {
            return new GroupBox
            {
                Text = text,
                Bounds = bounds
            };
        }

        private static Label CreateTitleLabel(string text, Point location, Size size, float fontSize, FontStyle style)
        {
            return new Label
            {
                Text = text,
                Location = location,
                Size = size,
                Font = new Font("Segoe UI", fontSize, style)
            };
        }

        private static Label CreateFieldLabel(string text, Point location, int width = 64)
        {
            return new Label
            {
                Text = text,
                Location = location,
                Size = new Size(width, 20)
            };
        }

        private static Label CreateTextLabel(string text, Point location, Size size, string colorHtml)
        {
            return new Label
            {
                Text = text,
                Location = location,
                Size = size,
                ForeColor = ColorTranslator.FromHtml(colorHtml)
            };
        }

        private static void ConfigureTextBox(TextBox box, Rectangle bounds)
        {
            box.Bounds = bounds;
        }

        private static void ConfigureNumeric(NumericUpDown control, Rectangle bounds, int min, int max, int value)
        {
            control.Bounds = bounds;
            control.Minimum = min;
            control.Maximum = max;
            control.Value = value;
        }

        private static void ConfigureCombo(ComboBox combo, Rectangle bounds, string[] items, string selectedItem)
        {
            combo.Bounds = bounds;
            combo.DropDownStyle = ComboBoxStyle.DropDownList;
            combo.Items.AddRange(items);
            combo.SelectedItem = selectedItem;
        }

        private StudioSettings LoadSettings()
        {
            if (!File.Exists(_settingsPath))
            {
                return new StudioSettings();
            }

            try
            {
                var json = File.ReadAllText(_settingsPath, Encoding.UTF8);
                var loaded = _serializer.Deserialize<StudioSettings>(json);
                return loaded ?? new StudioSettings();
            }
            catch
            {
                return new StudioSettings();
            }
        }

        private void SaveSettings(StudioSettings settings)
        {
            var json = _serializer.Serialize(settings);
            File.WriteAllText(_settingsPath, json, new UTF8Encoding(true));
        }

        private void ApplySettings(StudioSettings settings)
        {
            _windowTitleBox.Text = settings.windowTitleKeyword ?? string.Empty;
            _processNameBox.Text = settings.processNameKeyword ?? "KakaoTalk";
            _commandTextBox.Text = settings.commandText ?? "/강화";
            _targetLevelUpDown.Value = ClampToRange(settings.targetLevel, _targetLevelUpDown);
            _responseDelayUpDown.Value = ClampToRange(settings.responseDelayMs, _responseDelayUpDown);
            _countdownUpDown.Value = ClampToRange(settings.countdownSeconds, _countdownUpDown);
            _captureModeCombo.SelectedItem = string.IsNullOrWhiteSpace(settings.captureMode) ? "screen" : settings.captureMode;
            _sendModeCombo.SelectedItem = string.IsNullOrWhiteSpace(settings.sendMode) ? "background" : settings.sendMode;
            _ghostForegroundCheck.Checked = settings.sendMode == "foreground" && settings.ghostForeground;
            _sendOnlyCheck.Checked = settings.sendOnly;
            _restoreClipboardCheck.Checked = settings.restoreClipboard;
            _regionLeftUpDown.Value = ClampToRange(settings.regionLeft, _regionLeftUpDown);
            _regionTopUpDown.Value = ClampToRange(settings.regionTop, _regionTopUpDown);
            _regionWidthUpDown.Value = ClampToRange(settings.regionWidth, _regionWidthUpDown);
            _regionHeightUpDown.Value = ClampToRange(settings.regionHeight, _regionHeightUpDown);
            UpdateModeControls();
        }

        private static decimal ClampToRange(int value, NumericUpDown control)
        {
            if (value < control.Minimum) return control.Minimum;
            if (value > control.Maximum) return control.Maximum;
            return value;
        }

        private StudioSettings CollectSettings()
        {
            return new StudioSettings
            {
                windowTitleKeyword = _windowTitleBox.Text.Trim(),
                processNameKeyword = _processNameBox.Text.Trim(),
                commandText = _commandTextBox.Text,
                targetLevel = (int)_targetLevelUpDown.Value,
                responseDelayMs = (int)_responseDelayUpDown.Value,
                randomDelayMs = 900,
                countdownSeconds = (int)_countdownUpDown.Value,
                captureMode = _captureModeCombo.Text,
                sendMode = _sendModeCombo.Text,
                ghostForeground = _sendModeCombo.Text == "foreground" && _ghostForegroundCheck.Checked,
                ghostAlpha = 1,
                sendOnly = _sendOnlyCheck.Checked,
                restoreClipboard = _restoreClipboardCheck.Checked,
                regionLeft = (int)_regionLeftUpDown.Value,
                regionTop = (int)_regionTopUpDown.Value,
                regionWidth = (int)_regionWidthUpDown.Value,
                regionHeight = (int)_regionHeightUpDown.Value,
                inputClassHints = new[] { "RichEdit50W", "RichEdit20W", "RichEdit20A", "Edit" }
            };
        }

        private void SelectRegionFromScreen()
        {
            Hide();
            using (var selector = new RegionSelectionForm())
            {
                var result = selector.ShowDialog();
                Show();
                Activate();

                if (result != DialogResult.OK)
                {
                    SetStatus("영역 선택을 취소했습니다.");
                    return;
                }

                _regionLeftUpDown.Value = ClampToRange(selector.SelectedRectangle.Left, _regionLeftUpDown);
                _regionTopUpDown.Value = ClampToRange(selector.SelectedRectangle.Top, _regionTopUpDown);
                _regionWidthUpDown.Value = ClampToRange(selector.SelectedRectangle.Width, _regionWidthUpDown);
                _regionHeightUpDown.Value = ClampToRange(selector.SelectedRectangle.Height, _regionHeightUpDown);

                SetStatus("숫자 영역을 저장했습니다.");
                AppendLog(string.Format("숫자영역 저장: X={0}, Y={1}, 너비={2}, 높이={3}", selector.SelectedRectangle.Left, selector.SelectedRectangle.Top, selector.SelectedRectangle.Width, selector.SelectedRectangle.Height));
            }
        }

        private void StartBackend(string mode)
        {
            if (_backendProcess != null && !_backendProcess.HasExited)
            {
                SetStatus("이미 실행 중입니다.");
                return;
            }

            var settings = CollectSettings();
            if (mode == "run" && string.IsNullOrWhiteSpace(settings.windowTitleKeyword) && string.IsNullOrWhiteSpace(settings.processNameKeyword))
            {
                SetStatus("채팅방 이름 또는 프로세스명을 입력하세요.");
                return;
            }

            if (settings.sendMode == "foreground" && settings.ghostForeground)
            {
                settings.sendMode = "foreground";
                _sendModeCombo.SelectedItem = "foreground";

                if (!settings.sendOnly)
                {
                    settings.captureMode = "window";
                    _captureModeCombo.SelectedItem = "window";
                }
            }

            SaveSettings(settings);

            var startInfo = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = string.Format("-NoProfile -STA -ExecutionPolicy Bypass -File \"{0}\" -Mode \"{1}\" -ConfigPath \"{2}\"", _wrapperPath, mode, _settingsPath),
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            _backendProcess = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
            _backendProcess.OutputDataReceived += (_, args) =>
            {
                if (!string.IsNullOrEmpty(args.Data))
                {
                    AppendLogSafe(args.Data);
                }
            };
            _backendProcess.ErrorDataReceived += (_, args) =>
            {
                if (!string.IsNullOrEmpty(args.Data))
                {
                    AppendLogSafe(args.Data);
                }
            };
            _backendProcess.Exited += (_, __) =>
            {
                BeginInvoke((Action)(() =>
                {
                    SetIdleState();
                    SetStatus("완료");
                }));
            };

            _backendProcess.Start();
            _backendProcess.BeginOutputReadLine();
            _backendProcess.BeginErrorReadLine();

            SetBusyState();
            var modeLabel = mode == "run" && _sendOnlyCheck.Checked ? "전송만 반복" : GetModeLabel(mode);
            SetStatus(modeLabel + " 실행 중...");
            AppendLog(modeLabel + " 시작");
        }

        private void StopBackend()
        {
            if (_backendProcess == null || _backendProcess.HasExited)
            {
                SetStatus("현재 실행 중인 작업이 없습니다.");
                return;
            }

            try
            {
                _backendProcess.Kill();
                AppendLog("실행 중인 작업을 중지했습니다.");
            }
            catch (Exception ex)
            {
                AppendLog("중지 실패: " + ex.Message);
            }
            finally
            {
                SetIdleState();
                SetStatus("정지됨");
            }
        }

        private void SetBusyState()
        {
            _runButton.Enabled = false;
            _previewButton.Enabled = false;
            _listWindowsButton.Enabled = false;
            _listChildButton.Enabled = false;
            _stopButton.Enabled = true;
            UpdateModeControls();
        }

        private void SetIdleState()
        {
            _runButton.Enabled = true;
            _previewButton.Enabled = true;
            _listWindowsButton.Enabled = true;
            _listChildButton.Enabled = true;
            _stopButton.Enabled = false;
            UpdateModeControls();
        }

        private void UpdateModeControls()
        {
            var useOcr = !_sendOnlyCheck.Checked;
            var isIdle = _backendProcess == null || _backendProcess.HasExited;
            var isForeground = string.Equals(_sendModeCombo.Text, "foreground", StringComparison.OrdinalIgnoreCase);

            if (!isForeground && _ghostForegroundCheck.Checked)
            {
                _ghostForegroundCheck.Checked = false;
            }

            _runButton.Text = _sendOnlyCheck.Checked ? "전송만 시작" : "자동강화 시작";
            _targetLevelUpDown.Enabled = useOcr;
            _captureModeCombo.Enabled = useOcr;
            _ghostForegroundCheck.Enabled = isIdle && isForeground;
            _regionLeftUpDown.Enabled = false;
            _regionTopUpDown.Enabled = false;
            _regionWidthUpDown.Enabled = false;
            _regionHeightUpDown.Enabled = false;
            _selectRegionButton.Enabled = false;
            _previewButton.Enabled = useOcr && isIdle;
        }

        private void AppendLogSafe(string text)
        {
            if (InvokeRequired)
            {
                BeginInvoke((Action)(() => AppendLog(text)));
                return;
            }

            AppendLog(text);
        }

        private void AppendLog(string text)
        {
            var line = string.Format("[{0}] {1}", DateTime.Now.ToString("HH:mm:ss"), text);
            if (string.IsNullOrWhiteSpace(_logBox.Text))
            {
                _logBox.Text = line;
            }
            else
            {
                _logBox.AppendText(Environment.NewLine + Environment.NewLine + line);
            }

            _logBox.SelectionStart = _logBox.TextLength;
            _logBox.ScrollToCaret();

            try
            {
                File.AppendAllText(_logFilePath, line + Environment.NewLine + Environment.NewLine, Encoding.UTF8);
            }
            catch
            {
            }
        }

        private void SetStatus(string text)
        {
            _statusLabel.Text = text;
        }

        private static string GetModeLabel(string mode)
        {
            switch (mode)
            {
                case "run":
                    return "자동강화";
                case "preview":
                    return "숫자 읽기 테스트";
                case "list-windows":
                    return "카톡창 찾기";
                case "list-child":
                    return "입력창 찾기";
                default:
                    return mode;
            }
        }

        private EventHandler SafeUiAction(EventHandler action)
        {
            return (sender, args) =>
            {
                try
                {
                    action(sender, args);
                }
                catch (Exception ex)
                {
                    AppendLog("오류 발생: " + ex.Message);
                    SetStatus("오류 발생");
                }
            };
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (_backendProcess != null && !_backendProcess.HasExited)
            {
                try
                {
                    _backendProcess.Kill();
                }
                catch
                {
                }
            }
        }
    }

    internal sealed class RegionSelectionForm : Form
    {
        private Point _startPoint;
        private Point _currentPoint;
        private bool _dragging;

        public Rectangle SelectedRectangle { get; private set; }

        public RegionSelectionForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            Bounds = SystemInformation.VirtualScreen;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            ShowInTaskbar = false;
            DoubleBuffered = true;
            BackColor = Color.Black;
            Opacity = 0.25;
            Cursor = Cursors.Cross;
            KeyPreview = true;

            MouseDown += RegionSelectionForm_MouseDown;
            MouseMove += RegionSelectionForm_MouseMove;
            MouseUp += RegionSelectionForm_MouseUp;
            KeyDown += RegionSelectionForm_KeyDown;
        }

        private void RegionSelectionForm_MouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left)
            {
                return;
            }

            _dragging = true;
            _startPoint = e.Location;
            _currentPoint = e.Location;
            Invalidate();
        }

        private void RegionSelectionForm_MouseMove(object sender, MouseEventArgs e)
        {
            if (!_dragging)
            {
                return;
            }

            _currentPoint = e.Location;
            Invalidate();
        }

        private void RegionSelectionForm_MouseUp(object sender, MouseEventArgs e)
        {
            if (!_dragging)
            {
                return;
            }

            _dragging = false;
            _currentPoint = e.Location;
            var local = NormalizeRectangle(_startPoint, _currentPoint);
            if (local.Width < 2 || local.Height < 2)
            {
                DialogResult = DialogResult.Cancel;
                Close();
                return;
            }

            SelectedRectangle = new Rectangle(local.Left + Bounds.Left, local.Top + Bounds.Top, local.Width, local.Height);
            DialogResult = DialogResult.OK;
            Close();
        }

        private void RegionSelectionForm_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape)
            {
                DialogResult = DialogResult.Cancel;
                Close();
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);

            using (var infoBrush = new SolidBrush(Color.FromArgb(220, 255, 244, 190)))
            using (var infoPen = new Pen(Color.FromArgb(196, 88, 58, 25), 2))
            using (var infoFont = new Font("Segoe UI", 11, FontStyle.Bold))
            {
                var header = new Rectangle(24, 24, 420, 70);
                e.Graphics.FillRectangle(infoBrush, header);
                e.Graphics.DrawRectangle(infoPen, header);
                e.Graphics.DrawString("강화 숫자 부분만 드래그해서 선택하세요. Esc는 취소입니다.", infoFont, Brushes.Black, new RectangleF(38, 44, 390, 34));
            }

            if (!_dragging)
            {
                return;
            }

            var rect = NormalizeRectangle(_startPoint, _currentPoint);
            using (var fill = new SolidBrush(Color.FromArgb(70, 255, 255, 255)))
            using (var pen = new Pen(Color.Red, 2))
            {
                e.Graphics.FillRectangle(fill, rect);
                e.Graphics.DrawRectangle(pen, rect);
            }
        }

        private static Rectangle NormalizeRectangle(Point first, Point second)
        {
            var left = Math.Min(first.X, second.X);
            var top = Math.Min(first.Y, second.Y);
            var width = Math.Abs(first.X - second.X);
            var height = Math.Abs(first.Y - second.Y);
            return new Rectangle(left, top, width, height);
        }
    }
}
