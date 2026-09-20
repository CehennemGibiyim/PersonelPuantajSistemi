(() => {
  const start = () => {
    window.__miniappBootStage = 'ana JavaScript yükleniyor';
    import('./main.js')
      .then(module => {
        if (typeof module.startApp !== 'function') {
          throw new Error('main.js startApp dışa aktarmadı.');
        }
        return module.startApp();
      })
      .catch(error => {
        const detail = error?.stack || error?.message || String(error);
        console.error('[Loader] Ana JavaScript yüklenemedi:', detail);
        window.__miniappReportBootError?.(
          `Ana JavaScript yüklenemedi.\n\n${detail}\n\nDosya: ${window.location.href}`
        );
      });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
