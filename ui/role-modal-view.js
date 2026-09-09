import { getRole, setRole, canEdit } from '../state.js';
import { ROLE_LABELS, t } from '../utils.js';

let overlay = null;
let onUpdate = null;

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

export function showRoleModal() {
  createOverlay();
  const current = getRole();

  overlay.innerHTML = `
    <div class="modal glass" style="max-width:400px">
      <h2 class="modal-title">${t('role.title')}</h2>
      <p class="modal-label" style="margin-bottom:10px">${t('role.description')}</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${Object.entries(ROLE_LABELS).map(([key, label]) => `
          <label class="role-option ${current === key ? 'role-active' : 'role-inactive'}" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;cursor:pointer;border:1px solid rgba(255,255,255,${current === key ? '0.4' : '0.1'});background:rgba(255,255,255,${current === key ? '0.15' : '0.05'})" data-role="${key}">
            <input type="radio" name="role" value="${key}" ${current === key ? 'checked' : ''} style="accent-color:#38bdf8">
            <div style="flex:1">
              <div style="font-size:14px;color:#fff;font-weight:500">${label}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.5)">${t(`role.${key}Desc`)}</div>
            </div>
          </label>
        `).join('')}
      </div>
      <p class="modal-error" id="roleError" style="display:none;margin-top:10px"></p>
      <div class="modal-actions" style="margin-top:20px">
        <button class="btn" id="roleCancel">${t('modal.cancel')}</button>
        <button class="btn btn-primary" id="roleSave">${t('modal.save')}</button>
      </div>
    </div>
  `;

  overlay.querySelectorAll('[data-role]').forEach(label => {
    label.addEventListener('click', () => {
      const key = label.dataset.role;
      overlay.querySelectorAll('[data-role]').forEach(l => {
        l.style.borderColor = 'rgba(255,255,255,0.1)';
        l.style.background = 'rgba(255,255,255,0.05)';
        l.querySelector('input').checked = false;
      });
      label.style.borderColor = 'rgba(255,255,255,0.4)';
      label.style.background = 'rgba(255,255,255,0.15)';
      label.querySelector('input').checked = true;
    });
  });

  overlay.querySelector('#roleCancel').addEventListener('click', hide);
  overlay.querySelector('#roleSave').addEventListener('click', () => {
    const selected = overlay.querySelector('input[name="role"]:checked');
    if (!selected) return;
    const newRole = selected.value;
    if (setRole(newRole)) {
      hide();
      if (onUpdate) onUpdate();
    }
  });

  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('role.title'));
}

export function initRoleModal(btn, callback) {
  onUpdate = callback;
  if (btn) btn.addEventListener('click', showRoleModal);
}
