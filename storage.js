const hasStorage = () => typeof window !== 'undefined' && window.miniappsAI?.storage;

export async function saveState(data, storageKey) {
  const key = storageKey || 'puantaj_data';
  try {
    if (hasStorage()) {
      await window.miniappsAI.storage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (e) {
    console.error('Save failed:', e);
  }
}

export async function loadState(storageKey) {
  const key = storageKey || 'puantaj_data';
  try {
    let raw;
    if (hasStorage()) {
      raw = await window.miniappsAI.storage.getItem(key);
    } else {
      raw = localStorage.getItem(key);
    }
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Load failed:', e);
    return null;
  }
}
