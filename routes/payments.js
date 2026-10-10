const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// POST /api/payments - Registrar un pago (RF-008) (Solo Personal autorizado o Admin)
router.post('/', authenticateToken, requireRole('personal', 'admin'), (req, res) => {
  try {
    const { appointment_id, amount, payment_method } = req.body;

    if (!appointment_id || amount == null || !payment_method) {
      return res.status(400).json({ error: 'ID de cita, monto y método de pago son obligatorios.' });
    }

    const validMethods = ['efectivo', 'tarjeta', 'transferencia'];
    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({ error: 'Método de pago no válido (efectivo, tarjeta, transferencia).' });
    }

    const paymentTransaction = db.transaction(() => {
      // 1. Verificar cita existente
      const app = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment_id);
      if (!app) {
        throw new Error('La cita especificada no existe.');
      }

      if (app.status === 'cancelada') {
        throw new Error('No se puede registrar un pago para una cita cancelada.');
      }

      // 2. Verificar si ya fue pagada
      const existingPayment = db.prepare('SELECT id FROM payments WHERE appointment_id = ?').get(appointment_id);
      if (existingPayment) {
        throw new Error('Esta cita ya cuenta con un pago registrado.');
      }

      // 3. Registrar el pago
      const result = db.prepare(`
        INSERT INTO payments (appointment_id, amount, payment_method, status, registered_by)
        VALUES (?, ?, ?, 'completado', ?)
      `).run(appointment_id, parseFloat(amount), payment_method, req.user.id);

      // 4. Si la cita estaba pendiente o confirmada, podemos actualizarla a completada
      db.prepare("UPDATE appointments SET status = 'completada' WHERE id = ? AND status != 'completada'").run(appointment_id);

      return {
        payment_id: result.lastInsertRowid,
        appointment_id: parseInt(appointment_id),
        amount: parseFloat(amount),
        payment_method,
        status: 'completado',
        registered_by: req.user.name
      };
    });

    const payment = paymentTransaction();

    res.status(201).json({
      message: 'Pago registrado exitosamente.',
      payment
    });

  } catch (error) {
    console.error('Error al registrar pago:', error.message);
    res.status(400).json({ error: error.message || 'Error al procesar el pago.' });
  }
});

// GET /api/payments - Listar historial de pagos (RF-008) (Solo Personal o Admin)
router.get('/', authenticateToken, requireRole('personal', 'admin'), (req, res) => {
  try {
    const { date, payment_method } = req.query;

    let sql = `
      SELECT 
        p.*,
        a.date AS appointment_date,
        a.start_time,
        u_client.name AS client_name,
        u_barber.name AS barber_name,
        s.name AS service_name,
        u_reg.name AS registered_by_name
      FROM payments p
      JOIN appointments a ON p.appointment_id = a.id
      JOIN users u_client ON a.client_id = u_client.id
      JOIN barbers b ON a.barber_id = b.id
      JOIN users u_barber ON b.user_id = u_barber.id
      JOIN services s ON a.service_id = s.id
      JOIN users u_reg ON p.registered_by = u_reg.id
      WHERE 1=1
    `;

    const params = [];

    if (date) {
      sql += ' AND a.date = ?';
      params.push(date);
    }

    if (payment_method) {
      sql += ' AND p.payment_method = ?';
      params.push(payment_method);
    }

    sql += ' ORDER BY p.created_at DESC';

    const payments = db.prepare(sql).all(...params);
    res.json(payments);

  } catch (error) {
    console.error('Error al obtener lista de pagos:', error);
    res.status(500).json({ error: 'Error al consultar el historial de pagos.' });
  }
});

module.exports = router;
