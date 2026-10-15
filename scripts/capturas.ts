/**
 * npm run capturas
 *
 * Siembra una base nueva en data/capturas/, levanta la API (puerto 3101) y el frontend (puerto 5273),
 * recorre el flujo completo con Playwright y guarda PNG numerados en capturas/ (1440 × 900, modo claro).
 * Las capturas *_bd_*.png son páginas HTML generadas aquí (no forman parte de la aplicación)
 * con el SQL ejecutado y su resultado, como evidencia de la persistencia.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { chromium, type Page } from 'playwright';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const DATOS = join(RAIZ, 'data', 'capturas');
const SALIDA = join(RAIZ, 'capturas');
const PUERTO_API = 3101;
const PUERTO_WEB = 5273;
const WEB = `http://localhost:${PUERTO_WEB}`;
const LAURA = { documento: '1020457813', email: 'laura.gomez@gmail.com' };
const COORDINADOR = '80114527';

process.env.BETA_DATOS = DATOS;
const procesos: ChildProcess[] = [];

function lanzar(args: string[], cwd: string, env: Record<string, string>) {
  const p = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stderr?.on('data', (d) => process.env.DEBUG && process.stderr.write(d));
  procesos.push(p);
  return p;
}

async function esperarUrl(url: string, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* todavía no responde */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`No respondió ${url}`);
}

function cerrarTodo() {
  for (const p of procesos) if (!p.killed) p.kill();
}

/* ---------- páginas de evidencia ---------- */

const esc = (v: unknown) =>
  v === null || v === undefined ? '<span class="nulo">NULL</span>' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Consulta {
  titulo: string;
  sql: string;
  params?: (string | number)[];
  db: DatabaseSync;
  limite?: number;
}

function paginaEvidencia(titulo: string, subtitulo: string, consultas: Consulta[]) {
  const bloques = consultas
    .map((c) => {
      const filas = c.db.prepare(c.sql).all(...(c.params ?? [])) as Record<string, unknown>[];
      const mostradas = c.limite ? filas.slice(0, c.limite) : filas;
      const cols = filas[0] ? Object.keys(filas[0]) : [];
      const sqlConParams = (c.params ?? []).reduce<string>((s, p) => s.replace('?', typeof p === 'number' ? String(p) : `'${p}'`), c.sql);
      return `<section>
        <h2>${esc(c.titulo)} <small>${filas.length} ${filas.length === 1 ? 'fila' : 'filas'}${c.limite && filas.length > c.limite ? `, se muestran ${c.limite}` : ''}</small></h2>
        <pre>${esc(sqlConParams.trim())};</pre>
        ${
          filas.length
            ? `<table><thead><tr>${cols.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${mostradas
                .map((f) => `<tr>${cols.map((k) => `<td>${esc(f[k])}</td>`).join('')}</tr>`)
                .join('')}</tbody></table>`
            : '<p class="vacio">Sin filas</p>'
        }
      </section>`;
    })
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Archivo:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    body{margin:0;padding:28px 32px;font-family:Archivo,Segoe UI,sans-serif;background:#f2f5f9;color:#0e1a2f}
    header{border-bottom:2px solid #163c8c;padding-bottom:12px;margin-bottom:20px}
    h1{margin:0;font-size:24px;font-weight:800}
    header p{margin:4px 0 0;color:#4b5a72;font-size:14px}
    section{background:#fff;border:1px solid #d9e0ea;border-radius:10px;padding:16px 18px;margin-bottom:16px}
    h2{margin:0 0 10px;font-size:17px}
    h2 small{font-weight:400;color:#77849a;font-size:13px;margin-left:8px}
    pre{margin:0 0 12px;background:#0b1626;color:#ffb627;padding:10px 14px;border-radius:8px;font:13px/1.5 'IBM Plex Mono',monospace;white-space:pre-wrap}
    table{border-collapse:collapse;width:100%;font:12.5px 'IBM Plex Mono',monospace}
    th{background:#e6edfa;text-align:left;padding:6px 8px;border:1px solid #d9e0ea;white-space:nowrap}
    td{padding:5px 8px;border:1px solid #e8edf4;white-space:nowrap}
    .nulo{color:#9aa6b8;font-style:italic}
    .vacio{color:#77849a;margin:0}
  </style></head><body><header><h1>${esc(titulo)}</h1><p>${esc(subtitulo)}</p></header>${bloques}</body></html>`;
}

async function fotoEvidencia(page: Page, nombre: string, html: string) {
  const p = await page.context().newPage();
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.screenshot({ path: join(SALIDA, nombre), fullPage: true });
  await p.close();
  console.log(`  ✓ ${nombre}`);
}

/* ---------- recorrido ---------- */

async function main() {
  rmSync(SALIDA, { recursive: true, force: true });
  mkdirSync(SALIDA, { recursive: true });
  mkdirSync(DATOS, { recursive: true });

  console.log('Sembrando una base nueva en data/capturas/ …');
  const { crearBases, ARCHIVO_BD, ARCHIVO_DW } = await import('../server/src/bases.ts');
  crearBases();

  console.log('Levantando la API y el frontend …');
  lanzar(['--import', 'tsx', 'src/index.ts'], join(RAIZ, 'server'), { PORT: String(PUERTO_API), BETA_DATOS: DATOS });
  lanzar([join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PUERTO_WEB), '--strictPort'], join(RAIZ, 'web'), {
    BETA_API: `http://localhost:${PUERTO_API}`,
  });
  await esperarUrl(`http://localhost:${PUERTO_API}/api/aeropuertos`);
  await esperarUrl(WEB);

  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'es-CO' });
  const page = await contexto.newPage();
  const errores: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('pageerror', (e) => errores.push(e.message));

  const foto = async (nombre: string, completa = false) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SALIDA, nombre), fullPage: completa });
    console.log(`  ✓ ${nombre}`);
  };
  const bd = new DatabaseSync(ARCHIVO_BD, { readOnly: true });
  const dw = new DatabaseSync(ARCHIVO_DW, { readOnly: true });
  const archivoBd = 'data/capturas/beta_airlines.db';
  const archivoDw = 'data/capturas/beta_airlines_dw.db';

  try {
    console.log('Recorriendo el sitio de pasajeros …');
    // 1. Buscador
    await page.goto(WEB, { waitUntil: 'networkidle' });
    await page.selectOption('select[name=origen]', 'ATL');
    await page.selectOption('#campo-destino', 'JFK');
    await page.selectOption('select[name=pasajeros]', '2');
    await page.selectOption('select[name=clase]', 'Económica');
    await foto('01_inicio_buscador.png');

    // 2. Resultados
    await page.click('.buscador button[type=submit]');
    await page.waitForSelector('.vuelo-fila');
    await foto('02_resultados.png');

    // Inicio de sesión de la pasajera (pide la sesión al elegir el vuelo)
    await page.click('.vuelo-fila button');
    await page.waitForSelector('input[name=documento]');
    await page.fill('input[name=documento]', LAURA.documento);
    await page.fill('input[name=email]', LAURA.email);
    await page.click('form button[type=submit]');

    // 3. Datos de pasajeros
    await page.waitForSelector('input[name=nombres-0]');
    await page.fill('input[name=nombres-0]', 'Martín');
    await page.fill('input[name=apellidos-0]', 'Gómez Rivas');
    await page.fill('input[name=documento-0]', '1020998877');
    await foto('03_datos_pasajeros.png');

    // 4. Pago
    await page.click('form button[type=submit]');
    await page.waitForSelector('input[name=numero]');
    await page.fill('input[name=numero]', '4111 1111 1111 1111');
    await page.fill('input[name=titular]', 'LAURA GOMEZ');
    await page.fill('input[name=vencimiento]', '08/29');
    await page.fill('input[name=cvv]', '123');
    await foto('04_pago.png');

    // 5. Confirmación
    await page.click('form button[type=submit]');
    await page.waitForSelector('.codigo-grande');
    await foto('05_confirmacion.png', true);
    const idReserva = page.url().match(/reserva\/(RS\d{8})/)![1];

    // 6. Evidencia: Reserva, Tiquete, Factura y Pago
    await fotoEvidencia(
      page,
      '06_bd_reserva.png',
      paginaEvidencia('Reserva registrada en la base operacional', `${archivoBd}, reserva ${idReserva}`, [
        { titulo: 'Reserva', db: bd, sql: 'SELECT * FROM Reserva WHERE IdReserva = ?', params: [idReserva] },
        { titulo: 'Tiquete', db: bd, sql: 'SELECT * FROM Tiquete WHERE IdReserva = ?', params: [idReserva] },
        { titulo: 'Factura', db: bd, sql: 'SELECT * FROM Factura WHERE IdReserva = ?', params: [idReserva] },
        {
          titulo: 'Pago',
          db: bd,
          sql: 'SELECT p.* FROM Pago p JOIN Factura f ON f.IdFactura = p.IdFactura WHERE f.IdReserva = ?',
          params: [idReserva],
        },
      ]),
    );

    // 7. Check-in de la titular
    const tiquete = bd
      .prepare(`SELECT t.IdTiquete FROM Tiquete t JOIN Cliente c ON c.IdCliente = t.IdCliente WHERE t.IdReserva = ? AND c.Documento = ?`)
      .get(idReserva, LAURA.documento) as { IdTiquete: string };
    await page.goto(`${WEB}/checkin/${tiquete.IdTiquete}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.silla');
    const silla = page.locator('.silla:not(:disabled)').nth(14);
    await silla.scrollIntoViewIfNeeded();
    await silla.click();
    await page.click('button[aria-label="Agregar una maleta"]');
    await page.click('button[aria-label="Agregar una maleta"]');
    await page.fill('#maleta-0', '18.5');
    await page.fill('#maleta-1', '21.3');
    await page.evaluate(() => window.scrollTo(0, 0));
    await foto('07_checkin.png');

    // 8. Pase de abordar
    await page.click('.resumen-compra button.boton-primario');
    await page.waitForSelector('.pase');
    await foto('08_pase_abordar.png');
    const etiqueta = (await page.locator('.etiqueta-maleta .codigo').first().innerText()).trim();

    // 9. Evidencia: Checkin, Equipaje y RastreoEquipaje
    await fotoEvidencia(
      page,
      '09_bd_checkin.png',
      paginaEvidencia('Check-in registrado en la base operacional', `${archivoBd}, tiquete ${tiquete.IdTiquete}`, [
        { titulo: 'Checkin', db: bd, sql: 'SELECT * FROM Checkin WHERE IdTiquete = ?', params: [tiquete.IdTiquete] },
        { titulo: 'Tiquete (silla asignada)', db: bd, sql: 'SELECT IdTiquete, NumeroTiquete, Clase, Asiento, Estado FROM Tiquete WHERE IdTiquete = ?', params: [tiquete.IdTiquete] },
        { titulo: 'Equipaje', db: bd, sql: 'SELECT * FROM Equipaje WHERE IdTiquete = ?', params: [tiquete.IdTiquete] },
        {
          titulo: 'RastreoEquipaje',
          db: bd,
          sql: 'SELECT r.* FROM RastreoEquipaje r JOIN Equipaje e ON e.IdEquipaje = r.IdEquipaje WHERE e.IdTiquete = ? ORDER BY r.IdRastreo',
          params: [tiquete.IdTiquete],
        },
      ]),
    );

    console.log('Recorriendo el portal de operaciones …');
    const { IdVuelo: idVuelo } = bd.prepare('SELECT IdVuelo FROM Reserva WHERE IdReserva = ?').get(idReserva) as { IdVuelo: string };

    // 10. Tablero de vuelos
    await page.goto(`${WEB}/operaciones/ingresar`, { waitUntil: 'networkidle' });
    await page.fill('input[name=documento]', COORDINADOR);
    await page.click('form button[type=submit]');
    await page.waitForSelector('.fids tbody tr');
    await foto('10_tablero_vuelos.png');

    // 11. Las 8 etapas del vuelo de la reserva
    await page.goto(`${WEB}/operaciones/vuelos/${idVuelo}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.etapas');
    for (let i = 0; i < 8; i++) {
      const boton = page.locator('.panel-titulo button.boton-primario');
      await boton.click();
      await page.waitForFunction((n) => document.querySelectorAll('.etapa[data-estado="hecho"]').length >= n, i + 1);
    }
    await foto('11_vuelo_etapas.png');

    // 12. Evidencia: eventos, tripulación y millas
    await fotoEvidencia(
      page,
      '12_bd_eventos_millas.png',
      paginaEvidencia('Pipeline operacional del vuelo', `${archivoBd}, vuelo ${idVuelo}`, [
        { titulo: 'Vuelo', db: bd, sql: 'SELECT IdVuelo, NumeroVuelo, SalidaProgramada, SalidaReal, LlegadaReal, Puerta, Estado FROM Vuelo WHERE IdVuelo = ?', params: [idVuelo] },
        { titulo: 'EventoVuelo', db: bd, sql: 'SELECT * FROM EventoVuelo WHERE IdVuelo = ? ORDER BY IdEvento', params: [idVuelo] },
        { titulo: 'AsignacionTripulacion', db: bd, sql: 'SELECT * FROM AsignacionTripulacion WHERE IdVuelo = ?', params: [idVuelo] },
        {
          titulo: 'MovimientoMillas',
          db: bd,
          sql: `SELECT m.* FROM MovimientoMillas m JOIN Tiquete t ON t.IdTiquete = m.IdTiquete
JOIN Reserva r ON r.IdReserva = t.IdReserva WHERE r.IdVuelo = ?`,
          params: [idVuelo],
        },
        {
          titulo: 'CuentaMillas de la pasajera',
          db: bd,
          sql: 'SELECT cm.* FROM CuentaMillas cm JOIN Cliente c ON c.IdCliente = cm.IdCliente WHERE c.Documento = ?',
          params: [LAURA.documento],
        },
      ]),
    );

    // 13 y 14. Skymiles y rastreo de la maleta, de vuelta en el sitio de pasajeros
    await page.goto(`${WEB}/skymiles`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.socio');
    await foto('13_skymiles.png');
    await page.goto(`${WEB}/maletas/${etiqueta}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.linea-tiempo');
    await foto('14_rastreo_maleta.png');

    console.log('Recorriendo la analítica …');
    // 15–17. Reportes del data warehouse (primero se actualiza con las operaciones nuevas)
    await page.goto(`${WEB}/operaciones/analitica`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.grafica');
    await page.click('button:has-text("Actualizar datos")');
    await page.waitForSelector('.aviso-ok');
    await page.mouse.move(0, 0);
    await foto('15_dw_4a.png', true);
    await page.click('button[role=tab] >> text=Reservas por ciudad');
    await page.waitForSelector('text=Reservas por mes');
    await page.mouse.move(0, 0);
    await foto('16_dw_4b.png', true);
    await page.click('button[role=tab] >> text=Millas en vuelos nacionales');
    await page.waitForSelector('text=Millas por pasajero y mes');
    await foto('17_dw_4c.png', true);

    // 18. Evidencia del data warehouse
    const tablasDw = ['DimTiempo', 'DimCiudad', 'DimCliente', 'DimCanal', 'DimRuta', 'FactVentaTiquetes', 'FactReservas', 'FactMillasPasajero'];
    await fotoEvidencia(
      page,
      '18_bd_dw.png',
      paginaEvidencia('Data warehouse cargado por el ETL', archivoDw, [
        { titulo: 'Filas por tabla', db: dw, sql: tablasDw.map((t) => `SELECT '${t}' AS Tabla, COUNT(*) AS Filas FROM ${t}`).join('\nUNION ALL ') },
        { titulo: 'FactVentaTiquetes', db: dw, sql: 'SELECT * FROM FactVentaTiquetes ORDER BY IdVenta DESC LIMIT 5' },
        { titulo: 'FactReservas', db: dw, sql: 'SELECT * FROM FactReservas ORDER BY IdReservaDW DESC LIMIT 5' },
        { titulo: 'FactMillasPasajero', db: dw, sql: 'SELECT * FROM FactMillasPasajero ORDER BY IdMillas DESC LIMIT 5' },
      ]),
    );

    if (errores.length) console.warn(`\nErrores de consola durante el recorrido:\n${errores.join('\n')}`);
    else console.log('\nSin errores de consola.');
    console.log(`Capturas guardadas en ${SALIDA}`);
  } finally {
    bd.close();
    dw.close();
    await navegador.close();
    cerrarTodo();
  }
}

main().catch((e) => {
  console.error(e);
  cerrarTodo();
  process.exit(1);
});
