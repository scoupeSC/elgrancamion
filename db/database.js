/**
 * Base de datos provisional basada en archivos JSON.
 * Fácil de migrar a MongoDB, PostgreSQL, etc.
 */

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');

// Asegurar que exista el directorio de datos
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const FILES = {
  boletas: path.join(DB_DIR, 'boletas.json'),
  clientes: path.join(DB_DIR, 'clientes.json'),
  config: path.join(DB_DIR, 'config.json'),
};

// Cache en memoria para rendimiento
let cache = {
  boletas: null,
  clientes: null,
  config: null,
};

function initFile(file, defaultData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

function loadCollection(name) {
  if (cache[name]) return cache[name];
  initFile(FILES[name], []);
  const raw = fs.readFileSync(FILES[name], 'utf-8');
  cache[name] = JSON.parse(raw);
  return cache[name];
}

function saveCollection(name, data) {
  cache[name] = data;
  fs.writeFileSync(FILES[name], JSON.stringify(data, null, 2), 'utf-8');
}

// ==================== BOLETAS ====================

function getAllBoletas() {
  return loadCollection('boletas');
}

function getBoletaByNumber(numero) {
  const boletas = loadCollection('boletas');
  return boletas.find(b => b.numero === numero);
}

function getBoletaById(id) {
  const boletas = loadCollection('boletas');
  return boletas.find(b => b.id === id);
}

function getBoletasByStatus(status) {
  const boletas = loadCollection('boletas');
  return boletas.filter(b => b.estado === status);
}

function getBoletasByCliente(clienteId) {
  const boletas = loadCollection('boletas');
  return boletas.filter(b => b.clienteId === clienteId);
}

function updateBoleta(numero, updates) {
  const boletas = loadCollection('boletas');
  const index = boletas.findIndex(b => b.numero === numero);
  if (index === -1) return null;
  boletas[index] = { ...boletas[index], ...updates, updatedAt: new Date().toISOString() };
  saveCollection('boletas', boletas);
  return boletas[index];
}

function saveBoletas(boletasArray) {
  saveCollection('boletas', boletasArray);
}

function countBoletas() {
  const boletas = loadCollection('boletas');
  const total = boletas.length;
  const vendidas = boletas.filter(b => b.estado === 'vendida').length;
  const disponibles = boletas.filter(b => b.estado === 'disponible').length;
  const reservadas = boletas.filter(b => b.estado === 'reservada').length;
  return { total, vendidas, disponibles, reservadas };
}

// ==================== CLIENTES ====================

function getAllClientes() {
  return loadCollection('clientes');
}

function getClienteById(id) {
  const clientes = loadCollection('clientes');
  return clientes.find(c => c.id === id);
}

function getClienteByCedula(cedula) {
  const clientes = loadCollection('clientes');
  return clientes.find(c => c.cedula === cedula);
}

function createCliente(cliente) {
  const clientes = loadCollection('clientes');
  cliente.createdAt = new Date().toISOString();
  cliente.updatedAt = new Date().toISOString();
  clientes.push(cliente);
  saveCollection('clientes', clientes);
  return cliente;
}

function updateCliente(id, updates) {
  const clientes = loadCollection('clientes');
  const index = clientes.findIndex(c => c.id === id);
  if (index === -1) return null;
  clientes[index] = { ...clientes[index], ...updates, updatedAt: new Date().toISOString() };
  saveCollection('clientes', clientes);
  return clientes[index];
}

function deleteCliente(id) {
  const clientes = loadCollection('clientes');
  const index = clientes.findIndex(c => c.id === id);
  if (index === -1) return false;
  clientes.splice(index, 1);
  saveCollection('clientes', clientes);
  return true;
}

function searchClientes(query) {
  const clientes = loadCollection('clientes');
  const q = query.toLowerCase();
  return clientes.filter(c =>
    c.nombre.toLowerCase().includes(q) ||
    c.cedula.includes(q) ||
    (c.telefono && c.telefono.includes(q)) ||
    (c.email && c.email.toLowerCase().includes(q))
  );
}

// ==================== DASHBOARD / MÉTRICAS ====================

function getDashboardMetrics() {
  const boletas = loadCollection('boletas');
  const clientes = loadCollection('clientes');

  const totalBoletas = boletas.length;
  const vendidas = boletas.filter(b => b.estado === 'vendida').length;
  const disponibles = boletas.filter(b => b.estado === 'disponible').length;
  const reservadas = boletas.filter(b => b.estado === 'reservada').length;

  const porcentajeVendidas = totalBoletas > 0 ? ((vendidas / totalBoletas) * 100).toFixed(2) : 0;

  // Boletas por cliente
  const boletasPorCliente = {};
  boletas.filter(b => b.clienteId).forEach(b => {
    if (!boletasPorCliente[b.clienteId]) {
      boletasPorCliente[b.clienteId] = 0;
    }
    boletasPorCliente[b.clienteId]++;
  });

  // Top compradores
  const topCompradores = Object.entries(boletasPorCliente)
    .map(([clienteId, cantidad]) => {
      const cliente = clientes.find(c => c.id === clienteId);
      return {
        clienteId,
        nombre: cliente ? cliente.nombre : 'Desconocido',
        cedula: cliente ? cliente.cedula : '',
        cantidad,
      };
    })
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  // Ventas por fecha
  const ventasPorFecha = {};
  boletas.filter(b => b.estado === 'vendida' && b.fechaVenta).forEach(b => {
    const fecha = b.fechaVenta.split('T')[0];
    if (!ventasPorFecha[fecha]) ventasPorFecha[fecha] = 0;
    ventasPorFecha[fecha]++;
  });

  // Ingresos estimados (precio por boleta * vendidas)
  const precioBoleta = getConfig().precioBoleta || 0;
  const ingresoTotal = vendidas * precioBoleta;

  return {
    totalBoletas,
    vendidas,
    disponibles,
    reservadas,
    porcentajeVendidas: parseFloat(porcentajeVendidas),
    totalClientes: clientes.length,
    topCompradores,
    ventasPorFecha,
    ingresoTotal,
    precioBoleta,
  };
}

// ==================== CONFIG ====================

function getConfig() {
  const defaults = {
    nombreRifa: 'Rifas El Gran Camión',
    descripcion: 'KIA Picanto 0KM 2026 - Juega el 20 de junio con la Lotería de Boyacá',
    precioBoleta: 120000,
    totalBoletas: 10000,
    fechaSorteo: '2026-06-20',
    premio: 'KIA Picanto 0KM 2026',
    organizador: 'Inversiones Castaño S.A.S',
    telefono: '3217706789',
    logo: '/img/kia.jpg',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
  };
  initFile(FILES.config, defaults);
  const raw = fs.readFileSync(FILES.config, 'utf-8');
  const saved = JSON.parse(raw);
  // Siempre mergear con defaults para incluir campos nuevos
  return { ...defaults, ...saved };
}

function updateConfig(updates) {
  const config = getConfig();
  const newConfig = { ...config, ...updates };
  fs.writeFileSync(FILES.config, JSON.stringify(newConfig, null, 2), 'utf-8');
  return newConfig;
}

// ==================== RESET CACHE ====================

function clearCache() {
  cache = { boletas: null, clientes: null, config: null };
}

module.exports = {
  getAllBoletas,
  getBoletaByNumber,
  getBoletaById,
  getBoletasByStatus,
  getBoletasByCliente,
  updateBoleta,
  saveBoletas,
  countBoletas,
  getAllClientes,
  getClienteById,
  getClienteByCedula,
  createCliente,
  updateCliente,
  deleteCliente,
  searchClientes,
  getDashboardMetrics,
  getConfig,
  updateConfig,
  clearCache,
};
