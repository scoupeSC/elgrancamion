/**
 * Rutas API para gestión de clientes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

// GET /api/clientes - Listar todos los clientes
router.get('/', (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    let clientes = search ? db.searchClientes(search) : db.getAllClientes();

    // Agregar conteo de boletas a cada cliente
    clientes = clientes.map(c => {
      const boletas = db.getBoletasByCliente(c.id);
      return {
        ...c,
        totalBoletas: boletas.length,
        boletasNumeros: boletas.map(b => b.numero),
      };
    });

    const total = clientes.length;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginated = clientes.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/clientes/:id - Obtener un cliente con sus boletas
router.get('/:id', (req, res) => {
  try {
    const cliente = db.getClienteById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }

    const boletas = db.getBoletasByCliente(cliente.id);

    res.json({
      success: true,
      data: {
        ...cliente,
        boletas,
        totalBoletas: boletas.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/clientes - Crear un nuevo cliente
router.post('/', (req, res) => {
  try {
    const { nombre, cedula, telefono, email, direccion } = req.body;

    if (!nombre || !cedula) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y cédula son obligatorios',
      });
    }

    // Verificar si ya existe un cliente con esa cédula
    const existente = db.getClienteByCedula(cedula);
    if (existente) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un cliente con esa cédula',
        data: existente,
      });
    }

    const cliente = db.createCliente({
      id: uuidv4(),
      nombre,
      cedula,
      telefono: telefono || '',
      email: email || '',
      direccion: direccion || '',
    });

    res.status(201).json({ success: true, data: cliente });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/clientes/:id - Actualizar un cliente
router.put('/:id', (req, res) => {
  try {
    const { nombre, telefono, email, direccion } = req.body;
    const updated = db.updateCliente(req.params.id, { nombre, telefono, email, direccion });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/clientes/:id - Eliminar un cliente
router.delete('/:id', (req, res) => {
  try {
    // Liberar boletas del cliente antes de eliminar
    const boletas = db.getBoletasByCliente(req.params.id);
    boletas.forEach(b => {
      db.updateBoleta(b.numero, {
        estado: 'disponible',
        clienteId: null,
        fechaVenta: null,
      });
    });

    const deleted = db.deleteCliente(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }

    res.json({ success: true, message: 'Cliente eliminado', boletasLiberadas: boletas.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
