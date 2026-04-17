import 'package:flutter/services.dart';

import '../domain/reader_preferences.dart';
import '../domain/site_preset.dart';

class InjectionBundle {
  const InjectionBundle({
    required this.baseCss,
    required this.pageCss,
    required this.pageJs,
  });

  final String baseCss;
  final String pageCss;
  final String pageJs;
}

class InjectionLoader {
  Future<InjectionBundle> build({
    required SitePreset site,
    required Uri? url,
    required ReaderPreferences preferences,
  }) async {
    final baseCss = await rootBundle.loadString(
      'assets/injection/common_surface.css',
    );

    final isReadingPage = _isReadingPage(site, url);
    final pageCss = await rootBundle.loadString(
      isReadingPage
          ? 'assets/injection/reader_surface.css'
          : 'assets/injection/catalog_surface.css',
    );

    final siteScriptPath = switch (site) {
      SitePreset.munpia => 'assets/injection/munpia_reader.js',
      SitePreset.novelpia => 'assets/injection/novelpia_reader.js',
      _ => '',
    };

    final siteScript = siteScriptPath.isEmpty
        ? ''
        : await rootBundle.loadString(siteScriptPath);

    final typographyScript = '''
      (() => {
        const root = document.documentElement;
        root.style.setProperty('--sticky-font-size', '${preferences.fontSize}px');
        root.style.setProperty('--sticky-line-height', '${preferences.lineHeight}');
        root.style.setProperty('--sticky-letter-spacing', '${preferences.letterSpacing}px');
        root.setAttribute('data-sticky-reader-mode', '${preferences.useReaderMode ? '1' : '0'}');
      })();
    ''';

    return InjectionBundle(
      baseCss: baseCss,
      pageCss: pageCss,
      pageJs: '$typographyScript\n$siteScript',
    );
  }

  bool _isReadingPage(SitePreset site, Uri? url) {
    if (url == null) {
      return false;
    }

    final value = url.toString().toLowerCase();

    return switch (site) {
      SitePreset.novelpia =>
        value.contains('/viewer/') ||
            value.contains('/reader/') ||
            value.contains('/episode/'),
      SitePreset.munpia =>
        value.contains('/novel/') ||
            value.contains('/page/') ||
            value.contains('work/view'),
      SitePreset.joara => value.contains('/book/') || value.contains('/viewer/'),
      SitePreset.kakaoPage => value.contains('/content/'),
    };
  }
}

