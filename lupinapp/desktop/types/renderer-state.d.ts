import type { ReaderEventPayload, ShortcutCommand, WindowStateSnapshot } from "./sticky-desktop";

declare global {
  type RendererBookmarkRecord = {
    id: string;
    name: string;
    url: string;
    meta: string;
  };

  type RendererBookmarkDraft = Partial<RendererBookmarkRecord> & {
    id?: string;
    name?: string;
    url?: string;
    meta?: string;
  };

  type RendererRecentPageRecord = {
    url: string;
    title: string;
    hostname: string;
    visitedAt: string;
  };

  type RendererTypographyPreset = {
    fontSize: number;
    lineHeight: number;
    letterSpacing: string;
    fontFamily: string;
  };

  type RendererFontFamilyPreset = "site" | "noto-sans-kr" | "malgun-gothic" | "nanum-myeongjo";

  type RendererSettings = {
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    fontFamilyPreset: RendererFontFamilyPreset;
    initializedFromNovelpia: boolean;
  };

  type RendererDrawerName = "" | "bookmarks" | "history";
  type RendererShortcutCommand = ShortcutCommand;
  type RendererReaderEventPayload = ReaderEventPayload;
  type RendererWindowMeta = WindowStateSnapshot;

  interface RendererState {
    bookmarks: RendererBookmarkRecord[];
    recentPages: RendererRecentPageRecord[];
    settings: RendererSettings;
    novelpiaTypography: RendererTypographyPreset | null;
    currentUrl: string;
    simplifyEnabled: boolean;
    ambientThemeKey: string;
    windowMeta: RendererWindowMeta;
  }
}

export {};
