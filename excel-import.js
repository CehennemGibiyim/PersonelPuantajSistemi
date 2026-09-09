const normalize = value => String(value ?? '')
  .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/Ş/g, 's').replace(/Ğ/g, 'g')
  .replace(/Ü/g, 'u').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/g, ' ').trim();

function parseDelimited(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const sample = lines.slice(0, 5).join('\n');
  const candidates = ['\t', ';', ','];
  const delimiter = candidates.sort((a, b) => {
    const count = value => value.split('\n').reduce((sum, line) => sum + (line.split(a).length - 1), 0);
    return count(b) - count(a);
  })[0];
  const split = line => {
    const cells = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) { cells.push(value.trim()); value = ''; }
      else value += char;
    }
    cells.push(value.trim());
    return cells;
  };
  const headers = split(lines[0]).map((value, index) => value || `Sütun ${index + 1}`);
  return lines.slice(1).map(line => {
    const values = split(line);
    return headers.reduce((row, header, index) => { row[header] = values[index] || ''; return row; }, {});
  }).filter(row => Object.values(row).some(Boolean));
}

function findEnd(bytes) {
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
  }
  return -1;
}

async function unzipEntries(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const end = findEnd(bytes);
  if (end < 0) throw new Error('xlsx-zip');
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map();
  let offset = centralOffset;
  while (offset < centralOffset + centralSize) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    entries.set(name, { method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  const read = async name => {
    const entry = entries.get(name);
    if (!entry) return null;
    const localNameLength = view.getUint16(entry.localOffset + 26, true);
    const localExtraLength = view.getUint16(entry.localOffset + 28, true);
    const start = entry.localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(start, start + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('xlsx-compression');
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
  return { entries, read, decoder };
}

function xmlText(xmlBytes) { return new TextDecoder().decode(xmlBytes || new Uint8Array()); }

async function parseXlsx(buffer) {
  const zip = await unzipEntries(buffer);
  const stringsBytes = await zip.read('xl/sharedStrings.xml');
  const shared = stringsBytes ? [...new DOMParser().parseFromString(xmlText(stringsBytes), 'application/xml').querySelectorAll('si')].map(node => [...node.querySelectorAll('t')].map(t => t.textContent).join('')) : [];
  const sheetBytes = await zip.read('xl/worksheets/sheet1.xml');
  if (!sheetBytes) throw new Error('xlsx-sheet');
  const sheet = new DOMParser().parseFromString(xmlText(sheetBytes), 'application/xml');
  const rows = [...sheet.querySelectorAll('row')].map(row => {
    const cells = {};
    [...row.querySelectorAll(':scope > c')].forEach(cell => {
      const ref = cell.getAttribute('r') || '';
      const match = ref.match(/[A-Z]+/i);
      if (!match) return;
      const col = match[0].toUpperCase().split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
      const type = cell.getAttribute('t');
      const value = type === 'inlineStr' ? [...cell.querySelectorAll('t')].map(t => t.textContent).join('') : cell.querySelector('v')?.textContent || '';
      cells[col] = type === 's' ? (shared[Number(value)] || '') : value;
    });
    return cells;
  });
  const headers = rows[0] || {};
  const names = Object.keys(headers).map(Number).sort((a, b) => a - b);
  return rows.slice(1).map(row => names.reduce((item, index) => { item[headers[index] || `Sütun ${index + 1}`] = row[index] || ''; return item; }, {})).filter(row => Object.values(row).some(Boolean));
}

export async function readSpreadsheetFile(file) {
  if (!file) throw new Error('file-required');
  const name = String(file.name || '').toLocaleLowerCase('tr-TR');
  if (name.endsWith('.xlsx')) return parseXlsx(await file.arrayBuffer());
  const text = await file.text();
  if (name.endsWith('.xls') && /<table|<html/i.test(text)) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const rows = [...doc.querySelectorAll('tr')].map(row => [...row.querySelectorAll('th,td')].map(cell => cell.textContent.trim()));
    if (rows.length) {
      const headers = rows[0];
      return rows.slice(1).map(values => headers.reduce((item, header, index) => { item[header || `Sütun ${index + 1}`] = values[index] || ''; return item; }, {}));
    }
  }
  return parseDelimited(text);
}

export function normalizedHeader(value) { return normalize(value); }
