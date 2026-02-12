/**
 * Rutas API para gestión de boletas
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const emailService = require('../services/email');

// GET /api/boletas - Listar boletas con paginación y filtros
router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 50, estado, search, clienteId } = req.query;
    let boletas = db.getAllBoletas();

    // Filtrar por estado
    if (estado) {
      boletas = boletas.filter(b => b.estado === estado);
    }

    // Filtrar por cliente
    if (clienteId) {
      boletas = boletas.filter(b => b.clienteId === clienteId);
    }

    // Buscar por número
    if (search) {
      boletas = boletas.filter(b => b.numero.includes(search));
    }

    const total = boletas.length;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginated = boletas.slice(offset, offset + parseInt(limit));

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

// GET /api/boletas/stats - Estadísticas rápidas
router.get('/stats', (req, res) => {
  try {
    const stats = db.countBoletas();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/boletas/:numero - Obtener boleta por número
router.get('/:numero', (req, res) => {
  try {
    const boleta = db.getBoletaByNumber(req.params.numero);
    if (!boleta) {
      return res.status(404).json({ success: false, error: 'Boleta no encontrada' });
    }

    // Si tiene cliente, incluir datos del cliente
    let cliente = null;
    if (boleta.clienteId) {
      cliente = db.getClienteById(boleta.clienteId);
    }

    res.json({ success: true, data: { ...boleta, cliente } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/boletas/:numero/vender - Vender/asignar boleta a cliente
router.put('/:numero/vender', async (req, res) => {
  try {
    const { clienteId } = req.body;
    const boleta = db.getBoletaByNumber(req.params.numero);

    if (!boleta) {
      return res.status(404).json({ success: false, error: 'Boleta no encontrada' });
    }

    if (boleta.estado === 'vendida') {
      return res.status(400).json({ success: false, error: 'La boleta ya fue vendida' });
    }

    const cliente = db.getClienteById(clienteId);
    if (!cliente) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }

    const updated = db.updateBoleta(req.params.numero, {
      estado: 'vendida',
      clienteId,
      fechaVenta: new Date().toISOString(),
    });

    // Enviar boleta por email (no bloquea la respuesta)
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    let emailResult = { success: false, message: 'No enviado' };
    if (cliente.email) {
      emailResult = await emailService.enviarBoletaPorEmail(updated, cliente, baseUrl);
    }

    res.json({ success: true, data: { ...updated, cliente }, email: emailResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/boletas/:numero/reservar - Reservar boleta
router.put('/:numero/reservar', (req, res) => {
  try {
    const { clienteId } = req.body;
    const boleta = db.getBoletaByNumber(req.params.numero);

    if (!boleta) {
      return res.status(404).json({ success: false, error: 'Boleta no encontrada' });
    }

    if (boleta.estado === 'vendida') {
      return res.status(400).json({ success: false, error: 'La boleta ya fue vendida' });
    }

    const updated = db.updateBoleta(req.params.numero, {
      estado: 'reservada',
      clienteId: clienteId || null,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/boletas/:numero/liberar - Liberar boleta (volver a disponible)
router.put('/:numero/liberar', (req, res) => {
  try {
    const boleta = db.getBoletaByNumber(req.params.numero);

    if (!boleta) {
      return res.status(404).json({ success: false, error: 'Boleta no encontrada' });
    }

    const updated = db.updateBoleta(req.params.numero, {
      estado: 'disponible',
      clienteId: null,
      fechaVenta: null,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/boletas/vender-lote - Vender múltiples boletas a un cliente
router.post('/vender-lote', async (req, res) => {
  try {
    const { numeros, clienteId } = req.body;

    if (!numeros || !Array.isArray(numeros) || numeros.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe enviar un array de números de boletas' });
    }

    const cliente = db.getClienteById(clienteId);
    if (!cliente) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }

    const resultados = [];
    const errores = [];

    for (const numero of numeros) {
      const boleta = db.getBoletaByNumber(numero);
      if (!boleta) {
        errores.push({ numero, error: 'Boleta no encontrada' });
        continue;
      }
      if (boleta.estado === 'vendida') {
        errores.push({ numero, error: 'Ya vendida' });
        continue;
      }

      const updated = db.updateBoleta(numero, {
        estado: 'vendida',
        clienteId,
        fechaVenta: new Date().toISOString(),
      });
      resultados.push(updated);
    }

    // Enviar boletas por email al cliente
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    let emailResult = { success: false, message: 'No enviado' };
    if (cliente.email && resultados.length > 0) {
      emailResult = await emailService.enviarBoletasLotePorEmail(resultados, cliente, baseUrl);
    }

    res.json({
      success: true,
      data: { vendidas: resultados, errores },
      email: emailResult,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
