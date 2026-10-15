import { DbBase, type Param, type Row } from './Db';
import { traducirErrorSqlite } from '../errores';

/** Forma mínima de un Database de sql.js. Tipado estructural para no depender del navegador en core/. */
export interface SqlJsDatabaseLike {
  run(sql: string, params?: any[]): unknown;
  exec(sql: string): unknown;
  prepare(sql: string): {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, any>;
    reset(): void;
    free(): boolean;
  };
  getRowsModified(): number;
  export(): Uint8Array;
  close(): void;
}

/** Adaptador del navegador: envuelve una base de sql.js (SQLite compilado a WebAssembly). */
export class SqlJsDb extends DbBase {
  private cache = new Map<string, ReturnType<SqlJsDatabaseLike['prepare']>>();
  /** Se llama después de cada escritura; LocalClient lo usa para guardar en IndexedDB. */
  onCambio: (() => void) | null = null;

  constructor(readonly base: SqlJsDatabaseLike) {
    super();
    base.exec('PRAGMA foreign_keys = ON');
  }

  private stmt(sql: string) {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.base.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  run(sql: string, params: Param[] = []) {
    const s = this.stmt(sql);
    try {
      s.bind(params);
      s.step();
      const changes = this.base.getRowsModified();
      this.onCambio?.();
      return { changes };
    } catch (e) {
      throw traducirErrorSqlite(e);
    } finally {
      s.reset();
    }
  }

  all<T = Row>(sql: string, params: Param[] = []): T[] {
    const s = this.stmt(sql);
    try {
      s.bind(params);
      const out: T[] = [];
      while (s.step()) out.push(s.getAsObject() as T);
      return out;
    } catch (e) {
      throw traducirErrorSqlite(e);
    } finally {
      s.reset();
    }
  }

  get<T = Row>(sql: string, params: Param[] = []): T | undefined {
    return this.all<T>(sql, params)[0];
  }

  exec(sql: string) {
    try {
      this.base.exec(sql);
    } catch (e) {
      throw traducirErrorSqlite(e);
    }
  }

  /**
   * Exporta la base como bytes. sql.js cierra y reabre la conexión al exportar: libera los statements
   * preparados y restablece los PRAGMA, así que se limpia la caché y se reactivan las FK.
   */
  exportar(): Uint8Array {
    this.cache.clear();
    const bytes = this.base.export();
    this.base.exec('PRAGMA foreign_keys = ON');
    return bytes;
  }

  close() {
    for (const s of this.cache.values()) s.free();
    this.cache.clear();
    this.base.close();
  }
}
