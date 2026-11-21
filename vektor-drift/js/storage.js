// Highscore-Speicherung via localStorage (fehlertolerant, z. B. im privaten Modus)

const KEY = 'vektordrift.highscores.v1';
const NAME_KEY = 'vektordrift.lastname';
const MAX = 10;

export function loadHighscores() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(data)) {
      return data
        .filter((e) => e && typeof e.score === 'number' && typeof e.name === 'string')
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX);
    }
  } catch { /* ignorieren */ }
  return [];
}

function saveHighscores(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignorieren */ }
}

export function qualifies(list, score) {
  return score > 0 && (list.length < MAX || score > list[list.length - 1].score);
}

/** Fügt einen Eintrag ein und liefert dessen Index (Platz) zurück. */
export function insertHighscore(list, name, score, level) {
  const entry = {
    name: (name || '???').toUpperCase().slice(0, 10),
    score,
    level,
    date: new Date().toISOString().slice(0, 10),
  };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX);
  saveHighscores(list);
  return list.indexOf(entry);
}

export function loadLastName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
export function saveLastName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignorieren */ }
}

export function loadPref(key, fallback) {
  try {
    const v = localStorage.getItem('vektordrift.' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
export function savePref(key, value) {
  try { localStorage.setItem('vektordrift.' + key, JSON.stringify(value)); } catch { /* ignorieren */ }
}
