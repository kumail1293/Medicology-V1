import { Flashcard, ReviewLog } from "./types";

const DB_NAME = "medicology_flashcards";
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("cards")) {
        db.createObjectStore("cards", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("logs")) {
        db.createObjectStore("logs", { keyPath: "id" });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

function txGet<T>(store: "cards" | "logs"): Promise<T[]> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  }));
}

function txPutAll<T>(store: "cards" | "logs", items: T[]): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    os.clear();
    items.forEach(item => os.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function txPut<T>(store: "cards" | "logs", item: T): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

function txDelete(store: "cards" | "logs", id: string): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

function txCount(store: "cards" | "logs"): Promise<number> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

/* ── Public card API ───────────────────────────────────────────────── */

export async function dbLoadCards(): Promise<Flashcard[]> {
  return txGet<Flashcard>("cards");
}

export async function dbSaveCards(cards: Flashcard[]): Promise<void> {
  return txPutAll("cards", cards);
}

export async function dbUpsertCard(card: Flashcard): Promise<void> {
  return txPut("cards", card);
}

export async function dbDeleteCard(id: string): Promise<void> {
  return txDelete("cards", id);
}

/* ── Public log API ────────────────────────────────────────────────── */

export async function dbLoadLogs(): Promise<ReviewLog[]> {
  return txGet<ReviewLog>("logs");
}

export async function dbAppendLog(log: ReviewLog): Promise<void> {
  return txPut("logs", log);
}

export async function dbTrimLogs(maxCount = 10000): Promise<void> {
  const count = await txCount("logs");
  if (count <= maxCount) return;
  const all = await txGet<ReviewLog>("logs");
  all.sort((a, b) => a.time - b.time);
  await txPutAll("logs", all.slice(all.length - maxCount));
}

/* ── Migrate from localStorage to IndexedDB ────────────────────────── */
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    const cardCount = await txCount("cards");
    if (cardCount > 0) return;

    const raw = localStorage.getItem("medi_fc_cards_v2");
    if (!raw) return;
    const cards = JSON.parse(raw) as Flashcard[];
    if (cards.length > 0) {
      await dbSaveCards(cards);
      localStorage.removeItem("medi_fc_cards_v2");
    }
  } catch { /* ignore migration errors */ }

  try {
    const logCount = await txCount("logs");
    if (logCount > 0) return;

    const raw = localStorage.getItem("medi_fc_logs_v2");
    if (!raw) return;
    const logs = JSON.parse(raw) as ReviewLog[];
    if (logs.length > 0) {
      await txPutAll("logs", logs);
      localStorage.removeItem("medi_fc_logs_v2");
    }
  } catch { /* ignore */ }
}
