const hasStorage = () => typeof window !== 'undefined' && window.miniappsAI?.storage;

export async function saveState(data, storageKey) {
  const key = storageKey || 'puantaj_data';
  try {
    const serialized = JSON.stringify(data);
    if (hasStorage()) await window.miniappsAI.storage.setItem(key, serialized);
    else localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

export async function loadState(storageKey) {
  const key = storageKey || 'puantaj_data';
  try {
    const raw = hasStorage() ? await window.miniappsAI.storage.getItem(key) : localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
