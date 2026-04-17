"use strict";
const READER_SITE_URL_STRATEGIES = [
    {
        id: "novelpia",
        hosts: ["novelpia.com"],
        readingTokens: ["/viewer/", "/reader/", "/episode/", "viewer", "reader", "episode", "chapter", "read"]
    },
    {
        id: "munpia",
        hosts: ["munpia.com"],
        readingTokens: [
            "/novel/",
            "/page/",
            "viewer",
            "read",
            "episode",
            "chapter",
            "menu=novel",
            "?num=",
            "&num=",
            "action=view",
            "entry_id=",
            "viewratetype=list"
        ]
    },
    {
        id: "kakaopage",
        hosts: ["page.kakao.com"],
        readingTokens: ["/content/"]
    },
    {
        id: "joara",
        hosts: ["joara.com"],
        readingTokens: ["book", "viewer", "read", "episode", "chapter", "story"],
        useMinimalAmbientTheme: true
    }
];
function normalizeReaderUrl(url) {
    return String(url || "").toLowerCase();
}
function matchesAnyUrlToken(value, tokens) {
    return tokens.some((token) => value.includes(token));
}
function getReaderSiteStrategy(url) {
    const value = normalizeReaderUrl(url);
    return READER_SITE_URL_STRATEGIES.find((strategy) => matchesAnyUrlToken(value, strategy.hosts)) ?? null;
}
function getReaderSiteId(url) {
    return getReaderSiteStrategy(url)?.id ?? null;
}
function isAuthPage(url) {
    const value = normalizeReaderUrl(url);
    return [
        "login",
        "signin",
        "sign-in",
        "auth",
        "oauth",
        "account",
        "accounts.kakao.com",
        "kauth.kakao.com",
        "/proc/login_kakao"
    ].some((token) => value.includes(token));
}
function isSupportedNovelSite(url) {
    return getReaderSiteStrategy(url) !== null;
}
function isMunpiaUrl(url) {
    return getReaderSiteId(url) === "munpia";
}
function isMunpiaReadingUrl(url) {
    const value = normalizeReaderUrl(url);
    if (!value.includes("munpia.com")) {
        return false;
    }
    if (value.includes("/novel/detail/") || value.includes("viewratetype=list")) {
        return false;
    }
    return ((value.includes("action=view") && value.includes("entry_id="))
        || value.includes("viewratetype=continue")
        || value.includes("viewratetype=replay")
        || value.includes("/viewer/")
        || value.includes("/read/")
        || value.includes("?num=")
        || value.includes("&num="));
}
const READING_FONT_OFFSET_PX = 1;
function buildMunpiaSurfaceCss(typography, applyReaderTypography = false) {
    if (!applyReaderTypography) {
        return `
      html,
      body,
      #wrap,
      #container,
      #content,
      .wrap,
      .container,
      .content,
      main {
        background: #f6efb6 !important;
        background-color: #f6efb6 !important;
        color: #231f15 !important;
      }

      html,
      body {
        background-image: none !important;
      }

      body::before,
      body::after,
      html::before,
      html::after {
        background-image: none !important;
      }

      a,
      p,
      span,
      strong,
      em,
      small,
      li,
      dt,
      dd,
      h1,
      h2,
      h3,
      h4,
      h5,
      h6,
      button,
      input,
      textarea,
      select,
      label {
        color: #231f15 !important;
        text-shadow: none !important;
      }

      [style*='background-image'] {
        background-image: none !important;
      }

      header,
      nav,
      [class*='header'],
      [id*='header'],
      [class*='gnb'],
      [id*='gnb'],
      [class*='top'],
      [id*='top'],
      [class*='nav'],
      [id*='nav'],
      [class*='menu'],
      [id*='menu'],
      [class*='tab'],
      [id*='tab'] {
        background: #f2e79e !important;
        background-color: #f2e79e !important;
        background-image: none !important;
        border-color: rgba(120, 109, 36, 0.28) !important;
        box-shadow: none !important;
      }

      header *,
      nav *,
      [class*='header'] *,
      [id*='header'] *,
      [class*='gnb'] *,
      [id*='gnb'] *,
      [class*='top'] *,
      [id*='top'] *,
      [class*='nav'] *,
      [id*='nav'] *,
      [class*='menu'] *,
      [id*='menu'] *,
      [class*='tab'] *,
      [id*='tab'] * {
        color: #231f15 !important;
        fill: currentColor !important;
        stroke: currentColor !important;
      }
    `;
    }
    const fontSize = Math.max(12, (typography?.fontSize || 18) + READING_FONT_OFFSET_PX);
    const lineHeight = typography?.lineHeight || 1.9;
    const letterSpacing = typography?.letterSpacing || "0.01em";
    const fontFamilyRule = typography?.fontFamily ? `font-family: ${typography.fontFamily} !important;` : "";
    const readerTypographyCss = applyReaderTypography ? `
    p,
    span,
    li,
    dd,
    dt,
    div,
    article,
    section,
    td,
    th {
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
      letter-spacing: ${letterSpacing} !important;
      ${fontFamilyRule}
    }
  ` : "";
    return `
    html,
    body {
      background: #f6efb6 !important;
      background-color: #f6efb6 !important;
      background-image: none !important;
      color: #231f15 !important;
    }

    body,
    main,
    section,
    article,
    div,
    ul,
    ol,
    li,
    dl,
    dt,
    dd,
    table,
    tr,
    td,
    th,
    form,
    fieldset,
    #wrap,
    #container,
    #content,
    .wrap,
    .container,
    .content,
    [class*='wrap'],
    [id*='wrap'],
    [class*='container'],
    [id*='container'],
    [class*='content'],
    [id*='content'],
    [class*='page'],
    [id*='page'],
    [class*='view'],
    [id*='view'],
    [class*='detail'],
    [id*='detail'],
    [class*='viewer'],
    [id*='viewer'] {
      background-image: none !important;
      background-color: #f6efb6 !important;
      box-shadow: none !important;
    }

    p,
    span,
    strong,
    em,
    small,
    a,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    li,
    dt,
    dd,
    td,
    th,
    label,
    button,
    input,
    textarea,
    select {
      color: #231f15 !important;
      text-shadow: none !important;
    }

    [style*='background-image'],
    [style*='background: url'],
    [style*='background:url'] {
      background-image: none !important;
    }

    ${readerTypographyCss}
  `;
}
function buildMemoPaperBackgroundCss() {
    return `
    :root {
      --sticky-paper: #f6efb6;
      --sticky-paper-strong: #f2e79e;
      --sticky-ink: #231f15;
      --sticky-line: rgba(120, 109, 36, 0.22);
      --sticky-line-strong: rgba(120, 109, 36, 0.36);
      --sticky-chip: rgba(255, 248, 196, 0.82);
    }

    html,
    body {
      background: var(--sticky-paper) !important;
      background-color: var(--sticky-paper) !important;
      background-image: none !important;
      color: var(--sticky-ink) !important;
    }

    body,
    #root,
    #wrap,
    #container,
    #content,
    main,
    article,
    section,
    .wrap,
    .container,
    .content,
    [class*='wrap'],
    [id*='wrap'],
    [class*='container'],
    [id*='container'],
    [class*='content'],
    [id*='content'] {
      background-image: none !important;
    }

    [style*='background-image'],
    [style*='background: url'],
    [style*='background:url'] {
      background-image: none !important;
    }

    [style*='background-color:#fff'],
    [style*='background:#fff'],
    [style*='background-color: #fff'],
    [style*='background: #fff'],
    [style*='background-color:white'],
    [style*='background:white'],
    [style*='background-color: white'],
    [style*='background: white'],
    [style*='background-color:rgb(255,255,255)'],
    [style*='background:rgb(255,255,255)'],
    [style*='background-color: rgb(255,255,255)'],
    [style*='background: rgb(255,255,255)'],
    [style*='background-color:rgb(255, 255, 255)'],
    [style*='background:rgb(255, 255, 255)'],
    [style*='background-color: rgb(255, 255, 255)'],
    [style*='background: rgb(255, 255, 255)'],
    .ant-layout,
    .ant-layout-content,
    .ant-card,
    .ant-card-body,
    .ant-modal-content,
    .ant-drawer-content,
    .ant-popover-inner,
    .ant-table,
    .ant-table-container {
      background: var(--sticky-paper) !important;
      background-color: var(--sticky-paper) !important;
      background-image: none !important;
      color: var(--sticky-ink) !important;
      box-shadow: none !important;
    }

    body,
    p,
    span,
    strong,
    em,
    small,
    a,
    li,
    dt,
    dd,
    td,
    th,
    label,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      color: var(--sticky-ink) !important;
      text-shadow: none !important;
    }

    input,
    select,
    button,
    textarea {
      box-shadow: none !important;
      border-color: var(--sticky-line-strong) !important;
    }

    * {
      scrollbar-width: none !important;
    }

    *::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
      display: none !important;
    }
  `;
}
function shouldUseMinimalAmbientTheme(url) {
    return getReaderSiteStrategy(url)?.useMinimalAmbientTheme === true;
}
function shouldUseCatalogAmbientTheme(url) {
    return isSupportedNovelSite(url) && !isAuthPage(url) && !isReadingUrl(url);
}
function isReadingUrl(url) {
    const value = normalizeReaderUrl(url);
    if (!value) {
        return false;
    }
    const strategy = getReaderSiteStrategy(value);
    if (!strategy) {
        return false;
    }
    if (strategy.id === "munpia") {
        return isMunpiaReadingUrl(value);
    }
    return matchesAnyUrlToken(value, strategy.readingTokens);
}
function buildReaderChromeSuppressionCss(url) {
    if (!isReadingUrl(url)) {
        return "";
    }
    const siteId = getReaderSiteId(url);
    if (siteId === "novelpia") {
        return `
      header,
      footer,
      nav,
      aside,
      [class*='toolbar'],
      [id*='toolbar'],
      [class*='viewer_top'],
      [id*='viewer_top'],
      [class*='viewer-header'],
      [id*='viewer-header'],
      [class*='topbar'],
      [id*='topbar'],
      [class*='episode_head'],
      [id*='episode_head'],
      [class*='episode-title'],
      [id*='episode-title'],
      [class*='chapter_head'],
      [id*='chapter_head'],
      [class*='chapter-title'],
      [id*='chapter-title'],
      [class*='novel_title'],
      [id*='novel_title'],
      [class*='title_box'],
      [id*='title_box'],
      [class*='read_option'],
      [id*='read_option'],
      [class*='view_option'],
      [id*='view_option'],
      #i-am-progress-indicator,
      #back_info_layer,
      #next_info_layer {
        display: none !important;
        visibility: hidden !important;
        max-height: 0 !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    }
    if (siteId === "munpia") {
        return `
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) header,
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) footer,
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) nav,
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) aside,
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='toolbar'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='toolbar'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='viewer_top'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='viewer_top'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='viewer-header'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='viewer-header'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='topbar'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='topbar'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='episode_head'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='episode_head'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='episode-title'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='episode-title'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='chapter_head'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='chapter_head'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='chapter-title'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='chapter-title'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='novel_title'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='novel_title'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='title_box'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='title_box'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='read_option'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='read_option'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [class*='view_option'],
      body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) [id*='view_option'] {
        display: none !important;
        visibility: hidden !important;
        max-height: 0 !important;
        overflow: hidden !important;
      }
    `;
    }
    if (siteId === "joara") {
        return `
      header,
      footer,
      nav,
      aside,
      [class*='toolbar'],
      [id*='toolbar'],
      [class*='viewer_top'],
      [id*='viewer_top'],
      [class*='viewer-header'],
      [id*='viewer-header'],
      [class*='topbar'],
      [id*='topbar'],
      [class*='title_box'],
      [id*='title_box'],
      [class*='read_option'],
      [id*='read_option'],
      [class*='view_option'],
      [id*='view_option'] {
        display: none !important;
        visibility: hidden !important;
        max-height: 0 !important;
        overflow: hidden !important;
      }
    `;
    }
    return "";
}
function buildCatalogShellCss(url) {
    if (!shouldUseCatalogAmbientTheme(url)) {
        return "";
    }
    return `
    :root {
      --sticky-paper: #f6efb6;
      --sticky-paper-strong: #f2e79e;
      --sticky-ink: #231f15;
      --sticky-line: rgba(120, 109, 36, 0.22);
      --sticky-line-strong: rgba(120, 109, 36, 0.36);
      --sticky-chip: rgba(255, 248, 196, 0.82);
    }

    html,
    body {
      background: var(--sticky-paper) !important;
      color: var(--sticky-ink) !important;
      background-image: none !important;
    }

    body,
    main,
    section,
    article,
    header,
    footer,
    nav,
    aside,
    div,
    ul,
    ol,
    li,
    dl,
    dt,
    dd,
    form,
    fieldset,
    table,
    tr,
    td,
    th,
    #wrap,
    #container,
    #content,
    .wrap,
    .container,
    .content,
    [class*='wrap'],
    [id*='wrap'],
    [class*='container'],
    [id*='container'],
    [class*='content'],
    [id*='content'] {
      background: var(--sticky-paper) !important;
      background-image: none !important;
      color: var(--sticky-ink) !important;
      box-shadow: none !important;
    }

    main,
    article,
    [role='main'],
    #wrap,
    #container,
    #content,
    .wrap,
    .container,
    .content,
    [class*='wrap'],
    [id*='wrap'],
    [class*='container'],
    [id*='container'],
    [class*='content'],
    [id*='content'] {
      max-width: 860px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 14px !important;
      padding-right: 14px !important;
    }

    [class*='banner'],
    [id*='banner'],
    [class*='hero'],
    [id*='hero'],
    [class*='swiper'],
    [id*='swiper'],
    [class*='carousel'],
    [id*='carousel'],
    [class*='slide'],
    [id*='slide'],
    [class*='event'],
    [id*='event'],
    [class*='promotion'],
    [id*='promotion'],
    [class*='advert'],
    [id*='advert'],
    iframe,
    video {
      display: none !important;
      visibility: hidden !important;
    }

    img,
    picture,
    figure,
    source,
    [class*='thumb'],
    [id*='thumb'],
    [class*='thumbnail'],
    [id*='thumbnail'],
    [class*='cover'],
    [id*='cover'],
    [class*='poster'],
    [id*='poster'] {
      display: none !important;
      visibility: hidden !important;
      background-image: none !important;
    }

    [class*='grid'],
    [id*='grid'],
    [class*='rank'],
    [id*='rank'],
    [class*='search'],
    [id*='search'],
    [class*='result'],
    [id*='result'],
    [class*='list'],
    [id*='list'] {
      display: block !important;
      grid-template-columns: 1fr !important;
      gap: 0 !important;
    }

    li,
    [class*='item'],
    [id*='item'],
    [class*='card'],
    [id*='card'] {
      border: 0 !important;
      border-bottom: 1px solid var(--sticky-line) !important;
      border-radius: 0 !important;
      padding: 10px 0 !important;
      margin: 0 !important;
      min-height: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    input,
    select,
    button,
    textarea {
      background: var(--sticky-chip) !important;
      color: var(--sticky-ink) !important;
      border: 1px solid var(--sticky-line-strong) !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    a,
    p,
    span,
    strong,
    em,
    small,
    li,
    dt,
    dd,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      color: var(--sticky-ink) !important;
      text-shadow: none !important;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      letter-spacing: -0.01em !important;
      margin-top: 0 !important;
      margin-bottom: 10px !important;
    }

    a {
      text-decoration: none !important;
    }

    table,
    tr,
    td,
    th {
      border-color: var(--sticky-line) !important;
    }
  `;
}
function buildReaderComfortCss(url, typography) {
    if (!isReadingUrl(url)) {
        return "";
    }
    const fontSize = Math.max(12, typography?.fontSize || 18);
    const lineHeight = typography?.lineHeight || 1.92;
    const letterSpacing = typography?.letterSpacing || "0.01em";
    const fontFamilyRule = typography?.fontFamily ? `font-family: ${typography.fontFamily} !important;` : "";
    return `
    html, body {
      scroll-behavior: smooth !important;
    }

    body {
      padding-bottom: 24px !important;
    }

    #novel_content,
    #novelContent,
    #novel_box,
    #novel_text,
    #novel_drawing,
    #novel_drawing_page,
    #novel_drawing_page_c,
    #revContents,
    .novel_view_area,
    .novel_view,
    .viewer_contents,
    .viewer_body,
    .episode-content,
    .ep-content,
    .read_area,
    .view_content,
    .content_view,
    [class*='viewer_contents'],
    [class*='viewer_body'],
    [class*='episode-content'],
    [class*='read_area'],
    [class*='view_content'],
    article,
    main {
      width: auto !important;
      max-width: min(820px, calc(100vw - 20px)) !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 12px !important;
      padding-right: 12px !important;
      box-sizing: border-box !important;
      background-color: #f6efb6 !important;
      text-align: left !important;
    }

    #novel_content > *,
    #novelContent > *,
    #novel_box > *,
    #novel_text > *,
    #novel_drawing > *,
    #novel_drawing_page > *,
    #novel_drawing_page_c > *,
    #revContents > *,
    .novel_view_area > *,
    .novel_view > *,
    .viewer_contents > *,
    .viewer_body > *,
    .episode-content > *,
    .ep-content > *,
    .read_area > *,
    .view_content > *,
    .content_view > *,
    article > *,
    main > * {
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      text-indent: 0 !important;
      text-align: left !important;
    }

    #novel_content p,
    #novelContent p,
    #novel_text p,
    #revContents p,
    .novel_view_area p,
    .novel_view p,
    .viewer_contents p,
    .viewer_body p,
    .episode-content p,
    .ep-content p,
    .read_area p,
    .view_content p,
    .content_view p,
    [class*='viewer_contents'] p,
    [class*='viewer_body'] p,
    [class*='episode-content'] p,
    [class*='read_area'] p,
    [class*='view_content'] p,
    article p,
    main p {
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      text-indent: 0 !important;
      text-align: left !important;
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
      letter-spacing: ${letterSpacing} !important;
      ${fontFamilyRule}
      color: #231f15 !important;
    }

    font.line,
    font[id^='line_'],
    .line {
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      text-indent: 0 !important;
      text-align: left !important;
    }
  `;
}
function buildPopupCloseVisibilityCss() {
    return `
    button[class*='close' i],
    a[class*='close' i],
    [role='button'][class*='close' i],
    button[id*='close' i],
    a[id*='close' i],
    [role='button'][id*='close' i],
    button[aria-label*='close' i],
    a[aria-label*='close' i],
    button[title*='close' i],
    a[title*='close' i],
    [class*='popup' i] button[class*='btn' i][class*='close' i],
    [class*='modal' i] button[class*='btn' i][class*='close' i] {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      visibility: visible !important;
      opacity: 1 !important;
      color: #231f15 !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
    }

    button[class*='close' i] img,
    a[class*='close' i] img,
    [role='button'][class*='close' i] img,
    button[id*='close' i] img,
    a[id*='close' i] img,
    [role='button'][id*='close' i] img,
    button[class*='close' i] svg,
    a[class*='close' i] svg,
    [role='button'][class*='close' i] svg,
    button[id*='close' i] svg,
    a[id*='close' i] svg,
    [role='button'][id*='close' i] svg,
    button[class*='close' i] i,
    a[class*='close' i] i,
    [role='button'][class*='close' i] i,
    button[id*='close' i] i,
    a[id*='close' i] i,
    [role='button'][id*='close' i] i,
    [class*='popup' i] button[class*='btn' i][class*='close' i] img,
    [class*='popup' i] button[class*='btn' i][class*='close' i] svg,
    [class*='modal' i] button[class*='btn' i][class*='close' i] img,
    [class*='modal' i] button[class*='btn' i][class*='close' i] svg {
      display: inline-block !important;
      visibility: visible !important;
      opacity: 1 !important;
      color: #231f15 !important;
      fill: currentColor !important;
    }
  `;
}
function buildModalSafetyCss(url) {
    if (getReaderSiteId(url) !== "munpia" || isAuthPage(url)) {
        return "";
    }
    return `
    html,
    body {
      overflow: auto !important;
    }

    #_rht_toaster {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
}
function buildSiteDomAdapterScript(url, typography) {
    const siteId = getReaderSiteId(url);
    if (siteId === "novelpia" && !isAuthPage(url) && !isReadingUrl(url)) {
        return `
      (() => {
        const STYLE_ID = "sticky-novelpia-drag-scroll-style";
        const TARGET_ATTR = "data-sticky-drag-scroll";
        const READY_ATTR = "data-sticky-drag-scroll-ready";
        const CLICK_SUPPRESS_ATTR = "data-sticky-drag-click-suppress";
        let refreshTimer = 0;

        function ensureStyle() {
          if (document.getElementById(STYLE_ID)) {
            return;
          }

          const style = document.createElement("style");
          style.id = STYLE_ID;
          style.textContent = [
            "[" + TARGET_ATTR + "='1']{cursor:grab;scrollbar-width:none;user-select:auto;}",
            "[" + TARGET_ATTR + "='1']::-webkit-scrollbar{width:0;height:0;display:none;}",
            "[" + TARGET_ATTR + "='1'][" + READY_ATTR + "='dragging']{cursor:grabbing;user-select:none;}"
          ].join("");
          (document.head || document.documentElement || document.body).appendChild(style);
        }

        function isInteractiveTarget(node) {
          return node instanceof Element
            && Boolean(node.closest("a, button, input, textarea, select, label, summary, [role='button'], [contenteditable='true']"));
        }

        function looksHorizontallyScrollable(node) {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          if (node === document.body || node === document.documentElement) {
            return false;
          }

          const style = window.getComputedStyle(node);
          const overflowX = style.overflowX || "";
          const hasHorizontalOverflow = node.scrollWidth - node.clientWidth > 24;
          const wideEnough = node.clientWidth >= 120;
          const reasonableHeight = node.clientHeight >= 32 && node.clientHeight <= Math.max(window.innerHeight * 0.72, 240);
          const horizontalLayout = style.whiteSpace === "nowrap"
            || style.display.includes("flex")
            || style.display.includes("grid")
            || style.scrollSnapType.includes("x");
          const childCount = node.children.length;

          if (!hasHorizontalOverflow || !wideEnough || !reasonableHeight) {
            return false;
          }

          if (!(overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden" || overflowX === "overlay")) {
            return false;
          }

          if (!horizontalLayout && childCount < 2) {
            return false;
          }

          if (node.closest("#sticky-munpia-reader-root, #sticky-reader-mask, #sticky-munpia-back-chip, #sticky-munpia-next-chip, #sticky-munpia-list-chip")) {
            return false;
          }

          return true;
        }

        function attachDragScroll(node) {
          if (!(node instanceof HTMLElement) || node.getAttribute(READY_ATTR) === "1") {
            return;
          }

          node.setAttribute(TARGET_ATTR, "1");
          node.setAttribute(READY_ATTR, "1");

          let pointerId = -1;
          let startX = 0;
          let startY = 0;
          let startScrollLeft = 0;
          let dragging = false;
          let directionLocked = false;

          function resetState() {
            const activePointerId = pointerId;
            pointerId = -1;
            dragging = false;
            directionLocked = false;
            node.setAttribute(READY_ATTR, "1");
            try {
              node.releasePointerCapture(activePointerId);
            } catch {}
          }

          node.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || isInteractiveTarget(event.target)) {
              return;
            }

            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            startScrollLeft = node.scrollLeft;
            dragging = false;
            directionLocked = false;
          });

          node.addEventListener("pointermove", (event) => {
            if (pointerId !== event.pointerId) {
              return;
            }

            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;

            if (!directionLocked) {
              if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) {
                return;
              }

              if (Math.abs(deltaY) > Math.abs(deltaX)) {
                resetState();
                return;
              }

              directionLocked = true;
              dragging = true;
              node.setAttribute(READY_ATTR, "dragging");
              try {
                node.setPointerCapture(event.pointerId);
              } catch {}
            }

            if (!dragging) {
              return;
            }

            node.scrollLeft = startScrollLeft - deltaX;
            node.setAttribute(CLICK_SUPPRESS_ATTR, "1");
            event.preventDefault();
          });

          node.addEventListener("pointerup", (event) => {
            if (pointerId !== event.pointerId) {
              return;
            }

            window.setTimeout(() => {
              node.removeAttribute(CLICK_SUPPRESS_ATTR);
            }, 80);
            resetState();
          });

          node.addEventListener("pointercancel", (event) => {
            if (pointerId !== event.pointerId) {
              return;
            }

            node.removeAttribute(CLICK_SUPPRESS_ATTR);
            resetState();
          });

          node.addEventListener("lostpointercapture", () => {
            dragging = false;
            directionLocked = false;
            node.setAttribute(READY_ATTR, "1");
          });

          node.addEventListener("click", (event) => {
            if (node.getAttribute(CLICK_SUPPRESS_ATTR) !== "1") {
              return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();
          }, true);
        }

        function refreshTargets() {
          ensureStyle();

          document.querySelectorAll("div, section, article, ul, ol, nav, main").forEach((node) => {
            if (looksHorizontallyScrollable(node)) {
              attachDragScroll(node);
            }
          });
        }

        function scheduleRefresh() {
          if (refreshTimer) {
            return;
          }

          refreshTimer = window.setTimeout(() => {
            refreshTimer = 0;
            refreshTargets();
          }, 120);
        }

        refreshTargets();

        if (!window.__stickyNovelpiaDragScrollObserver) {
          const observer = new MutationObserver(() => {
            scheduleRefresh();
          });

          observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
          });

          window.__stickyNovelpiaDragScrollObserver = observer;
        }

        return true;
      })();
    `;
    }
    if (siteId === "novelpia" && isReadingUrl(url)) {
        return `
      (() => {
        function normalizeText(value) {
          return String(value || "").replace(/\\s+/g, " ").trim();
        }

        function isVisibleElement(node) {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none"
            && style.visibility !== "hidden"
            && Number(style.opacity || "1") > 0
            && rect.width > 0
            && rect.height > 0;
        }

        function hideElement(node) {
          if (!(node instanceof HTMLElement)) {
            return;
          }

          node.setAttribute("data-sticky-munpia-hidden", "1");
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
          node.style.setProperty("opacity", "0", "important");
          node.style.setProperty("pointer-events", "none", "important");
        }

        function hideElement(node) {
          if (!(node instanceof HTMLElement)) {
            return;
          }

          node.setAttribute("data-sticky-novelpia-hidden", "1");
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
          node.style.setProperty("opacity", "0", "important");
          node.style.setProperty("pointer-events", "none", "important");
        }

        function ensureAdapterStyle() {
          if (document.getElementById("sticky-novelpia-adapter-style")) {
            return;
          }

          const style = document.createElement("style");
          style.id = "sticky-novelpia-adapter-style";
          style.textContent = [
            "body[data-sticky-novelpia-adapter='1'] [data-sticky-novelpia-hidden='1'] { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }",
            "body[data-sticky-novelpia-adapter='1'], body[data-sticky-novelpia-adapter='1'] #novel_box, body[data-sticky-novelpia-adapter='1'] #novel_text, body[data-sticky-novelpia-adapter='1'] #novel_drawing, body[data-sticky-novelpia-adapter='1'] #novel_drawing_page, body[data-sticky-novelpia-adapter='1'] #novel_drawing_page_c { background: #f6efb6 !important; background-color: #f6efb6 !important; background-image: none !important; color: #231f15 !important; }",
            "body[data-sticky-novelpia-adapter='1'] #novel_drawing_page_info, body[data-sticky-novelpia-adapter='1'] #page_cnt { display: none !important; }",
            "body[data-sticky-novelpia-adapter='1'] #novel_box, body[data-sticky-novelpia-adapter='1'] #novel_text, body[data-sticky-novelpia-adapter='1'] #novel_drawing, body[data-sticky-novelpia-adapter='1'] #novel_drawing_page { box-shadow: none !important; border-color: rgba(120, 109, 36, 0.24) !important; }"
          ].join("\\n");
          (document.head || document.documentElement || document.body).appendChild(style);
        }

        function findReaderRoot() {
          return (
            document.getElementById("novel_drawing_page")
            || document.getElementById("novel_drawing")
            || document.getElementById("novel_text")
            || document.getElementById("novel_box")
          );
        }

        function findFirstReadableLine(root) {
          const candidates = Array.from(root.querySelectorAll("font.line, font[id^='line_'], .line, p"));
          let best = null;
          let bestTop = Number.POSITIVE_INFINITY;

          candidates.forEach((node) => {
            if (!(node instanceof HTMLElement) || !isVisibleElement(node)) {
              return;
            }

            if (node.id === "novel_drawing_page_info") {
              return;
            }

            const text = normalizeText(node.innerText || node.textContent || "");
            if (text.length < 6) {
              return;
            }

            if (/(comment|recommend|writer|reply)/i.test(text) && text.length < 32) {
              return;
            }

            const rect = node.getBoundingClientRect();
            if (rect.width < 100 || rect.height <= 0 || rect.top < 0) {
              return;
            }

            if (rect.top < bestTop) {
              best = node;
              bestTop = rect.top;
            }
          });

          return best;
        }

        function applyRootSurface(root) {
          [
            document.documentElement,
            document.body,
            document.getElementById("novel_box"),
            document.getElementById("novel_text"),
            document.getElementById("novel_drawing"),
            document.getElementById("novel_drawing_page"),
            document.getElementById("novel_drawing_page_c"),
            root
          ].forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            node.style.background = "#f6efb6";
            node.style.backgroundColor = "#f6efb6";
            node.style.backgroundImage = "none";
            node.style.color = "#231f15";
          });
        }

        function hideKnownInlineOverlays() {
          const pageCounterNode = document.getElementById("page_cnt");
          if (pageCounterNode instanceof HTMLElement) {
            hideElement(pageCounterNode);

            const pageCounterShell = pageCounterNode.parentElement;
            if (pageCounterShell instanceof HTMLElement && pageCounterShell !== document.body) {
              const shellStyle = window.getComputedStyle(pageCounterShell);
              const shellRect = pageCounterShell.getBoundingClientRect();
              const shellText = normalizeText(pageCounterShell.innerText || pageCounterShell.textContent || "");
              const looksLikePageCounterShell = (
                (shellStyle.position === "fixed" || shellStyle.position === "absolute")
                && Number.parseFloat(shellStyle.bottom || "0") <= 12
                && shellRect.height <= 72
                && shellText.length <= 16
                && /^[0-9/\s.]+$/.test(shellText || "1/1")
              );

              if (looksLikePageCounterShell) {
                hideElement(pageCounterShell);
              }
            }
          }

          [
            document.getElementById("novel_drawing_page_info"),
            document.getElementById("writer_comments_box")
          ].forEach((node) => {
            hideElement(node);
          });

          document.querySelectorAll("[id*='writer_comment'], [class*='writer-comment']").forEach((node) => {
            hideElement(node);
          });
        }

        function hideUpperMetaBetweenTopAndFirstLine(root, firstReadableLine) {
          if (!(root instanceof HTMLElement)) {
            return;
          }

          const rootRect = root.getBoundingClientRect();
          const firstRect = firstReadableLine instanceof HTMLElement
            ? firstReadableLine.getBoundingClientRect()
            : null;

          const topMin = rootRect.top + 10;
          const topMax = firstRect
            ? Math.min(firstRect.top + Math.max(18, Math.min(42, firstRect.height + 12)), rootRect.top + 260)
            : rootRect.top + 220;

          const preserveSelector = [
            "#header_bar",
            "#footer_bar",
            "#theme_box",
            "#comment_box",
            "#list_box",
            "#float-menu",
            "#scroll_up_btn",
            "#scroll_down_btn",
            "#back_info_layer",
            "#next_info_layer",
            "#load_bar",
            "#novel_box",
            "#novel_text",
            "#novel_drawing",
            "#novel_drawing_page",
            "#novel_drawing_page_c",
            "#novel_drawing_left",
            "#novel_drawing_right"
          ].join(", ");

          root.querySelectorAll("*").forEach((node) => {
            if (!(node instanceof HTMLElement) || !isVisibleElement(node)) {
              return;
            }

            if (node === firstReadableLine || node.contains(firstReadableLine)) {
              return;
            }

            if (node.matches("font.line, font[id^='line_'], .line, p, span, br, strong, em, b, i")) {
              return;
            }

            if (node.id === "novel_drawing_page_info") {
              hideElement(node);
              return;
            }

            if (node.id === "writer_comments_box" || node.matches("[id*='writer_comment'], [class*='writer-comment']")) {
              hideElement(node);
              return;
            }

            const preservedAncestor = node.closest(preserveSelector);
            if (preservedAncestor && preservedAncestor !== node) {
              return;
            }

            const rect = node.getBoundingClientRect();
            if (rect.top < topMin || rect.top > topMax || rect.width < 120 || rect.height <= 0 || rect.height > 64) {
              return;
            }

            const style = window.getComputedStyle(node);
            const text = normalizeText(node.innerText || node.textContent || "");
            const descriptor = [
              node.tagName,
              node.id,
              node.className,
              node.getAttribute("role")
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            const controlCount = node.querySelectorAll("button, [role='button'], a, input, select, textarea").length;
            const iconCount = node.querySelectorAll("svg, img, i").length;
            const borderTop = Number.parseFloat(style.borderTopWidth || "0");
            const borderBottom = Number.parseFloat(style.borderBottomWidth || "0");
            const looksLikeMetaText = text.length > 0
              && text.length <= 32
              && (
                /(comment|recommend|writer|reply)/i.test(text)
                || /\\(\\d+\\)|\\d+\\s*(ea|count|comments?)/i.test(text)
                || descriptor.includes("comment")
                || descriptor.includes("recommend")
              );
            const looksLikeThinDivider = text.length === 0
              && rect.width >= Math.max(160, rootRect.width * 0.45)
              && (
                rect.height <= 4
                || ((borderTop >= 1 || borderBottom >= 1) && rect.height <= 12)
                || descriptor.includes("divider")
                || descriptor.includes("separator")
                || descriptor.includes("split")
              );
            const overlayPosition = style.position === "absolute" || style.position === "fixed" || style.position === "sticky";

            if (looksLikeThinDivider) {
              hideElement(node);
              return;
            }

            if (looksLikeMetaText && (overlayPosition || controlCount <= 2 || iconCount > 0)) {
              hideElement(node);
            }
          });
        }

        function applyNovelpiaAdapter() {
          if (!document.body) {
            return false;
          }

          const root = findReaderRoot();
          if (!(root instanceof HTMLElement)) {
            document.body.removeAttribute("data-sticky-novelpia-adapter");
            return false;
          }

          ensureAdapterStyle();
          document.body.setAttribute("data-sticky-novelpia-adapter", "1");
          applyRootSurface(root);
          hideKnownInlineOverlays();

          const firstReadableLine = findFirstReadableLine(root);
          hideUpperMetaBetweenTopAndFirstLine(root, firstReadableLine);
          return true;
        }

        let refreshTimer = 0;
        function scheduleNovelpiaAdapterRefresh() {
          if (refreshTimer) {
            return;
          }

          refreshTimer = window.setTimeout(() => {
            refreshTimer = 0;
            applyNovelpiaAdapter();
          }, 90);
        }

        applyNovelpiaAdapter();

        const observer = new MutationObserver(() => {
          scheduleNovelpiaAdapterRefresh();
        });

        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }

        window.setTimeout(() => {
          observer.disconnect();
          if (refreshTimer) {
            window.clearTimeout(refreshTimer);
            refreshTimer = 0;
          }
        }, 3200);

        return true;
      })();
    `;
    }
    if (isMunpiaUrl(url) && isReadingUrl(url)) {
        return `
      (() => {
        const typography = ${JSON.stringify(typography ?? null)};

        function normalizeText(value) {
          return String(value || "").replace(/\\s+/g, " ").trim();
        }

        function hasNextEpisodeAction(text) {
          return /다음\s*화|다음화|next/i.test(normalizeText(text));
        }

        function isVisibleElement(node) {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none"
            && style.visibility !== "hidden"
            && Number(style.opacity || "1") > 0
            && rect.width > 0
            && rect.height > 0;
        }

        function findTitleElement() {
          const selectors = [
            "h1",
            "h2",
            "h3",
            "[class*='title']",
            "[id*='title']",
            ".tit",
            ".title"
          ];
          let best = null;
          let bestScore = -Infinity;

          selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => {
              if (!(node instanceof HTMLElement) || !isVisibleElement(node)) {
                return;
              }

              const text = normalizeText(node.innerText || node.textContent || "");
              const rect = node.getBoundingClientRect();
              if (text.length < 4 || text.length > 60 || rect.top < 40 || rect.top > 260 || rect.height > 90) {
                return;
              }

              const score = (320 - rect.top) + Math.min(text.length, 24) * 3;
              if (score > bestScore) {
                best = node;
                bestScore = score;
              }
            });
          });

          return best;
        }

        function hasMeaningfulChildBlocks(node) {
          return Array.from(node.children || []).some((child) => {
            if (!(child instanceof HTMLElement) || !isVisibleElement(child)) {
              return false;
            }

            if (!["P", "DIV", "LI", "SECTION", "ARTICLE", "BLOCKQUOTE", "TD"].includes(child.tagName)) {
              return false;
            }

            return normalizeText(child.innerText || child.textContent || "").length >= 20;
          });
        }

        function collectReadableBlocks(root, titleBottom) {
          const results = [];
          const seen = new Set();
          const selectors = ["p", "blockquote", "dd", "li", "td"];
          if ((root.children?.length || 0) <= 120) {
            selectors.push("div");
          }

          selectors.forEach((selector) => {
            root.querySelectorAll(selector).forEach((node) => {
              if (!(node instanceof HTMLElement) || !isVisibleElement(node)) {
                return;
              }

              if (node.closest("#sticky-munpia-reader-root")) {
                return;
              }

              if (selector === "div" && hasMeaningfulChildBlocks(node)) {
                return;
              }

              if (node.querySelector("button, [role='button'], input, select, textarea")) {
                return;
              }

              const style = window.getComputedStyle(node);
              if (style.position === "fixed" || style.position === "sticky") {
                return;
              }

              const rect = node.getBoundingClientRect();
              if (rect.top < titleBottom - 8 || rect.height < 14 || rect.width < 120 || rect.top > window.innerHeight * 0.96) {
                return;
              }

              const text = normalizeText(node.innerText || node.textContent || "");
              if (text.length < 10 || text.length > 1200) {
                return;
              }

              if (/조회|댓글|추천|선호|공유|가기|목록|위로|신고|설정/.test(text) && text.length < 120) {
                return;
              }

              const key = text.slice(0, 160);
              if (seen.has(key)) {
                return;
              }

              seen.add(key);
              results.push({
                text,
                top: rect.top,
                element: node
              });
            });
          });

          return results
            .sort((a, b) => a.top - b.top)
            .slice(0, 160);
        }

        function findContentRoot(titleBottom) {
          const candidates = [];
          const seen = new Set();
          [
            "#novel_content",
            "#novelContent",
            "#revContents",
            ".novel_view_area",
            ".novel_view",
            ".viewer_contents",
            ".viewer_body",
            ".view_content",
            ".content_view",
            "[class*='viewer_contents']",
            "[class*='viewer_body']",
            "[class*='view_content']",
            "[class*='novel_view']",
            "[class*='read_area']",
            "article",
            "main",
            "section"
          ].forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => {
              if (!(node instanceof HTMLElement) || seen.has(node) || !isVisibleElement(node)) {
                return;
              }

              seen.add(node);
              const rect = node.getBoundingClientRect();
              if (rect.bottom < titleBottom || rect.top > window.innerHeight * 0.95) {
                return;
              }

              const blocks = collectReadableBlocks(node, titleBottom);
              if (blocks.length < 3) {
                return;
              }

              const previewChars = blocks.slice(0, 8).reduce((sum, block) => sum + block.text.length, 0);
              const score = blocks.length * 90 + previewChars - Math.abs(rect.top - titleBottom) * 2;
              candidates.push({
                node,
                score,
                blocks
              });
            });
          });

          candidates.sort((a, b) => b.score - a.score);
          if (candidates[0]) {
            return candidates[0];
          }

          const fallbackBlocks = collectReadableBlocks(document.body, titleBottom)
            .filter((block) => block.top > titleBottom + 12)
            .slice(0, 160);

          if (fallbackBlocks.length < 3) {
            return null;
          }

          return {
            node: document.body,
            score: fallbackBlocks.length * 100,
            blocks: fallbackBlocks
          };
        }

        function findFirstReadableBlockElement(titleBottom) {
          const block = collectReadableBlocks(document.body, titleBottom)
            .filter((candidate) => candidate.top > titleBottom + 8)[0];
          return block?.element || null;
        }

        function looksLikeThinDivider(node, rect, text) {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          const style = window.getComputedStyle(node);
          const descriptor = [
            node.tagName,
            node.className,
            node.id,
            node.getAttribute("role")
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          const controlCount = node.querySelectorAll("button, [role='button'], a, input, select, textarea").length;
          const borderTop = Number.parseFloat(style.borderTopWidth || "0");
          const borderBottom = Number.parseFloat(style.borderBottomWidth || "0");

          return controlCount === 0
            && (
              node.tagName.toLowerCase() === "hr"
              || descriptor.includes("divider")
              || descriptor.includes("separator")
              || descriptor.includes("split")
              || (text.length === 0 && rect.width >= 120 && rect.height <= 4)
              || (text.length === 0 && rect.width >= 120 && rect.height <= 12 && (borderTop >= 1 || borderBottom >= 1))
            );
        }

        function collectMunpiaScanNodes(roots) {
          const results = [];
          const seen = new Set();

          roots.forEach((root) => {
            if (!(root instanceof HTMLElement) || seen.has(root)) {
              return;
            }

            seen.add(root);
            results.push(root);

            root.querySelectorAll("*").forEach((node) => {
              if (!(node instanceof HTMLElement) || seen.has(node)) {
                return;
              }

              seen.add(node);
              results.push(node);
            });
          });

          return results;
        }

        function getMunpiaChromeScanNodes() {
          const roots = [];
          const selector = [
            "body > header",
            "body > footer",
            "body > nav",
            "body > aside",
            "body > div",
            "body > section",
            "header",
            "footer",
            "nav",
            "[class*='header']",
            "[id*='header']",
            "[class*='footer']",
            "[id*='footer']",
            "[class*='toolbar']",
            "[id*='toolbar']",
            "[class*='menu']",
            "[id*='menu']",
            "[class*='gnb']",
            "[id*='gnb']",
            "[class*='top']",
            "[id*='top']",
            "[class*='bottom']",
            "[id*='bottom']"
          ].join(", ");

          document.querySelectorAll(selector).forEach((node) => {
            if (node instanceof HTMLElement && !node.closest("#sticky-munpia-reader-root")) {
              roots.push(node);
            }
          });

          return collectMunpiaScanNodes(roots);
        }

        function getMunpiaInlineScanNodes(titleElement, firstBlockElement) {
          return collectMunpiaScanNodes([
            titleElement.parentElement,
            firstBlockElement.parentElement,
            titleElement.closest("#novel_content, #novelContent, #revContents, .novel_view_area, .novel_view, .viewer_contents, .viewer_body, .view_content, .content_view, [class*='viewer_contents'], [class*='viewer_body'], [class*='view_content'], [class*='novel_view'], [class*='read_area'], article, main, section"),
            firstBlockElement.closest("#novel_content, #novelContent, #revContents, .novel_view_area, .novel_view, .viewer_contents, .viewer_body, .view_content, .content_view, [class*='viewer_contents'], [class*='viewer_body'], [class*='view_content'], [class*='novel_view'], [class*='read_area'], article, main, section")
          ]);
        }

        function hideFixedReaderChrome() {
          const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
          const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);

          getMunpiaChromeScanNodes().forEach((node) => {
            if (!isVisibleElement(node)) {
              return;
            }

            const style = window.getComputedStyle(node);
            if (style.position !== "fixed" && style.position !== "sticky") {
              return;
            }

            const rect = node.getBoundingClientRect();
            if (rect.width < viewportWidth * 0.42 || rect.height <= 0 || rect.height > 120) {
              return;
            }

            const text = normalizeText(node.innerText || node.textContent || "");
            if (hasNextEpisodeAction(text)) {
              return;
            }
            const nearTop = rect.top <= 18 && rect.bottom <= 132;
            const nearBottom = rect.bottom >= viewportHeight - 12 && rect.top >= viewportHeight - 150;

            if (nearTop || (nearBottom && /목록|댓글|위로/.test(text))) {
              node.style.display = "none";
            }
          });
        }

        function hideBottomReaderActions() {
          const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);

          getMunpiaChromeScanNodes().forEach((node) => {
            if (!isVisibleElement(node)) {
              return;
            }

            if (node.closest("#sticky-munpia-reader-root")) {
              return;
            }

            const rect = node.getBoundingClientRect();
            if (rect.height <= 0 || rect.width <= 0) {
              return;
            }

            const nearBottom = rect.bottom >= viewportHeight - 10 && rect.top >= viewportHeight - 180;
            if (!nearBottom || rect.height > 96) {
              return;
            }

            const text = normalizeText(node.innerText || node.textContent || "");
            if (hasNextEpisodeAction(text)) {
              return;
            }
            const controlCount = node.querySelectorAll("button, [role='button'], a, input, select").length;
            const looksLikeBottomActionBar = /목록|댓글|댓글로|위로|설정/.test(text) || controlCount >= 3;

            if (looksLikeBottomActionBar) {
              node.style.display = "none";
            }
          });
        }

        function hideMunpiaInlineChrome(titleElement, firstBlockElement) {
          if (!(titleElement instanceof HTMLElement) || !(firstBlockElement instanceof HTMLElement)) {
            return;
          }

          const titleRect = titleElement.getBoundingClientRect();
          const firstRect = firstBlockElement.getBoundingClientRect();
          const upperBound = Math.max(titleRect.bottom - 6, 0);
          const lowerBound = Math.max(firstRect.top - 8, upperBound);

          getMunpiaInlineScanNodes(titleElement, firstBlockElement).forEach((node) => {
            if (!isVisibleElement(node)) {
              return;
            }

            if (node.closest("#sticky-munpia-reader-root")) {
              return;
            }

            if (node === titleElement || node.contains(titleElement)) {
              return;
            }

            if (node === firstBlockElement || node.contains(firstBlockElement)) {
              return;
            }

            const rect = node.getBoundingClientRect();
            if (rect.top < upperBound || rect.bottom > lowerBound || rect.height <= 0 || rect.width <= 0) {
              return;
            }

            const text = normalizeText(node.innerText || node.textContent || "");
            if (hasNextEpisodeAction(text)) {
              return;
            }
            const controlCount = node.querySelectorAll("button, [role='button'], a, input, select").length;
            const iconCount = node.querySelectorAll("svg, img, i").length;
            const hasMeaningfulText = text.length >= 16 && !/조회|댓글|공유|가기|추천|선호|목록|위로|설정|신고/.test(text);
            const looksLikeInlineChrome = controlCount >= 1
              || iconCount >= 1
              || /조회|댓글|공유|가기|추천|선호|목록|위로|설정|신고/.test(text)
              || (text.length <= 24 && rect.height <= 110);

            if (!hasMeaningfulText && looksLikeInlineChrome) {
              node.style.display = "none";
            }
          });
        }

        function clearGapBetweenTitleAndContent(titleElement, firstBlockElement) {
          if (!(titleElement instanceof HTMLElement) || !(firstBlockElement instanceof HTMLElement)) {
            return;
          }

          const titleRect = titleElement.getBoundingClientRect();
          const firstRect = firstBlockElement.getBoundingClientRect();
          const upperBound = Math.max(titleRect.bottom - 4, 0);
          const lowerBound = Math.max(firstRect.top - 6, upperBound);

          getMunpiaInlineScanNodes(titleElement, firstBlockElement).forEach((node) => {
            if (!isVisibleElement(node)) {
              return;
            }

            if (node.closest("#sticky-munpia-reader-root")) {
              return;
            }

            if (node === titleElement || node.contains(titleElement)) {
              return;
            }

            if (node === firstBlockElement || node.contains(firstBlockElement)) {
              return;
            }

            const rect = node.getBoundingClientRect();
            if (rect.top < upperBound || rect.bottom > lowerBound || rect.height <= 0 || rect.width <= 0) {
              return;
            }

            const text = normalizeText(node.innerText || node.textContent || "");
            if (hasNextEpisodeAction(text)) {
              return;
            }
            const controlCount = node.querySelectorAll("button, [role='button'], a, input, select, textarea").length;
            const iconCount = node.querySelectorAll("svg, img, i").length;
            const longReadableText = text.length >= 40 && !/조회|댓글|공유|가기|추천|선호|목록|위로|설정|신고/.test(text);

            if (!longReadableText && (controlCount > 0 || iconCount > 0 || text.length <= 36)) {
              node.style.display = "none";
            }
          });
        }

        function hideThinSeparatorsBetweenTitleAndContent(titleElement, firstBlockElement) {
          if (!(titleElement instanceof HTMLElement) || !(firstBlockElement instanceof HTMLElement)) {
            return;
          }

          const titleRect = titleElement.getBoundingClientRect();
          const firstRect = firstBlockElement.getBoundingClientRect();
          const upperBound = Math.max(titleRect.bottom - 8, 0);
          const lowerBound = Math.max(firstRect.top + 8, upperBound);

          getMunpiaInlineScanNodes(titleElement, firstBlockElement).forEach((node) => {
            if (!isVisibleElement(node)) {
              return;
            }

            if (node.closest("#sticky-munpia-reader-root")) {
              return;
            }

            if (node === titleElement || node.contains(titleElement)) {
              return;
            }

            if (node === firstBlockElement || node.contains(firstBlockElement)) {
              return;
            }

            const rect = node.getBoundingClientRect();
            if (rect.top < upperBound || rect.bottom > lowerBound || rect.width < 120 || rect.height <= 0) {
              return;
            }

            const style = window.getComputedStyle(node);
            const text = normalizeText(node.innerText || node.textContent || "");
            const descriptor = [
              node.tagName,
              node.className,
              node.id,
              node.getAttribute("role")
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            const borderTop = Number.parseFloat(style.borderTopWidth || "0");
            const borderBottom = Number.parseFloat(style.borderBottomWidth || "0");
            const looksLikeDivider = text.length === 0
              && (
                node.tagName.toLowerCase() === "hr"
                || descriptor.includes("divider")
                || descriptor.includes("separator")
                || descriptor.includes("split")
                || rect.height <= 4
                || ((borderTop >= 1 || borderBottom >= 1) && rect.height <= 12)
              );

            if (looksLikeDivider) {
              node.style.display = "none";
            }
          });
        }

        function applyMunpiaReaderFallback(titleElement, firstBlockElement) {
          if (!(titleElement instanceof HTMLElement)) {
            return;
          }

          hideFixedReaderChrome();
          hideBottomReaderActions();
          if (firstBlockElement instanceof HTMLElement) {
            hideMunpiaInlineChrome(titleElement, firstBlockElement);
            clearGapBetweenTitleAndContent(titleElement, firstBlockElement);
            hideThinSeparatorsBetweenTitleAndContent(titleElement, firstBlockElement);
          }
        }

        function ensureReaderStyles() {
          if (document.getElementById("sticky-munpia-reader-style")) {
            return;
          }

          const style = document.createElement("style");
          style.id = "sticky-munpia-reader-style";
          style.textContent = [
            "html, body { background: #f6efb6 !important; background-image: none !important; }",
            "body[data-sticky-munpia-reader='1']:not([data-sticky-munpia-native-overlay='1']) > *:not(#sticky-munpia-reader-root):not(#sticky-munpia-back-chip):not(#sticky-munpia-next-chip):not(#sticky-munpia-list-chip):not(script):not(style) { visibility: hidden !important; }",
            "#sticky-munpia-reader-root { position: fixed; inset: 0; z-index: 2147483000; overflow: auto; background: #f6efb6; color: #231f15; box-sizing: border-box; padding: 56px 18px 34px; }",
            "#sticky-munpia-reader-inner { max-width: 760px; margin: 0 auto; }",
            "#sticky-munpia-reader-title { margin: 0 0 26px; font-size: 1.9rem; line-height: 1.28; font-weight: 700; letter-spacing: -0.02em; color: #231f15; }",
            "#sticky-munpia-reader-content p { margin: 0 0 1.25em; white-space: pre-wrap; color: #231f15; }",
            "#sticky-munpia-back-chip { position: fixed; left: 16px; top: 52px; z-index: 2147483600; padding: 8px 12px; border: 1px solid rgba(120, 109, 36, 0.36); background: rgba(255, 248, 196, 0.96); color: #231f15; font: 600 14px/1 sans-serif; opacity: 0; pointer-events: none; transition: opacity 120ms ease; }",
            "#sticky-munpia-next-chip { position: fixed; right: 16px; top: 52px; z-index: 2147483600; padding: 8px 12px; border: 1px solid rgba(120, 109, 36, 0.36); background: rgba(255, 248, 196, 0.96); color: #231f15; font: 600 14px/1 sans-serif; opacity: 0; pointer-events: none; transition: opacity 120ms ease; }",
            "#sticky-munpia-list-chip { position: fixed; left: 50%; top: 52px; transform: translateX(-50%); z-index: 2147483600; padding: 8px 12px; border: 1px solid rgba(120, 109, 36, 0.36); background: rgba(255, 248, 196, 0.96); color: #231f15; font: 600 14px/1 sans-serif; opacity: 0; pointer-events: none; transition: opacity 120ms ease; }",
            "body[data-sticky-munpia-back='1'] #sticky-munpia-back-chip, body[data-sticky-munpia-back='1'] #sticky-munpia-next-chip, body[data-sticky-munpia-back='1'] #sticky-munpia-list-chip { opacity: 1; pointer-events: auto; }"
          ].join("\\n");
          document.head.appendChild(style);
        }

        function findNextEpisodeAction() {
          const candidates = Array.from(document.querySelectorAll("a, button, [role='button']"));
          return candidates.find((node) => {
            if (!(node instanceof HTMLElement) || !isVisibleElement(node)) {
              return false;
            }

            const text = normalizeText(node.innerText || node.textContent || node.getAttribute("aria-label") || node.getAttribute("title") || "");
            return hasNextEpisodeAction(text);
          }) || null;
        }

        function getMunpiaEpisodeListUrl() {
          return "";
        }

        function openMunpiaEpisodeList() {
          return false;
        }

        function isMunpiaNativeOverlayNode(node) {
          return false;
        }

        function hideMunpiaNativeOverlays() {
          return false;
        }

        function syncMunpiaNativeOverlayState() {
          if (!document.body) {
            return;
          }

          document.body.removeAttribute("data-sticky-munpia-native-overlay");
        }

        function ensureBackChip() {
          ensureReaderStyles();

          let backChip = document.getElementById("sticky-munpia-back-chip");
          if (!(backChip instanceof HTMLElement)) {
            backChip = document.createElement("button");
            backChip.id = "sticky-munpia-back-chip";
            backChip.type = "button";
            backChip.textContent = "← 뒤로";
            backChip.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              window.dispatchEvent(new CustomEvent("sticky-reader-go-back"));
            });
            document.body.appendChild(backChip);
          }

          let nextChip = document.getElementById("sticky-munpia-next-chip");
          if (!(nextChip instanceof HTMLElement)) {
            nextChip = document.createElement("button");
            nextChip.id = "sticky-munpia-next-chip";
            nextChip.type = "button";
            nextChip.textContent = "다음화 →";
            nextChip.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              const nextAction = findNextEpisodeAction();
              if (nextAction instanceof HTMLElement) {
                nextAction.click();
              }
            });
            document.body.appendChild(nextChip);
          }

          let listChip = document.getElementById("sticky-munpia-list-chip");
          if (!(listChip instanceof HTMLElement)) {
            listChip = document.createElement("button");
            listChip.id = "sticky-munpia-list-chip";
            listChip.type = "button";
            listChip.textContent = "紐⑸줉";
            listChip.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              openMunpiaEpisodeList();
            });
            document.body.appendChild(listChip);
          }

          const nextAction = findNextEpisodeAction();
          nextChip.style.display = nextAction ? "block" : "none";
          listChip.style.display = getMunpiaEpisodeListUrl() ? "block" : "none";

          if (document.body.dataset.stickyMunpiaBackBound === "1") {
            return;
          }

          let hideTimer = 0;
          const showChip = () => {
            document.body.setAttribute("data-sticky-munpia-back", "1");
            window.clearTimeout(hideTimer);
            hideTimer = window.setTimeout(() => {
              document.body.removeAttribute("data-sticky-munpia-back");
            }, 1800);
          };

          document.addEventListener("pointerdown", (event) => {
            const target = event.target;
            if (target instanceof HTMLElement && target.closest("#sticky-munpia-back-chip, #sticky-munpia-next-chip, #sticky-munpia-list-chip")) {
              return;
            }
            showChip();
          }, true);

          document.body.dataset.stickyMunpiaBackBound = "1";
        }

        function renderMunpiaReaderView() {
          const existingRoot = document.getElementById("sticky-munpia-reader-root");
          const titleElement = findTitleElement();
          if (!(titleElement instanceof HTMLElement)) {
            document.body.removeAttribute("data-sticky-munpia-reader");
            document.body.removeAttribute("data-sticky-munpia-native-overlay");
            munpiaRenderSignature = "";
            if (existingRoot) {
              existingRoot.remove();
            }
            return false;
          }

          const titleText = normalizeText(titleElement.innerText || titleElement.textContent || "");
          if (!titleText) {
            document.body.removeAttribute("data-sticky-munpia-reader");
            document.body.removeAttribute("data-sticky-munpia-native-overlay");
            munpiaRenderSignature = "";
            if (existingRoot) {
              existingRoot.remove();
            }
            return false;
          }

          const titleRect = titleElement.getBoundingClientRect();
          ensureBackChip();
          const contentCandidate = findContentRoot(titleRect.bottom);
          const firstBlockElement = contentCandidate?.blocks?.[0]?.element || findFirstReadableBlockElement(titleRect.bottom);
          applyMunpiaReaderFallback(titleElement, firstBlockElement);
          if (!contentCandidate || !contentCandidate.blocks || contentCandidate.blocks.length < 3) {
            document.body.removeAttribute("data-sticky-munpia-reader");
            munpiaRenderSignature = "";
            if (existingRoot) {
              existingRoot.remove();
            }
            return false;
          }

          const nextRenderSignature = [
            titleText,
            String(contentCandidate.blocks.length),
            contentCandidate.blocks[0]?.text || "",
            contentCandidate.blocks[contentCandidate.blocks.length - 1]?.text || ""
          ].join("|");

          if (
            existingRoot
            && munpiaRenderSignature === nextRenderSignature
            && document.body.getAttribute("data-sticky-munpia-reader") === "1"
          ) {
            return true;
          }

          const root = existingRoot || document.createElement("div");
          isRenderingMunpiaView = true;

          try {
            root.id = "sticky-munpia-reader-root";
            root.innerHTML = "";

            const inner = document.createElement("div");
            inner.id = "sticky-munpia-reader-inner";

            const title = document.createElement("div");
            title.id = "sticky-munpia-reader-title";
            title.textContent = titleText;

            const content = document.createElement("div");
            content.id = "sticky-munpia-reader-content";

            if (typography && typeof typography === "object") {
              const fontSize = Number(typography.fontSize);
              const lineHeight = Number(typography.lineHeight);
              content.style.fontSize = Number.isFinite(fontSize) ? Math.max(12, fontSize) + "px" : "19px";
              content.style.lineHeight = Number.isFinite(lineHeight) ? String(lineHeight) : "1.9";
              content.style.letterSpacing = typography.letterSpacing || "0.01em";
              if (typography.fontFamily) {
                content.style.fontFamily = typography.fontFamily;
                title.style.fontFamily = typography.fontFamily;
              }
            } else {
              const sampleElement = contentCandidate.blocks[0]?.element;
              if (sampleElement instanceof HTMLElement) {
                const sampleStyle = window.getComputedStyle(sampleElement);
                const sampleFontSize = Number.parseFloat(sampleStyle.fontSize || "");
                content.style.fontSize = Number.isFinite(sampleFontSize)
                  ? Math.max(12, sampleFontSize + ${READING_FONT_OFFSET_PX}) + "px"
                  : "19px";
                content.style.lineHeight = sampleStyle.lineHeight;
                content.style.letterSpacing = sampleStyle.letterSpacing;
                content.style.fontFamily = sampleStyle.fontFamily;
              } else {
                content.style.fontSize = "19px";
                content.style.lineHeight = "1.9";
                content.style.letterSpacing = "0.01em";
              }
            }

            contentCandidate.blocks.forEach((block) => {
              const paragraph = document.createElement("p");
              paragraph.textContent = block.text;
              content.appendChild(paragraph);
            });

            inner.appendChild(title);
            inner.appendChild(content);
            root.appendChild(inner);

            ensureReaderStyles();
            document.body.setAttribute("data-sticky-munpia-reader", "1");
            if (!root.parentElement) {
              document.body.appendChild(root);
            }
            munpiaRenderSignature = nextRenderSignature;
          } finally {
            isRenderingMunpiaView = false;
          }

          return true;
        }

        let refreshTimer = 0;
        let munpiaRenderSignature = "";
        let isRenderingMunpiaView = false;
        function scheduleMunpiaReaderRefresh() {
          if (refreshTimer) {
            return;
          }

          refreshTimer = window.setTimeout(() => {
            refreshTimer = 0;
            renderMunpiaReaderView();
          }, 90);
        }

        renderMunpiaReaderView();

        const observer = new MutationObserver((mutations) => {
          if (isRenderingMunpiaView) {
            return;
          }

          const hasExternalMutation = mutations.some((mutation) => {
            const target = mutation.target;
            return !(target instanceof HTMLElement)
              || !target.closest("#sticky-munpia-reader-root, #sticky-munpia-back-chip, #sticky-munpia-next-chip, #sticky-munpia-list-chip");
          });

          if (hasExternalMutation) {
            scheduleMunpiaReaderRefresh();
          }
        });

        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }

        window.setTimeout(() => {
          observer.disconnect();
          if (refreshTimer) {
            window.clearTimeout(refreshTimer);
            refreshTimer = 0;
          }
        }, 3200);

        return true;
      })();
    `;
    }
    if (isMunpiaUrl(url) && !isAuthPage(url) && !isReadingUrl(url)) {
        return `
      (() => {
        function isVisibleElement(node) {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none"
            && style.visibility !== "hidden"
            && Number(style.opacity || "1") > 0
            && rect.width > 0
            && rect.height > 0;
        }

        function softenMunpiaTopChrome() {
          const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);

          document.querySelectorAll("body *").forEach((node) => {
            if (!(node instanceof HTMLElement) || !isVisibleElement(node)) {
              return;
            }

            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            const nearTop = rect.top <= 100 && rect.bottom <= 180;
            const wideEnough = rect.width >= viewportWidth * 0.5;
            const looksLikeChrome = style.position === "fixed"
              || style.position === "sticky"
              || /header|top|gnb|nav|menu|tab/i.test(node.className || "")
              || /header|top|gnb|nav|menu|tab/i.test(node.id || "");

            if (!nearTop || !wideEnough || !looksLikeChrome) {
              return;
            }

            node.style.background = "#f2e79e";
            node.style.backgroundColor = "#f2e79e";
            node.style.backgroundImage = "none";
            node.style.boxShadow = "none";
            node.style.borderColor = "rgba(120, 109, 36, 0.28)";
            node.querySelectorAll("*").forEach((child) => {
              if (!(child instanceof HTMLElement)) {
                return;
              }
              child.style.color = "#231f15";
              child.style.fill = "currentColor";
              child.style.stroke = "currentColor";
            });
          });
        }

        softenMunpiaTopChrome();

        const observer = new MutationObserver(() => {
          softenMunpiaTopChrome();
        });

        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }

        window.setTimeout(() => {
          observer.disconnect();
        }, 10000);

        return true;
      })();
    `;
    }
    if (false && siteId === "munpia" && !isAuthPage(url) && !isReadingUrl(url)) {
        return `
      (() => {
        const EMPTY_BOX_SELECTOR = [
          "[class*='thumb']",
          "[id*='thumb']",
          "[class*='thumbnail']",
          "[id*='thumbnail']",
          "[class*='cover']",
          "[id*='cover']",
          "[class*='poster']",
          "[id*='poster']",
          "[class*='banner']",
          "[id*='banner']",
          "[class*='hero']",
          "[id*='hero']",
          "[class*='visual']",
          "[id*='visual']"
        ].join(",");

        function hasMeaningfulText(element) {
          const text = String(element.innerText || element.textContent || "").replace(/\\s+/g, "");
          return text.length > 1;
        }

        function hasInteractiveContent(element) {
          return Boolean(element.querySelector("a[href], button, input, select, textarea"));
        }

        function getLabelFromNode(element) {
          const ownText = String(element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim();
          if (ownText) {
            return ownText;
          }

          const attrCandidates = [
            element.getAttribute("aria-label"),
            element.getAttribute("title"),
            element.getAttribute("placeholder"),
            element.getAttribute("data-tooltip"),
            element.getAttribute("data-title")
          ].filter(Boolean);

          for (const value of attrCandidates) {
            const normalized = String(value).replace(/\\s+/g, " ").trim();
            if (normalized) {
              return normalized;
            }
          }

          const mediaAlt = element.querySelector("img[alt], svg[aria-label], [title]");
          if (mediaAlt instanceof HTMLElement) {
            const nestedLabel =
              mediaAlt.getAttribute("alt") ||
              mediaAlt.getAttribute("aria-label") ||
              mediaAlt.getAttribute("title") ||
              "";
            return String(nestedLabel).replace(/\\s+/g, " ").trim();
          }

          return "";
        }

        function normalizeActionLabel(label) {
          const value = String(label || "").toLowerCase();

          if (!value) {
            return "";
          }

          if (value.includes("search") || value.includes("검색")) {
            return "검색";
          }
          if (value.includes("menu") || value.includes("메뉴")) {
            return "메뉴";
          }
          if (value.includes("gift") || value.includes("선물")) {
            return "선물";
          }
          if (value.includes("home") || value.includes("홈")) {
            return "홈";
          }
          if (value.includes("close") || value.includes("닫기")) {
            return "닫기";
          }
          if (value.includes("back") || value.includes("이전")) {
            return "이전";
          }

          return String(label).replace(/\\s+/g, " ").trim().slice(0, 6);
        }

        function getActionIconMarkup(label) {
          switch (label) {
            case "검색":
              return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"></circle><path d="M10.5 10.5L14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"></path></svg>';
            case "메뉴":
              return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 4H13M3 8H13M3 12H13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"></path></svg>';
            case "선물":
              return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2.5" y="6" width="11" height="7.5" rx="0.8" fill="none" stroke="currentColor" stroke-width="1.2"></rect><path d="M8 6V13.5M2.5 8.75H13.5M5.5 6C4.6 6 4 5.4 4 4.6C4 3.7 4.6 3 5.5 3C6.8 3 7.5 4.2 8 6M10.5 6C11.4 6 12 5.4 12 4.6C12 3.7 11.4 3 10.5 3C9.2 3 8.5 4.2 8 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
            case "홈":
              return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 7.2L8 3L13.5 7.2V13H9.8V9.8H6.2V13H2.5V7.2Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"></path></svg>';
            case "닫기":
              return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4L12 12M12 4L4 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"></path></svg>';
            case "이전":
              return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10.5 3.5L5.5 8L10.5 12.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
            default:
              return "";
          }
        }

        function inferFallbackActionLabel(element) {
          const rect = element.getBoundingClientRect();
          const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
          const attrText = [
            element.getAttribute("id"),
            element.getAttribute("class"),
            element.getAttribute("href"),
            element.getAttribute("name"),
            element.getAttribute("data-name"),
            element.getAttribute("data-type")
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (attrText.includes("search") || attrText.includes("find")) {
            return "검색";
          }
          if (attrText.includes("menu") || attrText.includes("gnb") || attrText.includes("nav")) {
            return "메뉴";
          }
          if (attrText.includes("gift") || attrText.includes("coupon") || attrText.includes("event")) {
            return "선물";
          }
          if (attrText.includes("home") || attrText.includes("main")) {
            return "홈";
          }
          if (attrText.includes("back") || attrText.includes("prev")) {
            return "이전";
          }
          if (attrText.includes("close")) {
            return "닫기";
          }

          if (rect.top <= 180) {
            if (element.parentElement?.querySelector("input[type='search'], input[type='text']")) {
              return "검색";
            }

            if (viewportWidth > 0 && rect.left <= viewportWidth * 0.22) {
              return "메뉴";
            }

            if (viewportWidth > 0 && rect.right >= viewportWidth * 0.82) {
              return "홈";
            }
          }

          return "";
        }

        function applyScrollRoot() {
          [document.documentElement, document.body, document.getElementById("root")].forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            node.style.height = "auto";
            node.style.minHeight = "100%";
            node.style.maxHeight = "none";
            node.style.overflowY = "auto";
            node.style.overflowX = "hidden";
            node.style.position = "static";
          });

          document.querySelectorAll("#root > div, main, [class*='layout'], [class*='page'], [class*='container'], [class*='wrapper']").forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            node.style.height = "auto";
            node.style.maxHeight = "none";
            node.style.minHeight = "0";
            node.style.overflow = "visible";
          });
        }

        function decorateSmallButtons(root) {
          root.querySelectorAll("button, a, [role='button']").forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            const rect = node.getBoundingClientRect();
            const label = normalizeActionLabel(getLabelFromNode(node) || inferFallbackActionLabel(node));
            const visibleText = String(node.innerText || node.textContent || "").replace(/\\s+/g, " ").trim();
            const smallButton = rect.width > 8 && rect.width <= 80 && rect.height > 8 && rect.height <= 48;
            const topButton = rect.top <= 170;

            if (!smallButton) {
              return;
            }

            if (!visibleText && label) {
              node.querySelectorAll("img, picture, svg, canvas, i").forEach((child) => child.remove());
              const iconMarkup = getActionIconMarkup(label);
              if (iconMarkup) {
                node.innerHTML = iconMarkup;
              } else {
                node.textContent = label;
              }
              node.setAttribute("title", label);
              node.setAttribute("aria-label", label);
              node.style.display = "inline-flex";
              node.style.alignItems = "center";
              node.style.justifyContent = "center";
              node.style.padding = iconMarkup ? "0" : "0 8px";
              node.style.fontSize = "12px";
              node.style.lineHeight = "1";
              node.style.whiteSpace = "nowrap";
              node.style.width = iconMarkup ? "28px" : "";
              node.style.height = iconMarkup ? "28px" : "";
              node.style.minWidth = iconMarkup ? "28px" : (label.length <= 2 ? "36px" : "48px");
              node.style.borderRadius = "0";
              node.style.color = "#6f6123";
              return;
            }

            if (!visibleText && !label && topButton) {
              node.remove();
            }
          });
        }

        function normalizeTextValue(value) {
          return String(value || "").replace(/\\s+/g, " ").trim();
        }

        function escapeHtml(value) {
          return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        }

        function findHeadingNode(labels) {
          const nodes = Array.from(document.querySelectorAll("h1, h2, h3, h4, strong, b, p, span, div, button, a"));
          return nodes.find((node) => {
            const text = normalizeTextValue(node.textContent || "");
            return labels.some((label) => text.includes(label));
          }) || null;
        }

        function findSectionRootFromHeading(heading) {
          let current = heading instanceof HTMLElement ? heading : null;
          for (let depth = 0; current && depth < 6; depth += 1) {
            const count = current.querySelectorAll("a[href], button, [role='button'], li").length;
            if (count >= 4) {
              return current;
            }
            current = current.parentElement;
          }
          return heading instanceof HTMLElement ? heading.parentElement : null;
        }

        function extractSectionLinks(labels, limit) {
          const heading = findHeadingNode(labels);
          if (!(heading instanceof HTMLElement)) {
            return [];
          }

          const section = findSectionRootFromHeading(heading);
          if (!(section instanceof HTMLElement)) {
            return [];
          }

          const seen = new Set();
          const items = [];
          section.querySelectorAll("a[href], button, [role='button']").forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            const label = normalizeTextValue(getLabelFromNode(node));
            if (!label || label.length > 18) {
              return;
            }

            if (labels.some((text) => label.includes(text))) {
              return;
            }

            if (seen.has(label)) {
              return;
            }

            let href = "";
            if (node instanceof HTMLAnchorElement) {
              href = node.href;
            } else {
              const anchor = node.closest("a[href]");
              if (anchor instanceof HTMLAnchorElement) {
                href = anchor.href;
              }
            }

            seen.add(label);
            items.push({ label, href });
          });

          return items.slice(0, limit);
        }

        function getSearchConfig() {
          const input = document.querySelector("input[type='search'], input[type='text']");
          if (!(input instanceof HTMLInputElement)) {
            return {
              placeholder: "작품명, 작가명 검색",
              action: "",
              paramName: "keyword"
            };
          }

          const form = input.form || input.closest("form");
          const action = form instanceof HTMLFormElement ? (form.action || form.getAttribute("action") || "") : "";

          return {
            placeholder: input.placeholder || "작품명, 작가명 검색",
            action,
            paramName: input.name || "keyword"
          };
        }

        function buildLinkList(items, mode) {
          if (!items.length) {
            return "";
          }

          if (mode === "chips") {
            return '<div class="sticky-chip-list">' + items.map((item) => {
              const label = escapeHtml(item.label);
              const href = item.href ? ' href="' + escapeHtml(item.href) + '"' : "";
              return '<a class="sticky-chip"' + href + '>' + label + '</a>';
            }).join("") + '</div>';
          }

          return '<ol class="sticky-rank-list">' + items.map((item, index) => {
            const label = escapeHtml(item.label);
            const href = item.href ? ' href="' + escapeHtml(item.href) + '"' : "";
            return '<li><span class="sticky-rank-index">' + String(index + 1) + '</span><a class="sticky-rank-link"' + href + '>' + label + '</a></li>';
          }).join("") + '</ol>';
        }

        function renderMunpiaMemoView() {
          return false;

          const popularItems = extractSectionLinks(["실시간 인기검색어"], 10);
          const recentItems = extractSectionLinks(["최근 검색어"], 8);
          const genreItems = extractSectionLinks(["장르별 작품보기", "장르별"], 12);
          const searchConfig = getSearchConfig();

          if (popularItems.length + recentItems.length + genreItems.length < 4) {
            return false;
          }

          const popularMarkup = buildLinkList(popularItems, "rank");
          const recentMarkup = buildLinkList(recentItems, "chips");
          const genreMarkup = buildLinkList(genreItems, "chips");

          document.documentElement.innerHTML = [
            '<head>',
            '<meta charset="utf-8" />',
            '<meta name="viewport" content="width=device-width, initial-scale=1" />',
            '<title>Munpia Memo View</title>',
            '<style>',
            ':root{--paper:#f6efb6;--paper-strong:#f2e79e;--ink:#231f15;--ink-soft:#6f6123;--line:rgba(120,109,36,.24);--chip:rgba(255,248,196,.88);}',
            '*{box-sizing:border-box;}',
            'html,body{margin:0;min-height:100%;background:var(--paper);color:var(--ink);font-family:"Malgun Gothic","Segoe UI Variable",sans-serif;}',
            'body{padding:10px 10px 18px;overflow-y:auto;}',
            '.sticky-shell{display:flex;flex-direction:column;gap:14px;min-height:100%;}',
            '.sticky-top{display:flex;align-items:center;justify-content:space-between;gap:10px;}',
            '.sticky-brand{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft);}',
            '.sticky-action-row{display:flex;align-items:center;gap:8px;}',
            '.sticky-icon{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid var(--line);color:var(--ink-soft);text-decoration:none;background:rgba(255,248,196,.72);}',
            '.sticky-search{display:grid;grid-template-columns:1fr auto;gap:8px;}',
            '.sticky-search input{width:100%;height:32px;padding:0 10px;border:1px solid var(--line);background:rgba(255,248,196,.92);color:var(--ink);outline:none;}',
            '.sticky-search button{height:32px;padding:0 10px;border:1px solid var(--line);background:rgba(255,248,196,.92);color:var(--ink);cursor:pointer;}',
            '.sticky-section{padding-top:2px;}',
            '.sticky-section-title{margin:0 0 8px;font-size:12px;font-weight:700;color:var(--ink-soft);letter-spacing:.04em;}',
            '.sticky-rank-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--line);}',
            '.sticky-rank-list li{display:grid;grid-template-columns:20px 1fr;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);}',
            '.sticky-rank-index{font-size:12px;color:var(--ink-soft);text-align:right;}',
            '.sticky-rank-link{color:var(--ink);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '.sticky-chip-list{display:flex;flex-wrap:wrap;gap:8px;}',
            '.sticky-chip{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border:1px solid var(--line);background:var(--chip);color:var(--ink);text-decoration:none;}',
            '</style>',
            '</head>',
            '<body>',
            '<main class="sticky-shell">',
            '<div class="sticky-top">',
            '<div class="sticky-brand">MUNPIA</div>',
            '<div class="sticky-action-row"><a class="sticky-icon" href="https://m.munpia.com/" title="홈" aria-label="홈">⌂</a></div>',
            '</div>',
            '<form id="sticky-munpia-search-form" class="sticky-search">',
            '<input id="sticky-munpia-search-input" type="search" placeholder="' + escapeHtml(searchConfig.placeholder) + '" />',
            '<button type="submit">검색</button>',
            '</form>',
            '<section class="sticky-section"><h2 class="sticky-section-title">실시간 인기 검색어</h2>' + popularMarkup + '</section>',
            recentMarkup ? '<section class="sticky-section"><h2 class="sticky-section-title">최근 검색어</h2>' + recentMarkup + '</section>' : '',
            genreMarkup ? '<section class="sticky-section"><h2 class="sticky-section-title">장르별 작품보기</h2>' + genreMarkup + '</section>' : '',
            '</main>',
            '</body>'
          ].join("");

          const searchForm = document.getElementById("sticky-munpia-search-form");
          const searchInput = document.getElementById("sticky-munpia-search-input");
          if (searchForm instanceof HTMLFormElement && searchInput instanceof HTMLInputElement) {
            searchForm.addEventListener("submit", (event) => {
              event.preventDefault();
              const keyword = searchInput.value.trim();
              if (!keyword) {
                return;
              }

              const target = searchConfig.action ? new URL(searchConfig.action, location.href) : new URL(location.href);
              target.searchParams.set(searchConfig.paramName || "keyword", keyword);
              location.href = target.toString();
            });
          }

          return true;
        }

        function removeDecorativeNodes(root) {
          root.querySelectorAll(EMPTY_BOX_SELECTOR).forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            if (!hasMeaningfulText(node) && !hasInteractiveContent(node)) {
              node.remove();
            }
          });
        }

        function flattenMunpiaCatalog() {
          const body = document.body;
          if (!body) {
            return;
          }

          applyScrollRoot();
          if (renderMunpiaMemoView()) {
            return;
          }
          removeDecorativeNodes(document);
          decorateSmallButtons(body);

          body.querySelectorAll("[class*='rank'], [id*='rank'], [class*='search'], [id*='search'], [class*='list'], [id*='list']").forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            node.style.maxWidth = "100%";
            node.style.margin = "0";
            node.style.padding = "0";
            node.style.overflow = "visible";
          });

          body.querySelectorAll("li, [class*='item'], [id*='item'], [class*='card'], [id*='card']").forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            if (!hasMeaningfulText(node) && !hasInteractiveContent(node)) {
              node.remove();
              return;
            }

            node.style.display = "grid";
            node.style.gridTemplateColumns = "1fr auto";
            node.style.alignItems = "center";
            node.style.columnGap = "8px";
          });
        }

        flattenMunpiaCatalog();

        const observer = new MutationObserver(() => {
          flattenMunpiaCatalog();
        });

        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }

        window.setTimeout(() => {
          observer.disconnect();
        }, 12000);

        return true;
      })();
    `;
    }
    return "";
}
