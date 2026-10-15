import type { Contexto } from '../contexto';
import type { Actor, PerfilCliente, PerfilEmpleado, Registro } from '../api/tipos';
import { ErrorNegocio } from '../errores';
import { insertar, siguienteId } from '../dominio/ids';
import { SECCIONES_POR_CARGO } from '../dominio/reglas';
import { aFecha } from '../dominio/fechas';
import type { MillasService } from './MillasService';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const normalizarDoc = (d: string) => String(d ?? '').replace(/[\s.\-]/g, '');

/**
 * Autenticación sin contraseñas (el modelo no las tiene):
 * pasajeros con número de documento + correo, empleados con número de documento.
 * La firma de la sesión (JWT) la hace el servidor; aquí solo se validan las credenciales.
 */
export class AuthService {
  constructor(
    private ctx: Contexto,
    private millas: MillasService,
  ) {}

  ingresarCliente(documento: string, email: string): PerfilCliente {
    const doc = normalizarDoc(documento);
    const c = this.ctx.db.get<{ IdCliente: string; Email: string }>(
      `SELECT IdCliente, Email FROM Cliente WHERE Documento = ?`,
      [doc],
    );
    if (!c || c.Email.toLowerCase() !== String(email ?? '').trim().toLowerCase()) {
      throw new ErrorNegocio('El documento o el correo no coinciden con nuestros registros.', 401);
    }
    return this.perfilCliente(c.IdCliente);
  }

  registrar(r: Registro): PerfilCliente {
    const doc = normalizarDoc(r.documento);
    const email = String(r.email ?? '').trim().toLowerCase();
    if (!/^[A-Za-z0-9]{5,15}$/.test(doc)) throw new ErrorNegocio('Escribe un número de documento válido (5 a 15 caracteres).');
    if (!r.nombres?.trim() || !r.apellidos?.trim()) throw new ErrorNegocio('Escribe tus nombres y apellidos.');
    if (!EMAIL.test(email)) throw new ErrorNegocio('Escribe un correo electrónico válido.');
    const ciudad = this.ctx.db.get<{ IdCiudad: string }>(`SELECT IdCiudad FROM Aeropuerto WHERE CodigoIATA = ?`, [r.ciudad]);
    if (!ciudad) throw new ErrorNegocio('Elige tu ciudad de residencia.');

    return this.ctx.db.transaction(() => {
      const existente = this.ctx.db.get<{ IdCliente: string; Email: string }>(
        `SELECT IdCliente, Email FROM Cliente WHERE Documento = ?`,
        [doc],
      );
      if (existente) {
        throw new ErrorNegocio('Ya existe una cuenta con ese documento. Inicia sesión con tu documento y correo.', 409);
      }
      const id = siguienteId(this.ctx.db, 'Cliente');
      insertar(this.ctx.db, 'Cliente', {
        IdCliente: id,
        Documento: doc,
        Nombres: r.nombres.trim().slice(0, 40),
        Apellidos: r.apellidos.trim().slice(0, 40),
        Email: email,
        Telefono: r.telefono?.trim() || null,
        FechaNacimiento: r.fechaNacimiento || null,
        IdCiudad: ciudad.IdCiudad,
      });
      if (r.afiliarSkymiles) this.millas.afiliar(id);
      return this.perfilCliente(id);
    });
  }

  ingresarEmpleado(documento: string): PerfilEmpleado {
    const e = this.ctx.db.get<{ IdEmpleado: string; Cargo: string }>(
      `SELECT IdEmpleado, Cargo FROM Empleado WHERE Documento = ?`,
      [normalizarDoc(documento)],
    );
    if (!e) throw new ErrorNegocio('No encontramos un empleado con ese documento.', 401);
    if (!SECCIONES_POR_CARGO[e.Cargo]) {
      throw new ErrorNegocio('Tu cargo no tiene acceso al portal de operaciones.', 403);
    }
    return this.perfilEmpleado(e.IdEmpleado);
  }

  perfilCliente(id: string): PerfilCliente {
    const c = this.ctx.db.get<any>(
      `SELECT c.*, ci.Nombre AS Ciudad, cm.NumeroSocio, cm.Nivel, cm.SaldoMillas
       FROM Cliente c JOIN Ciudad ci ON ci.IdCiudad = c.IdCiudad
       LEFT JOIN CuentaMillas cm ON cm.IdCliente = c.IdCliente
       WHERE c.IdCliente = ?`,
      [id],
    );
    if (!c) throw new ErrorNegocio('Tu sesión ya no es válida. Vuelve a iniciar sesión.', 401);
    return {
      tipo: 'cliente',
      id: c.IdCliente,
      nombres: c.Nombres,
      apellidos: c.Apellidos,
      email: c.Email,
      documento: c.Documento,
      ciudad: c.Ciudad,
      socio: c.NumeroSocio ? { numero: c.NumeroSocio, nivel: c.Nivel, saldo: c.SaldoMillas } : null,
    };
  }

  perfilEmpleado(id: string): PerfilEmpleado {
    const e = this.ctx.db.get<any>(
      `SELECT e.*, d.Nombre AS Departamento FROM Empleado e
       JOIN Departamento d ON d.IdDepartamento = e.IdDepartamento WHERE e.IdEmpleado = ?`,
      [id],
    );
    if (!e) throw new ErrorNegocio('Tu sesión ya no es válida. Vuelve a iniciar sesión.', 401);
    return {
      tipo: 'empleado',
      id: e.IdEmpleado,
      nombres: e.Nombres,
      apellidos: e.Apellidos,
      cargo: e.Cargo,
      departamento: e.Departamento,
      secciones: SECCIONES_POR_CARGO[e.Cargo] ?? [],
    };
  }

  perfil(actor: Actor) {
    return actor.tipo === 'cliente' ? this.perfilCliente(actor.id) : this.perfilEmpleado(actor.id);
  }

  exigirCliente(actor: Actor | null): string {
    if (!actor || actor.tipo !== 'cliente') throw new ErrorNegocio('Inicia sesión para continuar.', 401);
    this.perfilCliente(actor.id);
    return actor.id;
  }

  exigirSeccion(actor: Actor | null, seccion: string): string {
    if (!actor || actor.tipo !== 'empleado') throw new ErrorNegocio('Inicia sesión con tu cuenta de empleado.', 401);
    const p = this.perfilEmpleado(actor.id);
    if (!p.secciones.includes(seccion)) throw new ErrorNegocio('Tu cargo no tiene acceso a esta sección.', 403);
    return actor.id;
  }

  exigirEmpleado(actor: Actor | null): string {
    if (!actor || actor.tipo !== 'empleado') throw new ErrorNegocio('Inicia sesión con tu cuenta de empleado.', 401);
    this.perfilEmpleado(actor.id);
    return actor.id;
  }

  hoy() {
    return aFecha(this.ctx.reloj.ahora());
  }
}
