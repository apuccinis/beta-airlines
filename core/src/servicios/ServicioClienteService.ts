import type { Contexto } from '../contexto';
import type { Caso, NuevoCaso } from '../api/tipos';
import { ErrorNegocio, noEncontrado } from '../errores';
import { insertar, siguienteId } from '../dominio/ids';
import { TIPOS_CASO } from '../dominio/reglas';
import { aFechaHora } from '../dominio/fechas';

const SQL = `
  SELECT cs.*, c.Nombres AS CN, c.Apellidos AS CA, c.Documento AS CD, e.Nombres AS EN, e.Apellidos AS EA
  FROM CasoServicio cs JOIN Cliente c ON c.IdCliente = cs.IdCliente
  LEFT JOIN Empleado e ON e.IdEmpleado = cs.IdEmpleado`;

const aCaso = (x: any): Caso => ({
  idCaso: x.IdCaso,
  tipo: x.Tipo,
  canal: x.Canal,
  descripcion: x.Descripcion,
  estado: x.Estado,
  apertura: x.FechaApertura,
  cierre: x.FechaCierre,
  cliente: `${x.CN} ${x.CA}`,
  documentoCliente: x.CD,
  agente: x.EN ? `${x.EN} ${x.EA}` : null,
});

/** Solicitudes de servicio al cliente (CasoServicio). */
export class ServicioClienteService {
  constructor(private ctx: Contexto) {}

  casosDeCliente(idCliente: string): Caso[] {
    return this.ctx.db.all(`${SQL} WHERE cs.IdCliente = ? ORDER BY cs.FechaApertura DESC`, [idCliente]).map(aCaso);
  }

  abrir(idCliente: string, n: NuevoCaso, canal = 'Web'): Caso {
    if (!(TIPOS_CASO as readonly string[]).includes(n?.tipo)) throw new ErrorNegocio('Elige el tipo de solicitud.');
    const descripcion = String(n.descripcion ?? '').trim();
    if (descripcion.length < 10) throw new ErrorNegocio('Cuéntanos un poco más (mínimo 10 caracteres).');
    if (descripcion.length > 200) throw new ErrorNegocio('La descripción admite hasta 200 caracteres.');
    const id = siguienteId(this.ctx.db, 'CasoServicio');
    insertar(this.ctx.db, 'CasoServicio', {
      IdCaso: id,
      FechaApertura: aFechaHora(this.ctx.reloj.ahora()),
      FechaCierre: null,
      Tipo: n.tipo,
      Canal: canal,
      Descripcion: descripcion,
      Estado: 'Abierto',
      IdCliente: idCliente,
      IdEmpleado: null,
    });
    return this.caso(id);
  }

  caso(id: string): Caso {
    const x = this.ctx.db.get(`${SQL} WHERE cs.IdCaso = ?`, [id]);
    if (!x) throw noEncontrado('el caso');
    return aCaso(x);
  }

  bandeja(estado?: string): Caso[] {
    const filtro = estado ? 'WHERE cs.Estado = ?' : '';
    return this.ctx.db
      .all(
        `${SQL} ${filtro}
         ORDER BY CASE cs.Estado WHEN 'Abierto' THEN 0 WHEN 'En atención' THEN 1 ELSE 2 END, cs.FechaApertura DESC`,
        estado ? [estado] : [],
      )
      .map(aCaso);
  }

  atender(idCaso: string, idEmpleado: string): Caso {
    const c = this.caso(idCaso);
    if (c.estado !== 'Abierto') throw new ErrorNegocio('Este caso ya está siendo atendido o está cerrado.', 409);
    this.ctx.db.run(`UPDATE CasoServicio SET Estado = 'En atención', IdEmpleado = ? WHERE IdCaso = ?`, [idEmpleado, idCaso]);
    return this.caso(idCaso);
  }

  cerrar(idCaso: string, idEmpleado: string): Caso {
    const c = this.caso(idCaso);
    if (c.estado === 'Cerrado') throw new ErrorNegocio('Este caso ya está cerrado.', 409);
    this.ctx.db.run(
      `UPDATE CasoServicio SET Estado = 'Cerrado', FechaCierre = ?, IdEmpleado = COALESCE(IdEmpleado, ?) WHERE IdCaso = ?`,
      [aFechaHora(this.ctx.reloj.ahora()), idEmpleado, idCaso],
    );
    return this.caso(idCaso);
  }
}
