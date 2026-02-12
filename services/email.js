/**
 * Servicio de envío de correos electrónicos
 * Envía boletas por email al cliente cuando se realiza una compra
 */

const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const db = require('../db/database');

/**
 * Crea el transporter de nodemailer con la config SMTP guardada
 */
function createTransporter() {
  const config = db.getConfig();

  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: parseInt(config.smtpPort) || 587,
    secure: (parseInt(config.smtpPort) || 587) === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

/**
 * Envía la boleta por correo electrónico al cliente
 * @param {Object} boleta - Datos de la boleta
 * @param {Object} cliente - Datos del cliente
 * @param {string} baseUrl - URL base del servidor (para generar links)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function enviarBoletaPorEmail(boleta, cliente, baseUrl) {
  if (!cliente.email) {
    return { success: false, message: 'El cliente no tiene email registrado' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'SMTP no configurado. Configure el correo en Configuración.' };
  }

  const config = db.getConfig();

  try {
    // Generar QR como base64 para embeber en el email
    const qrUrl = `${baseUrl}/boleta/${boleta.numero}`;
    const qrBase64 = await QRCode.toDataURL(qrUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const precio = config.precioBoleta
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(config.precioBoleta)
      : '';

    const fechaSorteo = config.fechaSorteo
      ? new Date(config.fechaSorteo).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Por definir';

    const htmlEmail = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background-color:#f5f6fa; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f6fa; padding: 30px 0;">
        <tr>
          <td align="center">
            <table width="500" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              
              <!-- HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #6c5ce7, #a29bfe); padding: 30px; text-align: center; color: white;">
                  <h1 style="margin:0; font-size:28px; letter-spacing:2px;">🎫 ${config.nombreRifa || 'RIFA'}</h1>
                  <p style="margin:8px 0 0; opacity:0.9; font-size:14px;">${config.descripcion || ''}</p>
                  ${config.premio ? `<p style="margin:10px 0 0; font-size:16px; font-weight:700;">🏆 Premio: ${config.premio}</p>` : ''}
                </td>
              </tr>

              <!-- NÚMERO DE BOLETA -->
              <tr>
                <td style="text-align:center; padding:24px; background:#f8f9ff;">
                  <p style="margin:0 0 4px; color:#636e72; font-size:12px; text-transform:uppercase; letter-spacing:2px;">Número de Boleta</p>
                  <h2 style="margin:0; font-size:48px; font-weight:900; color:#6c5ce7; letter-spacing:8px;">#${boleta.numero}</h2>
                </td>
              </tr>

              <!-- DATOS -->
              <tr>
                <td style="padding: 24px;">
                  <table width="100%" cellpadding="8" cellspacing="0">
                    <tr>
                      <td style="color:#636e72; font-size:14px; border-bottom:1px solid #eee;">Estado</td>
                      <td style="font-weight:600; font-size:14px; text-align:right; border-bottom:1px solid #eee;">
                        <span style="background:#e8f8f5; color:#00b894; padding:4px 12px; border-radius:12px; font-size:12px;">✅ COMPRADA</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="color:#636e72; font-size:14px; border-bottom:1px solid #eee;">Código</td>
                      <td style="font-weight:600; font-size:14px; text-align:right; border-bottom:1px solid #eee; font-family:monospace;">${boleta.codigoBarras}</td>
                    </tr>
                    ${precio ? `
                    <tr>
                      <td style="color:#636e72; font-size:14px; border-bottom:1px solid #eee;">Valor</td>
                      <td style="font-weight:600; font-size:14px; text-align:right; border-bottom:1px solid #eee;">${precio}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="color:#636e72; font-size:14px; border-bottom:1px solid #eee;">Fecha Sorteo</td>
                      <td style="font-weight:600; font-size:14px; text-align:right; border-bottom:1px solid #eee;">${fechaSorteo}</td>
                    </tr>
                    <tr>
                      <td style="color:#636e72; font-size:14px;">Fecha Compra</td>
                      <td style="font-weight:600; font-size:14px; text-align:right;">${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- DATOS DEL COMPRADOR -->
              <tr>
                <td style="padding: 0 24px;">
                  <div style="background:#f0f0ff; border-radius:12px; padding:16px;">
                    <h3 style="margin:0 0 8px; color:#6c5ce7; font-size:14px;">👤 Datos del Comprador</h3>
                    <p style="margin:2px 0; font-size:14px;"><strong>${cliente.nombre}</strong></p>
                    <p style="margin:2px 0; font-size:13px; color:#636e72;">CC: ${cliente.cedula}</p>
                    ${cliente.telefono ? `<p style="margin:2px 0; font-size:13px; color:#636e72;">Tel: ${cliente.telefono}</p>` : ''}
                    ${cliente.email ? `<p style="margin:2px 0; font-size:13px; color:#636e72;">Email: ${cliente.email}</p>` : ''}
                  </div>
                </td>
              </tr>

              <!-- QR CODE -->
              <tr>
                <td style="text-align:center; padding:24px;">
                  <p style="margin:0 0 8px; color:#636e72; font-size:12px;">Escanea el QR para ver tu boleta</p>
                  <img src="${qrBase64}" alt="QR Code" width="160" height="160" style="border:2px solid #eee; border-radius:8px;">
                  <p style="margin:8px 0 0; font-size:11px; color:#a0a0a0;">
                    <a href="${qrUrl}" style="color:#6c5ce7; text-decoration:none;">${qrUrl}</a>
                  </p>
                </td>
              </tr>

              <!-- BOTÓN -->
              <tr>
                <td style="text-align:center; padding:0 24px 24px;">
                  <a href="${qrUrl}" style="display:inline-block; background:#6c5ce7; color:white; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:600; font-size:14px;">
                    🎫 Ver mi Boleta Online
                  </a>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background:#f8f9fa; padding:16px 24px; text-align:center; border-top:1px solid #eee;">
                  <p style="margin:0; font-size:12px; color:#636e72;">
                    ${config.organizador ? `Organiza: <strong>${config.organizador}</strong>` : ''}
                    ${config.telefono ? ` | Tel: ${config.telefono}` : ''}
                  </p>
                  <p style="margin:6px 0 0; font-size:11px; color:#a0a0a0;">
                    Conserve este correo como comprobante de su compra.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const mailOptions = {
      from: `"${config.nombreRifa || 'Rifa'}" <${config.smtpUser}>`,
      to: cliente.email,
      subject: `🎫 ¡Tu Boleta #${boleta.numero} - ${config.nombreRifa || 'Rifa'}!`,
      html: htmlEmail,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`📧 Email enviado a ${cliente.email} - Boleta #${boleta.numero} - MessageId: ${info.messageId}`);

    return {
      success: true,
      message: `Correo enviado exitosamente a ${cliente.email}`,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`❌ Error enviando email a ${cliente.email}:`, error.message);
    return {
      success: false,
      message: `Error enviando correo: ${error.message}`,
    };
  }
}

/**
 * Envía boletas en lote (múltiples boletas al mismo cliente en un solo correo)
 */
async function enviarBoletasLotePorEmail(boletas, cliente, baseUrl) {
  if (!cliente.email) {
    return { success: false, message: 'El cliente no tiene email registrado' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'SMTP no configurado' };
  }

  const config = db.getConfig();

  try {
    const precio = config.precioBoleta
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(config.precioBoleta)
      : '';
    const totalPago = config.precioBoleta
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(config.precioBoleta * boletas.length)
      : '';

    // Generar QRs para cada boleta
    let boletasHtml = '';
    for (const boleta of boletas) {
      const qrUrl = `${baseUrl}/boleta/${boleta.numero}`;
      const qrBase64 = await QRCode.toDataURL(qrUrl, { width: 120, margin: 1 });

      boletasHtml += `
        <tr>
          <td style="padding:12px; text-align:center; border-bottom:1px solid #eee;">
            <span style="font-size:20px; font-weight:900; color:#6c5ce7; letter-spacing:4px;">#${boleta.numero}</span>
          </td>
          <td style="padding:12px; text-align:center; border-bottom:1px solid #eee; font-family:monospace; font-size:12px;">
            ${boleta.codigoBarras}
          </td>
          <td style="padding:12px; text-align:center; border-bottom:1px solid #eee;">
            <a href="${qrUrl}"><img src="${qrBase64}" width="80" height="80" alt="QR"></a>
          </td>
        </tr>
      `;
    }

    const htmlEmail = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; background-color:#f5f6fa; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f6fa; padding:30px 0;">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.1);">
              <tr>
                <td style="background:linear-gradient(135deg,#6c5ce7,#a29bfe); padding:30px; text-align:center; color:white;">
                  <h1 style="margin:0; font-size:26px;">🎫 ${config.nombreRifa || 'RIFA'}</h1>
                  ${config.premio ? `<p style="margin:8px 0 0; font-weight:700;">🏆 ${config.premio}</p>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding:24px; text-align:center;">
                  <h2 style="margin:0 0 4px; color:#2d3436;">¡Hola ${cliente.nombre}!</h2>
                  <p style="color:#636e72;">Aquí están tus <strong>${boletas.length} boleta(s)</strong></p>
                  ${totalPago ? `<p style="color:#6c5ce7; font-size:18px; font-weight:700;">Total: ${totalPago}</p>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee; border-radius:8px; overflow:hidden;">
                    <tr style="background:#f8f9fa;">
                      <th style="padding:10px; font-size:12px; color:#636e72; text-transform:uppercase;">Boleta</th>
                      <th style="padding:10px; font-size:12px; color:#636e72; text-transform:uppercase;">Código</th>
                      <th style="padding:10px; font-size:12px; color:#636e72; text-transform:uppercase;">QR</th>
                    </tr>
                    ${boletasHtml}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background:#f8f9fa; padding:16px; text-align:center; border-top:1px solid #eee;">
                  <p style="margin:0; font-size:12px; color:#636e72;">
                    ${config.organizador ? `Organiza: <strong>${config.organizador}</strong>` : ''}
                    ${config.telefono ? ` | Tel: ${config.telefono}` : ''}
                  </p>
                  <p style="margin:6px 0 0; font-size:11px; color:#a0a0a0;">Conserve este correo como comprobante.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const nums = boletas.map(b => `#${b.numero}`).join(', ');
    const info = await transporter.sendMail({
      from: `"${config.nombreRifa || 'Rifa'}" <${config.smtpUser}>`,
      to: cliente.email,
      subject: `🎫 Tus ${boletas.length} Boleta(s) ${nums} - ${config.nombreRifa || 'Rifa'}`,
      html: htmlEmail,
    });

    console.log(`📧 Email lote enviado a ${cliente.email} - ${boletas.length} boletas - MessageId: ${info.messageId}`);
    return { success: true, message: `Correo enviado a ${cliente.email}`, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error enviando email lote:`, error.message);
    return { success: false, message: `Error enviando correo: ${error.message}` };
  }
}

/**
 * Test de conexión SMTP
 */
async function testSmtpConnection() {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'SMTP no configurado' };
  }
  try {
    await transporter.verify();
    return { success: true, message: 'Conexión SMTP exitosa ✅' };
  } catch (error) {
    return { success: false, message: `Error de conexión: ${error.message}` };
  }
}

module.exports = {
  enviarBoletaPorEmail,
  enviarBoletasLotePorEmail,
  testSmtpConnection,
};
