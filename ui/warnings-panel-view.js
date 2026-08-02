import { getPersonnelList, getWeeklyTotal, getMonthlyTotal, getScheduleData, getPersonnelType } from '../state.js';
import { getWeeks, SHIFT_HOURS, normalizeShiftCode, t } from '../utils.js';

let overlay = null;

const WEEKLY_OVERTIME_LIMIT = 45;
const MIN_REST_DAYS = 1;

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

function checkOvertimeWarnings() {
  const warnings = [];
  const personnel = getPersonnelList();

  personnel.forEach(name => {
    const totalExtra = getMonthlyTotal(name, 'extra');
    const pType = getPersonnelType(name);
    const weeklyLimit = pType === 'civil' ? 40 : WEEKLY_OVERTIME_LIMIT;

    getWeeks().forEach((wk, wi) => {
      const worked = getWeeklyTotal(name, wi, 'worked');
      const extra = getWeeklyTotal(name, wi, 'extra');
      if (worked + extra > weeklyLimit) {
        warnings.push({
          type: 'overtime',
          person: name,
          week: wk.label,
          detail: t('warnings.overtimeDetail', { name, week: wk.label, hours: worked + extra - weeklyLimit })
        });
      }
    });

    if (totalExtra > weeklyLimit * 0.5) {
      warnings.push({
        type: 'extra',
        person: name,
        detail: t('warnings.monthlyExtraDetail', { name, hours: totalExtra })
      });
    }
  });

  return warnings;
}

function checkRestWarnings() {
  const warnings = [];
  const personnel = getPersonnelList();
  const schedule = getScheduleData();

  personnel.forEach(name => {
    const data = schedule[name] || {};
    let lastWorkDay = null;

    getWeeks().flatMap(w => w.days).forEach(day => {
      const v = String(data[String(day)] || '').trim().toUpperCase();
      if (v && v !== 'İ' && v !== 'R' && v !== 'ÜY') {
        if (lastWorkDay !== null && day - lastWorkDay - 1 < MIN_REST_DAYS) {
          warnings.push({
            type: 'rest',
            person: name,
            detail: t('warnings.restDetail', { name, days: day - lastWorkDay - 1 })
          });
        }
        lastWorkDay = day;
      }
    });
  });

  return warnings;
}

function checkLeaveWarnings() {
  const warnings = [];
  const personnel = getPersonnelList();

  personnel.forEach(name => {
    let consecutiveLeave = 0;
    let maxConsecutiveLeave = 0;
    const data = getScheduleData()[name] || {};

    getWeeks().flatMap(w => w.days).forEach(day => {
      const v = String(data[String(day)] || '').trim().toUpperCase();
      if (v === 'İ' || v === 'R' || v === 'ÜY') {
        consecutiveLeave++;
        maxConsecutiveLeave = Math.max(maxConsecutiveLeave, consecutiveLeave);
      } else {
        consecutiveLeave = 0;
      }
    });

    if (maxConsecutiveLeave >= 10) {
      warnings.push({
        type: 'leave',
        person: name,
        detail: t('warnings.leaveDetail', { name, days: maxConsecutiveLeave })
      });
    }
  });

  return warnings;
}

function checkCodeWarnings() {
  const warnings = [];
  const allowed = new Set(Object.keys(SHIFT_HOURS));
  const schedule = getScheduleData();
  getPersonnelList().forEach(name => {
    Object.entries(schedule[name] || {}).forEach(([day, value]) => {
      const raw = String(value || '').trim();
      const code = normalizeShiftCode(raw);
      const isDirectHours = /^\d+(?:[.,]\d+)?$/.test(raw) && Number(raw.replace(',', '.')) <= 24;
      if (raw && !allowed.has(code) && !isDirectHours) warnings.push({ type: 'code', detail: t('warnings.invalidCodeDetail', { name, day, code: raw }) });
    });
  });
  return warnings;
}

export function showWarningsPanel() {
  createOverlay();

  const overtime = checkOvertimeWarnings();
  const rest = checkRestWarnings();
  const leave = checkLeaveWarnings();
  const codes = checkCodeWarnings();

  const renderWarnings = (items, emptyMsg) => {
    if (!items.length) return `<p style="font-size:12px;color:rgba(255,255,255,0.4);padding:10px;text-align:center">${emptyMsg}</p>`;
    return items.map(w => `
      <div class="warning-item warning-${w.type}" style="padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);margin-bottom:6px;font-size:12px;color:rgba(255,255,255,0.85)">
        ${w.detail}
      </div>
    `).join('');
  };

  overlay.innerHTML = `
    <div class="modal glass" style="max-width:520px;max-height:80vh;display:flex;flex-direction:column">
      <h2 class="modal-title">${t('warnings.title')}</h2>
      <div style="overflow-y:auto;flex:1;padding-right:4px">
        <div style="margin-bottom:14px">
          <p class="modal-label" style="margin-bottom:8px">⚠ ${t('warnings.overtime')}</p>
          ${renderWarnings(overtime, t('warnings.noOvertime'))}
        </div>
        <div style="margin-bottom:14px">
          <p class="modal-label" style="margin-bottom:8px">🛌 ${t('warnings.rest')}</p>
          ${renderWarnings(rest, t('warnings.noRest'))}
        </div>
        <div>
          <p class="modal-label" style="margin-bottom:8px">📋 ${t('warnings.leave')}</p>
          ${renderWarnings(leave, t('warnings.noLeave'))}
        </div>
        <div style="margin-top:14px">
          <p class="modal-label" style="margin-bottom:8px">🔎 ${t('warnings.code')}</p>
          ${renderWarnings(codes, t('warnings.noCode'))}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn" id="warningsClose">${t('modal.cancel')}</button>
      </div>
    </div>
  `;

  overlay.querySelector('#warningsClose').addEventListener('click', hide);

  overlay.classList.add('active');
  overlay.setAttribute('aria-label', t('warnings.title'));
}

export function initWarningsPanel(btn) {
  if (btn) btn.addEventListener('click', showWarningsPanel);
}
