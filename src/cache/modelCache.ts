// Offline-mode PoC: caches MediaPipe model asset bytes in IndexedDB so
// repeat/offline loads don't need to re-fetch them from the CDN. Scope is
// deliberately narrow — this only covers the model files, which have an
// official modelAssetBuffer API. The WASM runtime files are a separate,
// murkier problem (see README) and aren't cached here.

const DB_NAME = 'mediapipe-model-cache'
const DB_VERSION = 1
const STORE_NAME = 'models'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function getCachedModel(url: string): Promise<Uint8Array | null> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const store = db
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
        const request = store.get(url)
        request.onsuccess = () => {
          const result = request.result as ArrayBuffer | undefined
          resolve(result ? new Uint8Array(result) : null)
        }
        request.onerror = () => reject(request.error)
      }),
  )
}

function cacheModel(url: string, bytes: Uint8Array): Promise<void> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        // Store a plain ArrayBuffer slice — structured-clone friendly, and
        // independent of whatever view/offset the caller's Uint8Array has.
        tx.objectStore(STORE_NAME).put(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
          url,
        )
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

/**
 * Returns a model asset's bytes, preferring a cached IndexedDB copy over the
 * network. On a cache miss, fetches from `url`, caches the result for next
 * time (including for offline use), then returns it.
 */
export async function getOrFetchModelBuffer(url: string): Promise<Uint8Array> {
  try {
    const cached = await getCachedModel(url)
    if (cached) {
      console.info('[modelCache] serving from IndexedDB cache:', url)
      return cached
    }
  } catch (err) {
    console.info(
      '[modelCache] IndexedDB read failed, falling back to network',
      err,
    )
  }

  console.info('[modelCache] fetching from network:', url)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch model asset: ${url} (${response.status})`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())

  try {
    await cacheModel(url, bytes)
  } catch (err) {
    console.info('[modelCache] failed to write to IndexedDB cache', err)
  }

  return bytes
}
