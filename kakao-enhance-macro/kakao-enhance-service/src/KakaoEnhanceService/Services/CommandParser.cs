using System.Text.RegularExpressions;

namespace KakaoEnhanceService.Services
{
    public enum CommandKind
    {
        Unknown,
        Help,
        Status,
        Register,
        Enhance
    }

    public sealed class ParsedCommand
    {
        public CommandKind Kind { get; set; }

        public int? TargetLevel { get; set; }

        public string PlayerName { get; set; }

        public int? CurrentLevel { get; set; }
    }

    public sealed class CommandParser
    {
        private static readonly Regex EnhanceRegex =
            new Regex(@"^/?강화\s+(?<target>\d+)$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex RegisterRegex =
            new Regex(@"^/?등록\s+(?<name>\S+)\s+(?<level>\d+)$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        public ParsedCommand Parse(string message)
        {
            var text = (message ?? string.Empty).Trim();

            if (text == string.Empty)
            {
                return new ParsedCommand { Kind = CommandKind.Unknown };
            }

            if (text == "도움말" || text == "/도움말" || text == "help" || text == "/help")
            {
                return new ParsedCommand { Kind = CommandKind.Help };
            }

            if (text == "상태" || text == "/상태")
            {
                return new ParsedCommand { Kind = CommandKind.Status };
            }

            var registerMatch = RegisterRegex.Match(text);
            if (registerMatch.Success)
            {
                return new ParsedCommand
                {
                    Kind = CommandKind.Register,
                    PlayerName = registerMatch.Groups["name"].Value,
                    CurrentLevel = int.Parse(registerMatch.Groups["level"].Value)
                };
            }

            var enhanceMatch = EnhanceRegex.Match(text);
            if (enhanceMatch.Success)
            {
                return new ParsedCommand
                {
                    Kind = CommandKind.Enhance,
                    TargetLevel = int.Parse(enhanceMatch.Groups["target"].Value)
                };
            }

            return new ParsedCommand { Kind = CommandKind.Unknown };
        }
    }
}
