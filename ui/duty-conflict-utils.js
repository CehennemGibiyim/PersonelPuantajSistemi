import { t } from '../utils.js';

const REST_HOURS = 11;

function parseWindow(record) {
  const label = String(record?.shiftLabel || '');
  const match = label.match(/(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  const day = Number(record?.day);
  if (!Number.isInteger(day)) return null;
  if (!match) {
    const gross = Math.max(1, Number(record?.grossHours ?? record?.hours) || 8);
    return { start: day * 24, end: day * 24 + gross, day };
  }
  const startHour = Number(match[1]) + Number(match[2]) / 60;
  const endHour = Number(match[3]) + Number(match[4]) / 60;
  let end = day * 24 + endHour;
  const start = day * 24 + startHour;
  if (end <= start) end += 24;
  return { start, end, day };
}

function recordLabel(record) {
  return `${record?.day || ''}. ${record?.shiftLabel || t('dutySystem.columnDuty')}`.trim();
}

export function getDutyWarnings(candidate, records = []) {
  const person = String(candidate?.person || '').trim();
  if (!person) return [];
  const candidateWindow = parseWindow(candidate);
  if (!candidateWindow) return [];
  const comparable = records
    .filter(item => String(item?.person || '').trim() === person)
    .filter(item => !(String(item.columnKey || '') === String(candidate.columnKey || '') && Number(item.day) === Number(candidate.day)))
    .map(item => ({ item, window: parseWindow(item) }))
    .filter(entry => entry.window);
  const warnings = [];

  comparable.forEach(({ item, window }) => {
    const overlaps = candidateWindow.start < window.end && window.start < candidateWindow.end;
    const sameDay = Number(item.day) === Number(candidate.day);
    if (overlaps || sameDay) {
      warnings.push({ type: 'overlap', label: recordLabel(item), item });
      return;
    }
    const gapBefore = candidateWindow.start - window.end;
    const gapAfter = window.start - candidateWindow.end;
    if (gapBefore >= 0 && gapBefore < REST_HOURS) {
      warnings.push({ type: 'rest', hours: Math.round(gapBefore * 10) / 10, label: recordLabel(item), item });
    } else if (gapAfter >= 0 && gapAfter < REST_HOURS) {
      warnings.push({ type: 'rest', hours: Math.round(gapAfter * 10) / 10, label: recordLabel(item), item });
    }
  });

  return warnings.filter((warning, index, list) => list.findIndex(item => item.type === warning.type && item.label === warning.label) === index);
}

export function getDutyWarningSummary(records = []) {
  const summary = [];
  records.forEach(record => {
    const warnings = getDutyWarnings(record, records);
    warnings.forEach(warning => {
      const key = `${record.person}|${warning.type}|${record.day}|${warning.label}`;
      if (summary.some(item => item.key === key)) return;
      summary.push({ key, person: record.person, day: record.day, warning });
    });
  });
  return summary;
}

export function warningText(entry) {
  if (entry.warning.type === 'overlap') return t('dutySystem.overlapWarning', { person: entry.person, day: entry.day, shift: entry.warning.label });
  return t('dutySystem.restWarning', { person: entry.person, day: entry.day, hours: entry.warning.hours, shift: entry.warning.label });
}

export function isWarningFor(record, records = []) {
  return getDutyWarnings(record, records).length > 0;
}

export function getRestHours() {
  return REST_HOURS;
}

