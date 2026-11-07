import type { LibraryEntry, SlotKind } from '@/assets/library';

/**
 * Player-provided GLB files (Asset Lab). Stored in IndexedDB so they survive reloads and
 * work in the published game without rebuilding. Licence fields are mandatory.
 */
export interface UserAssetRecord {
  slot: string;
  kind: SlotKind;
  name: string;
  buffer: ArrayBuffer;
  license: { author: string; license: string; source: string };
  addedAt: number;
  /** extra yaw in degrees so the model's front faces +Z */
  rotate?: number;
}

const DB = 'uzbek-life-assets';
const STORE = 'glb';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'slot' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export const UserAssets = {
  async list(): Promise<UserAssetRecord[]> {
    try {
      return await tx('readonly', (s) => s.getAll() as IDBRequest<UserAssetRecord[]>);
    } catch {
      return [];
    }
  },
  async put(rec: UserAssetRecord) {
    await tx('readwrite', (s) => s.put(rec));
  },
  async remove(slot: string) {
    await tx('readwrite', (s) => s.delete(slot));
  },
  toEntry(r: UserAssetRecord): LibraryEntry & { buffer: ArrayBuffer } {
    return { slot: r.slot, kind: r.kind, name: r.name, url: '', license: r.license, origin: 'user', buffer: r.buffer };
  },
};
