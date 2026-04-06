using System;

namespace KakaoEnhanceService.Domain
{
    public sealed class DeliveryLog
    {
        public string Id { get; set; }

        public string Channel { get; set; }

        public string Recipient { get; set; }

        public string Payload { get; set; }

        public string Result { get; set; }

        public DateTime CreatedUtc { get; set; }
    }
}
