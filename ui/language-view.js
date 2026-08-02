import { setLocale, getLocale, t } from '../utils.js';

let overlay = null;
let onChange = null;

function createOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) hide(); });
}

function hide() {
  if (overlay) overlay.classList.remove('active');
}

export function showLanguageModal() {
  createOverlay();
  const current = getLocale().startsWith('en') ? 'en' : 'tr';

  overlay.innerHTML = `
    <div class="modal glass" style="max-width:360px">
      <h2 class="modal-title">${t('language.title')}</h2>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label class="role-option ${current === 'tr' ? 'role-active' : 'role-inactive'}" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;cursor:pointer;border:1px solid rgba(255,255,255,${current === 'tr' ? '0.4' : '0.1'});background:rgba(255,255,255,${current === 'tr' ? '0.15' : '0.05'})" data-lang="tr">
          <input type="radio" name="lang" value="tr" ${current === 'tr' ? 'checked' : ''}>
          <span style="font-size:14px;color:#fff">${t('language.tr')}</span>
        </label>
        <label class="role-option ${current === 'en' ? 'role-active' : 'role-inactive'}" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;cursor:pointer;border:1px solid rgba(255,255,255,${current === 'en' ? '0.4' : '0.1'});background:rgba(255,255,255,${current === 'en' ? '0.15' : '0.05'})" data-lang="en">
          <input type="radio" name="lang" value="en" ${current === 'en' ? 'checked' : ''}>
          <span style="font-size:14px;color:#fff">${t('language.en')}</span>
        </label>
      </div>
      <div class="modal-actions" style="margin-top:20px">
        <button class="btn" id="langCancel">${t('modal.cancel')}</button>
        <button class="btn btn-primary" id="langSave">${t('modal.save')}</button>
      </div>
    </div>
  `;

  overlay.querySelectorAll('[data-lang]').forEach(label => {
    label.addEventListener('click', () => {
      const key = label.dataset.lang;
      overlay.querySelectorAll('[data-lang]').forEach(l => {
        l.style.borderColor = 'rgba(255,255,255,0.1)';
        l.style.background = 'rgba(255,255,255,0.05)';
        l.querySelector('input').checked = false;
      });
      label.style.borderColor = 'rgba(255,255,255,0.4)';
      label.style.background = 'rgba(255,255,255,0.15)';
      label.querySelector('input').checked = true;
    });
  });

  overlay.querySelector('#langCancel').addEventListener('click', hide);
  overlay.querySelector('#langSave').addEventListener('click', () => {
    const selected = overlay.querySelector('input[name="lang"]:checked');
    if (!selected) return;
    const code = selected.value;
    if (code !== current) {
      setLocale(code);
      hide();
      if (onChange) onChange();
    } else {
      hide();
    }
  });

  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('language.title'));
}

export function initLanguageModal(btn, callback) {
  onChange = callback;
  if (btn) btn.addEventListener('click', showLanguageModal);
}
