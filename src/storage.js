const KEY = 'hex-drop:progress';

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cleared: [] };
    const obj = JSON.parse(raw);
    return { cleared: Array.isArray(obj.cleared) ? obj.cleared : [] };
  } catch {
    return { cleared: [] };
  }
}

export function markCleared(stageId) {
  const p = loadProgress();
  if (!p.cleared.includes(stageId)) {
    p.cleared.push(stageId);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      // localStorage が無効でもゲームは続行可能にする
    }
  }
}
