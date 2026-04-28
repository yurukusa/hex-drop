const KEY = 'hex-drop:progress';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cleared: [], lastPlayed: 1 };
    const obj = JSON.parse(raw);
    return {
      cleared: Array.isArray(obj.cleared) ? obj.cleared.filter(n => Number.isInteger(n)) : [],
      lastPlayed: Number.isInteger(obj.lastPlayed) ? obj.lastPlayed : 1,
    };
  } catch {
    return { cleared: [], lastPlayed: 1 };
  }
}

function write(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // localStorage 無効でも続行
  }
}

export function loadProgress() {
  return read();
}

export function markCleared(stageNumber) {
  const p = read();
  if (!p.cleared.includes(stageNumber)) p.cleared.push(stageNumber);
  write(p);
}

export function setLastPlayed(stageNumber) {
  const p = read();
  p.lastPlayed = stageNumber;
  write(p);
}
