// Durable browser drafts; keys always include environment and authenticated user.
export class DraftCollision extends Error {}
export interface DraftStore {
  get(key: string): Promise<any>;
  put(key: string, value: any, expectedVersion?: number): Promise<number>;
}
export class IndexedInventoryDraftStore implements DraftStore {
  private database?: Promise<IDBDatabase>;
  private open() {
    return this.database ||= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('promix-inventory-drafts-v2', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('records');
      request.onerror = () => { this.database = undefined; reject(request.error); };
      request.onblocked = () => { this.database = undefined; reject(new Error('Cierra otras pestañas para habilitar el almacenamiento de borradores.')); };
      request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); this.database = undefined; }; resolve(request.result); };
    });
  }
  async get(key: string) {
    const db = await this.open();
    return new Promise<any>((resolve, reject) => {
      const transaction = db.transaction('records', 'readonly');
      const request = transaction.objectStore('records').get(key);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  async put(key: string, value: any, expectedVersion?: number) {
    const db = await this.open();
    return new Promise<number>((resolve, reject) => {
      const transaction = db.transaction('records', 'readwrite');
      const store = transaction.objectStore('records');
      let version = 0; let failure: Error | null = null;
      const request = store.get(key);
      request.onsuccess = () => {
        const prior = request.result?.version || 0;
        if (expectedVersion !== undefined && expectedVersion !== prior) {
          failure = new DraftCollision('Otra pestaña modificó este borrador. Conserva tus datos y revisa la otra pestaña.');
          transaction.abort(); return;
        }
        version = prior + 1;
        store.put({ ...value, version }, key);
      };
      transaction.oncomplete = () => resolve(version);
      transaction.onerror = () => reject(failure || transaction.error);
      transaction.onabort = () => reject(failure || transaction.error);
    });
  }
}
export const inventoryDraftStore = new IndexedInventoryDraftStore();
export const inventoryScopeKey = (environment: string, userId: string, plantId: string, period: string) =>
  JSON.stringify([environment, userId, plantId, period]);
