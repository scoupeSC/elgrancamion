/**
 * Rutas API para dashboard y métricas
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const emailService = require('../services/email');

// GET /api/dashboard - Métricas generales
router.get('/', (req, res) => {
  try {
    const metrics = db.getDashboardMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/config - Configuración de la rifa
router.get('/config', (req, res) => {
  try {
    const config = db.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dashboard/config - Actualizar configuración
router.put('/config', (req, res) => {
  try {
    const config = db.updateConfig(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dashboard/test-email - Probar conexión SMTP
router.post('/test-email', async (req, res) => {
  try {
    const result = await emailService.testSmtpConnection();
    res.json({ success: result.success, message: result.message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
