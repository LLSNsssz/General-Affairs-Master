namespace KakaoEnhanceService.Contracts
{
    public sealed class UpsertPlayerRequest
    {
        public string UserId { get; set; }

        public string DisplayName { get; set; }

        public int CurrentLevel { get; set; }
    }
}
