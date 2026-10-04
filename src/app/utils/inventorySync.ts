import { DraftCollision, type DraftStore } from './inventoryDraftStore.ts';
class LocalPersistenceError extends Error {}
export type SaveState = 'saving-local' | 'local' | 'pending' | 'syncing' | 'server' | 'attention';
export interface PendingWrite { id: string; expected: number; rows: any[]; generation: number; prepared?: boolean; occurredAt?: string }
export interface InventoryDraft {
  monthId: string; section: string; rows: any[]; generation: number; acknowledged: number;
  captureStartedAt?: string; changedAt?: string; revision: number; operation?: PendingWrite; version: number;
}
export interface SyncState { state: SaveState; message?: string; localSaved: boolean; revision?: number }
export interface SyncReply { success: boolean; error?: string; status?: number; code?: string; revision?: number; data?: any; summary?: any }
export interface SyncDependencies {
  store: DraftStore;
  send(draft: InventoryDraft, operation: PendingWrite): Promise<SyncReply>;
  preparePhotos(rows: any[], draft: InventoryDraft): Promise<any[]>;
  ready(): boolean;
  unavailableReason?: string;
  online(): boolean;
  notify(section: string, state: SyncState, rows?: any[]): void;
  now?: () => number;
  uuid?: () => string;
}
// Keep display/configuration metadata that is not a stored entry column. The
// server's ids, readings, nulls and calculated values always take precedence.
function confirmedRows(before: any[], value: any): any[] {
  const rows = Array.isArray(value) ? value : value ? [value] : before;
  return rows.map(row => {
    const key = Object.keys(row).find(key => key.endsWith('_config_id') && row[key]);
    const previous = key ? before.find(item => item[key] === row[key]) : before.length === 1 ? before[0] : undefined;
    return { ...previous, ...row, _isNew: !row.id || String(row.id).startsWith('temp_') };
  });
}
// One durable queue per user/plant/month. Writes are serialized per section;
// edits during a request remain a later generation and never change its body.
export class InventorySync {
  readonly drafts = new Map<string, InventoryDraft>();
  private commits = new Map<string, Promise<void>>();
  private writes = new Map<string, Promise<void>>();
  private flights = new Map<string, Promise<SyncReply>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private firstDirty = new Map<string, number>();
  private attempts = new Map<string, number>();
  private blocked = new Set<string>();
  private stopped = false;
  readonly scope: string;
  private dependencies: SyncDependencies;
  constructor(scope: string, dependencies: SyncDependencies) { this.scope = scope; this.dependencies = dependencies; }
  private key(section: string) { return `draft:${this.scope}:${section}`; }
  private signal(section: string, state: SaveState, message?: string, rows?: any[]) {
    if (this.stopped) return;
    const d = this.drafts.get(section);
    this.dependencies.notify(section, { state, message, localSaved: !!d?.version && state !== 'saving-local', revision: d?.revision }, rows);
  }
  async restore(monthId: string, section: string, rows: any[], revision: number, status: string, fresh = true): Promise<any[]> {
    const saved = await this.dependencies.store.get(this.key(section));
    const pending = saved && (saved.generation > saved.acknowledged || saved.operation);
    const draft: InventoryDraft = saved || { monthId, section, rows: structuredClone(rows), generation: 0, acknowledged: 0, revision, version: 0 };
    if (draft.monthId !== monthId) throw new Error('El inventario local pertenece a otro identificador. Revisa el borrador antes de continuar.');
    if (!pending && (fresh || !saved)) { draft.rows = structuredClone(rows); draft.revision = revision; }
    this.drafts.set(section, draft);
    if (pending && status !== 'IN_PROGRESS') {
      this.blocked.add(section); this.signal(section, 'attention', 'El inventario fue enviado o aprobado. Tu borrador permanece en este dispositivo.');
    } else if (pending && fresh && !draft.operation && draft.revision !== revision) {
      this.blocked.add(section); this.signal(section, 'attention', 'Otra sesión guardó datos diferentes. Revisa ambos borradores antes de continuar.');
    } else if (pending) { this.signal(section, 'local'); this.schedule(section); }
    else this.signal(section, 'server');
    return structuredClone(pending || (!fresh && saved) ? draft.rows : rows);
  }
  change(section: string, rows: any[], recordActivity = true) {
    const draft = this.drafts.get(section);
    if (!draft || this.stopped) return;
    draft.rows = structuredClone(rows); draft.generation++;
    draft.changedAt = new Date(this.dependencies.now?.() ?? Date.now()).toISOString();
    if (recordActivity) draft.captureStartedAt ||= draft.changedAt;
    this.signal(section, 'saving-local');
    const prior = this.writes.get(section) || Promise.resolve();
    const write = prior.then(async () => {
      await this.persist(section);
      this.signal(section, this.blocked.has(section) ? 'attention' : 'local', this.blocked.has(section) ? 'Revisa el conflicto antes de sincronizar.' : undefined);
      this.schedule(section);
    }).catch(error => {
      this.blocked.add(section);
      // Never claim local protection after a quota/transaction failure.
      this.dependencies.notify(section, { state: 'attention', localSaved: false, message: error.message || 'No se pudo guardar en este dispositivo. Exporta tus datos antes de salir.' });
    });
    this.writes.set(section, write);
  }
  private persist(section: string): Promise<void> {
    const prior = this.commits.get(section) || Promise.resolve();
    const commit = prior.catch(() => {}).then(async () => {
      const draft = this.drafts.get(section)!;
      try { draft.version = await this.dependencies.store.put(this.key(section), structuredClone(draft), draft.version); }
      catch (error: any) { throw new LocalPersistenceError(error.message || 'No se pudo guardar en este dispositivo.'); }
    });
    this.commits.set(section, commit); return commit;
  }
  private schedule(section: string, delay?: number) {
    if (this.stopped || this.blocked.has(section)) return;
    clearTimeout(this.timers.get(section));
    const now = this.dependencies.now?.() ?? Date.now();
    if (!this.firstDirty.has(section)) this.firstDirty.set(section, now);
    const wait = delay ?? Math.min(2000, Math.max(0, 10000 - (now - this.firstDirty.get(section)!)));
    this.timers.set(section, setTimeout(() => { void this.flush(section); }, wait));
  }
  flush(section: string): Promise<SyncReply> {
    if (this.flights.has(section)) return this.flights.get(section)!;
    const task = this.sync(section).finally(() => { this.flights.delete(section); });
    this.flights.set(section, task); return task;
  }
  private async sync(section: string): Promise<SyncReply> {
    clearTimeout(this.timers.get(section));
    await this.writes.get(section);
    const draft = this.drafts.get(section);
    if (!draft || this.stopped) return { success: false, error: 'Selecciona el inventario de nuevo.' };
    if (this.blocked.has(section)) return { success: false, error: 'Revisa el problema del borrador antes de guardar.' };
    if (!this.dependencies.ready()) { this.signal(section, 'attention', this.dependencies.unavailableReason || 'Inicia sesión nuevamente con el mismo usuario para sincronizar.'); return { success: false, status: 401, error: this.dependencies.unavailableReason || 'Inicia sesión con el mismo usuario para sincronizar.' }; }
    if (!this.dependencies.online()) { this.signal(section, 'pending', 'Guardado en este dispositivo. Pendiente de conexión.'); return { success: false, error: 'Sin conexión; borrador conservado en este dispositivo.' }; }
    let response: SyncReply = { success: true };
    try {
      while (draft.generation > draft.acknowledged || draft.operation) {
        if (this.stopped || !this.dependencies.ready()) return { success: false, status: 401 };
        this.signal(section, 'syncing');
        if (!draft.operation) {
          draft.operation = { id: this.dependencies.uuid?.() ?? crypto.randomUUID(), expected: draft.revision,
            rows: structuredClone(draft.rows), generation: draft.generation, occurredAt: draft.changedAt };
          await this.persist(section); // Durable operation exists before any network write.
        }
        const operation = draft.operation;
        if (!operation.prepared) {
          operation.rows = await this.dependencies.preparePhotos(operation.rows, draft);
          operation.prepared = true;
          await this.persist(section);
        }
        if (this.stopped || !this.dependencies.ready()) return { success: false, status: 401 };
        response = await this.dependencies.send(draft, operation);
        if (!response.success) {
          if (response.status === 401) { this.signal(section, 'attention', 'La sesión venció. Inicia sesión con el mismo usuario; el borrador está conservado.'); return response; }
          if ([400,403,404,409,422].includes(response.status || 0)) {
            this.blocked.add(section); this.signal(section, 'attention', response.error || 'Revisa el inventario antes de continuar.'); return response;
          }
          throw new Error(response.error || 'No se pudo confirmar el guardado.');
        }
        if (!Number.isSafeInteger(response.revision) || response.revision! <= operation.expected) {
          this.blocked.add(section); this.signal(section, 'attention', 'El servidor no confirmó una revisión válida. Conserva el borrador y actualiza la aplicación.');
          return { success:false, error:'El servidor no confirmó una revisión válida.' };
        }
        draft.revision = response.revision!; draft.acknowledged = operation.generation; draft.operation = undefined;
        // A response cannot erase edits made while the request was in flight.
        if (draft.generation === operation.generation) draft.rows = structuredClone(confirmedRows(operation.rows, response.data));
        await this.persist(section);
        this.attempts.delete(section); this.firstDirty.delete(section);
        if (draft.generation === draft.acknowledged) this.signal(section, 'server', undefined, draft.rows);
      }
      return response;
    } catch (error: any) {
      if (error.status === 401) { this.signal(section, 'attention', 'La sesión venció. Inicia sesión con el mismo usuario; el borrador sigue conservado.'); return {success:false,status:401,error:error.message}; }
      if ([400,403,404,409,422].includes(error.status)) { this.blocked.add(section); this.signal(section, 'attention', error.message); return {success:false,status:error.status,error:error.message}; }
      if (error instanceof LocalPersistenceError || error instanceof DraftCollision || /quota|storage|almacenamiento/i.test(error.name + error.message)) {
        this.blocked.add(section); this.dependencies.notify(section, { state: 'attention', localSaved: false, message: error.message });
      } else {
        this.signal(section, 'pending', 'Borrador conservado. No se pudo confirmar el servidor; se reintentará.');
        const attempts = (this.attempts.get(section) || 0) + 1; this.attempts.set(section, attempts);
        this.schedule(section, Math.min(60000, 2000 * 2 ** Math.min(attempts,5)));
      }
      return { success: false, error: error.message };
    }
  }
  resume() { for (const [section,draft] of this.drafts) if (draft.generation > draft.acknowledged || draft.operation) this.schedule(section, 0); }
  async flushAll() {
    const results = await Promise.all([...this.drafts.keys()].map(section => this.flush(section)));
    return results.every(result => result.success) && [...this.drafts.values()].every(d => d.generation === d.acknowledged && !d.operation);
  }
  async resolve(section: string, serverRows: any[], revision: number, keepLocal: boolean) {
    await this.writes.get(section); await this.flights.get(section);
    const draft = this.drafts.get(section)!;
    // Restore is required for a cross-tab storage collision; do not overwrite it.
    const stored = await this.dependencies.store.get(this.key(section));
    if ((stored?.version || 0) !== draft.version) throw new DraftCollision('Otra pestaña cambió el borrador. Exporta tus cambios y vuelve a abrir el inventario.');
    draft.operation = undefined; draft.revision = revision;
    if (!keepLocal) { draft.rows = structuredClone(confirmedRows(draft.rows, serverRows)); draft.acknowledged = draft.generation; }
    await this.persist(section); this.blocked.delete(section);
    this.signal(section, keepLocal ? 'local' : 'server', undefined, draft.rows);
    if (keepLocal) this.schedule(section,0);
  }
  hasPending() { return [...this.drafts.values()].some(d => d.generation > d.acknowledged || d.operation); }
  stop() { this.stopped = true; for (const timer of this.timers.values()) clearTimeout(timer); }
}
