using System;

namespace KakaoEnhanceService.Domain
{
    public sealed class PlayerState
    {
        public string PlayerId { get; set; }

        public string UserId { get; set; }

        public string DisplayName { get; set; }

        public int CurrentLevel { get; set; }

        public DateTime LastUpdatedUtc { get; set; }
    }
}
