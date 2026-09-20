const LETTER_PATTERN = /(^|[\s\-/'’])([\p{L}])/gu;

function titleToken(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR').replace(LETTER_PATTERN, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('tr-TR')}`);
}

/** Formats personnel names as "Ad Soyad" with the surname fully uppercase. */
export function formatPersonnelName(value) {
  const parts = String(value ?? '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return titleToken(parts[0]);
  const surname = parts.pop().toLocaleUpperCase('tr-TR');
  return `${parts.map(titleToken).join(' ')} ${surname}`;
}

export function personnelNameKey(value) {
  return formatPersonnelName(value);
}

export function formatPersonnelList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(formatPersonnelName).filter(Boolean))];
}
