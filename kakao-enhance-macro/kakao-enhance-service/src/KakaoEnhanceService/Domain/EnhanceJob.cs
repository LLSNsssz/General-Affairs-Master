using System;
using System.Collections.Generic;

namespace KakaoEnhanceService.Domain
{
    public sealed class EnhanceJob
    {
        public EnhanceJob()
        {
            Attempts = new List<EnhanceAttempt>();
        }

        public string Id { get; set; }

        public string UserId { get; set; }

        public string PlayerId { get; set; }

        public int TargetLevel { get; set; }

        public string RequestedBy { get; set; }

        public string Source { get; set; }

        public string Status { get; set; }

        public string LastMessage { get; set; }

        public DateTime CreatedUtc { get; set; }

        public DateTime? StartedUtc { get; set; }

        public DateTime? CompletedUtc { get; set; }

        public List<EnhanceAttempt> Attempts { get; set; }
    }
}
