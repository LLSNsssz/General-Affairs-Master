(() => {
  const hideSelectors = [
    'header',
    '[class*="top"]',
    '[class*="toolbar"]',
    '[class*="comment"]',
    '[class*="reply"]',
    '[class*="floating"]',
    '[class*="fixed"]',
  ];

  const apply = () => {
    for (const selector of hideSelectors) {
      document.querySelectorAll(selector).forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }

        const text = node.innerText || '';
        if (
          text.includes('다음화') ||
          text.includes('다음 화') ||
          text.includes('다음화보기')
        ) {
          return;
        }

        node.style.display = 'none';
      });
    }
  };

  apply();
  setTimeout(apply, 250);
  setTimeout(apply, 1200);
})();

