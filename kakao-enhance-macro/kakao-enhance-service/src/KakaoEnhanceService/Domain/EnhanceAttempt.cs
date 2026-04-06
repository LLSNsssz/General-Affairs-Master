using System;

namespace KakaoEnhanceService.Domain
{
    public sealed class EnhanceAttempt
    {
        public int AttemptNumber { get; set; }

        public int FromLevel { get; set; }

        public int ToLevel { get; set; }

        public bool Succeeded { get; set; }

        public string Message { get; set; }

        public DateTime OccurredUtc { get; set; }
    }
}
