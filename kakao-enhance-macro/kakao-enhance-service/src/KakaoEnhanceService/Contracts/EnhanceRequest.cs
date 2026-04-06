namespace KakaoEnhanceService.Contracts
{
    public sealed class EnhanceRequest
    {
        public string UserId { get; set; }

        public string PlayerId { get; set; }

        public int TargetLevel { get; set; }

        public string RequestedBy { get; set; }

        public string Source { get; set; }
    }
}
