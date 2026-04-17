"use strict";
function attachWebviewEvents() {
    if (!readerController.isAttached()) {
        return;
    }
    readerController.addEventListener("dom-ready", async () => {
        setLoading(false);
        await applyAmbientPageTheme();
        await hideWebviewScrollbars();
        if (state.simplifyEnabled) {
            await applySimplifyMode();
        }
    });
    readerController.addEventListener("did-start-loading", () => {
        setLoading(true);
        setStatus("Loading page inside desktop viewer");
        window.clearTimeout(loadingFallbackTimer);
        loadingFallbackTimer = window.setTimeout(() => {
            setLoading(false);
        }, 3500);
    });
    readerController.addEventListener("did-stop-loading", async () => {
        window.clearTimeout(loadingFallbackTimer);
        setLoading(false);
        await applyAmbientPageTheme();
        await hideWebviewScrollbars();
        syncNavigationState();
        setStatus("Ready");
        if (state.simplifyEnabled) {
            await applySimplifyMode();
        }
    });
    readerController.addEventListener("did-navigate", () => {
        syncNavigationState();
    });
    readerController.addEventListener("did-navigate-in-page", () => {
        syncNavigationState();
    });
    readerController.addEventListener("page-title-updated", (event) => {
        if (elements.pageTitle) {
            elements.pageTitle.textContent = event.title || simplifyHost(state.currentUrl);
        }
        syncNavigationState();
    });
    readerController.addEventListener("did-fail-load", () => {
        window.clearTimeout(loadingFallbackTimer);
        setLoading(true);
        setStageNotice("Error", "Page could not load", "Check the site URL or try another preset.");
        setStatus("Could not load the requested page");
    });
}
function queueInitialNavigation() {
    if (!readerController.isAttached()) {
        return;
    }
    setLoading(true);
    window.requestAnimationFrame(() => {
        window.setTimeout(() => {
            if (state.currentUrl) {
                readerController.setSource(state.currentUrl);
            }
        }, 40);
    });
}
async function applySimplifyMode() {
    if (!readerController.isAttached()) {
        return;
    }
    state.simplifyEnabled = true;
    persistScalar(STORAGE_KEYS.simplifyEnabled, "true");
    updateSimplifyButton();
    try {
        await readerController.executeJavaScript(buildSimplifyScript(state.settings), true);
        await hideWebviewScrollbars();
        setStatus("Simplified the current page");
    }
    catch (error) {
        console.error(error);
        state.simplifyEnabled = false;
        persistScalar(STORAGE_KEYS.simplifyEnabled, "false");
        updateSimplifyButton();
        setStatus("Could not simplify this page");
    }
}
async function applyAmbientPageTheme() {
    if (!readerController.isAttached()) {
        return;
    }
    try {
        const currentUrl = readerController.getURL() || state.currentUrl;
        const authPage = isAuthPage(currentUrl);
        const minimalThemePage = shouldUseMinimalAmbientTheme(currentUrl);
        const readerChromeSuppressionCss = buildReaderChromeSuppressionCss(currentUrl);
        const readerComfortCss = buildReaderComfortCss(currentUrl);
        if (state.ambientThemeKey) {
            try {
                await readerController.removeInsertedCSS(state.ambientThemeKey);
            }
            catch (error) {
                console.error(error);
            }
            state.ambientThemeKey = "";
        }
        if (minimalThemePage && !authPage) {
            state.ambientThemeKey = (await readerController.insertCSS(`
        html, body {
          background: #f6efb6 !important;
          color: #231f15 !important;
          scrollbar-width: none !important;
        }

        body,
        [style*='background-image'] {
          background-image: none !important;
        }

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
        header,
        footer,
        nav,
        aside,
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
          background-color: #f6efb6 !important;
          color: #231f15 !important;
        }

        img,
        picture,
        video,
        figure,
        source {
          display: none !important;
          visibility: hidden !important;
        }

        [class*='thumb'],
        [id*='thumb'],
        [class*='thumbnail'],
        [id*='thumbnail'],
        [class*='cover'],
        [id*='cover'],
        [class*='poster'],
        [id*='poster'],
        [class*='banner'],
        [id*='banner'] {
          background-image: none !important;
          background-color: transparent !important;
        }

        * {
          scrollbar-width: none !important;
        }

        *::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }

        ${readerChromeSuppressionCss}
        ${readerComfortCss}
        ${buildPopupCloseVisibilityCss()}
      `)) ?? "";
            return;
        }
        state.ambientThemeKey = (await readerController.insertCSS(authPage ? `
      html, body {
        background: #f6efb6 !important;
        color: #231f15 !important;
        scrollbar-width: none !important;
      }

      body {
        background-image: none !important;
      }

      * {
        scrollbar-width: none !important;
      }

      *::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }

      ${buildPopupCloseVisibilityCss()}
    ` : `
      html, body {
        background: #f6efb6 !important;
        color: #231f15 !important;
        scrollbar-width: none !important;
      }

      body {
        background-image: none !important;
      }

      img,
      picture,
      video,
      svg,
      canvas,
      figure,
      source {
        display: none !important;
        visibility: hidden !important;
      }

      img[src*='kakao' i],
      svg[class*='kakao' i],
      svg[id*='kakao' i],
      [class*='kakao' i] img,
      [class*='kakao' i] svg,
      [class*='kakao'] img,
      [class*='kakao'] svg,
      [id*='kakao'] img,
      [id*='kakao'] svg,
      button[aria-label*='kakao' i] img,
      button[aria-label*='kakao' i] svg,
      a[aria-label*='kakao' i] img,
      a[aria-label*='kakao' i] svg,
      img[alt*='kakao' i],
      img[src*='kakaotalk' i] {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      * {
        scrollbar-width: none !important;
        box-shadow: none !important;
      }

      *::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }

      header,
      footer,
      nav,
      aside,
      [class*='banner'],
      [id*='banner'],
      [class*='advert'],
      [id*='advert'] {
        background: transparent !important;
      }

      body,
      main,
      article,
      section,
      div,
      p,
      span,
      li,
      td,
      th,
      h1,
      h2,
      h3,
      h4,
      h5,
      h6,
      a,
      strong,
      em {
        color: #231f15 !important;
        border-color: rgba(120, 109, 36, 0.24) !important;
      }

      body,
      main,
      article,
      section,
      div,
      ul,
      ol,
      table,
      tr,
      td,
      th {
        background-color: #f6efb6 !important;
        background-image: none !important;
      }

      ${buildPopupCloseVisibilityCss()}
    `)) ?? "";
    }
    catch (error) {
        console.error(error);
    }
}
async function hideWebviewScrollbars() {
    if (!readerController.isAttached()) {
        return;
    }
    try {
        await readerController.insertCSS(`
      html, body {
        scrollbar-width: none !important;
      }

      ::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
    `);
    }
    catch (error) {
        console.error(error);
    }
}
function buildSimplifyScript(settings) {
    const serializedSettings = JSON.stringify(settings);
    return `
    (() => {
      const settings = ${serializedSettings};
      const blockedSelectors = [
        "script", "style", "noscript", "iframe", "canvas", "svg",
        "img", "picture", "video", "audio", "figure", "figcaption",
        "form", "button", "input", "textarea", "select", "nav",
        "header", "footer", "aside", "[aria-hidden='true']",
        "[class*='advert']", "[id*='advert']", "[class*='ads']",
        "[id*='ads']", "[class*='banner']", "[id*='banner']",
        "[class*='comment']", "[id*='comment']", "[class*='reply']",
        "[id*='reply']", "[class*='toolbar']", "[id*='toolbar']"
      ];

      function normalizeText(text) {
        return String(text)
          .replace(/\\r/g, "")
          .replace(/\\u00a0/g, " ")
          .replace(/\\n[ \\t]+/g, "\\n")
          .replace(/[ \\t]+\\n/g, "\\n")
          .replace(/\\n{3,}/g, "\\n\\n")
          .replace(/[ \\t]{2,}/g, " ")
          .trim();
      }

      function splitParagraphs(text) {
        return normalizeText(text)
          .split(/\\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean);
      }

      function scoreElement(element) {
        const clone = element.cloneNode(true);
        if (!(clone instanceof HTMLElement)) {
          return { score: 0, text: "" };
        }

        blockedSelectors.forEach((selector) => {
          clone.querySelectorAll(selector).forEach((node) => node.remove());
        });

        clone.querySelectorAll("br").forEach((node) => node.replaceWith("\\n"));
        clone.querySelectorAll("p, div, li, section, article, h1, h2, h3, blockquote").forEach((node) => {
          if (node.textContent && node.textContent.trim().length > 0) {
            node.append(document.createTextNode("\\n"));
          }
        });

        const text = normalizeText(clone.innerText || clone.textContent || "");
        const paragraphs = splitParagraphs(text);
        const paragraphCount = paragraphs.filter((line) => line.length > 30).length;
        const links = normalizeText([...element.querySelectorAll("a")].map((node) => node.textContent || "").join(" ")).length;
        const mediaCount = element.querySelectorAll("img, picture, video, audio, canvas, iframe, svg").length;
        const interactiveCount = element.querySelectorAll("button, input, textarea, select").length;
        const score = text.length + paragraphCount * 220 - Math.min(links * 1.4, 900) - mediaCount * 120 - interactiveCount * 90;
        return { score, text };
      }

      const selectors = [
        "#novel_content", "#revContents", ".novel_view_area", ".novel_view",
        ".viewer_contents", ".episode-content", ".ep-content", ".viewer_body",
        ".read_area", ".view_content", ".episode_viewer", "article", "main",
        "[role='main']", "[id*='content']", "[class*='content']",
        "[id*='chapter']", "[class*='chapter']", "[id*='viewer']", "[class*='viewer']"
      ];

      const candidates = [];
      const seen = new Set();
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          if (element instanceof HTMLElement && !seen.has(element)) {
            seen.add(element);
            candidates.push(element);
          }
        });
      });

      if (candidates.length === 0 && document.body) {
        candidates.push(document.body);
      }

      const best = candidates
        .map((element) => ({ element, ...scoreElement(element) }))
        .filter((item) => item.text.length > 120)
        .sort((left, right) => right.score - left.score)[0];

      if (!best) {
        return false;
      }

      const titleNode = best.element.querySelector("h1, h2, .title, [class*='title']");
      const title = normalizeText((titleNode && titleNode.textContent) || document.title || "Untitled");
      const paragraphs = splitParagraphs(best.text);
      const bodyMarkup = paragraphs
        .map((paragraph) => {
          const safeParagraph = paragraph
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
          return "<p>" + safeParagraph + "</p>";
        })
        .join("");

      document.documentElement.innerHTML = \`
        <head>
          <meta charset="utf-8" />
          <title>\${title}</title>
          <style>
            :root {
              color-scheme: light;
              --paper: #f6efb6;
              --ink: #302816;
              --ink-soft: #62543f;
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              background: var(--paper);
              color: var(--ink);
              font-family: Georgia, "Times New Roman", serif;
            }
            main {
              width: min(860px, calc(100vw - 48px));
              margin: 28px auto;
              padding: 28px 32px 40px;
              border-radius: 0;
              background: var(--paper);
              box-shadow: none;
            }
            h1 {
              margin: 0;
              font-size: 2rem;
              line-height: 1.15;
              letter-spacing: -0.02em;
            }
            .meta {
              margin-top: 10px;
              color: var(--ink-soft);
              font: 12px/1.5 "Segoe UI Variable", "Malgun Gothic", sans-serif;
              text-transform: uppercase;
              letter-spacing: 0.16em;
            }
            p {
              margin: 0 0 22px;
              font-size: \${settings.fontSize}px;
              line-height: \${settings.lineHeight};
              white-space: pre-wrap;
              word-break: keep-all;
              overflow-wrap: anywhere;
            }
          </style>
        </head>
        <body>
          <main>
            <h1>\${title}</h1>
            <div class="meta">Reader Mode</div>
            \${bodyMarkup}
          </main>
        </body>
      \`;

      return true;
    })();
  `;
}
