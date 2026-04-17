(() => {
  const apply = () => {
    document.querySelectorAll('[class*="ad"], [class*="banner"], aside').forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.display = 'none';
      }
    });

    document.querySelectorAll('main, article, [class*="viewer"], [class*="content"]').forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.background = 'transparent';
        node.style.color = '#231f15';
      }
    });
  };

  apply();
  setTimeout(apply, 300);
})();
