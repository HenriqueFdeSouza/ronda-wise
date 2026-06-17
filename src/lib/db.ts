import { openDB, type IDBPDatabase } from "idb";
import type { Round, StoredPhoto } from "./types";

const DB_NAME = "rondacheck";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB only available in browser");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("rounds")) {
          const s = db.createObjectStore("rounds", { keyPath: "id" });
          s.createIndex("by_hotel_user", ["hotel_id", "user_id"]);
          s.createIndex("by_status", "status");
        }
        if (!db.objectStoreNames.contains("photos")) {
          const p = db.createObjectStore("photos", { keyPath: "id" });
          p.createIndex("by_round", "round_id");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise;
}

export async function putRound(r: Round) {
  const db = await getDb();
  await db.put("rounds", r);
}

export async function getRound(id: string): Promise<Round | undefined> {
  const db = await getDb();
  return db.get("rounds", id);
}

export async function getAllRounds(): Promise<Round[]> {
  const db = await getDb();
  return db.getAll("rounds");
}

export async function getInProgressRound(hotel_id: string, user_id: string) {
  const all = await getAllRounds();
  return all.find(
    (r) => r.hotel_id === hotel_id && r.user_id === user_id && r.status === "em_andamento",
  );
}

export async function getRoundsForUser(hotel_id: string, user_id: string) {
  const all = await getAllRounds();
  return all
    .filter((r) => r.hotel_id === hotel_id && r.user_id === user_id)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export async function putPhoto(p: StoredPhoto) {
  const db = await getDb();
  await db.put("photos", p);
}

export async function getPhotosByRound(round_id: string): Promise<StoredPhoto[]> {
  const db = await getDb();
  return db.getAllFromIndex("photos", "by_round", round_id);
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  const db = await getDb();
  return db.get("photos", id);
}

export async function deletePhoto(id: string) {
  const db = await getDb();
  await db.delete("photos", id);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get("meta", key);
}

export async function setMeta<T>(key: string, value: T) {
  const db = await getDb();
  await db.put("meta", value, key);
}
