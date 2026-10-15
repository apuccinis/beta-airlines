import { ARCHIVO_BD, ARCHIVO_DW, crearBases } from '../bases';

const t0 = Date.now();
const { seed, etl } = crearBases();

console.log(`\nBases creadas desde db/TablesBD.sql y db/TablesDW.sql en ${Date.now() - t0} ms`);
console.log(`  Operacional:     ${ARCHIVO_BD}`);
console.log(`  Data warehouse:  ${ARCHIVO_DW}\n`);
console.log('Filas por tabla (operacional):');
for (const [t, n] of Object.entries(seed.filas)) console.log(`  ${t.padEnd(24)} ${String(n).padStart(6)}`);
console.log('\nFilas por tabla (data warehouse):');
for (const [t, n] of Object.entries(etl.filas)) console.log(`  ${t.padEnd(24)} ${String(n).padStart(6)}`);
console.log('\nCuentas de acceso:');
for (const c of seed.cuentas) {
  console.log(`  ${c.rol.padEnd(26)} ${c.nombre.padEnd(18)} documento ${c.documento}${c.email ? `  ·  correo ${c.email}` : `  ·  ${c.cargo}`}`);
}
console.log('');
