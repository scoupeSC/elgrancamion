/**
 * Rutas para generación de QR y código de barras para impresión de boletas
 */

const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const db = require('../db/database');

// GET /api/print/:numero - Datos para impresión de boleta (QR + Barcode)
router.get('/:numero', async (req, res) => {
  try {
    const boleta = db.getBoletaByNumber(req.params.numero);
    if (!boleta) {
      return res.status(404).json({ success: false, error: 'Boleta no encontrada' });
    }

    const config = db.getConfig();
    let cliente = null;
    if (boleta.clienteId) {
      cliente = db.getClienteById(boleta.clienteId);
    }

    // URL del QR: si tiene cliente -> ver datos, si no -> registrar
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const qrUrl = `${baseUrl}/boleta/${boleta.numero}`;

    // Generar QR como data URL
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.json({
      success: true,
      data: {
        boleta,
        cliente,
        config: {
          nombreRifa: config.nombreRifa,
          descripcion: config.descripcion,
          premio: config.premio,
          fechaSorteo: config.fechaSorteo,
          organizador: config.organizador,
          precioBoleta: config.precioBoleta,
        },
        qrDataUrl,
        qrUrl,
        codigoBarras: boleta.codigoBarras,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
