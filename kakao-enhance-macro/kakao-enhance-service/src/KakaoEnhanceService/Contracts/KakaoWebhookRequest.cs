namespace KakaoEnhanceService.Contracts
{
    public sealed class KakaoWebhookRequest
    {
        public string UserId { get; set; }

        public string PlayerId { get; set; }

        public string Message { get; set; }
    }
}
