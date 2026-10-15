# Beta Airlines

Aplicación web de Beta Airlines. Cubre el **pipeline de experiencia del cliente** (búsqueda, reserva, pago, check-in, equipaje, Skymiles y ayuda), el **pipeline operacional** (tablero de vuelos y las 8 etapas de cada vuelo, servicio al cliente, flota y mantenimiento) y la **analítica** sobre un data warehouse (ingresos, reservas y millas nacionales).

El modelo de datos son los scripts de Enterprise Architect de `db/` (`TablesBD.sql`, 22 tablas, y `TablesDW.sql`, 8 tablas). Se cargan tal cual y se adaptan a SQLite al crear las bases.

## Requisitos

- Node.js 24 o superior (incluye `node:sqlite`; no hay que compilar nada). Probado con Node 24.19.0 y npm 11.17.0 en Windows.

## Puesta en marcha

```bash
npm install
npm run seed     # crea data/beta_airlines.db y data/beta_airlines_dw.db con los datos iniciales y corre el ETL
npm run dev      # levanta la API y el frontend
```

| Qué | URL |
| --- | --- |
| Sitio de pasajeros | http://localhost:5173 |
| Portal de operaciones | http://localhost:5173/operaciones |
| API REST | http://localhost:3001/api |

Si el servidor arranca sin bases, las crea solo. Si el data warehouse está vacío, corre el ETL al iniciar.

### Cuentas de acceso

| Rol | Nombre | Cómo entrar |
| --- | --- | --- |
| Pasajera (Skymiles Oro, viaje ATL → JFK mañana sin check-in) | Laura Gómez | Documento `1020457813` y correo `laura.gomez@gmail.com` |
| Coordinador de operaciones (todas las secciones del portal) | Andrés Restrepo | Documento `80114527` |
| Agente de servicio al cliente | Paula Méndez | Documento `52987341` |
| Analista de datos | Camilo Duarte | Documento `79635214` |

El modelo no tiene contraseñas: los pasajeros entran con documento y correo; los empleados, con su documento. Al portal solo entran los cargos de operaciones, despachos, servicio al cliente, mantenimiento y analítica.

### Pagos y correos (servicios simulados)

La pasarela de pagos y el envío de correos están **simulados en el backend** (`core/src/servicios/PagosService.ts`). La pasarela aprueba cualquier tarjeta de 13 a 19 dígitos con fecha de vencimiento futura y CVV de 3 o 4 dígitos, **excepto las que terminan en `0000`**, que el banco rechaza. El pago rechazado también queda registrado en `Pago` con estado `Rechazado`. Ningún correo se envía de verdad; la interfaz solo informa a qué dirección se enviaría.

## Pruebas

```bash
npm test
```

Vitest sobre `core/`. Cada suite corre con los dos adaptadores de base de datos (`NodeSqliteDb` y `SqlJsDb`) y cubre:

- la carga del esquema: 22 + 8 tablas, índices, restricciones con nombre y FK activas;
- el flujo reserva → pago → check-in → 8 etapas → millas;
- el ETL y las consultas 4a, 4b y 4c.

## Capturas para el informe

```bash
npx playwright install chromium   # solo la primera vez
npm run capturas
```

El script `scripts/capturas.ts` siembra una base nueva en `data/capturas/` (no toca la de desarrollo) y levanta la API y el frontend en los puertos 3101 y 5273. Después recorre el flujo completo y guarda 18 PNG de 1440 × 900 en modo claro en `capturas/`:

- **01 a 05**: búsqueda, resultados, pasajeros, pago y confirmación.
- **06**: evidencia de `Reserva`, `Tiquete`, `Factura` y `Pago`.
- **07 a 09**: check-in, pase de abordar y evidencia de `Checkin`, `Equipaje` y `RastreoEquipaje`.
- **10 a 12**: tablero de vuelos, las 8 etapas del vuelo y evidencia de eventos, tripulación y millas.
- **13 y 14**: Skymiles y rastreo de la maleta.
- **15 a 18**: reportes 4a, 4b y 4c, y evidencia del data warehouse.

Las capturas `*_bd_*` son páginas HTML que genera el script (no son parte de la aplicación). Cada una muestra el SQL ejecutado encima de su resultado.

## Sitio estático (GitHub Pages)

La misma aplicación funciona sin servidor. Los servicios de `core/` corren en el navegador sobre sql.js (SQLite en WebAssembly). En la primera visita, el navegador:

1. crea las dos bases con `TablesBD.sql` y `TablesDW.sql`;
2. corre el seed con fechas relativas al día de la visita y luego el ETL;
3. guarda las bases en IndexedDB, así lo que haga el visitante se conserva.

Para volver a empezar, usa *Restablecer datos* en el menú de la cuenta del portal de operaciones.

```bash
npm run build:pages     # compila en web/dist-pages con VITE_MODO_DATOS=local y base /beta-airlines/
npm run preview:pages   # sirve el build en http://localhost:4174/beta-airlines/
```

### Cómo publicarlo

1. Crea un repositorio **público** en GitHub, por ejemplo `beta-airlines`.
2. Sube el código a la rama `main`:
   ```bash
   git init
   git add .
   git commit -m "Beta Airlines"
   git branch -M main
   git remote add origin https://github.com/<usuario>/<repositorio>.git
   git push -u origin main
   ```
3. En GitHub ve a **Settings → Pages** y en **Source** elige **GitHub Actions**.
4. El workflow `.github/workflows/pages.yml` corre en cada push a `main`: instala dependencias, ejecuta `npm run build:pages` con la ruta base `/<repositorio>/` y publica `web/dist-pages`. Si el primer push ocurrió antes del paso 3, vuelve a lanzarlo desde **Actions → Publicar en GitHub Pages → Run workflow**.
5. Cuando termine (pestaña **Actions**, unos 2 minutos), el sitio queda en `https://<usuario>.github.io/<repositorio>/`. El portal de operaciones está en `https://<usuario>.github.io/<repositorio>/#/operaciones`.

## Arquitectura

**Capas.** Es un monorepo con npm workspaces y tres capas:

- **Interfaz:** React + Vite en `web/`.
- **Lógica de negocio:** servicios en TypeScript en `core/src/servicios/` (`ReservasService`, `PagosService`, `FacturacionService`, `CheckinService`, `EquipajeService`, `EmbarqueService`, `MillasService`, `OperacionesService`, `MantenimientoService`, `ServicioClienteService`, `AuthService`, `EtlService` y `AnaliticaService`). La fachada `BetaApi` (`core/src/app.ts`) aplica además los permisos.
- **Persistencia:** SQLite detrás de la interfaz `Db` (`core/src/db/Db.ts`), con dos adaptadores: `NodeSqliteDb` (servidor) y `SqlJsDb` (navegador). `core/src/db/loadSchema.ts` adapta en tiempo de ejecución los scripts MySQL de Enterprise Architect.

**Modo completo.** La API Express de `server/` solo valida la entrada, firma la sesión (JWT) y llama a `BetaApi`. El frontend usa `ApiClient`.

**Modo estático.** El frontend usa `LocalClient`, que llama a la misma `BetaApi` sobre sql.js. El modo se elige al compilar con `VITE_MODO_DATOS`.

**Data warehouse.** Se accede por la interfaz `DwRepository` (`core/src/dw/`), implementada por `SqliteDwRepository`. Para migrar a Snowflake bastaría con agregar un `SnowflakeDwRepository` en el servidor.

```
core/    lógica de negocio compartida (esquema, seed, servicios, ETL, analítica) y pruebas
server/  API REST en Express (modo completo)
web/     frontend React (sitio de pasajeros y portal de operaciones)
db/      scripts de Enterprise Architect (modelo de datos, sin modificar)
scripts/ capturas para el informe
```
