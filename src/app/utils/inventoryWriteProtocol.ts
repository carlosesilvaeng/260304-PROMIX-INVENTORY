// Memory-only protocol for manual saves. No offline queue or automatic saving.
export class InventoryWriteProtocol {
  private identity = '';
  private revisions = new Map<string, number>();
  private pending = new Map<string, { signature: string; expected_revision: number; operation_id: string }>();
  private uuid: () => string;
  constructor(uuid: () => string = () => crypto.randomUUID()) { this.uuid = uuid; }
  setIdentity(identity: string) {
    if (identity !== this.identity) { this.identity = identity; this.revisions.clear(); this.pending.clear(); }
  }
  observe(monthId: string, revisions: Record<string, number>) {
    for (const [section, revision] of Object.entries(revisions)) {
      const key = `${monthId}:${section}`;
      if (this.pending.get(key)?.expected_revision !== Number(revision)) this.pending.delete(key);
      this.revisions.set(key, Number(revision));
    }
  }
  prepare(monthId: string, section: string, body: unknown) {
    const key = `${monthId}:${section}`;
    if (!this.revisions.has(key)) throw new Error('Vuelve a cargar el inventario antes de guardar. Tus cambios permanecen en pantalla.');
    const signature = JSON.stringify(body);
    const prior = this.pending.get(key);
    if (prior?.signature === signature) return { expected_revision: prior.expected_revision, operation_id: prior.operation_id };
    const next = { signature, expected_revision: this.revisions.get(key)!, operation_id: this.uuid() };
    this.pending.set(key, next);
    return { expected_revision: next.expected_revision, operation_id: next.operation_id };
  }
  confirm(monthId: string, section: string, operationId: string, revision: number) {
    const key = `${monthId}:${section}`;
    if (this.pending.get(key)?.operation_id !== operationId) return;
    this.revisions.set(key, revision); this.pending.delete(key);
  }
}
