/**
 * spool.js
 * IndexedDB-backed persistent spool for Digital-Twin telemetry frames.
 * Frames are written before upload and deleted only after cumulative server ack.
 */

const DB_NAME = "ecu-dt-spool";
const DB_VERSION = 1;
const STORE_NAME = "frames";

let _db = null;

async function _getDb() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("by_run", "run_id");
        store.createIndex("by_run_seq", ["run_id", "batch_seq"]);
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror  = () => reject(req.error);
  });
}

function _tx(mode) {
  return _db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function _req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(r.error);
  });
}

export const Spool = {
  async open() {
    await _getDb();
  },

  /**
   * Persist a frame before upload.
   * @param {string} runId
   * @param {string} ecuRunId
   * @param {number} batchSeq
   * @param {string} frameJson  Raw JSON string of the ECU telemetry frame
   */
  async push(runId, ecuRunId, batchSeq, frameJson) {
    const db = await _getDb();
    const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
    await _req(store.add({ run_id: runId, ecu_run_id: ecuRunId, batch_seq: batchSeq, frame_json: frameJson, spooled_at: Date.now() }));
  },

  /** Count pending (unacknowledged) frames for a run. */
  async countPending(runId) {
    const db = await _getDb();
    const index = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).index("by_run");
    return _req(index.count(IDBKeyRange.only(runId)));
  },

  /**
   * Fetch up to `limit` frames with batch_seq > afterSeq for a run, in ascending order.
   * @returns {Array<{id, batch_seq, ecu_run_id, frame_json}>}
   */
  async fetchChunk(runId, afterSeq, limit = 10) {
    const db = await _getDb();
    const index = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).index("by_run");
    return new Promise((resolve, reject) => {
      const results = [];
      const range = IDBKeyRange.only(runId);
      const req = index.openCursor(range, "next");
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor || results.length >= limit) { resolve(results); return; }
        if (cursor.value.batch_seq > afterSeq) {
          results.push(cursor.value);
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Delete all records with batch_seq <= throughSeq for a run.
   * Called after a cumulative server ack.
   */
  async deleteThrough(runId, throughSeq) {
    const db = await _getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const index = tx.objectStore(STORE_NAME).index("by_run");
      const req = index.openCursor(IDBKeyRange.only(runId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return; // tx.oncomplete fires when cursor exhausted
        if (cursor.value.batch_seq <= throughSeq) cursor.delete();
        cursor.continue();
      };
      req.onerror  = () => reject(req.error);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  },

  /** Delete ALL records for a run (on clean stop/end). */
  async clearRun(runId) {
    const db = await _getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const index = tx.objectStore(STORE_NAME).index("by_run");
      const req = index.openCursor(IDBKeyRange.only(runId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return; // tx.oncomplete fires when cursor exhausted
        cursor.delete();
        cursor.continue();
      };
      req.onerror  = () => reject(req.error);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  },

  /**
   * Find an active run persisted in the spool (for resume on page reload).
   * @returns {{run_id, ecu_run_id, max_batch_seq}|null}
   */
  async findActiveRun() {
    const db = await _getDb();
    return new Promise((resolve, reject) => {
      const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
      const req = store.openCursor(null, "prev"); // newest first
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { resolve(null); return; }
        resolve({
          run_id:       cursor.value.run_id,
          ecu_run_id:   cursor.value.ecu_run_id,
          max_batch_seq: cursor.value.batch_seq
        });
      };
      req.onerror = () => reject(req.error);
    });
  },
};
