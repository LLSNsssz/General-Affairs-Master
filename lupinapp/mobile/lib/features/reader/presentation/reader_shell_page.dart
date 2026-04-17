import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import '../data/reader_store.dart';
import '../domain/reader_preferences.dart';
import '../domain/site_preset.dart';
import '../services/injection_loader.dart';

class ReaderShellPage extends StatefulWidget {
  const ReaderShellPage({super.key});

  @override
  State<ReaderShellPage> createState() => _ReaderShellPageState();
}

class _ReaderShellPageState extends State<ReaderShellPage> {
  final _store = ReaderStore();
  final _loader = InjectionLoader();
  final _urlController = TextEditingController();

  InAppWebViewController? _webViewController;
  SitePreset _activeSite = SitePreset.novelpia;
  ReaderPreferences _preferences = const ReaderPreferences.defaults();
  Uri? _currentUri;
  bool _isLoading = true;
  bool _isBootstrapping = true;

  @override
  void initState() {
    super.initState();
    unawaited(_bootstrap());
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final site = await _store.loadSite();
    final prefs = await _store.loadPreferences();
    final lastUrl = await _store.loadLastUrl();

    final initialUri = Uri.tryParse(lastUrl ?? site.homeUrl) ?? Uri.parse(site.homeUrl);

    setState(() {
      _activeSite = site;
      _preferences = prefs;
      _currentUri = initialUri;
      _urlController.text = initialUri.toString();
      _isBootstrapping = false;
    });
  }

  Future<void> _switchSite(SitePreset site) async {
    final target = Uri.parse(site.homeUrl);
    setState(() {
      _activeSite = site;
      _currentUri = target;
      _urlController.text = target.toString();
      _isLoading = true;
    });
    await _store.saveSite(site);
    await _store.saveLastUrl(target.toString());
    await _webViewController?.loadUrl(
      urlRequest: URLRequest(url: WebUri(target.toString())),
    );
  }

  Future<void> _goToUrl(String input) async {
    final normalized = input.startsWith('http') ? input : 'https://$input';
    final uri = Uri.tryParse(normalized);
    if (uri == null) {
      return;
    }

    setState(() {
      _currentUri = uri;
      _urlController.text = uri.toString();
      _isLoading = true;
    });

    await _store.saveLastUrl(uri.toString());
    await _webViewController?.loadUrl(
      urlRequest: URLRequest(url: WebUri(uri.toString())),
    );
  }

  Future<void> _applySurface(Uri? url) async {
    final controller = _webViewController;
    if (controller == null) {
      return;
    }

    final bundle = await _loader.build(
      site: _activeSite,
      url: url,
      preferences: _preferences,
    );

    await controller.injectCSSCode(source: bundle.baseCss);
    await controller.injectCSSCode(source: bundle.pageCss);
    await controller.evaluateJavascript(source: bundle.pageJs);
  }

  Future<void> _openPreferencesSheet() async {
    final updated = await showModalBottomSheet<ReaderPreferences>(
      context: context,
      showDragHandle: true,
      backgroundColor: const Color(0xFFFFF5C7),
      builder: (context) {
        double fontSize = _preferences.fontSize;
        double lineHeight = _preferences.lineHeight;
        double letterSpacing = _preferences.letterSpacing;
        bool useReaderMode = _preferences.useReaderMode;

        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Reader Settings',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  Text('Font size ${fontSize.toStringAsFixed(0)}'),
                  Slider(
                    min: 14,
                    max: 24,
                    value: fontSize,
                    onChanged: (value) => setSheetState(() => fontSize = value),
                  ),
                  Text('Line height ${lineHeight.toStringAsFixed(2)}'),
                  Slider(
                    min: 1.4,
                    max: 2.2,
                    value: lineHeight,
                    onChanged: (value) => setSheetState(() => lineHeight = value),
                  ),
                  Text('Letter spacing ${letterSpacing.toStringAsFixed(1)}'),
                  Slider(
                    min: -0.5,
                    max: 0.8,
                    value: letterSpacing,
                    onChanged: (value) => setSheetState(() => letterSpacing = value),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: useReaderMode,
                    title: const Text('Use stronger reader cleanup'),
                    onChanged: (value) => setSheetState(() => useReaderMode = value),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: () {
                      Navigator.of(context).pop(
                        ReaderPreferences(
                          fontSize: fontSize,
                          lineHeight: lineHeight,
                          letterSpacing: letterSpacing,
                          useReaderMode: useReaderMode,
                        ),
                      );
                    },
                    child: const Text('Apply'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    if (updated == null) {
      return;
    }

    setState(() {
      _preferences = updated;
    });

    await _store.savePreferences(updated);
    await _applySurface(_currentUri);
  }

  @override
  Widget build(BuildContext context) {
    if (_isBootstrapping || _currentUri == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Container(
          color: const Color(0xFFF6EFB6),
          child: Column(
            children: [
              _buildTopBar(context),
              Expanded(
                child: Stack(
                  children: [
                    InAppWebView(
                      initialUrlRequest: URLRequest(
                        url: WebUri(_currentUri.toString()),
                      ),
                      initialSettings: InAppWebViewSettings(
                        javaScriptEnabled: true,
                        transparentBackground: true,
                        mediaPlaybackRequiresUserGesture: false,
                        useShouldOverrideUrlLoading: true,
                        isInspectable: true,
                      ),
                      onWebViewCreated: (controller) {
                        _webViewController = controller;
                      },
                      onLoadStart: (controller, url) async {
                        setState(() {
                          _isLoading = true;
                          _currentUri = url?.uriValue;
                          _urlController.text = url?.toString() ?? '';
                        });
                      },
                      onLoadStop: (controller, url) async {
                        final resolved = url?.uriValue;
                        setState(() {
                          _isLoading = false;
                          _currentUri = resolved;
                          _urlController.text = resolved?.toString() ?? '';
                        });

                        if (resolved != null) {
                          await _store.saveLastUrl(resolved.toString());
                        }

                        await _applySurface(resolved);
                      },
                      onTitleChanged: (controller, title) {
                        if (mounted) {
                          setState(() {});
                        }
                      },
                      shouldOverrideUrlLoading: (controller, navigationAction) async {
                        final requestUrl = navigationAction.request.url?.uriValue;
                        if (requestUrl != null) {
                          setState(() {
                            _currentUri = requestUrl;
                            _urlController.text = requestUrl.toString();
                          });
                        }
                        return NavigationActionPolicy.ALLOW;
                      },
                    ),
                    if (_isLoading)
                      Positioned.fill(
                        child: IgnorePointer(
                          child: DecoratedBox(
                            decoration: const BoxDecoration(
                              color: Color(0xFFF6EFB6),
                            ),
                            child: Center(
                              child: Text(
                                'Loading',
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      color: const Color(0xFF6B654D),
                                    ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar(BuildContext context) {
    return Material(
      color: const Color(0xFFF8F0B4),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: SitePreset.values.map((site) {
                        final selected = site == _activeSite;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(site.label),
                            selected: selected,
                            onSelected: (_) => _switchSite(site),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Settings',
                  onPressed: _openPreferencesSheet,
                  icon: const Icon(Icons.tune_rounded),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                IconButton(
                  tooltip: 'Back',
                  onPressed: () => _webViewController?.goBack(),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
                IconButton(
                  tooltip: 'Refresh',
                  onPressed: () => _webViewController?.reload(),
                  icon: const Icon(Icons.refresh_rounded),
                ),
                IconButton(
                  tooltip: 'Login',
                  onPressed: () => _goToUrl(_activeSite.loginUrl),
                  icon: const Icon(Icons.login_rounded),
                ),
                Expanded(
                  child: TextField(
                    controller: _urlController,
                    decoration: const InputDecoration(
                      isDense: true,
                      hintText: 'Enter URL',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: _goToUrl,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

