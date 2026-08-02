import { t } from '../utils.js';

export function renderSystemSwitcher(container, active, onChange) {
  if (!container) return;
  container.innerHTML = `
    <span class="system-switcher-label">${t('app.systemSwitcher')}</span>
    <div class="system-switcher-buttons" role="tablist" aria-label="${t('app.systemSwitcher')}">
      <button class="system-tab ${active === 'punch' ? 'active' : ''}" data-system="punch" role="tab" aria-selected="${active === 'punch'}">${t('app.punchSystem')}</button>
      <button class="system-tab ${active === 'duty' ? 'active' : ''}" data-system="duty" role="tab" aria-selected="${active === 'duty'}">${t('app.dutySystem')}</button>
    </div>`;
  container.querySelectorAll('[data-system]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.system !== active) onChange(button.dataset.system);
    });
  });
}
