class ReaderPreferences {
  const ReaderPreferences({
    required this.fontSize,
    required this.lineHeight,
    required this.letterSpacing,
    required this.useReaderMode,
  });

  const ReaderPreferences.defaults()
      : fontSize = 18,
        lineHeight = 1.8,
        letterSpacing = -0.1,
        useReaderMode = true;

  final double fontSize;
  final double lineHeight;
  final double letterSpacing;
  final bool useReaderMode;

  ReaderPreferences copyWith({
    double? fontSize,
    double? lineHeight,
    double? letterSpacing,
    bool? useReaderMode,
  }) {
    return ReaderPreferences(
      fontSize: fontSize ?? this.fontSize,
      lineHeight: lineHeight ?? this.lineHeight,
      letterSpacing: letterSpacing ?? this.letterSpacing,
      useReaderMode: useReaderMode ?? this.useReaderMode,
    );
  }
}

