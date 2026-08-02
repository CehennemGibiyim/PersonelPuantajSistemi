import { t } from '../utils.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

export function columnKey(service, shiftLabel) {
  return `${String(service || '').trim()}¦${String(shiftLabel || '').trim()}`;
}

export function defaultDutyColumns() {
  return [
    { service: t('dutySystem.defaultService1'), shiftLabel: '07.00-19.00' },
    { service: t('dutySystem.defaultService1'), shiftLabel: '06.00-14.00' },
    { service: t('dutySystem.defaultService1'), shiftLabel: '19.00-07.00' },
    { service: t('dutySystem.defaultService2'), shiftLabel: '08.00-16.00' },
    { service: t('dutySystem.defaultService2'), shiftLabel: '10.00-18.00' }
  ].map(item => ({ ...item, key: columnKey(item.service, item.shiftLabel) }));
}

export function normalizeColumns(columns) {
  const result = [];
  (columns || []).forEach(item => {
    const service = String(item.service || '').trim();
    const shiftLabel = String(item.shiftLabel || '').trim();
    if (!service || !shiftLabel) return;
    const key = item.key || columnKey(service, shiftLabel);
    if (!result.some(column => column.key === key)) result.push({ ...item, service, shiftLabel, key });
  });
  return result;
}

export function columnsFromRecords(records) {
  return normalizeColumns((records || []).map(item => ({
    key: item.columnKey || columnKey(String(item.service || '').trim() || t('dutySystem.generalService'), String(item.shiftLabel || '').trim() || t('dutySystem.columnDuty')),
    service: String(item.service || '').trim() || t('dutySystem.generalService'),
    shiftLabel: String(item.shiftLabel || '').trim() || t('dutySystem.columnDuty')
  })));
}

export function formatColumn(column) {
  return column.service ? `${column.service} (${column.shiftLabel})` : column.shiftLabel;
}

export function recordMatchesColumn(item, column) {
  if (String(item.columnKey || '').trim()) return String(item.columnKey) === column.key;
  const service = String(item.service || '').trim() || t('dutySystem.generalService');
  const shift = String(item.shiftLabel || '').trim() || t('dutySystem.columnDuty');
  return columnKey(service, shift) === column.key;
}

function parseTime(value) {
  const match = String(value || '').match(/(\d{1,2})[.:](\d{2})/);
  return match ? Number(match[1]) + Number(match[2]) / 60 : null;
}

export function hoursForShift(shiftLabel, holiday = false) {
  const times = String(shiftLabel || '').match(/(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})/);
  const start = times ? parseTime(times[1]) : null;
  const end = times ? parseTime(times[2]) : null;
  let gross = start !== null && end !== null ? end - start : 8;
  if (gross <= 0) gross += 24;
  gross = Math.min(24, Math.max(1, gross));
  const net = gross >= 12 ? gross - 1 : gross >= 8 ? gross - 0.5 : gross;
  const overnight = start !== null && end !== null && (end <= start || start >= 18 || end <= 7);
  return {
    grossHours: Number(gross.toFixed(2)),
    netHours: Number(net.toFixed(2)),
    nightHours: overnight ? Number(net.toFixed(2)) : 0,
    netNightHours: overnight ? Number(net.toFixed(2)) : 0,
    extraHours: Number(Math.max(0, net - 7.5).toFixed(2)),
    holidayHours: holiday ? Number(net.toFixed(2)) : 0,
    netHolidayHours: holiday ? Number(net.toFixed(2)) : 0,
    type: overnight ? 'night' : holiday ? 'holiday' : 'day'
  };
}

// Nöbet kaydı puantaj hücresinde "NB" olarak bırakılmaz. Nöbet sütunundaki
// saat aralığına göre gündüz/gece kodu üretilir; gerçek net süre ayrıca
// çıktı ve ipucunda gösterilir. Böylece 16 saat gibi standart kodlara
// sığmayan nöbetler de kaybolmadan puantaja aktarılır.
export function punchCodeForDuty(record) {
  const shiftLabel = String(record?.shiftLabel || '');
  const calculated = hoursForShift(shiftLabel, false);
  const type = calculated.type === 'night' || record?.type === 'night' ? 'N' : 'G';
  const gross = Number(record?.grossHours ?? calculated.grossHours) || calculated.grossHours;
  return `${type}${gross >= 12 ? '2' : ''}`;
}

export function punchLabelForDuty(record, withHours = false) {
  const code = punchCodeForDuty(record);
  if (!withHours) return code;
  const net = Number(record?.netHours ?? record?.hours);
  const hours = Number.isFinite(net) ? net : hoursForShift(record?.shiftLabel, false).netHours;
  return `${code} (${Number(hours.toFixed(2))}s)`;
}

export function effectiveColumns(columns, records) {
  const saved = normalizeColumns(columns);
  if (saved.length) return saved;
  const fromRecords = columnsFromRecords(records);
  return fromRecords.length ? fromRecords : defaultDutyColumns();
}
