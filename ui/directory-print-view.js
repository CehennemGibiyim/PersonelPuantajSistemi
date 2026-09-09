import { getContactInfo, getPersonnelType, getUnitName } from '../state.js';
import { getMonth, getYear, MONTHS_TR, t } from '../utils.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const valueMarkup = value => value
  ? esc(value)
  : `<span class="empty">${esc(t('directory.empty'))}</span>`;

function rowMarkup(name) {
  const info = getContactInfo(name) || {};
  const type = getPersonnelType(name) === 'civil'
    ? t('modal.typeCivil')
    : t('modal.typeWorker');
  return `<tr>
    <td class="name"><strong>${esc(name)}</strong><small>${esc(type)}</small></td>
    <td>${valueMarkup(info.phone)}</td>
    <td>${valueMarkup(info.email)}</td>
    <td>${valueMarkup(info.emergency)}</td>
    <td>${valueMarkup(info.address)}</td>
  </tr>`;
}

function buildSheet(people) {
  const unit = getUnitName();
  const month = MONTHS_TR[getMonth()];
  const year = getYear();
  const rows = people.length
    ? people.map(rowMarkup).join('')
    : `<tr><td colspan="5" class="no-results">${esc(t('directory.noResults'))}</td></tr>`;

  return `<section class="directory-print-sheet">
    <header class="directory-print-header">
      <div class="eyebrow">${esc(t('directory.printSubtitle'))}</div>
      <h1>${esc(t('directory.title'))}</h1>
      <p>${esc(t('directory.printPeriod', { unit, month, year }))}</p>
    </header>
    <div class="directory-print-meta">${esc(t('directory.count', { count: people.length }))}</div>
    <table>
      <thead><tr>
        <th>${esc(t('directory.name'))}</th>
        <th>${esc(t('detail.phone'))}</th>
        <th>${esc(t('detail.email'))}</th>
        <th>${esc(t('detail.emergency'))}</th>
        <th>${esc(t('detail.address'))}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <footer>${esc(t('directory.printFooter'))}</footer>
  </section>`;
}

export function printPersonnelDirectory(people = []) {
  const popup = window.open('about:blank', '_blank', 'width=1400,height=1000,scrollbars=yes,resizable=yes');
  if (!popup) {
    window.alert(t('dutySystem.popupBlocked'));
    return;
  }

  const title = t('directory.title');
  const printLabel = t('app.printBtn');
  const closeLabel = t('modal.cancel');
  const sheet = buildSheet(people);
  popup.document.open();
  popup.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #172a33; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #eef2f5; }
    .preview-toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px; background: #172a33; border-bottom: 1px solid #52656d; }
    .preview-toolbar button { min-height: 40px; padding: 8px 16px; border: 1px solid #9fb0b7; border-radius: 6px; background: #fff; color: #172a33; cursor: pointer; font: inherit; }
    .preview-toolbar button.primary { background: #1677a8; color: #fff; border-color: #1677a8; }
    .preview-toolbar button:focus-visible { outline: 3px solid #7dd3fc; outline-offset: 2px; }
    .directory-print-sheet { width: min(1120px, calc(100vw - 48px)); margin: 24px auto; padding: 30px; background: #fff; box-shadow: 0 8px 30px rgba(23,42,51,.18); }
    .directory-print-header { text-align: center; border-bottom: 2px solid #1677a8; padding-bottom: 16px; }
    .directory-print-header .eyebrow { color: #1677a8; font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; }
    .directory-print-header h1 { margin: 8px 0 5px; font-size: 24px; }
    .directory-print-header p { margin: 0; color: #52656d; font-size: 13px; }
    .directory-print-meta { margin: 18px 0 8px; color: #52656d; font-size: 12px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #aab8bd; padding: 9px 10px; text-align: left; vertical-align: top; }
    th { background: #dbeafe; color: #173c4b; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
    tbody tr:nth-child(even) { background: #f7fafc; }
    td.name { width: 22%; color: #10232c; }
    td.name small { display: block; margin-top: 4px; color: #60747c; font-size: 10px; font-weight: 400; }
    .empty { color: #9aa8ad; font-style: italic; }
    .no-results { padding: 24px; text-align: center; color: #60747c; }
    footer { margin-top: 18px; color: #71828a; font-size: 10px; text-align: right; }
    @media (max-width: 760px) { .directory-print-sheet { width: calc(100vw - 24px); margin: 12px auto; padding: 14px; overflow-x: auto; } table { min-width: 760px; } }
    @media print { @page { size: A4 landscape; margin: 8mm; } html, body { background: #fff; } .preview-toolbar { display: none !important; } .directory-print-sheet { width: 100%; margin: 0; padding: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="preview-toolbar" role="toolbar" aria-label="${esc(printLabel)}">
    <button type="button" class="primary" id="directoryPreviewPrint">${esc(printLabel)}</button>
    <button type="button" id="directoryPreviewClose">${esc(closeLabel)}</button>
  </div>
  ${sheet}
</body>
</html>`);
  popup.document.close();
  popup.document.getElementById('directoryPreviewPrint')?.addEventListener('click', () => {
    popup.focus();
    popup.print();
  });
  popup.document.getElementById('directoryPreviewClose')?.addEventListener('click', () => popup.close());
  setTimeout(() => popup.focus(), 100);
}
