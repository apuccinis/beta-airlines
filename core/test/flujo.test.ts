import { beforeAll, describe, expect, it } from 'vitest';
import { CUENTAS, ErrorNegocio, aFecha, sumarDias, sumarMinutos, tarifa, type Actor } from '../src';
import { ADAPTADORES, AHORA, entorno } from './ayudas';

const MANANA = aFecha(sumarDias(AHORA, 1));
const TARJETA = { numero: '4111 1111 1111 1111', titular: 'LAURA GOMEZ', vencimiento: '08/29', cvv: '123' };

describe.each(ADAPTADORES)('flujo reserva → pago → check-in → 8 etapas → millas con $nombre', (adaptador) => {
  let e: Awaited<ReturnType<typeof entorno>>;
  let laura: Actor;
  let coordinador: Actor;

  beforeAll(async () => {
    e = await entorno(adaptador);
    laura = { tipo: 'cliente', id: e.api.ingresarCliente(CUENTAS.pasajera.documento, CUENTAS.pasajera.email).id };
    coordinador = { tipo: 'empleado', id: e.api.ingresarEmpleado(CUENTAS.coordinador.documento).id };
  }, 120_000);

  it('el seed deja datos completos y la pasajera de las cuentas de acceso', () => {
    const { filas } = e.resultado.seed;
    expect(filas.Cliente).toBe(60);
    expect(filas.Aeronave).toBe(8);
    expect(filas.Ruta).toBe(132);
    expect(filas.Departamento).toBe(10);
    expect(filas.CasoServicio).toBe(16);
    expect(filas.Empleado).toBeGreaterThanOrEqual(28);
    const p = e.api.perfil(laura);
    expect(p.tipo === 'cliente' && p.socio?.nivel).toBe('Oro');
    const viajes = e.api.misReservas(laura);
    const manana = viajes.proximas.find((r) => r.vuelo.salida.startsWith(MANANA) && r.vuelo.origen.codigo === 'ATL' && r.vuelo.destino.codigo === 'JFK');
    expect(manana?.estado).toBe('Confirmada');
    expect(manana?.tiquetes.every((t) => t.checkin === null)).toBe(true);
    expect(viajes.anteriores.length).toBeGreaterThan(5);
  });

  it('niega el acceso sin sesión y a cargos sin permiso', () => {
    expect(() => e.api.misReservas(null)).toThrow(ErrorNegocio);
    expect(() => e.api.tablero(laura)).toThrow(ErrorNegocio);
    const piloto = e.db.get<{ Documento: string }>(`SELECT Documento FROM Empleado WHERE Cargo = 'Capitán'`)!;
    expect(() => e.api.ingresarEmpleado(piloto.Documento)).toThrow(/no tiene acceso/);
  });

  it('completa el recorrido de punta a punta', () => {
    // búsqueda
    const busqueda = e.api.buscarVuelos({ origen: 'ATL', destino: 'JFK', fecha: MANANA, pasajeros: 2, clase: 'Económica' });
    expect(busqueda.vuelos.length).toBeGreaterThanOrEqual(1);
    const vuelo = busqueda.vuelos[0];
    expect(vuelo.precio).toBe(tarifa(760, 9, 'Económica'));
    const sillasAntes = vuelo.sillasDisponibles;

    // reserva con un acompañante nuevo (se crea como Cliente)
    const clientesAntes = e.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM Cliente')!.n;
    const reserva = e.api.crearReserva(laura, {
      idVuelo: vuelo.idVuelo,
      clase: 'Económica',
      acompanantes: [{ nombres: 'Martín', apellidos: 'Gómez Rivas', documento: '1020998877' }],
    });
    expect(reserva.estado).toBe('Pendiente de pago');
    expect(reserva.canal).toBe('Web');
    expect(reserva.codigo).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
    expect(e.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM Cliente')!.n).toBe(clientesAntes + 1);
    expect(reserva.liquidacion?.total).toBe(Math.round(vuelo.precio * 2 * 1.075 * 100) / 100);

    // la pasarela rechaza las tarjetas terminadas en 0000
    expect(() => e.api.pagar(laura, reserva.idReserva, { ...TARJETA, numero: '4000 1234 5678 0000' })).toThrow(/rechazó/);
    expect(e.api.reserva(laura, reserva.idReserva).estado).toBe('Pendiente de pago');

    // pago aprobado: factura, pago, tiquetes y reserva confirmada en una transacción
    const pagada = e.api.pagar(laura, reserva.idReserva, TARJETA);
    expect(pagada.estado).toBe('Confirmada');
    expect(pagada.tiquetes).toHaveLength(2);
    expect(pagada.tiquetes.every((t) => t.estado === 'Emitido' && /^777\d{10}$/.test(t.numero))).toBe(true);
    expect(pagada.factura?.numero).toMatch(/^FE-\d{8}$/);
    expect(pagada.factura?.subtotal).toBe(Math.round(vuelo.precio * 2 * 100) / 100);
    expect(pagada.factura?.pagos.map((p) => p.estado)).toEqual(['Rechazado', 'Aprobado']);
    expect(pagada.factura?.pagos[1].referencia).toMatch(/^PSX-\d{8}$/);
    expect(e.api.vuelo(vuelo.idVuelo, 'Económica').sillasDisponibles).toBe(sillasAntes - 2);
    expect(() => e.api.pagar(laura, reserva.idReserva, TARJETA)).toThrow(/ya está pagada/);

    // check-in de la titular: silla de su cabina y 2 maletas
    const tq = pagada.tiquetes[0];
    const info = e.api.checkin(laura, tq.idTiquete);
    expect(info.abierto).toBe(true);
    const silla = `${Object.entries(info.mapa.claseDeFila).find(([, c]) => c === 'Económica')![0]}A`;
    const sillaLibre = info.mapa.ocupadas.includes(silla) ? silla.replace('A', 'F') : silla;
    expect(() => e.api.hacerCheckin(laura, tq.idTiquete, { asiento: '1A', maletas: [] })).toThrow(/no corresponde/);
    const pase = e.api.hacerCheckin(laura, tq.idTiquete, { asiento: sillaLibre, maletas: [18.5, 21] });
    expect(pase.asiento).toBe(sillaLibre);
    expect(pase.maletas).toHaveLength(2);
    expect(pase.maletas[0].etiqueta).toMatch(/^BA\d{8}$/);
    expect(pase.vuelo.origen.codigo).toBe('ATL');
    expect(() => e.api.hacerCheckin(laura, tq.idTiquete, { asiento: sillaLibre, maletas: [] })).toThrow(/Ya hiciste/);
    const maleta = e.api.rastrearMaleta(laura, pase.maletas[0].etiqueta);
    expect(maleta.rastreo.map((r) => r.punto)).toEqual(['Documentada en web']);

    // las 8 etapas del pipeline operacional
    const saldoAntes = e.api.skymiles(laura).cuenta!.saldo;
    const estados: string[] = [];
    for (let i = 0; i < 8; i++) {
      e.reloj.avanzar(20);
      const d = e.api.registrarEtapa(coordinador, vuelo.idVuelo);
      estados.push(d.vuelo.estado);
      if (i === 3) {
        // ya despegó: el acompañante no hizo check-in y ya no puede hacerlo
        expect(e.api.checkin(laura, pagada.tiquetes[1].idTiquete).abierto).toBe(false);
        expect(() => e.api.hacerCheckin(laura, pagada.tiquetes[1].idTiquete, { asiento: '30C', maletas: [] })).toThrow(ErrorNegocio);
      }
    }
    expect(estados).toEqual(['Recursos asignados', 'En preparación', 'Abordando', 'En vuelo', 'En vuelo', 'Aterrizado', 'Descargando', 'Finalizado']);
    expect(() => e.api.registrarEtapa(coordinador, vuelo.idVuelo)).toThrow(/todas sus etapas/);

    const op = e.api.vueloOperacion(coordinador, vuelo.idVuelo);
    expect(op.tripulacion.map((t) => t.rol)).toEqual(['Capitán', 'Primer oficial', 'Auxiliar de vuelo', 'Auxiliar de vuelo']);
    expect(op.vuelo.puerta).toBeTruthy();
    expect(op.vuelo.salidaReal).toBeTruthy();
    expect(op.vuelo.llegadaReal).toBeTruthy();
    expect(op.eventos).toHaveLength(8);
    expect(op.etapas.every((x) => x.hecho)).toBe(true);
    expect(
      e.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM EventoVuelo ev JOIN Empleado e ON e.IdEmpleado = ev.IdEmpleado WHERE ev.IdVuelo = ?`, [vuelo.idVuelo])!.n,
    ).toBe(8);

    // efectos: tiquete volado, reserva completada, millas, maletas en banda y servicio de rutina
    const final = e.api.reserva(laura, reserva.idReserva);
    expect(final.estado).toBe('Completada');
    expect(final.tiquetes[0].estado).toBe('Volado');
    expect(final.tiquetes[1].estado).toBe('Emitido');
    const ck = e.db.get<any>(`SELECT * FROM Checkin WHERE IdTiquete = ?`, [tq.idTiquete]);
    expect(ck.FechaEmbarque).toBeTruthy();
    expect(ck.PuertaEmbarque).toBe(op.vuelo.puerta);
    const sky = e.api.skymiles(laura);
    expect(sky.cuenta!.saldo).toBe(saldoAntes + 760);
    expect(sky.movimientos[0]).toMatchObject({ tipo: 'Acumulacion', millas: 760 });
    const m2 = e.api.rastrearMaleta(laura, pase.maletas[0].etiqueta);
    expect(m2.estado).toBe('En banda');
    expect(m2.rastreo.map((r) => r.punto)).toEqual(['Documentada en web', 'Cargada en bodega', 'Descargada', 'Lista en banda de entrega']);
    expect(m2.ultimo?.aeropuerto).toBe('JFK');
    const mant = e.db.get<any>(`SELECT * FROM Mantenimiento WHERE Tipo = 'Servicio de rutina' ORDER BY IdMantenimiento DESC LIMIT 1`);
    expect(mant.Descripcion).toContain(op.vuelo.numero);
  });

  it('no vende más tiquetes que la capacidad de la aeronave', () => {
    const v = e.db.get<any>(
      `SELECT v.IdVuelo, a.CapacidadPasajeros FROM Vuelo v JOIN Aeronave a ON a.IdAeronave = v.IdAeronave
       WHERE v.Estado = 'Programado' AND v.SalidaProgramada > ? ORDER BY v.SalidaProgramada DESC LIMIT 1`,
      [`${aFecha(sumarDias(AHORA, 5))} 00:00:00`],
    );
    const libres = e.api.vuelo(v.IdVuelo, 'Económica').sillasDisponibles;
    e.db.run(`UPDATE Aeronave SET CapacidadPasajeros = CapacidadPasajeros - ? WHERE IdAeronave = (SELECT IdAeronave FROM Vuelo WHERE IdVuelo = ?)`, [
      libres - 1,
      v.IdVuelo,
    ]);
    expect(() =>
      e.api.crearReserva(laura, { idVuelo: v.IdVuelo, clase: 'Económica', acompanantes: [{ nombres: 'Ana', apellidos: 'Ruiz', documento: '55667788' }] }),
    ).toThrow(/sillas suficientes/);
  });

  it('servicio al cliente: abrir, atender y cerrar un caso', () => {
    const caso = e.api.abrirCaso(laura, { tipo: 'Equipaje demorado', descripcion: 'Mi maleta no apareció en la banda de entrega.' });
    expect(caso.estado).toBe('Abierto');
    const agente: Actor = { tipo: 'empleado', id: e.api.ingresarEmpleado(CUENTAS.agente.documento).id };
    expect(e.api.atenderCaso(agente, caso.idCaso).estado).toBe('En atención');
    e.reloj.avanzar(30);
    const cerrado = e.api.cerrarCaso(agente, caso.idCaso);
    expect(cerrado.estado).toBe('Cerrado');
    expect(cerrado.cierre).toBeTruthy();
    expect(cerrado.agente).toBe(`${CUENTAS.agente.nombres} ${CUENTAS.agente.apellidos}`);
  });

  it('el tablero muestra hoy y los dos días siguientes', () => {
    const t = e.api.tablero(coordinador);
    const dias = new Set(t.map((v) => v.salida.slice(0, 10)));
    expect([...dias].sort()).toEqual([aFecha(AHORA), MANANA, aFecha(sumarDias(AHORA, 2))]);
    // los vuelos de hoy que ya salieron pasaron por el pipeline
    const salidos = t.filter((v) => v.salida.startsWith(aFecha(AHORA)) && v.salida < `${aFecha(sumarMinutos(AHORA, -300))}`);
    expect(salidos.every((v) => v.estado !== 'Programado')).toBe(true);
  });
});
