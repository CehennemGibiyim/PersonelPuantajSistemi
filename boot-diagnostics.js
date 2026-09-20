(() => {
  let completed = false;
  let timeoutId;

  if (window.desktopAPI?.isDesktop) document.documentElement.classList.add('desktop-mode');

  const readCatalogValue = key => {
    try {
      const platformText = window.miniappI18n?.t?.(`app.${key}`);
      if (platformText && platformText !== `app.${key}`) return platformText;
      const desktopCatalog = window.desktopAPI?.readLocale?.()?.catalog;
      return desktopCatalog?.app?.[key] || '';
    } catch {
      return '';
    }
  };

  const report = (message) => {
    if (completed) return;
    const panel = document.getElementById('bootError');
    if (!panel) return;
    const title = readCatalogValue('bootErrorTitle') || 'Uygulama arayüzü başlatılamadı.';
    const hint = readCatalogValue('bootErrorHint') || 'Lütfen npm start komutunun çıktısını kontrol edin.';
    panel.hidden = false;
    panel.style.display = 'block';
    panel.style.margin = '24px';
    panel.style.padding = '18px';
    panel.style.border = '1px solid #d97979';
    panel.style.borderRadius = '12px';
    panel.style.background = '#fff3f3';
    panel.style.color = '#7a2020';
    panel.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    panel.style.whiteSpace = 'pre-wrap';
    panel.textContent = `${title}\n\n${message}\n\n${hint}`;
  };

  const desktopAction = (method) => {
    try {
      if (typeof window.desktopAPI?.[method] === 'function') window.desktopAPI[method]();
    } catch (error) {
      report(error?.message || 'Pencere işlemi gerçekleştirilemedi.');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('bootMinimizeBtn')?.addEventListener('click', () => desktopAction('minimizeWindow'));
    document.getElementById('bootMaximizeBtn')?.addEventListener('click', () => desktopAction('toggleMaximizeWindow'));
    document.getElementById('bootCloseBtn')?.addEventListener('click', () => desktopAction('closeWindow'));
    timeoutId = window.setTimeout(() => {
      report('Başlangıç 12 saniyeden uzun sürdü.\nSon aşama: ' + (window.__miniappBootStage || 'ana JavaScript başlatılamadı') + '\n\nBu genellikle eksik veya eski proje dosyalarının çalıştırıldığını gösterir.\n\nÇalışan dosya: ' + window.location.href);
    }, 12000);
  });

  window.__miniappReportBootError = report;
  window.__miniappBootComplete = () => {
    completed = true;
    if (timeoutId) window.clearTimeout(timeoutId);
  };

  window.addEventListener('error', event => {
    const message = event.error?.stack || event.message || 'Bilinmeyen JavaScript hatası';
    report(message);
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason || 'Bilinmeyen Promise hatası');
    report(reason);
  });
})();
