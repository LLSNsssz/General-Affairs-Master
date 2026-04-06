using System.Collections.Generic;
using KakaoEnhanceService.Domain;

namespace KakaoEnhanceService.Infrastructure
{
    public sealed class StoreSnapshot
    {
        public List<PlayerState> Players { get; set; }

        public List<EnhanceJob> Jobs { get; set; }

        public List<DeliveryLog> DeliveryLogs { get; set; }
    }
}
