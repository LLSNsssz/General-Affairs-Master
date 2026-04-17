import 'package:flutter/material.dart';

import '../features/reader/presentation/reader_shell_page.dart';

class StickyLupinMobileApp extends StatelessWidget {
  const StickyLupinMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sticky Lupin Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF6EFB6),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE4D76A),
          brightness: Brightness.light,
        ),
        textTheme: ThemeData.light().textTheme.apply(
              bodyColor: const Color(0xFF231F15),
              displayColor: const Color(0xFF231F15),
            ),
      ),
      home: const ReaderShellPage(),
    );
  }
}

