"use strict";
function createEmpty(message) {
    const node = document.createElement("div");
    node.className = "empty-note";
    node.textContent = message;
    return node;
}
function normalizeUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) {
        return "";
    }
    try {
        return new URL(value).toString();
    }
    catch {
        try {
            return new URL(`https://${value}`).toString();
        }
        catch {
            return "";
        }
    }
}
function simplifyHost(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    }
    catch {
        return url;
    }
}
function urlsShareHost(leftUrl, rightUrl) {
    if (!leftUrl || !rightUrl) {
        return false;
    }
    try {
        const left = new URL(leftUrl);
        const right = new URL(rightUrl);
        return left.hostname === right.hostname || left.hostname.endsWith(`.${right.hostname}`) || right.hostname.endsWith(`.${left.hostname}`);
    }
    catch {
        return false;
    }
}
const DEFAULT_RENDERER_SETTINGS = {
    fontSize: 18,
    lineHeight: 1.9,
    letterSpacing: 0.01,
    fontFamilyPreset: "site",
    initializedFromNovelpia: false
};
const FONT_FAMILY_PRESET_CSS = {
    site: "",
    "noto-sans-kr": '"Noto Sans KR", "Malgun Gothic", sans-serif',
    "malgun-gothic": '"Malgun Gothic", "Segoe UI Variable", sans-serif',
    "nanum-myeongjo": '"Nanum Myeongjo", "Malgun Myeongjo", serif'
};
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function parseLetterSpacingValue(value, fontSize = 18) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    const text = String(value || "").trim().toLowerCase();
    if (!text || text === "normal") {
        return DEFAULT_RENDERER_SETTINGS.letterSpacing;
    }
    const numeric = Number.parseFloat(text);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_RENDERER_SETTINGS.letterSpacing;
    }
    if (text.endsWith("em")) {
        return numeric;
    }
    if (text.endsWith("px")) {
        return fontSize > 0 ? numeric / fontSize : DEFAULT_RENDERER_SETTINGS.letterSpacing;
    }
    return numeric;
}
function formatLetterSpacingEm(value) {
    return `${Number(clamp(value, -0.08, 0.2).toFixed(3))}em`;
}
function normalizeRendererSettings(raw) {
    const settings = raw && typeof raw === "object" ? raw : {};
    const fontFamilyPreset = settings.fontFamilyPreset;
    return {
        fontSize: clamp(Number(settings.fontSize) || DEFAULT_RENDERER_SETTINGS.fontSize, 12, 40),
        lineHeight: clamp(Number(settings.lineHeight) || DEFAULT_RENDERER_SETTINGS.lineHeight, 1.2, 2.8),
        letterSpacing: clamp(parseLetterSpacingValue(settings.letterSpacing), -0.08, 0.2),
        fontFamilyPreset: fontFamilyPreset === "noto-sans-kr" || fontFamilyPreset === "malgun-gothic" || fontFamilyPreset === "nanum-myeongjo"
            ? fontFamilyPreset
            : "site",
        initializedFromNovelpia: Boolean(settings.initializedFromNovelpia)
    };
}
function resolveFontFamilyPreset(preset, fallbackFontFamily = "") {
    if (preset === "site") {
        return fallbackFontFamily || "";
    }
    return FONT_FAMILY_PRESET_CSS[preset] || fallbackFontFamily || "";
}
function buildTypographyPresetFromSettings(settings, fallback = null) {
    return {
        fontSize: clamp(Number(settings.fontSize) || fallback?.fontSize || DEFAULT_RENDERER_SETTINGS.fontSize, 12, 40),
        lineHeight: clamp(Number(settings.lineHeight) || fallback?.lineHeight || DEFAULT_RENDERER_SETTINGS.lineHeight, 1.2, 2.8),
        letterSpacing: formatLetterSpacingEm(Number.isFinite(Number(settings.letterSpacing))
            ? Number(settings.letterSpacing)
            : parseLetterSpacingValue(fallback?.letterSpacing, fallback?.fontSize || DEFAULT_RENDERER_SETTINGS.fontSize)),
        fontFamily: resolveFontFamilyPreset(settings.fontFamilyPreset, fallback?.fontFamily || "")
    };
}
function loadJson(key, fallbackValue) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallbackValue;
    }
    catch {
        return fallbackValue;
    }
}
function persistJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
function persistScalar(key, value) {
    localStorage.setItem(key, value);
}
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
