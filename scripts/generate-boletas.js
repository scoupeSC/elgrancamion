/**
 * Script para generar las 10,000 boletas iniciales.
 * Ejecutar: npm run generate
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
const BOLETAS_FILE = path.join(DB_DIR, 'boletas.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const TOTAL = 10000;

console.log(`🎫 Generando ${TOTAL} boletas (0000-9999)...`);

const boletas = [];

for (let i = 0; i < TOTAL; i++) {
  const numero = String(i).padStart(4, '0'); // 0000 - 9999
  boletas.push({
    id: uuidv4(),
    numero: numero,
    codigoBarras: `RIFA-${numero}`, // Identificador para código de barras
    estado: 'disponible', // disponible | vendida | reservada
    clienteId: null,
    fechaVenta: null,
    vendidoPor: null,
    notas: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (i > 0 && i % 1000 === 0) {
    console.log(`  ✅ ${i} boletas generadas...`);
  }
}

fs.writeFileSync(BOLETAS_FILE, JSON.stringify(boletas, null, 2), 'utf-8');
console.log(`\n🎉 ¡${TOTAL} boletas generadas exitosamente!`);
console.log(`📁 Archivo: ${BOLETAS_FILE}`);
