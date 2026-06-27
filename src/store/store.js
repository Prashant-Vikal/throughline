import { SEED } from '../data/seed.js';

const KEY = 'throughline.db.v1';

const clone = (x) => JSON.parse(JSON.stringify(x));

// Per-visitor sandbox: a visitor's edits live in their own browser only.
export function loadDb() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // Corrupt or unavailable storage falls back to the pristine seed.
  }
  return clone(SEED);
}

export function saveDb(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (_) {
    // Storage full or blocked (e.g. private mode): the app still runs in-memory.
  }
}

export function resetDb() {
  try {
    localStorage.removeItem(KEY);
  } catch (_) {}
  return clone(SEED);
}

let n = Date.now();
export const newId = (prefix) => `${prefix}_${(n++).toString(36)}`;
