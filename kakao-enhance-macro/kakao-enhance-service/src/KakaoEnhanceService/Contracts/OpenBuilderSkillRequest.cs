using System.Collections.Generic;

namespace KakaoEnhanceService.Contracts
{
    public sealed class OpenBuilderSkillRequest
    {
        public OpenBuilderAction Action { get; set; }

        public OpenBuilderIntent Intent { get; set; }

        public OpenBuilderBot Bot { get; set; }

        public OpenBuilderUserRequest UserRequest { get; set; }
    }

    public sealed class OpenBuilderAction
    {
        public string Id { get; set; }

        public string Name { get; set; }

        public Dictionary<string, string> Params { get; set; }

        public Dictionary<string, OpenBuilderDetailParam> DetailParams { get; set; }
    }

    public sealed class OpenBuilderDetailParam
    {
        public string Origin { get; set; }

        public string GroupName { get; set; }

        public string Value { get; set; }
    }

    public sealed class OpenBuilderIntent
    {
        public string Id { get; set; }

        public string Name { get; set; }
    }

    public sealed class OpenBuilderBot
    {
        public string Id { get; set; }

        public string Name { get; set; }
    }

    public sealed class OpenBuilderUserRequest
    {
        public OpenBuilderUser User { get; set; }

        public string Utterance { get; set; }

        public string Lang { get; set; }

        public string Timezone { get; set; }

        public string CallbackUrl { get; set; }

        public Dictionary<string, object> Params { get; set; }
    }

    public sealed class OpenBuilderUser
    {
        public string Id { get; set; }

        public string Type { get; set; }

        public Dictionary<string, string> Properties { get; set; }
    }
}
