import { desktopTranslate, getDesktopLocale, initDesktopI18n, setDesktopLocale } from './desktop-i18n.js';

export const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
export const DAYS_TR = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

// Vardiya süresi brüt (işyerinde bulunulan süre) olarak tutulur.
// Puantaj toplamları ise ara dinlenmesi düşülmüş net süreyi gösterir.
export const SHIFT_HOURS = { G:8, G2:12, N:8, N2:12, NB:0, 'İ':0, R:0, ÜY:0, B:8, B2:12, '':0 };
export const SHIFT_NET_HOURS = { G:7.5, G2:11, N:7.5, N2:11, NB:0, 'İ':0, R:0, ÜY:0, B:7.5, B2:11, '':0 };
export const NIGHT_SHIFTS = { N:7.5, N2:11 };
export const EXTRA_SHIFTS = { G2:3.5, N2:3.5, B2:3.5 };
export const HOLIDAY_SHIFTS = { B:7.5, B2:11 };

// Kurum uygulamasına göre vardiya kodlarının açıklaması.
// G ve N: 8 brüt / 7,5 net; G2 ve N2: 12 brüt / 11 net.
export const SHIFT_DESCRIPTIONS = {
  G: 'Gündüz — 8 brüt / 7,5 net',
  G2: 'Gündüz uzun — 12 brüt / 11 net',
  N: 'Gece — 8 brüt / 7,5 net gece',
  N2: 'Gece uzun — 12 brüt / 11 net gece',
  B: 'Bayram — 8 brüt / 7,5 net bayram',
  B2: 'Bayram uzun — 12 brüt / 11 net bayram',
  NB: 'Nöbet — formdaki brüt süreden net ara dinlenmesi düşülür',
  'İ': 'İzinli',
  R: 'Raporlu',
  ÜY: 'Ücretsiz izin',
  '': 'Boş / çalışılmadı'
};

// Resmî tatil takvimi ISO tarihleriyle tutulur. Böylece JavaScript'in
// sıfırdan başlayan ay indeksleriyle (0 = Ocak) tarih karışıklığı oluşmaz.
// Arife günleri yarım gün olduğu için bu puantaj takviminde tam tatil olarak
// işaretlenmez; yalnızca tam gün resmî tatiller listelenir.
export const OFFICIAL_FULL_DAY_HOLIDAYS = [
  '2026-01-01', // Yılbaşı
  '2026-03-20', '2026-03-21', '2026-03-22', // Ramazan Bayramı
  '2026-04-23', // Ulusal Egemenlik ve Çocuk Bayramı
  '2026-05-01', // Emek ve Dayanışma Günü
  '2026-05-19', // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30', // Kurban Bayramı
  '2026-07-15', // Demokrasi ve Millî Birlik Günü
  '2026-08-30', // Zafer Bayramı
  '2026-10-29' // Cumhuriyet Bayramı
];

// Eski modüllerle uyumluluk için ay haritası çalışma anında ISO listeden
// üretilir; uygulama kodu artık doğrudan elle ay indeksi yazmaz.
export const HOLIDAYS_MAP = OFFICIAL_FULL_DAY_HOLIDAYS.reduce((map, isoDate) => {
  const [year, month, day] = isoDate.split('-');
  const key = `${year}-${Number(month) - 1}`;
  if (!map[key]) map[key] = [];
  map[key].push(Number(day));
  return map;
}, {});

// Personel tipine göre haftalık çalışma saatleri
export const WEEKLY_HOURS = { worker: 45, civil: 40 };

export function roundHours(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

// Ara dinlenmesi puantajdaki çalışılan saate dahil edilmez.
// Bu uygulamadaki vardiya politikası: 8 saatlik vardiyada 0,5 saat,
// 12 saatlik vardiyada 1 saat; 12 saati aşan nöbette en az 1,5 saat.
export function getBreakHours(grossHours) {
  const hours = Number(grossHours);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (hours > 12) return 1.5;
  if (hours >= 8) return hours >= 12 ? 1 : 0.5;
  if (hours > 4) return 0.5;
  return 0;
}

export function getNetWorkedHours(grossHours) {
  const gross = Number(grossHours);
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  // 7,5 ve altındaki sayılar puantajda zaten net saat kabul edilir.
  if (gross <= 7.5) return roundHours(gross);
  return roundHours(Math.max(0, gross - getBreakHours(gross)));
}

// Kullanıcı vardiya kodu yerine doğrudan saat yazdığında da puantajı hesapla.
export function normalizeShiftCode(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  const aliases = {
    'GÜNDÜZ': 'G',
    'GUNDUZ': 'G',
    'GECE': 'N',
    'BAYRAM': 'B',
    'NÖBET': 'NB',
    'NOBET': 'NB',
    'İZİN': 'İ',
    'IZIN': 'İ',
    'RAPOR': 'R',
    'ÜCRETSİZ': 'ÜY',
    'UCRETSIZ': 'ÜY'
  };
  return aliases[raw] || raw;
}

export function getShiftMetrics(value, day) {
  const raw = String(value ?? '').trim();
  const code = normalizeShiftCode(raw);
  const numeric = /^\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
  const worked = Number.isFinite(numeric)
    ? getNetWorkedHours(numeric)
    : (Number(SHIFT_NET_HOURS[code]) || 0);
  const extra = Number.isFinite(numeric)
    ? Math.max(0, worked - 7.5)
    : (Number(EXTRA_SHIFTS[code]) || 0);
  const holiday = isHoliday(day) && worked > 0 ? worked : (Number(HOLIDAY_SHIFTS[code]) || 0);
  return {
    worked: roundHours(worked),
    night: roundHours(Number(NIGHT_SHIFTS[code]) || 0),
    extra: roundHours(extra),
    holiday: roundHours(holiday)
  };
}

// Dinamik dönem (modül içi durum)
let _year = 2026;
let _month = 5;

export function setPeriod(year, month) {
  _year = year;
  _month = month;
}

export function getYear() { return _year; }
export function getMonth() { return _month; }

export function getDaysInMonth() {
  return new Date(_year, _month + 1, 0).getDate();
}

export function getWeeks() {
  const daysInMonth = getDaysInMonth();
  const weeks = [];
  let weekDays = [];

  for (let d = 1; d <= daysInMonth; d++) {
    weekDays.push(d);
    if (new Date(_year, _month, d).getDay() === 0 || d === daysInMonth) {
      weeks.push({ label: `${weeks.length + 1}. Hafta`, days: [...weekDays] });
      weekDays = [];
    }
  }

  return weeks;
}

export function getDayName(d) {
  return DAYS_TR[new Date(_year, _month, d).getDay()];
}

// 6 iş günü: sadece Pazar tatil
export function isWeekend(d) {
  return new Date(_year, _month, d).getDay() === 0;
}

// Görsel takvim işaretleri için Cumartesi ayrı tutulur; isWeekend() hesaplama
// mantığında 6 günlük çalışma düzeni nedeniyle yalnızca Pazar'ı ifade eder.
export function isSaturday(d) {
  return new Date(_year, _month, d).getDay() === 6;
}

export function isSunday(d) {
  return new Date(_year, _month, d).getDay() === 0;
}

export function isHoliday(d) {
  return getHolidays().includes(d);
}

export function getHolidays() {
  return HOLIDAYS_MAP[`${_year}-${_month}`] || [];
}

// Personel tipine göre günlük çalışma saati
// İşçi: 45s / 6 gün = 7.5 saat/gün
// Memur: 40s / 6 gün ≈ 6.67 saat/gün
export function getDailyRequired(type = 'worker') {
  const weekly = WEEKLY_HOURS[type] || 45;
  return weekly / 6;
}

// İstatistik hesaplama — personel tipine göre gereken saat
export function getStats(scheduleData, name, days, type = 'worker') {
  const data = scheduleData[name] || {};
  let worked = 0, night = 0, extra = 0, holiday = 0, workDays = 0;

  days.forEach(day => {
    const raw = String(data[String(day)] || data[day] || '').trim();
    const v = normalizeShiftCode(raw);
    const metrics = getShiftMetrics(raw, day);
    worked += metrics.worked;
    night += metrics.night;
    extra += metrics.extra;
    holiday += metrics.holiday;
    if (raw && v !== 'İ' && v !== 'R' && v !== 'ÜY') workDays++;
  });

  const dailyReq = getDailyRequired(type);
  const eligibleDays = days.filter(d => !isWeekend(d) && !isHoliday(d)).length;
  const required = Math.round(eligibleDays * dailyReq);

  return { worked: roundHours(worked), night: roundHours(night), extra: roundHours(extra), holiday: roundHours(holiday), required, workDays };
}

export function getAllDays() {
  return Array.from({ length: getDaysInMonth() }, (_, i) => i + 1);
}

export function countWorkDays(days) {
  return days.filter(d => !isWeekend(d) && !isHoliday(d)).length;
}

export function t(key, values) {
  return window.miniappI18n?.t(key, values) ?? desktopTranslate(key, values);
}

export function setLocale(code) {
  if (window.miniappI18n?.setLocale) {
    window.miniappI18n.setLocale(code);
  } else {
    setDesktopLocale(code);
  }
}

export function getLocale() {
  return window.miniappI18n?.getContext?.().resolvedLocale || getDesktopLocale();
}

export { initDesktopI18n };

export const ROLES = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer'
};

export const ROLE_LABELS = {
  admin: 'Yönetici',
  editor: 'Editör',
  viewer: 'Sadece Görüntüleme'
};

export function formatDate(date) {
  return new Intl.DateTimeFormat('tr-TR').format(date);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
