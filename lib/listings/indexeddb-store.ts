import {
  createMemoryListingStore,
  type CachedListing,
  type ListingCacheStore,
} from "./listing-cache";

export const CACHE_DB_NAME = "roomieslo-cache";
export const CACHE_DB_VERSION = 1;
const LISTINGS = "listings";
const META = "meta";
const OWNER_KEY = "owner";

type StoredRow = CachedListing & { id: string };

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // The cache can always be rebuilt from the server, so upgrades start clean
      // (Android uses fallbackToDestructiveMigration for the same reason).
      for (const name of Array.from(db.objectStoreNames))
        db.deleteObjectStore(name);
      db.createObjectStore(LISTINGS, { keyPath: "id" });
      db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Listing cache upgrade is blocked"));
  });
}

/** IndexedDB-backed listing cache store. */
export function createIndexedDbListingStore(
  factory: IDBFactory,
): ListingCacheStore {
  let database: Promise<IDBDatabase> | null = null;
  const db = () => (database ??= openDatabase(factory));

  async function write(stores: string[], work: (tx: IDBTransaction) => void) {
    const tx = (await db()).transaction(stores, "readwrite");
    work(tx);
    await done(tx);
  }

  return {
    async getAll() {
      const tx = (await db()).transaction(LISTINGS, "readonly");
      const rows = (await promisify(
        tx.objectStore(LISTINGS).getAll(),
      )) as StoredRow[];
      return rows.map(({ listing, lastSyncedAt }) => ({
        listing,
        lastSyncedAt,
      }));
    },
    putAll: (rows) =>
      write([LISTINGS], (tx) => {
        const store = tx.objectStore(LISTINGS);
        for (const row of rows)
          store.put({ id: row.listing.id, ...row } satisfies StoredRow);
      }),
    deleteIds: (ids) =>
      write([LISTINGS], (tx) => {
        const store = tx.objectStore(LISTINGS);
        for (const id of ids) store.delete(id);
      }),
    clear: () =>
      write([LISTINGS, META], (tx) => {
        tx.objectStore(LISTINGS).clear();
        tx.objectStore(META).clear();
      }),
    async getOwner() {
      const tx = (await db()).transaction(META, "readonly");
      const owner = await promisify(tx.objectStore(META).get(OWNER_KEY));
      return typeof owner === "string" ? owner : null;
    },
    setOwner: (userId) =>
      write([META], (tx) => {
        tx.objectStore(META).put(userId, OWNER_KEY);
      }),
  };
}

let browserStore: ListingCacheStore | null = null;

/**
 * The browser's listing cache. Falls back to memory when IndexedDB is
 * unavailable (private mode, server rendering), so callers never need to branch.
 */
export function getListingCacheStore(): ListingCacheStore {
  if (browserStore) return browserStore;
  const factory = typeof indexedDB === "undefined" ? null : indexedDB;
  browserStore = factory
    ? createIndexedDbListingStore(factory)
    : createMemoryListingStore();
  return browserStore;
}
