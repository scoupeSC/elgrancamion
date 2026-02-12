/**
 * 🎫 Sistema de Gestión de Boletas - Rifa
 * Servidor principal Express
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api/boletas', require('./routes/boletas'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/print', require('./routes/print'));

// Ruta pública para ver boleta (QR redirige aquí)
app.get('/boleta/:numero', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'boleta.html'));
});

// Ruta para imprimir boleta
app.get('/imprimir/:numero', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'imprimir.html'));
});

// Dashboard admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('');
  console.log('🎫 ═══════════════════════════════════════════════');
  console.log('🎫  Sistema de Gestión de Boletas - Rifa');
  console.log('🎫 ═══════════════════════════════════════════════');
  console.log(`🌐  Servidor:      http://localhost:${PORT}`);
  console.log(`📊  Dashboard:     http://localhost:${PORT}/admin`);
  console.log(`🔌  API:           http://localhost:${PORT}/api`);
  console.log('🎫 ═══════════════════════════════════════════════');
  console.log('');

  // Auto-ping para mantener el servicio despierto en Render (cada 14 min)
  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
      const https = require('https');
      https.get(`${process.env.RENDER_EXTERNAL_URL}/api/health`, (res) => {
        console.log(`🏓 Auto-ping: ${res.statusCode}`);
      }).on('error', (err) => {
        console.log('🏓 Auto-ping error:', err.message);
      });
    }, 14 * 60 * 1000); // Cada 14 minutos
    console.log('🏓 Auto-ping activado (cada 14 min)');
  }
});
