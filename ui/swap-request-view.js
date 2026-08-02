import { getPersonnelList, getScheduleData, getSwapRequests, addSwapRequest, updateSwapRequest, deleteSwapRequest, canEdit } from '../state.js';
import { getDayName, t } from '../utils.js';
import { showToast } from './toast-view.js';

let overlay = null;

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

function getShift(name, day) {
  const schedule = getScheduleData();
  return (schedule[name] && schedule[name][String(day)]) || '';
}

export function showSwapRequestForm(fromName) {
  if (!fromName) return;
  createOverlay();

  const personnel = getPersonnelList();
  const schedule = getScheduleData();
  const days = Object.keys(schedule[fromName] || {}).map(Number).sort((a, b) => a - b);

  overlay.innerHTML = `
    <div class="modal glass" style="max-width:420px">
      <h2 class="modal-title">${t('swap.title')}</h2>
      <p style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:14px">${fromName}</p>

      <label class="modal-label" for="swapFromDay">${t('swap.fromDay')}</label>
      <select id="swapFromDay" class="modal-input" style="margin-bottom:12px">
        ${days.map(d => `<option value="${d}">${d} ${getDayName(d)} — ${getShift(fromName, d) || t('swap.emptyShift')}</option>`).join('')}
      </select>

      <label class="modal-label" for="swapToPerson">${t('swap.toPerson')}</label>
      <select id="swapToPerson" class="modal-input" style="margin-bottom:12px">
        ${personnel.filter(n => n !== fromName).map(n => `<option value="${n}">${n}</option>`).join('')}
      </select>

      <label class="modal-label" for="swapToDay">${t('swap.toDay')}</label>
      <select id="swapToDay" class="modal-input" style="margin-bottom:12px"></select>

      <p class="modal-error" id="swapError" style="display:none"></p>

      <div class="modal-actions">
        <button class="btn" id="swapCancel">${t('modal.cancel')}</button>
        <button class="btn btn-primary" id="swapSubmit">${t('swap.submit')}</button>
      </div>
    </div>
  `;

  const toPersonSelect = overlay.querySelector('#swapToPerson');
  const toDaySelect = overlay.querySelector('#swapToDay');

  function updateToDays() {
    const person = toPersonSelect.value;
    toDaySelect.innerHTML = days.map(d => `<option value="${d}">${d} ${getDayName(d)} — ${getShift(person, d) || t('swap.emptyShift')}</option>`).join('');
  }

  updateToDays();
  toPersonSelect.addEventListener('change', updateToDays);

  overlay.querySelector('#swapCancel').addEventListener('click', hide);
  overlay.querySelector('#swapSubmit').addEventListener('click', () => {
    const fromDay = parseInt(overlay.querySelector('#swapFromDay').value);
    const toPerson = toPersonSelect.value;
    const toDay = parseInt(toDaySelect.value);

    if (!toPerson) {
      const err = overlay.querySelector('#swapError');
      err.textContent = t('swap.noTarget');
      err.style.display = 'block';
      return;
    }

    addSwapRequest({ fromPerson: fromName, fromDay, toPerson, toDay });
    hide();
    showToast(t('swap.requestSent'), 'success');
  });

  overlay.classList.add('active');
}

function renderRequestItem(req) {
  const statusColor = req.status === 'pending' ? '#fbbf24' : req.status === 'approved' ? '#6ee7b7' : '#fca5a5';
  const statusLabel = req.status === 'pending' ? t('swap.pending') : req.status === 'approved' ? t('swap.approved') : t('swap.rejected');

  return `
    <div class="warning-item" style="padding:12px;border-radius:8px;background:rgba(255,255,255,0.05);margin-bottom:8px;font-size:12px;color:rgba(255,255,255,0.85)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <strong style="color:#fff">${req.fromPerson} ↔ ${req.toPerson}</strong>
        <span style="font-size:11px;padding:3px 8px;border-radius:12px;background:${statusColor}20;color:${statusColor}">${statusLabel}</span>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:8px">
        ${req.fromDay} ${getDayName(req.fromDay)} ↔ ${req.toDay} ${getDayName(req.toDay)}
      </div>
      ${req.status === 'pending' && canEdit() ? `
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-primary swap-approve" data-id="${req.id}" style="padding:5px 10px;font-size:11px">${t('swap.approve')}</button>
          <button class="btn swap-reject" data-id="${req.id}" style="padding:5px 10px;font-size:11px;background:rgba(255,100,100,0.2);border-color:rgba(255,100,100,0.4);color:#fca5a5">${t('swap.reject')}</button>
        </div>
      ` : ''}
    </div>
  `;
}

export function showSwapRequestsPanel() {
  createOverlay();

  const requests = getSwapRequests();
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  overlay.innerHTML = `
    <div class="modal glass" style="max-width:520px;max-height:80vh;display:flex;flex-direction:column">
      <h2 class="modal-title">${t('swap.panelTitle')} ${pendingCount > 0 ? `<span style="font-size:12px;padding:3px 10px;border-radius:12px;background:#fbbf2420;color:#fbbf24">${pendingCount}</span>` : ''}</h2>
      <div id="swapRequestsList" style="overflow-y:auto;flex:1;padding-right:4px">
        ${requests.length ? requests.slice().reverse().map(renderRequestItem).join('') : `<p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;padding:20px">${t('swap.empty')}</p>`}
      </div>
      <div class="modal-actions">
        <button class="btn" id="swapPanelClose">${t('modal.cancel')}</button>
      </div>
    </div>
  `;

  overlay.querySelectorAll('.swap-approve').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSwapRequest(btn.dataset.id, 'approved');
      showToast(t('swap.approvedToast'), 'success');
      showSwapRequestsPanel();
    });
  });

  overlay.querySelectorAll('.swap-reject').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSwapRequest(btn.dataset.id, 'rejected');
      showToast(t('swap.rejectedToast'), 'info');
      showSwapRequestsPanel();
    });
  });

  overlay.querySelector('#swapPanelClose').addEventListener('click', hide);

  overlay.classList.add('active');
}

export function initSwapRequestsPanel(btn) {
  if (btn) btn.addEventListener('click', showSwapRequestsPanel);
}
