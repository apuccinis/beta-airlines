import type { Db } from '../db/Db';
import type { Contexto } from '../contexto';
import { claveValorEnMemoria, pendientesEnMemoria } from '../contexto';
import { azarConSemilla, barajar, digitos, elegir, entero, ponderado } from '../dominio/azar';
import { RelojFijo, aFecha, aFechaHora, diasEntre, inicioDelDia, sumarDias, sumarMinutos } from '../dominio/fechas';
import { codigoReserva, formatoId, generadores, insertar, numeroFactura, siguienteId } from '../dominio/ids';
import { configuracionCabina, duracionMinutos, filaDeSilla, liquidar, nivelPorSaldo, tarifa, ETAPAS, type Clase } from '../dominio/reglas';
import { MillasService } from '../servicios/MillasService';
import { EquipajeService } from '../servicios/EquipajeService';
import { CheckinService } from '../servicios/CheckinService';
import { EmbarqueService } from '../servicios/EmbarqueService';
import { MantenimientoService } from '../servicios/MantenimientoService';
import { OperacionesService } from '../servicios/OperacionesService';
import {
  AERONAVES, APELLIDOS, CANALES_CHECKIN_PESO, CANALES_RESERVA_PESO, CASOS, CIUDADES, CLASES_PESO, CUENTAS, DEPARTAMENTOS,
  DIAS_PROGRAMACION, DOMINIOS_CORREO, MANTENIMIENTOS, NOMBRES, PARES, PLANTA, RESIDENCIAS, TIPOS_EQUIPO,
} from './catalogos';

export interface ResumenSeed {
  ahora: string;
  filas: Record<string, number>;
  cuentas: { rol: string; nombre: string; documento: string; email?: string; cargo?: string }[];
}

export interface OpcionesSeed {
  /** Momento de referencia ("hoy"). Las fechas del seed son relativas a este instante. */
  ahora?: Date;
  semilla?: number;
}

interface RutaSeed {
  id: string;
  o: string;
  d: string;
  millas: number;
  tipo: string;
  pi: number;
  dir: 0 | 1;
  frecuencias: number;
  mensual: number;
}

interface VueloSeed {
  id: string;
  r: RutaSeed;
  numero: string;
  salida: Date;
  llegada: Date;
  nave: string;
  cap: number;
  pasajeros: Set<string>;
  sillas: Set<string>;
  tiempos: Date[]; // momento de cada una de las 8 etapas
}

interface TiqueteSeed {
  id: string;
  cliente: string;
  clase: Clase;
  reserva: string;
  fechaReserva: Date;
}

const AREA: Record<string, string> = { ATL: '404', JFK: '212', LAX: '310', ORD: '312', MIA: '305', SEA: '206', BOS: '617', DFW: '214' };
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Llena una base operacional vacía con datos realistas y deterministas (semilla fija).
 * Historia desde el 1 de enero del año en curso hasta ayer y programación de los próximos DIAS_PROGRAMACION días.
 * Los vuelos de los últimos 10 días (y los de hoy que ya salieron) pasan por el pipeline operacional
 * real (OperacionesService), con el reloj fijado en el momento de cada etapa.
 */
export function sembrar(db: Db, opciones: OpcionesSeed = {}): ResumenSeed {
  const ahora = opciones.ahora ?? new Date();
  const reloj = new RelojFijo(ahora);
  const azar = azarConSemilla(opciones.semilla ?? 20261015);
  const ctx: Contexto = { db, reloj, azar, pendientes: pendientesEnMemoria(), kv: claveValorEnMemoria() };
  const millasSrv = new MillasService(ctx);
  const equipaje = new EquipajeService(ctx);
  const checkin = new CheckinService(ctx, equipaje);
  const mantenimiento = new MantenimientoService(ctx);
  const ops = new OperacionesService(ctx, new EmbarqueService(ctx), equipaje, millasSrv, mantenimiento);

  const ri = (a: number, b: number) => entero(azar, a, b);
  const pick = <T>(arr: readonly T[]) => elegir(azar, arr);
  const I = (t: string, f: Record<string, string | number | null>) => insertar(db, t, f);
  const hoy = inicioDelDia(ahora);
  const inicio = new Date(hoy.getFullYear(), 0, 1);
  const fh = aFechaHora;

  db.transaction(() => {
    // ---------- ciudades y aeropuertos ----------
    const aero: Record<string, { id: string; ciudad: string; pais: string; nombreCiudad: string }> = {};
    CIUDADES.forEach((c, i) => {
      const idC = formatoId('Ciudad', i + 1);
      const idA = formatoId('Aeropuerto', i + 1);
      I('Ciudad', { IdCiudad: idC, Nombre: c.ciudad, EstadoRegion: c.region, Pais: c.pais });
      I('Aeropuerto', { IdAeropuerto: idA, CodigoIATA: c.iata, Nombre: c.aeropuerto, IdCiudad: idC });
      aero[c.iata] = { id: idA, ciudad: idC, pais: c.pais, nombreCiudad: c.ciudad };
    });

    DEPARTAMENTOS.forEach((n, i) => I('Departamento', { IdDepartamento: formatoId('Departamento', i + 1), Nombre: n }));

    // ---------- empleados ----------
    const nombresUsados = new Set<string>(['Laura Gómez']);
    const combos = barajar(azar, NOMBRES.flatMap((n) => APELLIDOS.map((a) => [n, a] as const)));
    let ic = 0;
    const nombreNuevo = () => {
      let x = combos[ic++];
      while (nombresUsados.has(`${x[0]} ${x[1]}`)) x = combos[ic++];
      nombresUsados.add(`${x[0]} ${x[1]}`);
      return x;
    };
    const documentos = new Set<string>();
    const docNuevo = (n: number) => {
      let d = digitos(azar, n);
      while (documentos.has(d)) d = digitos(azar, n);
      documentos.add(d);
      return d;
    };
    const empleado = (cargo: string, depto: number, fijo?: { nombres: string; apellidos: string; documento: string }) => {
      const id = siguienteId(db, 'Empleado');
      const [nombres, apellidos] = fijo ? [fijo.nombres, fijo.apellidos] : nombreNuevo();
      if (fijo) {
        documentos.add(fijo.documento);
        nombresUsados.add(`${fijo.nombres} ${fijo.apellidos}`);
      }
      I('Empleado', {
        IdEmpleado: id,
        Documento: fijo?.documento ?? docNuevo(8),
        Nombres: nombres,
        Apellidos: apellidos,
        Cargo: cargo,
        FechaIngreso: aFecha(new Date(ri(2008, 2024), ri(0, 11), ri(1, 28))),
        IdDepartamento: formatoId('Departamento', depto),
      });
      return id;
    };
    for (const k of ['coordinador', 'agente', 'analista'] as const) empleado(CUENTAS[k].cargo, CUENTAS[k].depto, CUENTAS[k]);
    for (const p of PLANTA) for (let i = 0; i < p.n; i++) empleado(p.cargo, p.depto);

    // ---------- flota y equipos ----------
    const capacidad: Record<string, number> = {};
    AERONAVES.forEach((a, i) => {
      const id = formatoId('Aeronave', i + 1);
      capacidad[id] = a.capacidad;
      I('Aeronave', { IdAeronave: id, Matricula: a.matricula, Modelo: a.modelo, CapacidadPasajeros: a.capacidad, Estado: 'En servicio' });
    });
    for (const iata of ['ATL', 'JFK', 'LAX', 'ORD', 'MIA']) {
      TIPOS_EQUIPO.forEach((t, k) =>
        I('Equipo', {
          IdEquipo: siguienteId(db, 'Equipo'),
          Tipo: t,
          Descripcion: `${t} · Terminal ${['Sur', 'Norte', 'Internacional'][k % 3]} de ${iata}`,
          Estado: azar() < 0.12 ? 'En mantenimiento' : 'Disponible',
          IdAeropuerto: aero[iata].id,
        }),
      );
    }

    // ---------- clientes y Skymiles ----------
    const clientes: string[] = [];
    const laura = siguienteId(db, 'Cliente');
    const L = CUENTAS.pasajera;
    documentos.add(L.documento);
    I('Cliente', {
      IdCliente: laura, Documento: L.documento, Nombres: L.nombres, Apellidos: L.apellidos, Email: L.email,
      Telefono: L.telefono, FechaNacimiento: L.nacimiento, IdCiudad: aero.ATL.ciudad,
    });
    clientes.push(laura);
    const correos = new Set<string>([L.email]);
    for (let i = 0; i < 59; i++) {
      const [n, a] = nombreNuevo();
      const res = ponderado(azar, RESIDENCIAS);
      let email = `${sinTildes(n)}.${sinTildes(a)}@${pick(DOMINIOS_CORREO)}`;
      if (correos.has(email)) email = email.replace('@', `${ri(10, 99)}@`);
      correos.add(email);
      const tel =
        azar() < 0.1 ? null
        : AREA[res] ? `+1 ${AREA[res]} 555 ${digitos(azar, 4)}`
        : res === 'BOG' ? `+57 3${ri(10, 23)} ${digitos(azar, 3)} ${digitos(azar, 4)}`
        : res === 'MEX' ? `+52 55 ${digitos(azar, 4)} ${digitos(azar, 4)}`
        : res === 'LHR' ? `+44 20 ${digitos(azar, 4)} ${digitos(azar, 4)}`
        : `+34 6${ri(10, 99)} ${digitos(azar, 3)} ${digitos(azar, 3)}`;
      const id = siguienteId(db, 'Cliente');
      I('Cliente', {
        IdCliente: id,
        Documento: docNuevo(['BOG'].includes(res) ? 10 : 9),
        Nombres: n,
        Apellidos: a,
        Email: email,
        Telefono: tel,
        FechaNacimiento: aFecha(new Date(ri(1958, 2004), ri(0, 11), ri(1, 28))),
        IdCiudad: aero[res].ciudad,
      });
      clientes.push(id);
    }
    const otrosClientes = clientes.slice(1);

    const cuenta: Record<string, string> = {};
    const socios = new Set<string>();
    const afiliados = new Set([laura, ...barajar(azar, otrosClientes).slice(0, Math.round(otrosClientes.length * 0.7))]);
    clientes.forEach((c, i) => {
      if (!afiliados.has(c)) return;
      const id = siguienteId(db, 'CuentaMillas');
      let socio = generadores.numeroSocio(azar);
      while (socios.has(socio)) socio = generadores.numeroSocio(azar);
      socios.add(socio);
      I('CuentaMillas', {
        IdCuentaMillas: id,
        NumeroSocio: socio,
        Nivel: 'Azul',
        SaldoMillas: 0,
        FechaAfiliacion: i === 0 ? '2016-03-08' : aFecha(new Date(ri(2014, hoy.getFullYear() - 1), ri(0, 11), ri(1, 28))),
        IdCliente: c,
      });
      cuenta[c] = id;
    });

    // ---------- rutas ----------
    const rutas: RutaSeed[] = [];
    PARES.forEach((p, pi) => {
      const tipo = aero[p.o].pais === aero[p.d].pais ? 'Nacional' : 'Internacional';
      ([[p.o, p.d, 0], [p.d, p.o, 1]] as const).forEach(([o, d, dir]) => {
        const id = siguienteId(db, 'Ruta');
        I('Ruta', { IdRuta: id, IdAeropuertoOrigen: aero[o].id, IdAeropuertoDestino: aero[d].id, DistanciaMillas: p.millas, TipoRuta: tipo });
        rutas.push({ id, o, d, millas: p.millas, tipo, pi, dir, frecuencias: p.frecuencias, mensual: p.mensual });
      });
    });

    // ---------- vuelos ----------
    const naves = (n: number[]) => n.map((x) => formatoId('Aeronave', x));
    const naveDe = (r: RutaSeed) =>
      r.millas > 3000 ? pick(naves([7, 8])) : r.millas > 1800 ? pick(naves([3, 4, 5])) : r.millas < 700 ? pick(naves([6, 1, 2])) : pick(naves([1, 2, 3, 4]));
    // Salidas repartidas en el día: transatlánticas hacia Europa en la tarde y de regreso en la mañana;
    // con dos frecuencias, una en la mañana y otra en la tarde; con una, entre las 6:00 y las 21:00.
    const horaSalida = (r: RutaSeed, f: number): [number, number] => {
      const minutos = ((r.pi * 7 + r.dir * 3 + f) % 4) * 15;
      if (r.millas > 3000) return [r.dir === 0 ? 16 + ((r.pi * 3) % 6) : 8 + (r.pi % 5), minutos];
      if (r.frecuencias > 1) return [[6, 13][f] + ((r.pi + r.dir * 2) % 5), minutos];
      return [6 + ((r.pi * 7 + r.dir * 5) % 16), minutos];
    };
    const tiemposEtapas = (salida: Date, llegada: Date): Date[] => {
      const x = azar();
      const demora = x < 0.7 ? ri(-3, 5) : x < 0.92 ? ri(6, 25) : ri(26, 70);
      const despegue = sumarMinutos(salida, demora);
      const aterrizaje = sumarMinutos(llegada, demora + ri(-12, 8));
      return [
        sumarMinutos(salida, -180 + ri(0, 20)),
        sumarMinutos(salida, -90 + ri(0, 10)),
        sumarMinutos(salida, -40 + ri(0, 5)),
        despegue,
        sumarMinutos(despegue, 25),
        aterrizaje,
        sumarMinutos(aterrizaje, ri(12, 20)),
        sumarMinutos(aterrizaje, ri(40, 55)),
      ];
    };
    const crearVuelo = (r: RutaSeed, f: number, dia: Date, historico: boolean): VueloSeed => {
      const [h, m] = horaSalida(r, f);
      const salida = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m);
      const llegada = sumarMinutos(salida, duracionMinutos(r.millas));
      const nave = naveDe(r);
      const tiempos = tiemposEtapas(salida, llegada);
      const id = siguienteId(db, 'Vuelo');
      I('Vuelo', {
        IdVuelo: id,
        NumeroVuelo: `BA${100 + r.pi * 10 + f * 2 + r.dir + 1}`,
        SalidaProgramada: fh(salida),
        LlegadaProgramada: fh(llegada),
        SalidaReal: historico ? fh(tiempos[3]) : null,
        LlegadaReal: historico ? fh(tiempos[5]) : null,
        Puerta: historico ? `${pick(['A', 'B', 'C', 'D', 'E'])}${ri(1, 36)}` : null,
        Estado: historico ? 'Finalizado' : 'Programado',
        IdRuta: r.id,
        IdAeronave: nave,
      });
      return { id, r, numero: '', salida, llegada, nave, cap: capacidad[nave], pasajeros: new Set(), sillas: new Set(), tiempos };
    };

    const sillaLibre = (v: VueloSeed, clase: Clase) => {
      const cab = configuracionCabina(v.cap);
      const libres = cab.sillas.filter((s) => !v.sillas.has(s));
      const deClase = libres.filter((s) => cab.claseDeFila(filaDeSilla(s)) === clase);
      const s = pick(deClase.length ? deClase : libres);
      v.sillas.add(s);
      return s;
    };

    // ---------- reservas, tiquetes, factura y pago ----------
    const codigos = new Set<string>();
    const numerosTiquete = new Set<string>();
    const etiquetas = new Set<string>();
    const unico = (set: Set<string>, gen: () => string) => {
      let v = gen();
      while (set.has(v)) v = gen();
      set.add(v);
      return v;
    };
    const medioPago = () => {
      const marca = ponderado(azar, [['Visa', 55], ['Mastercard', 35], ['American Express', 10]] as const);
      return `${marca} ${digitos(azar, 4)}`;
    };

    type Modo = 'historico' | 'activo';
    const reservar = (v: VueloSeed, n: number, modo: Modo, forzado?: { cliente: string; pax: number; canal: string; clase?: Clase }) => {
      const tiquetes: TiqueteSeed[] = [];
      for (let k = 0; k < n; k++) {
        const f = k === 0 ? forzado : undefined;

        // Fecha de reserva uniforme entre 45 (o 28) días antes del vuelo y el momento de corte.
        // Las que caerían antes del 1 de enero pertenecen al año anterior y no se crean, así enero no se infla.
        const hasta = new Date(Math.min(sumarMinutos(ahora, -10).getTime(), sumarMinutos(v.salida, -180).getTime()));
        let desde = sumarDias(v.salida, -(modo === 'historico' ? 45 : 28));
        if (f && desde < inicio) desde = inicio;
        let fr = new Date(desde.getTime() + azar() * Math.max(0, hasta.getTime() - desde.getTime()));
        if (fr < inicio) {
          if (!f) continue;
          fr = sumarMinutos(inicio, ri(60, 600));
        }

        const candidatos = otrosClientes.filter((c) => !v.pasajeros.has(c));
        const titular = f?.cliente ?? pick(candidatos);
        let pax = f?.pax ?? ponderado(azar, [[1, 55], [2, 35], [3, 10]] as const);
        const vendidos = v.pasajeros.size;
        if (vendidos + pax > v.cap) break;
        const grupo = [titular];
        v.pasajeros.add(titular);
        while (grupo.length < pax) {
          const libres = otrosClientes.filter((c) => !v.pasajeros.has(c));
          if (!libres.length) break;
          const c = pick(libres);
          grupo.push(c);
          v.pasajeros.add(c);
        }
        pax = grupo.length;

        const cancelada = modo === 'historico' && !f && azar() < 0.05;
        const id = siguienteId(db, 'Reserva');
        I('Reserva', {
          IdReserva: id,
          CodigoReserva: unico(codigos, () => codigoReserva(azar)),
          FechaReserva: fh(fr),
          Canal: f?.canal ?? ponderado(azar, CANALES_RESERVA_PESO),
          NumeroPasajeros: pax,
          Estado: cancelada ? 'Cancelada' : modo === 'historico' ? 'Completada' : 'Confirmada',
          IdCliente: titular,
          IdVuelo: v.id,
        });
        if (cancelada) {
          grupo.forEach((c) => v.pasajeros.delete(c));
          continue;
        }

        const clase = f?.clase ?? ponderado(azar, CLASES_PESO);
        const unit = tarifa(v.r.millas, v.salida.getMonth(), clase);
        const liq = liquidar(unit, pax);
        let fe = sumarMinutos(fr, ri(3, 40));
        if (fe > ahora) fe = ahora;
        const idFactura = siguienteId(db, 'Factura');
        I('Factura', {
          IdFactura: idFactura, NumeroFactura: numeroFactura(idFactura), FechaEmision: fh(fe),
          Subtotal: liq.subtotal, Impuestos: liq.impuestos, Total: liq.total, IdReserva: id,
        });
        if (azar() < 0.03) {
          I('Pago', {
            IdPago: siguienteId(db, 'Pago'), FechaPago: fh(sumarMinutos(fe, -4)), Valor: liq.total, MedioPago: medioPago(),
            Estado: 'Rechazado', Referencia: generadores.referenciaPago(azar), IdFactura: idFactura,
          });
        }
        I('Pago', {
          IdPago: siguienteId(db, 'Pago'), FechaPago: fh(fe), Valor: liq.total, MedioPago: medioPago(),
          Estado: 'Aprobado', Referencia: generadores.referenciaPago(azar), IdFactura: idFactura,
        });
        for (const c of grupo) {
          const tq = siguienteId(db, 'Tiquete');
          I('Tiquete', {
            IdTiquete: tq,
            NumeroTiquete: unico(numerosTiquete, () => generadores.numeroTiquete(azar)),
            FechaEmision: fh(fe),
            Clase: clase,
            Asiento: null,
            Valor: unit,
            Estado: 'Emitido',
            IdReserva: id,
            IdCliente: c,
          });
          tiquetes.push({ id: tq, cliente: c, clase, reserva: id, fechaReserva: fe });
        }
      }
      return tiquetes;
    };

    /** Vuelos ya cerrados hace más de 10 días: se insertan directamente con su historia completa (sin eventos). */
    const completarHistorico = (v: VueloSeed, tiquetes: TiqueteSeed[]) => {
      const [, , , despegue, , aterrizaje] = v.tiempos;
      const puerta = db.get<{ Puerta: string }>(`SELECT Puerta FROM Vuelo WHERE IdVuelo = ?`, [v.id])!.Puerta;
      for (const t of tiquetes) {
        if (azar() < 0.03) continue; // no se presentó: el tiquete queda Emitido
        const asiento = sillaLibre(v, t.clase);
        const canal = ponderado(azar, CANALES_CHECKIN_PESO);
        let hc = sumarMinutos(v.salida, -ri(60, 60 * 22));
        if (hc <= t.fechaReserva) hc = sumarMinutos(t.fechaReserva, 20);
        I('Checkin', {
          IdCheckin: siguienteId(db, 'Checkin'), FechaHora: fh(hc), Canal: canal, PuertaEmbarque: puerta,
          FechaEmbarque: fh(sumarMinutos(despegue, -ri(15, 35))), IdTiquete: t.id,
        });
        db.run(`UPDATE Tiquete SET Asiento = ?, Estado = 'Volado' WHERE IdTiquete = ?`, [asiento, t.id]);
        const nMaletas = ponderado(azar, [[0, 45], [1, 45], [2, 10]] as const);
        for (let m = 0; m < nMaletas; m++) {
          const ej = siguienteId(db, 'Equipaje');
          I('Equipaje', {
            IdEquipaje: ej, CodigoEtiqueta: unico(etiquetas, () => generadores.etiqueta(azar)),
            PesoKg: Math.round((10 + azar() * 13) * 10) / 10, Estado: 'Entregada', IdTiquete: t.id,
          });
          const puntos: [string, string, Date, string][] = [
            [`Documentada en ${canal === 'Kiosko' ? 'kiosko' : canal === 'Mostrador' ? 'mostrador' : canal === 'App' ? 'app' : 'web'}`, 'Documentada', sumarMinutos(hc, 1), v.r.o],
            ['Cargada en bodega', 'En bodega', sumarMinutos(despegue, -30), v.r.o],
            ['Descargada', 'Descargada', sumarMinutos(aterrizaje, 12), v.r.d],
            ['Lista en banda de entrega', 'En banda', sumarMinutos(aterrizaje, 22), v.r.d],
            ['Entregada al pasajero', 'Entregada', sumarMinutos(aterrizaje, ri(28, 45)), v.r.d],
          ];
          for (const [punto, estado, cuando, ap] of puntos) {
            I('RastreoEquipaje', {
              IdRastreo: siguienteId(db, 'RastreoEquipaje'), FechaHora: fh(cuando), PuntoControl: punto,
              Estado: estado, IdEquipaje: ej, IdAeropuerto: aero[ap].id,
            });
          }
        }
        if (cuenta[t.cliente]) {
          I('MovimientoMillas', {
            IdMovimiento: siguienteId(db, 'MovimientoMillas'), Fecha: fh(aterrizaje), Tipo: 'Acumulacion',
            Millas: v.r.millas, IdCuentaMillas: cuenta[t.cliente], IdTiquete: t.id,
          });
        }
      }
    };

    /** Vuelos recientes o de hoy: check-in y etapas a través de los servicios, con el reloj en cada momento. */
    const operar = (v: VueloSeed, tiquetes: TiqueteSeed[], entregarMaletas: boolean) => {
      const etapas = v.tiempos.filter((t) => t <= ahora).length;
      if (etapas >= 3) {
        for (const t of tiquetes) {
          if (azar() < 0.04) continue;
          let hc = sumarMinutos(v.salida, -ri(60, 60 * 22));
          if (hc <= t.fechaReserva) hc = sumarMinutos(t.fechaReserva, 20);
          if (hc >= v.tiempos[2]) hc = sumarMinutos(v.tiempos[2], -15);
          reloj.fijar(hc);
          const nMaletas = ponderado(azar, [[0, 45], [1, 45], [2, 10]] as const);
          const pesos = Array.from({ length: nMaletas }, () => Math.round((10 + azar() * 13) * 10) / 10);
          checkin.hacer(null, t.id, { asiento: sillaLibre(v, t.clase), maletas: pesos, canal: ponderado(azar, CANALES_CHECKIN_PESO) });
        }
      }
      for (let k = 0; k < etapas; k++) {
        reloj.fijar(v.tiempos[k]);
        ops.registrarEtapa(v.id, null);
      }
      if (entregarMaletas && etapas === ETAPAS.length) {
        const cuando = sumarMinutos(v.tiempos[6], ri(15, 30));
        for (const m of equipaje.maletasDeVuelo(v.id)) {
          equipaje.registrarPunto(m.IdEquipaje, 'Entregada al pasajero', 'Entregada', aero[v.r.d].id, cuando);
          db.run(`UPDATE Equipaje SET Estado = 'Entregada' WHERE IdEquipaje = ?`, [m.IdEquipaje]);
        }
      }
      reloj.fijar(ahora);
    };

    // Historia: `mensual` vuelos al mes por ruta y sentido (3 en las troncales), desde el 1 de enero hasta ayer
    const recientes = sumarDias(hoy, -10);
    const lauraMes = new Set<string>();
    const rutasLaura = [0, 3, 10]; // ATL–JFK, ATL–MIA, ATL–BOG
    for (let d = new Date(inicio); d < hoy; d = sumarDias(d, 1)) {
      for (const r of rutas) {
        if ((d.getDate() + r.pi * 3 + r.dir) % Math.round(30 / r.mensual) !== 0) continue;
        const historico = d < recientes;
        const v = crearVuelo(r, d.getDate() % r.frecuencias, d, historico);
        let forzado: Parameters<typeof reservar>[3];
        const claveMes = `${r.id}-${d.getMonth()}`;
        if (rutasLaura.includes(r.pi) && (d.getMonth() + r.dir + r.pi) % 3 === 0 && !lauraMes.has(claveMes) && historico) {
          lauraMes.add(claveMes);
          forzado = { cliente: laura, pax: azar() < 0.7 ? 1 : 2, canal: pick(['Web', 'App']), clase: azar() < 0.8 ? 'Económica' : 'Premium' };
        }
        const tiquetes = reservar(v, ri(2, 5), historico ? 'historico' : 'activo', forzado);
        if (historico) completarHistorico(v, tiquetes);
        else operar(v, tiquetes, true);
      }
    }

    // Programación de los próximos DIAS_PROGRAMACION días (incluye hoy). Rutas de más de 3.000 millas: día por medio.
    // Las reservas se concentran en los vuelos cercanos: las troncales se llenan más que el resto,
    // y los vuelos a más de 4 semanas todavía no tienen reservas.
    const reservasPrevias = (r: RutaSeed, k: number) => {
      if (k >= 28) return 0;
      if (r.mensual >= 3) return k < 3 ? ri(0, 2) : k < 10 ? ri(0, 1) : azar() < 0.15 ? 1 : 0;
      return azar() < (k < 3 ? 0.3 : 0.06) ? 1 : 0;
    };
    for (let k = 0; k < DIAS_PROGRAMACION; k++) {
      const dia = sumarDias(hoy, k);
      for (const r of rutas) {
        if (r.millas > 3000 && k % 2 === 1) continue;
        for (let f = 0; f < r.frecuencias; f++) {
          const v = crearVuelo(r, f, dia, false);
          const forzado =
            k === 1 && r.o === 'ATL' && r.d === 'JFK' && f === r.frecuencias - 1
              ? { cliente: laura, pax: 1, canal: 'App', clase: 'Económica' as Clase }
              : undefined;
          const tiquetes = reservar(v, Math.max(forzado ? 1 : 0, reservasPrevias(r, k)), 'activo', forzado);
          if (k === 0) operar(v, tiquetes, false);
        }
      }
    }

    // ---------- saldos de millas y niveles ----------
    // Cada socio termina con un saldo objetivo según una distribución de niveles realista:
    // si voló menos, trae saldo de años anteriores; si voló más, hizo canjes de millas (Redencion) durante el año.
    const RANGOS: Record<string, [number, number]> = {
      Azul: [1500, 11500], Plata: [12500, 29000], Oro: [30500, 58000], Platino: [60500, 84000],
    };
    const diasAnio = Math.max(2, diasEntre(inicio, hoy));
    for (const [cliente, idCuenta] of Object.entries(cuenta)) {
      const acumulado = db.get<{ s: number }>(`SELECT COALESCE(SUM(Millas), 0) AS s FROM MovimientoMillas WHERE IdCuentaMillas = ?`, [idCuenta])!.s;
      const nivel = cliente === laura ? 'Oro' : ponderado(azar, [['Azul', 35], ['Plata', 30], ['Oro', 22], ['Platino', 13]] as const);
      const objetivo = cliente === laura ? 36800 + ri(0, 1200) : ri(...RANGOS[nivel]);
      const mov = (fecha: Date, tipo: string, millas: number) =>
        I('MovimientoMillas', {
          IdMovimiento: siguienteId(db, 'MovimientoMillas'), Fecha: fh(fecha), Tipo: tipo, Millas: millas, IdCuentaMillas: idCuenta, IdTiquete: null,
        });
      if (acumulado < objetivo) {
        mov(inicio, 'Saldo inicial', objetivo - acumulado);
      } else {
        let porCanjear = acumulado - objetivo;
        while (porCanjear > 0) {
          const canje = Math.min(porCanjear, ri(10, 40) * 1000);
          porCanjear -= canje;
          const f = sumarDias(inicio, ri(Math.floor(diasAnio * 0.25), diasAnio - 1));
          f.setHours(ri(8, 22), ri(0, 59));
          mov(f, 'Redencion', -canje);
        }
      }
      db.run(`UPDATE CuentaMillas SET SaldoMillas = ?, Nivel = ? WHERE IdCuentaMillas = ?`, [objetivo, nivelPorSaldo(objetivo), idCuenta]);
    }

    // ---------- mantenimientos históricos ----------
    const tecnicos = db.all<{ IdEmpleado: string }>(`SELECT IdEmpleado FROM Empleado WHERE Cargo = 'Técnico de mantenimiento'`).map((e) => e.IdEmpleado);
    const diasHistoria = Math.max(2, diasEntre(inicio, hoy) - 1);
    for (let i = 0; i < 14; i++) {
      const m = pick(MANTENIMIENTOS);
      const ini = sumarDias(inicio, ri(0, diasHistoria - 1));
      ini.setHours(ri(0, 5), pick([0, 15, 30, 45]));
      I('Mantenimiento', {
        IdMantenimiento: siguienteId(db, 'Mantenimiento'),
        FechaInicio: fh(ini),
        FechaFin: fh(sumarMinutos(ini, ri(m.horas[0], m.horas[1]) * 60)),
        Tipo: m.tipo,
        Descripcion: m.descripcion,
        Estado: 'Completado',
        IdAeronave: formatoId('Aeronave', (i % AERONAVES.length) + 1),
        IdEmpleado: pick(tecnicos),
      });
    }

    // ---------- casos de servicio al cliente ----------
    const agentes = db.all<{ IdEmpleado: string }>(`SELECT IdEmpleado FROM Empleado WHERE Cargo = 'Agente de servicio al cliente'`).map((e) => e.IdEmpleado);
    const tipos = Object.keys(CASOS);
    const casos: { fecha: Date; tipo: string; estado: string; cliente: string }[] = [];
    for (let i = 0; i < 16; i++) {
      const fecha = sumarDias(hoy, -(i < 6 ? ri(0, 4) : ri(5, 120)));
      fecha.setHours(ri(7, 21), ri(0, 59));
      if (fecha > ahora) fecha.setTime(sumarMinutos(ahora, -ri(20, 300)).getTime());
      casos.push({
        fecha,
        tipo: i === 0 ? 'Equipaje demorado' : i === 6 ? 'Solicitud de asistencia' : tipos[i % tipos.length],
        estado: i < 4 ? 'Abierto' : i < 6 ? 'En atención' : 'Cerrado',
        cliente: i === 6 || i === 3 ? laura : pick(otrosClientes),
      });
    }
    casos.sort((a, z) => a.fecha.getTime() - z.fecha.getTime());
    for (const c of casos) {
      I('CasoServicio', {
        IdCaso: siguienteId(db, 'CasoServicio'),
        FechaApertura: fh(c.fecha),
        FechaCierre: c.estado === 'Cerrado' ? fh(sumarMinutos(c.fecha, ri(3, 96) * 60)) : null,
        Tipo: c.tipo,
        Canal: pick(['Web', 'App', 'Call center', 'Mostrador']),
        Descripcion: pick(CASOS[c.tipo]),
        Estado: c.estado,
        IdCliente: c.cliente,
        IdEmpleado: c.estado === 'Abierto' ? null : pick(agentes),
      });
    }
  });

  const tablas = db.all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).map((t) => t.name);
  const filas = Object.fromEntries(tablas.map((t) => [t, db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)!.n]));
  const L = CUENTAS.pasajera;
  return {
    ahora: aFechaHora(ahora),
    filas,
    cuentas: [
      { rol: 'Pasajera (Skymiles Oro)', nombre: `${L.nombres} ${L.apellidos}`, documento: L.documento, email: L.email },
      { rol: 'Operaciones', nombre: `${CUENTAS.coordinador.nombres} ${CUENTAS.coordinador.apellidos}`, documento: CUENTAS.coordinador.documento, cargo: CUENTAS.coordinador.cargo },
      { rol: 'Servicio al cliente', nombre: `${CUENTAS.agente.nombres} ${CUENTAS.agente.apellidos}`, documento: CUENTAS.agente.documento, cargo: CUENTAS.agente.cargo },
      { rol: 'Analítica', nombre: `${CUENTAS.analista.nombres} ${CUENTAS.analista.apellidos}`, documento: CUENTAS.analista.documento, cargo: CUENTAS.analista.cargo },
    ],
  };
}
