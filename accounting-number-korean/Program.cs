using System;
using System.Drawing;
using System.Globalization;
using System.Numerics;
using System.Text;
using System.Windows.Forms;

namespace AccountingNumberKorean
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

    internal sealed class MainForm : Form
    {
        private readonly TextBox _inputBox = new TextBox();
        private readonly TextBox _formattedBox = new TextBox();
        private readonly TextBox _plainKoreanBox = new TextBox();
        private readonly TextBox _accountingKoreanBox = new TextBox();
        private readonly TextBox _documentBox = new TextBox();
        private readonly Label _statusLabel = new Label();
        private readonly Button _convertButton = new Button();
        private readonly Button _copyPlainButton = new Button();
        private readonly Button _copyAccountingButton = new Button();
        private readonly Button _copyDocumentButton = new Button();
        private readonly Button _clearButton = new Button();

        public MainForm()
        {
            Text = "회계 숫자 한글 변환기";
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(760, 500);
            MinimumSize = new Size(776, 539);
            BackColor = ColorTranslator.FromHtml("#F6F1E8");
            Font = new Font("Malgun Gothic", 9F);

            BuildUi();
            SetStatus("정수 금액을 입력하면 바로 변환됩니다.");
        }

        private void BuildUi()
        {
            Controls.Add(CreateTitleLabel("회계 숫자 한글 변환기", new Point(20, 16), new Size(320, 30), 15F, FontStyle.Bold));
            Controls.Add(CreateTextLabel("숫자를 넣으면 일반 표기, 회계 표기, 일금 표기를 한 번에 만들어 줍니다.", new Point(20, 46), new Size(640, 22), "#5C4B3A"));

            var inputGroup = CreateGroupBox("입력", new Rectangle(20, 80, 720, 86));
            inputGroup.Controls.Add(CreateFieldLabel("숫자", new Point(18, 33)));
            _inputBox.Bounds = new Rectangle(68, 28, 420, 30);
            _inputBox.Font = new Font("Consolas", 12F);
            _inputBox.TextChanged += (_, __) => TryConvertInput(false);
            _inputBox.KeyDown += InputBox_KeyDown;
            inputGroup.Controls.Add(_inputBox);

            _convertButton.Text = "변환";
            _convertButton.Bounds = new Rectangle(502, 27, 86, 32);
            _convertButton.Click += (_, __) => TryConvertInput(true);
            inputGroup.Controls.Add(_convertButton);

            _clearButton.Text = "지우기";
            _clearButton.Bounds = new Rectangle(596, 27, 86, 32);
            _clearButton.Click += (_, __) => ClearAll();
            inputGroup.Controls.Add(_clearButton);
            Controls.Add(inputGroup);

            var resultGroup = CreateGroupBox("결과", new Rectangle(20, 182, 720, 268));

            AddOutputRow(resultGroup, "천단위", _formattedBox, _copyPlainButton, 30, "복사", (_, __) => CopyText(_formattedBox.Text, "천단위 숫자를 복사했습니다."));
            AddOutputRow(resultGroup, "일반 표기", _plainKoreanBox, _copyPlainButton, 86, "복사", (_, __) => CopyText(_plainKoreanBox.Text, "일반 표기를 복사했습니다."));
            AddOutputRow(resultGroup, "회계 표기", _accountingKoreanBox, _copyAccountingButton, 142, "복사", (_, __) => CopyText(_accountingKoreanBox.Text, "회계 표기를 복사했습니다."));
            AddOutputRow(resultGroup, "일금 표기", _documentBox, _copyDocumentButton, 198, "복사", (_, __) => CopyText(_documentBox.Text, "일금 표기를 복사했습니다."));
            Controls.Add(resultGroup);

            _statusLabel.Bounds = new Rectangle(22, 460, 716, 24);
            _statusLabel.ForeColor = ColorTranslator.FromHtml("#7A5E3A");
            Controls.Add(_statusLabel);
        }

        private void AddOutputRow(Control parent, string labelText, TextBox textBox, Button button, int top, string buttonText, EventHandler onClick)
        {
            parent.Controls.Add(CreateFieldLabel(labelText, new Point(18, top + 4), 70));

            textBox.Bounds = new Rectangle(95, top, 510, 34);
            textBox.Font = new Font("Malgun Gothic", 10F);
            textBox.ReadOnly = true;
            textBox.BackColor = Color.White;
            parent.Controls.Add(textBox);

            button = new Button
            {
                Text = buttonText,
                Bounds = new Rectangle(620, top, 72, 34)
            };
            button.Click += onClick;
            parent.Controls.Add(button);
        }

        private void InputBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter)
            {
                e.SuppressKeyPress = true;
                TryConvertInput(true);
            }
        }

        private void TryConvertInput(bool showMessageOnError)
        {
            var rawText = _inputBox.Text ?? string.Empty;
            var normalized = NormalizeInput(rawText);

            if (string.IsNullOrWhiteSpace(normalized))
            {
                _formattedBox.Clear();
                _plainKoreanBox.Clear();
                _accountingKoreanBox.Clear();
                _documentBox.Clear();
                SetStatus("정수 금액을 입력하면 바로 변환됩니다.");
                return;
            }

            BigInteger amount;
            if (!TryParseAmount(normalized, out amount))
            {
                _formattedBox.Clear();
                _plainKoreanBox.Clear();
                _accountingKoreanBox.Clear();
                _documentBox.Clear();
                SetStatus("숫자만 입력해 주세요. 예: 1234567");
                if (showMessageOnError)
                {
                    MessageBox.Show(this, "정수 숫자만 입력해 주세요.\n예: 1234567", "입력 확인", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }

                return;
            }

            _formattedBox.Text = FormatNumber(amount);
            _plainKoreanBox.Text = KoreanMoneyConverter.ToKoreanMoney(amount, false);
            _accountingKoreanBox.Text = KoreanMoneyConverter.ToKoreanMoney(amount, true);
            _documentBox.Text = KoreanMoneyConverter.ToDocumentText(amount);
            SetStatus("변환이 완료되었습니다.");
        }

        private void CopyText(string text, string status)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                SetStatus("복사할 결과가 없습니다.");
                return;
            }

            Clipboard.SetText(text);
            SetStatus(status);
        }

        private void ClearAll()
        {
            _inputBox.Clear();
            _formattedBox.Clear();
            _plainKoreanBox.Clear();
            _accountingKoreanBox.Clear();
            _documentBox.Clear();
            SetStatus("입력을 지웠습니다.");
            _inputBox.Focus();
        }

        private static string NormalizeInput(string text)
        {
            return (text ?? string.Empty)
                .Replace(",", string.Empty)
                .Replace("원정", string.Empty)
                .Replace("원", string.Empty)
                .Replace("일금", string.Empty)
                .Replace(" ", string.Empty)
                .Trim();
        }

        private static bool TryParseAmount(string text, out BigInteger amount)
        {
            amount = BigInteger.Zero;

            if (string.IsNullOrWhiteSpace(text))
            {
                return false;
            }

            if (!BigInteger.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out amount))
            {
                return false;
            }

            return true;
        }

        private static string FormatNumber(BigInteger amount)
        {
            var sign = amount.Sign < 0 ? "-" : string.Empty;
            var digits = BigInteger.Abs(amount).ToString(CultureInfo.InvariantCulture);
            var builder = new StringBuilder();

            for (var i = 0; i < digits.Length; i++)
            {
                if (i > 0 && (digits.Length - i) % 3 == 0)
                {
                    builder.Append(',');
                }

                builder.Append(digits[i]);
            }

            return sign + builder + "원";
        }

        private static GroupBox CreateGroupBox(string text, Rectangle bounds)
        {
            return new GroupBox
            {
                Text = text,
                Bounds = bounds,
                BackColor = Color.Transparent
            };
        }

        private static Label CreateTitleLabel(string text, Point location, Size size, float fontSize, FontStyle style)
        {
            return new Label
            {
                Text = text,
                Location = location,
                Size = size,
                Font = new Font("Malgun Gothic", fontSize, style),
                ForeColor = ColorTranslator.FromHtml("#2C2218")
            };
        }

        private static Label CreateTextLabel(string text, Point location, Size size, string htmlColor)
        {
            return new Label
            {
                Text = text,
                Location = location,
                Size = size,
                ForeColor = ColorTranslator.FromHtml(htmlColor),
                BackColor = Color.Transparent
            };
        }

        private static Label CreateFieldLabel(string text, Point location, int width = 44)
        {
            return new Label
            {
                Text = text,
                Location = location,
                Size = new Size(width, 22),
                BackColor = Color.Transparent
            };
        }

        private void SetStatus(string text)
        {
            _statusLabel.Text = text;
        }
    }

    internal static class KoreanMoneyConverter
    {
        private static readonly string[] Digits = { "영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구" };
        private static readonly string[] SmallUnits = { string.Empty, "십", "백", "천" };
        private static readonly string[] LargeUnits = { string.Empty, "만", "억", "조", "경", "해", "자", "양" };

        public static string ToKoreanMoney(BigInteger amount, bool accountingStyle)
        {
            var signPrefix = amount.Sign < 0 ? "마이너스 " : string.Empty;
            var abs = BigInteger.Abs(amount);

            if (abs.IsZero)
            {
                return signPrefix + "영원";
            }

            return signPrefix + ConvertInteger(abs, accountingStyle) + "원";
        }

        public static string ToDocumentText(BigInteger amount)
        {
            return "일금 " + ToKoreanMoney(amount, true) + "정";
        }

        private static string ConvertInteger(BigInteger value, bool accountingStyle)
        {
            var result = new StringBuilder();
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
            var builder = new StringBuilder();

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
}
