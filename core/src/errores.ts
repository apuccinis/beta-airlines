/** Error de negocio con un mensaje apto para mostrar al usuario y un código HTTP sugerido. */
export class ErrorNegocio extends Error {
  constructor(
    message: string,
    readonly codigo: 400 | 401 | 403 | 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = 'ErrorNegocio';
  }
}

export const noEncontrado = (que: string) => new ErrorNegocio(`No encontramos ${que}.`, 404);

/** Convierte las violaciones de restricciones de SQLite en errores de negocio claros. */
export function traducirErrorSqlite(e: unknown): unknown {
  if (e instanceof ErrorNegocio) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('FOREIGN KEY constraint failed')) {
    return new ErrorNegocio('La operación hace referencia a un registro que no existe o que todavía está en uso.', 409);
  }
  if (msg.includes('UNIQUE constraint failed')) {
    const campo = msg.split('UNIQUE constraint failed:')[1]?.trim() ?? '';
    return new ErrorNegocio(`Ya existe un registro con ese valor (${campo}).`, 409);
  }
  if (msg.includes('NOT NULL constraint failed')) {
    const campo = msg.split('NOT NULL constraint failed:')[1]?.trim() ?? '';
    return new ErrorNegocio(`Falta un dato obligatorio (${campo}).`, 422);
  }
  return e;
}
