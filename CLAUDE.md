# Beta Airlines: sistema de información web

Este repositorio contiene la aplicación web de **Beta Airlines**, una aerolínea de pasajeros (unos 4.000 empleados, 5 millones de clientes, 40 ciudades en 10 países). La aplicación cubre los dos pipelines del diagrama de arquitectura del enunciado: el **pipeline operacional** (ciclo de cada vuelo) y el **pipeline de experiencia del cliente** (reservas, pagos, check-in, equipaje, millas, servicio al cliente). Además alimenta un **data warehouse** que responde tres requerimientos de analítica.

La aplicación se construye para el punto 5 de un parcial universitario de Diseño de Software: *"Elabore un prototipo de la solución extremo a extremo desde la interfaz de usuario hasta la persistencia de datos."* Los puntos 1 a 4 (entidades, modelo conceptual, diseño relacional y data warehouse) ya están hechos en Enterprise Architect. Sus resultados están en `docs/` y `db/` y son la **fuente de verdad** del modelo de datos.

El entregable final del curso es un PDF con capturas. Por eso la aplicación debe verse como un producto real y, además, generar automáticamente las capturas del recorrido (ver "Capturas para el informe").

---

## Regla más importante: debe parecer una aplicación real

- En la interfaz **nunca** deben aparecer las palabras "prototipo", "demo", "simulado", "parcial", "universidad", "ejemplo", "Claude" ni nada que delate que es un trabajo académico. Tampoco banners de "datos de prueba", "modo demo" ni explicaciones de cómo está hecho por dentro.
- La pasarela de pagos, el envío de correos y la autenticación se implementan como **servicios simulados en el backend**, pero en la interfaz se ven y se comportan como integraciones reales: checkout de pago normal, mensajes de "Te enviamos la confirmación a tu correo", etc. La simulación solo se documenta en comentarios del código y en el README.
- Textos en español (Colombia/Latinoamérica), escritos como los escribiría una aerolínea: claros, directos, sin relleno. Precios en dólares (USD).
- Nada de lorem ipsum. Todos los datos visibles salen de la base de datos.

---

## Arquitectura y stack

La misma aplicación funciona en **dos modos**, con la lógica de negocio escrita una sola vez:

- **Modo completo (local):** React → API REST en Express → SQLite en archivo. Es el que muestra la arquitectura de tres capas y el que usa `npm run capturas`.
- **Modo estático (GitHub Pages):** el mismo frontend, pero los servicios de negocio corren dentro del navegador sobre **sql.js** (SQLite compilado a WebAssembly). GitHub Pages solo sirve archivos estáticos, así que este modo es el que da el link público que va en el informe.

| Capa | Tecnología | Carpeta |
| --- | --- | --- |
| Interfaz | React 18 + Vite + TypeScript, React Router | `web/` |
| Lógica de negocio | Servicios en TypeScript, compartidos por ambos modos | `core/` |
| API REST (modo completo) | Node.js 24 + Express + TypeScript; solo expone los servicios de `core/` | `server/` |
| Persistencia | SQLite. Modo completo: archivos `data/beta_airlines.db` (operacional) y `data/beta_airlines_dw.db` (data warehouse) con `better-sqlite3` o `node:sqlite`. Modo estático: dos bases sql.js en el navegador, guardadas en IndexedDB | `core/src/db/`, `data/` |

Reglas de la arquitectura:
- `core/` es un paquete del monorepo (npm workspaces) sin dependencias de Node ni del navegador. Define una interfaz de base de datos (`Db`: `run`, `all`, `get`, `transaction`) con dos adaptadores: `NodeSqliteDb` (servidor) y `SqlJsDb` (navegador). El cargador del esquema, el seed, el ETL y todos los servicios viven en `core/` y solo hablan con esa interfaz.
- Servicios con nombres del dominio: `ReservasService`, `PagosService`, `FacturacionService`, `CheckinService`, `EquipajeService`, `EmbarqueService`, `MillasService`, `OperacionesService`, `MantenimientoService`, `ServicioClienteService`, `AuthService`, `EtlService`, `AnaliticaService`.
- El frontend nunca escribe SQL. Usa un **cliente de datos** con dos implementaciones y la misma interfaz: `ApiClient` (llama a `/api` por HTTP, modo completo) y `LocalClient` (llama directo a los servicios de `core/` sobre sql.js, modo estático). El modo se elige al compilar con una variable de Vite (`VITE_MODO_DATOS=api` o `local`).
- En modo completo, las rutas Express solo validan la entrada y llaman a los servicios. Un solo comando levanta todo: `npm run dev` en la raíz (usa `concurrently`), con proxy de Vite hacia `/api`.
- Todas las operaciones que tocan varias tablas van en una **transacción**. `PRAGMA foreign_keys = ON` siempre, en ambos modos. Si una operación viola una FK, el servicio devuelve un error de negocio claro (HTTP 409/422 en la API), no un error genérico.
- El acceso al data warehouse va detrás de una interfaz (`core/src/dw/DwRepository.ts`) con la implementación `SqliteDwRepository`. Si después se exige Snowflake, solo se agrega `SnowflakeDwRepository` (en el servidor) sin tocar el resto. **No implementes Snowflake ahora**; deja solo la interfaz y un comentario de dónde iría.
- El equipo usa **Windows con Node.js v24.19.0 y npm 11.17.0**. Si `better-sqlite3` no instala o no compila, usar `node:sqlite` (incluido en Node 24) detrás del mismo adaptador. Todo debe funcionar en Windows.

### Modo estático y GitHub Pages
- `npm run build:pages` compila el frontend con `VITE_MODO_DATOS=local` y la base de rutas `/<nombre-del-repositorio>/`. Usa `HashRouter` en este modo, porque GitHub Pages no redirige las rutas internas de una SPA.
- El archivo `.wasm` de sql.js se sirve desde los propios archivos del sitio (no desde un CDN).
- En la primera visita, el navegador crea las dos bases con `TablesBD.sql` y `TablesDW.sql` (los `.sql` se incluyen en el build), corre el mismo seed determinista (con fechas relativas al día de la visita) y el ETL, y guarda las bases en IndexedDB. En las siguientes visitas las carga desde IndexedDB, así lo que el visitante haga se conserva. Si IndexedDB no está disponible, trabaja en memoria.
- La carga inicial muestra una pantalla de inicio con el logo de Beta Airlines mientras se preparan los datos, nunca un mensaje técnico.
- En el menú de la cuenta del portal interno, una opción discreta "Restablecer datos" vuelve a crear las bases (útil para quien revise el sitio). Sin la palabra "demo".
- Workflow de GitHub Actions (`.github/workflows/pages.yml`) que, en cada push a `main`, instala dependencias, corre `npm run build:pages` y publica en GitHub Pages con `actions/upload-pages-artifact` y `actions/deploy-pages`.
- El README explica paso a paso cómo publicarlo: crear el repositorio **público** en GitHub, subir el código, ir a *Settings → Pages → Source: GitHub Actions* y dónde queda el link (`https://<usuario>.github.io/<repositorio>/`).

---

## Modelo de datos: usar los scripts de Enterprise Architect tal cual

- `db/TablesBD.sql`: 22 tablas de la BD operacional, generadas por Enterprise Architect 17.2 para MySQL.
- `db/TablesDW.sql`: 8 tablas del data warehouse (3 de hechos y 5 dimensiones), generadas igual.
- `db/consultas_requerimientos_dw.sql`: las consultas que responden los requerimientos 4a, 4b y 4c.

**No reescribas el esquema a mano, no agregues ni renombres columnas y no agregues tablas al modelo.** Escribe un cargador (`core/src/db/loadSchema.ts`) que lea esos `.sql` y los adapte a SQLite en tiempo de ejecución:

1. Ignorar `SET FOREIGN_KEY_CHECKS` y los `DROP TABLE ... CASCADE` (la base se crea vacía).
2. Conservar los `CREATE TABLE` (SQLite acepta las comillas invertidas y `PRIMARY KEY (col ASC)`).
3. `ALTER TABLE x ADD INDEX nombre (cols)` → `CREATE INDEX nombre ON x (cols)`.
4. SQLite no permite agregar restricciones con `ALTER TABLE`: los `ADD CONSTRAINT ... UNIQUE` y `ADD CONSTRAINT ... FOREIGN KEY ... REFERENCES` se deben **incluir dentro del `CREATE TABLE`** de su tabla, conservando el nombre de la restricción.
5. Ignorar `ON DELETE No Action ON UPDATE No Action` (es el comportamiento por defecto).

Datos que el modelo **no** tiene y cómo resolverlos sin tocarlo:
- **No hay contraseñas.** El inicio de sesión de pasajeros es con **número de documento + correo** (columnas de `Cliente`). El de empleados es con **número de documento** (columna de `Empleado`) y solo pueden entrar al portal interno los cargos de operaciones, despachos, servicio al cliente, mantenimiento y analítica. La sesión se maneja con un token firmado (JWT o cookie de sesión) en modo completo, y con la sesión guardada en el navegador en modo estático.
- **La clase del tiquete** se guarda en `Tiquete.Clase`. Mientras la reserva está pendiente de pago, guarda la clase elegida en memoria del servidor o en la sesión, no en una columna nueva.
- **Los IDs** son `CHAR(10)`: prefijo de 2 letras + 8 dígitos (`CL00000001`, `RS00000042`…). Prefijos: Ciudad CI, Aeropuerto AP, Departamento DP, Empleado EM, Cliente CL, Ruta RU, Vuelo VU, Aeronave AN, Equipo EQ, Mantenimiento MT, AsignacionTripulacion AT, EventoVuelo EV, Reserva RS, Tiquete TQ, Factura FA, Pago PG, Checkin CK, Equipaje EJ, RastreoEquipaje RE, CuentaMillas CM, MovimientoMillas MM, CasoServicio CS.
- Otros códigos: `Reserva.CodigoReserva` = 6 caracteres alfanuméricos en mayúscula sin caracteres ambiguos; `Tiquete.NumeroTiquete` = `777` + 10 dígitos; `Equipaje.CodigoEtiqueta` = `BA` + 8 dígitos; `Factura.NumeroFactura` = `FE-` + 8 dígitos; `CuentaMillas.NumeroSocio` = `BA` + 9 dígitos; `Pago.Referencia` = referencia de la pasarela (`PSX-` + 8 dígitos).
- Fechas y horas se guardan como texto `YYYY-MM-DD HH:MM:SS` (DATETIME) o `YYYY-MM-DD` (DATE).

Los diagramas de EA están en `docs/diagramas/` y las entidades del punto 1 en `docs/punto1_entidades.md`. Úsalos para entender las relaciones.

---

## Funcionalidades

### 1. Sitio de pasajeros (público + cuenta del cliente)
Es el "Skylinks" del diagrama: el sitio web de la aerolínea.
- **Inicio:** buscador de vuelos (origen, destino, fecha, pasajeros 1–4, clase) como portada.
- **Crear cuenta / iniciar sesión:** registro inserta en `Cliente` (y opcionalmente afilia a Skymiles).
- **Resultados de búsqueda:** vuelos programados de esa ruta y fecha con hora de salida y llegada, número de vuelo, aeronave, sillas disponibles (`CapacidadPasajeros` − tiquetes vendidos) y precio. Si no hay vuelos, sugerir las fechas más cercanas con vuelos.
- **Reserva:** datos de los pasajeros adicionales (nombres, apellidos, documento; si el documento no existe se crea el `Cliente`). Crea la `Reserva` en estado `Pendiente de pago` con `Canal = 'Web'`.
- **Pago:** checkout con tarjeta (número, titular, vencimiento, CVV). La pasarela simulada aprueba toda tarjeta válida (13–19 dígitos) **salvo las que terminan en 0000**, que el banco rechaza. Al aprobar, en una transacción: `Factura` (subtotal, impuestos 7,5 %, total), `Pago` (`Aprobado` + referencia), un `Tiquete` por pasajero (`Emitido`) y `Reserva.Estado = 'Confirmada'`. Pantalla de confirmación con código de reserva, tiquetes y factura.
- **Mis viajes:** próximos y anteriores, con el estado del vuelo en vivo (lo que ponga operaciones). Pagar reservas pendientes.
- **Check-in:** por tiquete, si el vuelo no ha salido: elegir silla y registrar 0–2 maletas con peso. Inserta `Checkin`, actualiza `Tiquete.Asiento`, inserta `Equipaje` y el primer `RastreoEquipaje` ("Documentada en web" en el aeropuerto de origen). Muestra el **pase de abordar** (origen/destino en código IATA, vuelo, puerta, silla, hora de embarque = salida − 40 min, etiquetas de las maletas).
- **Mis maletas:** lista y rastreo por etiqueta con la línea de tiempo de `RastreoEquipaje`.
- **Skymiles:** saldo, nivel, número de socio y movimientos; botón para afiliarse si no tiene cuenta. Niveles por saldo: Azul < 12.000, Plata ≥ 12.000, Oro ≥ 30.000, Platino ≥ 60.000. Oro y Platino dan acceso a Crown Room (mostrarlo como beneficio).
- **Ayuda:** abrir y consultar solicitudes (`CasoServicio`): Equipaje demorado, Cambio de vuelo, Reembolso, Queja de servicio, Solicitud de asistencia.

### 2. Portal interno de operaciones (empleados)
- **Tablero de vuelos** estilo pantalla de aeropuerto (FIDS): vuelos de hoy y los dos días siguientes con hora, número, destino, origen, puerta, pasajeros y estado.
- **Detalle de vuelo** con las **8 etapas del pipeline operacional** del diagrama. Cada clic en "Registrar etapa" ejecuta la siguiente, inserta un `EventoVuelo` (TipoEvento = nombre de la etapa, empleado despachador) y aplica sus efectos:

| # | Etapa (EventoVuelo.TipoEvento) | Etapa del diagrama | Efectos en la BD | Vuelo.Estado |
| --- | --- | --- | --- | --- |
| 1 | Asignar recursos | Allocate Resources | 4 `AsignacionTripulacion` (Capitán, Primer oficial, 2 Auxiliares de vuelo), asigna `Vuelo.Puerta` | Recursos asignados |
| 2 | Preparar salida | Prepare for Flight Departure | solo evento | En preparación |
| 3 | Cargar aeronave | Load Aircraft | pasajeros con check-in → `Checkin.FechaEmbarque`, `Checkin.PuertaEmbarque`, `Tiquete.Estado = 'Abordado'`; cada maleta → `RastreoEquipaje` "Cargada en bodega", `Equipaje.Estado = 'En bodega'` | Abordando |
| 4 | Despegue y cierre | Flight Departure and Closeout | `Vuelo.SalidaReal` | En vuelo |
| 5 | Monitorear vuelo | Monitor Flight | solo evento | En vuelo |
| 6 | Llegada y cierre | Flight Arrival and Closeout | `Vuelo.LlegadaReal`; tiquetes abordados → `Volado`; **millas**: a cada pasajero abordado con `CuentaMillas` se le inserta `MovimientoMillas` (Tipo `Acumulacion`, Millas = `Ruta.DistanciaMillas`) y se actualiza `SaldoMillas` y `Nivel`; reservas `Confirmada` → `Completada` | Aterrizado |
| 7 | Descargar aeronave | Unload Aircraft | cada maleta → `RastreoEquipaje` "Descargada" y "Lista en banda de entrega" en el aeropuerto destino, `Equipaje.Estado = 'En banda'` | Descargando |
| 8 | Limpiar y alistar | Clean / Service Aircraft | `Mantenimiento` tipo "Servicio de rutina" con un técnico | Finalizado |

  El detalle muestra también la tripulación, la lista de pasajeros (silla, check-in, maletas, estado) y la línea de tiempo de eventos.
- **Servicio al cliente:** bandeja de casos; "Atender" asigna un agente (`En atención`) y "Cerrar" pone `FechaCierre` (`Cerrado`).
- **Flota y mantenimiento:** aeronaves con vuelos realizados y último mantenimiento; historial de `Mantenimiento`.

### 3. Analítica (data warehouse)
Sección del portal interno para analistas y gerencia.
- **ETL** (`EtlService`): vacía y recarga el DW desde la BD operacional. Corre al hacer `npm run seed`, con un botón "Actualizar datos" en la sección de analítica y una vez al iniciar el servidor si el DW está vacío. Muestra la fecha de la última carga.
  - `DimTiempo`: un registro por día del rango de fechas presente en los datos; `IdTiempo` = entero `YYYYMMDD`.
  - `DimCiudad`, `DimCliente` (NivelSocio = nivel de su `CuentaMillas` o "Sin afiliar"; CiudadResidencia = nombre de su ciudad), `DimCanal` (valores distintos de `Reserva.Canal`), `DimRuta` (ciudades origen/destino, TipoRuta, DistanciaMillas). Llaves sustitutas enteras.
  - `FactVentaTiquetes`: un registro por tiquete no anulado; fecha = `Tiquete.FechaEmision`; ciudades de origen y destino del vuelo; `CantidadTiquetes = 1`; `ValorVenta = Tiquete.Valor`.
  - `FactReservas`: un registro por reserva; fecha = `Reserva.FechaReserva`; `CantidadReservas = 1`; `NumeroPasajeros`.
  - `FactMillasPasajero`: un registro por `MovimientoMillas` de tipo `Acumulacion`; fecha del movimiento; ruta del vuelo del tiquete; `CantidadVuelos = 1`; `MillasAcumuladas = Millas`.
- **Reportes** (los tres requerimientos del enunciado), con selector de año:
  - **4a** Ingresos por venta de tiquetes por mes del año y por ciudad. Selector "ciudad de origen / ciudad de destino". Gráfico de barras por mes + tabla mes × ciudad con totales.
  - **4b** Número de reservas por mes del año y por ciudad. Mismo formato.
  - **4c** Millas acumuladas por pasajero en vuelos **nacionales** (`DimRuta.TipoRuta = 'Nacional'`), por mes. Tabla pasajero × mes, buscador por nombre, top 25.
  - Las consultas son las de `db/consultas_requerimientos_dw.sql`, adaptadas a parámetros.
  - Botón para exportar cada reporte a CSV.

---

## Reglas de negocio

- **Tarifa por persona** (USD) = `(49 + DistanciaMillas × 0.14) × factor de temporada del mes de salida × factor de clase`.
  - Temporada por mes (ene → dic): 1, 0.92, 1, 1.03, 1.05, 1.18, 1.22, 1.12, 0.95, 0.98, 1.06, 1.2.
  - Clase: Económica 1, Premium 1.7, Ejecutiva 3.2.
- **Impuestos** 7,5 % sobre el subtotal.
- **Vuelo nacional:** su ruta une dos ciudades del mismo país (`Ruta.TipoRuta`).
- **Millas:** solo las acumulan los pasajeros que **abordaron** (hicieron check-in) y tienen `CuentaMillas`; se suman al aterrizar.
- **Una reserva corresponde a un solo vuelo.** Ida y vuelta son dos reservas.
- **Estados.** Reserva: Pendiente de pago, Confirmada, Completada, Cancelada. Tiquete: Emitido, Abordado, Volado, Anulado. Vuelo: Programado, Recursos asignados, En preparación, Abordando, En vuelo, Aterrizado, Descargando, Finalizado. Pago: Aprobado, Rechazado. Caso: Abierto, En atención, Cerrado.
- **Canales.** Reserva: Web, App, Agente de viajes, Call center, Mostrador. Check-in: Web, App, Kiosko, Mostrador.
- No se puede vender más tiquetes que `CapacidadPasajeros`, ni hacer check-in de un vuelo que ya despegó.

---

## Datos iniciales (`npm run seed`)

Script determinista (semilla fija) que crea las dos bases desde los scripts de EA y las llena con datos realistas:
- **12 ciudades con su aeropuerto:** Atlanta (ATL, hub), Nueva York (JFK), Los Ángeles (LAX), Chicago (ORD), Miami (MIA), Seattle (SEA), Boston (BOS), Dallas (DFW), Bogotá (BOG), Ciudad de México (MEX), Londres (LHR), Madrid (MAD).
- **14 pares de rutas en ambos sentidos** (millas): ATL–JFK 760, ATL–LAX 1946, ATL–ORD 606, ATL–MIA 594, ATL–SEA 2182, ATL–BOS 946, ATL–DFW 731, JFK–LAX 2475, ORD–SEA 1721, JFK–MIA 1089, ATL–BOG 2130, ATL–MEX 1332, JFK–LHR 3451, ATL–MAD 4381. Duración ≈ distancia / 470 mph + 30 min.
- **8 aeronaves:** 2 × Boeing 737-800 (160), 2 × Airbus A321neo (196), Boeing 757-200 (199), Boeing 717-200 (110), Boeing 767-300ER (211), Airbus A330-300 (293). Rutas de más de 3.000 millas con 767 o A330.
- **10 departamentos** del enunciado: Reservas, Pagos, Facturas, Despachos, Tripulación, Embarque, Servicio al cliente, Mantenimiento, Operaciones, Marketing. Unos 30 empleados (capitanes, primeros oficiales, auxiliares, técnicos, despachadores, agentes, un coordinador de operaciones).
- **60 clientes** con nombres hispanos y anglosajones; ~70 % con cuenta Skymiles.
- **Historia** desde el 1 de enero del año en curso hasta ayer: varios vuelos al mes por ruta, ya finalizados, con reservas (1–3 pasajeros), tiquetes, facturas, pagos, check-ins, maletas con su rastreo completo y movimientos de millas. Los últimos 10 días con eventos de vuelo y tripulación completos. ~5 % de reservas canceladas. La fecha de reserva es entre 1 y 45 días antes del vuelo, sin acumularse en enero.
- **Próximos 10 días:** vuelos diarios por ruta (los de más de 3.000 millas, día por medio), en estado Programado, con algunas reservas confirmadas sin check-in.
- **Cuentas de acceso** que se imprimen al final del seed y van en el README:
  - Pasajera: **Laura Gómez** (Atlanta, Skymiles nivel Oro) con historial de vuelos y un viaje confirmado ATL→JFK para mañana sin check-in.
  - Empleado de operaciones (Coordinador de operaciones) y un agente de servicio al cliente.
- 16 casos de servicio al cliente (algunos abiertos) y unos 14 mantenimientos históricos.

---

## Diseño visual

- Identidad propia de **Beta Airlines**: azul profundo como color de marca, neutros fríos, un acento ámbar solo para el tablero de vuelos (fondo oscuro, tipografía monoespaciada, como las pantallas de aeropuerto). Logo simple (un avión estilizado en SVG) y nombre "BETA AIRLINES".
- Tipografía: Archivo (títulos y texto) e IBM Plex Mono (códigos de vuelo, IATA, reservas, etiquetas), desde Google Fonts, con fuentes de respaldo.
- Sitio de pasajeros con aspecto de sitio de aerolínea: buscador como portada, tarjetas de resultados de vuelo, checkout limpio, pase de abordar con talón.
- Portal interno con aspecto de herramienta de trabajo: navegación lateral, tablas densas y legibles, estados con chips de color.
- Responsive (sitio de pasajeros usable en celular), modo claro y oscuro, foco de teclado visible, sin errores en consola.

---

## Capturas para el informe (`npm run capturas`)

El curso se entrega como PDF, así que las capturas son el entregable del punto 5. Crea un script con Playwright que levante la app con una base recién sembrada, recorra el flujo y guarde PNG numerados en `capturas/` (1440 × 900, modo claro):

1. `01_inicio_buscador.png`: portada con el buscador lleno (ATL → JFK, mañana, 2 pasajeros).
2. `02_resultados.png`
3. `03_datos_pasajeros.png`
4. `04_pago.png`: checkout lleno.
5. `05_confirmacion.png`: reserva confirmada con código.
6. `06_bd_reserva.png`: **evidencia de persistencia**: una página HTML simple, generada por el script y no parte de la app, con el resultado de `SELECT` sobre `Reserva`, `Tiquete`, `Factura` y `Pago` filtrado por la reserva recién creada, con el SQL usado arriba de cada tabla.
7. `07_checkin.png`
8. `08_pase_abordar.png`
9. `09_bd_checkin.png`: evidencia de `Checkin`, `Equipaje` y `RastreoEquipaje`.
10. `10_tablero_vuelos.png`
11. `11_vuelo_etapas.png`: detalle del vuelo después de las 8 etapas.
12. `12_bd_eventos_millas.png`: evidencia de `EventoVuelo`, `AsignacionTripulacion` y `MovimientoMillas` del vuelo.
13. `13_skymiles.png`: millas de la pasajera ya sumadas.
14. `14_rastreo_maleta.png`
15. `15_dw_4a.png`, `16_dw_4b.png`, `17_dw_4c.png`
18. `18_bd_dw.png`: evidencia de las tablas del DW (conteo de filas por tabla + primeras filas de cada tabla de hechos).

---

## Entregables en el repositorio

- `README.md`: requisitos (Node.js 24 o superior), `npm install`, `npm run seed`, `npm run dev`, URLs, cuentas de acceso, `npm run capturas`, y una sección "Arquitectura" de un párrafo (capas y dónde está cada servicio). La simulación de la pasarela de pagos y del correo se menciona **solo** aquí.
- `.gitignore` con `node_modules`, `data/*.db` y `capturas/`.
- `.github/workflows/pages.yml` para publicar el modo estático en GitHub Pages.
- Pruebas (Vitest) de `core/`, corridas con ambos adaptadores (`NodeSqliteDb` y `SqlJsDb`): carga del esquema (22 + 8 tablas y FK activas), flujo reserva → pago → check-in → 8 etapas → millas, y ETL + consultas 4a, 4b y 4c.

## Forma de trabajo

- Antes de escribir código, presenta un plan corto (estructura de carpetas, endpoints de la API, pantallas) y espera mi aprobación.
- Construye por etapas y verifica cada una: `core/` (esquema, seed, servicios) con pruebas → API Express → frontend en modo completo → ETL y analítica → modo estático y workflow de GitHub Pages → capturas.
- Al terminar, corre `npm run seed`, las pruebas, `npm run capturas` y `npm run build:pages`. Revisa las imágenes y prueba el build estático con `npm run preview:pages` (abre el recorrido de reserva y el reporte 4a) antes de darlo por terminado.
- `docs/referencia/logica_referencia.html` es una versión anterior de la aplicación hecha en un solo archivo. Úsala **solo** como referencia de la lógica (reglas, flujo de etapas, ETL, datos iniciales). **No copies su interfaz ni sus textos**: esa versión mostraba explícitamente que era un prototipo y justamente eso es lo que no queremos.
