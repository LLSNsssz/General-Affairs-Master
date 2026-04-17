import 'package:shared_preferences/shared_preferences.dart';

import '../domain/reader_preferences.dart';
import '../domain/site_preset.dart';

class ReaderStore {
  static const _siteKey = 'reader.activeSite';
  static const _urlKey = 'reader.lastUrl';
  static const _fontSizeKey = 'reader.fontSize';
  static const _lineHeightKey = 'reader.lineHeight';
  static const _letterSpacingKey = 'reader.letterSpacing';
  static const _readerModeKey = 'reader.useReaderMode';

  Future<SitePreset> loadSite() async {
    final prefs = await SharedPreferences.getInstance();
    return SitePreset.fromName(prefs.getString(_siteKey));
  }

  Future<void> saveSite(SitePreset site) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_siteKey, site.name);
  }

  Future<String?> loadLastUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_urlKey);
  }

  Future<void> saveLastUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_urlKey, url);
  }

  Future<ReaderPreferences> loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    return ReaderPreferences(
      fontSize: prefs.getDouble(_fontSizeKey) ?? 18,
      lineHeight: prefs.getDouble(_lineHeightKey) ?? 1.8,
      letterSpacing: prefs.getDouble(_letterSpacingKey) ?? -0.1,
      useReaderMode: prefs.getBool(_readerModeKey) ?? true,
    );
  }

  Future<void> savePreferences(ReaderPreferences preferences) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_fontSizeKey, preferences.fontSize);
    await prefs.setDouble(_lineHeightKey, preferences.lineHeight);
    await prefs.setDouble(_letterSpacingKey, preferences.letterSpacing);
    await prefs.setBool(_readerModeKey, preferences.useReaderMode);
  }
}

