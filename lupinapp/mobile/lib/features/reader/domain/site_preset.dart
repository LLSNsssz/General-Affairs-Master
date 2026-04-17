enum SitePreset {
  novelpia(
    label: 'Novelpia',
    homeUrl: 'https://novelpia.com/',
    loginUrl: 'https://novelpia.com/page/login',
  ),
  munpia(
    label: 'Munpia',
    homeUrl: 'https://www.munpia.com/',
    loginUrl: 'https://nssl.munpia.com/login',
  ),
  joara(
    label: 'Joara',
    homeUrl: 'https://www.joara.com/',
    loginUrl: 'https://auth.joara.com/login',
  ),
  kakaoPage(
    label: 'KakaoPage',
    homeUrl: 'https://page.kakao.com/',
    loginUrl: 'https://accounts.kakao.com/login/?continue=https%3A%2F%2Fpage.kakao.com%2F',
  );

  const SitePreset({
    required this.label,
    required this.homeUrl,
    required this.loginUrl,
  });

  final String label;
  final String homeUrl;
  final String loginUrl;

  static SitePreset fromName(String? name) {
    return SitePreset.values.firstWhere(
      (preset) => preset.name == name,
      orElse: () => SitePreset.novelpia,
    );
  }
}

