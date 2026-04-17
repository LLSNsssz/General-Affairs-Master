using System;
using System.Drawing;
using System.Globalization;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace AccountingNumberKorean
{
    internal static class HotkeyProgram
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new HotkeyContext());
        }
    }

    internal sealed class HotkeyContext : ApplicationContext
    {
        private const int HotkeyId = 1001;
        private readonly NotifyIcon _notifyIcon;
        private readonly HotkeyWindow _window;
        private readonly System.Windows.Forms.Timer _restoreClipboardTimer;
        private IDataObject _clipboardBackup;
        private DateTime _lastHotkeyAt = DateTime.MinValue;

        public HotkeyContext()
        {
            _window = new HotkeyWindow();
            _window.HotkeyPressed += Window_HotkeyPressed;

            if (!_window.Register(HotkeyId, NativeMethods.MOD_CONTROL | NativeMethods.MOD_ALT, Keys.H))
            {
                MessageBox.Show(
                    "\uD56B\uD0A4 Ctrl+Alt+H \uB4F1\uB85D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.\n\uB2E4\uB978 \uD504\uB85C\uADF8\uB7A8\uC774 \uC774 \uD0A4\uB97C \uC4F0\uACE0 \uC788\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
                    "\uD56B\uD0A4 \uB4F1\uB85D \uC2E4\uD328",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }

            _restoreClipboardTimer = new System.Windows.Forms.Timer();
            _restoreClipboardTimer.Interval = 300;
            _restoreClipboardTimer.Tick += RestoreClipboardTimer_Tick;

            var menu = new ContextMenuStrip();
            menu.Items.Add("\uC218\uB3D9 \uBCC0\uD658\uAE30 \uC5F4\uAE30", null, (_, __) => OpenManualConverter());
            menu.Items.Add("\uD56B\uD0A4 \uC548\uB0B4", null, (_, __) => ShowGuide());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("\uC885\uB8CC", null, (_, __) => ExitThread());

            _notifyIcon = new NotifyIcon
            {
                Icon = SystemIcons.Information,
                Visible = true,
                Text = "\uD68C\uACC4 \uC22B\uC790 \uD55C\uAE00 \uD56B\uD0A4",
                ContextMenuStrip = menu
            };

            _notifyIcon.DoubleClick += (_, __) => ShowGuide();
            _notifyIcon.ShowBalloonTip(
                2500,
                "\uD68C\uACC4 \uD55C\uAE00 \uD56B\uD0A4 \uC2E4\uD589 \uC911",
                "\uC22B\uC790\uB97C \uB4DC\uB798\uADF8\uD55C \uB4A4 Ctrl+Alt+H\uB97C \uB204\uB974\uBA74 \uBC14\uB85C \uD68C\uACC4 \uD55C\uAE00\uB85C \uBC14\uB00D \uB123\uC2B5\uB2C8\uB2E4.",
                ToolTipIcon.Info);
        }

        protected override void ExitThreadCore()
        {
            _restoreClipboardTimer.Stop();
            _restoreClipboardTimer.Dispose();
            _window.Unregister(HotkeyId);
            _window.Dispose();
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
            base.ExitThreadCore();
        }

        private void Window_HotkeyPressed(object sender, EventArgs e)
        {
            if ((DateTime.Now - _lastHotkeyAt).TotalMilliseconds < 500)
            {
                return;
            }

            _lastHotkeyAt = DateTime.Now;
            ConvertCurrentSelection();
        }

        private void ConvertCurrentSelection()
        {
            var selectedText = TryCaptureSelectedText();
            if (string.IsNullOrWhiteSpace(selectedText))
            {
                ShowBalloon(
                    "\uC120\uD0DD \uD655\uC778",
                    "\uC22B\uC790\uB97C \uBA3C\uC800 \uB4DC\uB798\uADF8\uD55C \uB4A4 Ctrl+Alt+H\uB97C \uB204\uB974\uC138\uC694.",
                    ToolTipIcon.Warning);
                return;
            }

            var normalized = SelectionConverter.NormalizeInput(selectedText);
            BigInteger amount;
            if (!SelectionConverter.TryParseAmount(normalized, out amount))
            {
                ShowBalloon(
                    "\uBCC0\uD658 \uC2E4\uD328",
                    "\uC120\uD0DD\uD55C \uAC12\uC774 \uC815\uC218 \uC22B\uC790\uAC00 \uC544\uB2D9\uB2C8\uB2E4.",
                    ToolTipIcon.Warning);
                return;
            }

            var converted = KoreanMoneyConverter.ToKoreanMoney(amount, true);
            TryReplaceSelection(converted);
        }

        private string TryCaptureSelectedText()
        {
            _clipboardBackup = TryGetClipboardData();
            var marker = "__ACCNUM__" + Guid.NewGuid().ToString("N");

            try
            {
                Clipboard.SetText(marker);
            }
            catch
            {
                return null;
            }

            SendKeys.SendWait("^c");

            for (var i = 0; i < 20; i++)
            {
                Thread.Sleep(70);

                try
                {
                    if (!Clipboard.ContainsText())
                    {
                        continue;
                    }

                    var text = Clipboard.GetText();
                    if (string.Equals(text, marker, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    return text;
                }
                catch
                {
                }
            }

            return null;
        }

        private void TryReplaceSelection(string text)
        {
            try
            {
                Clipboard.SetText(text);
                Thread.Sleep(60);
                SendKeys.SendWait("^v");
                _restoreClipboardTimer.Stop();
                _restoreClipboardTimer.Start();
            }
            catch
            {
                ShowBalloon(
                    "\uBCC0\uD658 \uC2E4\uD328",
                    "\uC120\uD0DD \uC601\uC5ED\uC5D0 \uBC14\uB85C \uB123\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
                    ToolTipIcon.Warning);
            }
        }

        private void RestoreClipboardTimer_Tick(object sender, EventArgs e)
        {
            _restoreClipboardTimer.Stop();

            if (_clipboardBackup == null)
            {
                return;
            }

            try
            {
                Clipboard.SetDataObject(_clipboardBackup, true);
            }
            catch
            {
            }
            finally
            {
                _clipboardBackup = null;
            }
        }

        private static IDataObject TryGetClipboardData()
        {
            try
            {
                return Clipboard.GetDataObject();
            }
            catch
            {
                return null;
            }
        }

        private void OpenManualConverter()
        {
            var exePath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AccountingNumberKorean.exe");
            if (System.IO.File.Exists(exePath))
            {
                System.Diagnostics.Process.Start(exePath);
                return;
            }

            ShowBalloon(
                "\uC218\uB3D9 \uBCC0\uD658\uAE30",
                "\uC218\uB3D9 \uBCC0\uD658\uAE30 exe\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
                ToolTipIcon.Info);
        }

        private void ShowGuide()
        {
            MessageBox.Show(
                "\uC0AC\uC6A9 \uBC29\uBC95\n\n1. \uBB38\uC11C\uC5D0\uC11C \uC22B\uC790\uB97C \uB4DC\uB798\uADF8\uD569\uB2C8\uB2E4.\n2. Ctrl+Alt+H \uB97C \uB204\uB985\uB2C8\uB2E4.\n3. \uC120\uD0DD\uD55C \uC22B\uC790\uAC00 \uD68C\uACC4 \uD55C\uAE00 \uAE08\uC561\uC73C\uB85C \uBC14\uB85C \uBC14\uB01D\uB2C8\uB2E4.\n\n\uC608)\n1234567 -> \uC77C\uBC31\uC774\uC2ED\uC0BC\uB9CC\uC0AC\uCC9C\uC624\uBC31\uC721\uC2ED\uCE60\uC6D0",
                "\uD56B\uD0A4 \uC548\uB0B4",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }

        private void ShowBalloon(string title, string text, ToolTipIcon icon)
        {
            _notifyIcon.ShowBalloonTip(1800, title, text, icon);
        }
    }

    internal sealed class HotkeyWindow : NativeWindow, IDisposable
    {
        private const int WmHotkey = 0x0312;

        public event EventHandler HotkeyPressed;

        public HotkeyWindow()
        {
            CreateHandle(new CreateParams());
        }

        public bool Register(int id, uint modifiers, Keys key)
        {
            return NativeMethods.RegisterHotKey(Handle, id, modifiers, (uint)key);
        }

        public void Unregister(int id)
        {
            NativeMethods.UnregisterHotKey(Handle, id);
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WmHotkey)
            {
                var handler = HotkeyPressed;
                if (handler != null)
                {
                    handler(this, EventArgs.Empty);
                }
            }

            base.WndProc(ref m);
        }

        public void Dispose()
        {
            DestroyHandle();
        }
    }

    internal static class SelectionConverter
    {
        public static string NormalizeInput(string text)
        {
            return (text ?? string.Empty)
                .Replace(",", string.Empty)
                .Replace("\uC6D0\uC815", string.Empty)
                .Replace("\uC6D0", string.Empty)
                .Replace("\uC77C\uAE08", string.Empty)
                .Replace("\r", string.Empty)
                .Replace("\n", string.Empty)
                .Replace("\t", string.Empty)
                .Replace(" ", string.Empty)
                .Trim();
        }

        public static bool TryParseAmount(string text, out BigInteger amount)
        {
            amount = BigInteger.Zero;

            if (string.IsNullOrWhiteSpace(text))
            {
                return false;
            }

            return BigInteger.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out amount);
        }
    }

    internal static class KoreanMoneyConverter
    {
        private static readonly string[] Digits = { "\uC601", "\uC77C", "\uC774", "\uC0BC", "\uC0AC", "\uC624", "\uC721", "\uCE60", "\uD314", "\uAD6C" };
        private static readonly string[] SmallUnits = { string.Empty, "\uC2ED", "\uBC31", "\uCC9C" };
        private static readonly string[] LargeUnits = { string.Empty, "\uB9CC", "\uC5B5", "\uC870", "\uACBD", "\uD574", "\uC790", "\uC591" };

        public static string ToKoreanMoney(BigInteger amount, bool accountingStyle)
        {
            var signPrefix = amount.Sign < 0 ? "\uB9C8\uC774\uB108\uC2A4 " : string.Empty;
            var abs = BigInteger.Abs(amount);

            if (abs.IsZero)
            {
                return signPrefix + "\uC601\uC6D0";
            }

            return signPrefix + ConvertInteger(abs, accountingStyle) + "\uC6D0";
        }

        private static string ConvertInteger(BigInteger value, bool accountingStyle)
        {
            var result = new System.Text.StringBuilder();
            var groupIndex = 0;

            while (value > 0)
            {
                var groupValue = (int)(value % 10000);
                if (groupValue > 0)
                {
                    var groupText = ConvertFourDigits(groupValue, accountingStyle);
                    if (!string.IsNullOrEmpty(groupText))
                    {
                        result.Insert(0, groupText + LargeUnits[groupIndex]);
                    }
                }

                value /= 10000;
                groupIndex++;
            }

            return result.ToString();
        }

        private static string ConvertFourDigits(int value, bool accountingStyle)
        {
            var builder = new System.Text.StringBuilder();

            for (var unitIndex = 3; unitIndex >= 0; unitIndex--)
            {
                var divisor = (int)Math.Pow(10, unitIndex);
                var digit = value / divisor;
                value %= divisor;

                if (digit == 0)
                {
                    continue;
                }

                var writeOne = accountingStyle || unitIndex == 0 || digit != 1;
                if (writeOne)
                {
                    builder.Append(Digits[digit]);
                }

                builder.Append(SmallUnits[unitIndex]);
            }

            return builder.ToString();
        }
    }

    internal static class NativeMethods
    {
        public const uint MOD_ALT = 0x0001;
        public const uint MOD_CONTROL = 0x0002;

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    }
}
