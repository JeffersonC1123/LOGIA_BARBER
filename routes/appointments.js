const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { createAppointment } = require('../utils/appointmentBooking');
const { 
  calculateEndTime, 
  doTimesOverlap, 
  isWithinWorkingHours, 
  isPastDateTime 
} = require('../utils/timeHelper');

// POST /api/appointments - Crear nueva reserva (RF-004 y RF-005)
router.post('/', authenticateToken, (req, res) => {
  try {
    const appointment = createAppointment(db, req.user, req.body);

    res.status(201).json({
      message: 'Reserva creada con éxito.',
      appointment
    });

  } catch (error) {
    console.error('Error al crear cita:', error.message);
    res.status(400).json({ error: error.message || 'Error al procesar la reserva.' });
  }
});

// GET /api/appointments - Obtener citas según el rol y filtros (RF-006)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { date, barber_id, status } = req.query;

    let sql = `
      SELECT 
        a.*,
        u_client.name AS client_name,
        u_client.email AS client_email,
        u_client.phone AS client_phone,
        u_barber.name AS barber_name,
        s.name AS service_name,
        s.duration_minutes,
        p.id AS payment_id,
        p.amount AS payment_amount,
        p.payment_method,
        p.status AS payment_status
      FROM appointments a
      JOIN users u_client ON a.client_id = u_client.id
      JOIN barbers b ON a.barber_id = b.id
      JOIN users u_barber ON b.user_id = u_barber.id
      JOIN services s ON a.service_id = s.id
      LEFT JOIN payments p ON a.id = p.appointment_id
      WHERE 1=1
    `;

    const params = [];

    // Filtrado por rol
    if (role === 'cliente') {
      sql += ' AND a.client_id = ?';
      params.push(userId);
    } else if (role === 'barbero') {
      // Buscar el id del barbero correspondiente al user.id
      const barber = db.prepare('SELECT id FROM barbers WHERE user_id = ?').get(userId);
      if (barber) {
        sql += ' AND a.barber_id = ?';
        params.push(barber.id);
      } else {
        return res.json([]);
      }
    }

    // Filtros opcionales
    if (date) {
      sql += ' AND a.date = ?';
      params.push(date);
    }

    if (barber_id && ['admin', 'personal'].includes(role)) {
      sql += ' AND a.barber_id = ?';
      params.push(barber_id);
    }

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY a.date DESC, a.start_time ASC';

    const appointments = db.prepare(sql).all(...params);
    res.json(appointments);

  } catch (error) {
    console.error('Error al listar citas:', error);
    res.status(500).json({ error: 'Error al obtener el historial de citas.' });
  }
});

// GET /api/appointments/:id - Obtener detalle de cita
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const appointmentId = req.params.id;
    const app = db.prepare(`
      SELECT 
        a.*,
        u_client.name AS client_name,
        u_client.phone AS client_phone,
        u_barber.name AS barber_name,
        s.name AS service_name,
        p.status AS payment_status
      FROM appointments a
      JOIN users u_client ON a.client_id = u_client.id
      JOIN barbers b ON a.barber_id = b.id
      JOIN users u_barber ON b.user_id = u_barber.id
      JOIN services s ON a.service_id = s.id
      LEFT JOIN payments p ON a.id = p.appointment_id
      WHERE a.id = ?
    `).get(appointmentId);

    if (!app) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    // Verificar permisos
    if (req.user.role === 'cliente' && app.client_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta cita.' });
    }

    res.json(app);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la cita.' });
  }
});

// PUT /api/appointments/:id/status - Actualizar estado de una cita (RF-006, RF-007)
router.put('/:id/status', authenticateToken, (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['pendiente', 'confirmada', 'en_proceso', 'completada', 'cancelada'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado de cita no válido.' });
    }

    const app = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
    if (!app) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    // Permisos por rol:
    // - cliente: solo puede cancelar sus propias citas pendientes
    // - barbero: puede actualizar citas asignadas a él
    // - personal/admin: pueden actualizar cualquier cita
    if (req.user.role === 'cliente') {
      if (app.client_id !== req.user.id) {
        return res.status(403).json({ error: 'No tienes permiso para modificar esta cita.' });
      }
      if (status !== 'cancelada') {
        return res.status(403).json({ error: 'Los clientes solo pueden cancelar citas.' });
      }
    } else if (req.user.role === 'barbero') {
      const barber = db.prepare('SELECT id FROM barbers WHERE user_id = ?').get(req.user.id);
      if (!barber || barber.id !== app.barber_id) {
        return res.status(403).json({ error: 'Solo puedes gestionar las citas asignadas a tu agenda.' });
      }
    }

    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, appointmentId);

    res.json({
      message: `El estado de la cita #${appointmentId} ha sido actualizado a "${status}".`,
      appointment_id: parseInt(appointmentId),
      status
    });
  } catch (error) {
    console.error('Error al actualizar estado de cita:', error);
    res.status(500).json({ error: 'Error al actualizar el estado de la cita.' });
  }
});

// PUT /api/appointments/:id - Modificar una cita (RF-007)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { date, start_time, barber_id, service_id, notes } = req.body;

    const modifyTransaction = db.transaction(() => {
      const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
      if (!existing) {
        throw new Error('Cita no encontrada.');
      }

      // Validar permisos
      if (req.user.role === 'cliente' && existing.client_id !== req.user.id) {
        throw new Error('No tienes permiso para modificar esta cita.');
      }

      if (existing.status === 'completada' || existing.status === 'cancelada') {
        throw new Error(`No se puede modificar una cita con estado "${existing.status}".`);
      }

      const targetDate = date || existing.date;
      const targetStartTime = start_time || existing.start_time;
      const targetBarberId = barber_id || existing.barber_id;
      const targetServiceId = service_id || existing.service_id;

      // Validar servicio
      const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(targetServiceId);
      if (!service) {
        throw new Error('Servicio no válido.');
      }

      // Validar barbero
      const barber = db.prepare('SELECT * FROM barbers WHERE id = ? AND is_active = 1').get(targetBarberId);
      if (!barber) {
        throw new Error('Barbero no disponible.');
      }

      // Validar fecha/hora futura
      if (isPastDateTime(targetDate, targetStartTime)) {
        throw new Error('La nueva fecha y hora no pueden estar en el pasado.');
      }

      const newEndTime = calculateEndTime(targetStartTime, service.duration_minutes);

      // Validar jornada laboral
      if (!isWithinWorkingHours(targetStartTime, newEndTime, barber.start_hour, barber.end_hour)) {
        throw new Error(`El nuevo horario está fuera de la jornada del barbero (${barber.start_hour} - ${barber.end_hour}).`);
      }

      // Validar solapamiento con otras citas (excluyendo la cita actual que se edita)
      const otherAppointments = db.prepare(`
        SELECT id, start_time, end_time 
        FROM appointments 
        WHERE barber_id = ? AND date = ? AND status != 'cancelada' AND id != ?
      `).all(targetBarberId, targetDate, appointmentId);

      const hasOverlap = otherAppointments.some(app => 
        doTimesOverlap(targetStartTime, newEndTime, app.start_time, app.end_time)
      );

      if (hasOverlap) {
        throw new Error('El nuevo horario seleccionado entra en conflicto con otra cita agendada.');
      }

      db.prepare(`
        UPDATE appointments 
        SET barber_id = ?, service_id = ?, date = ?, start_time = ?, end_time = ?, notes = ?
        WHERE id = ?
      `).run(
        targetBarberId,
        targetServiceId,
        targetDate,
        targetStartTime,
        newEndTime,
        notes !== undefined ? notes : existing.notes,
        appointmentId
      );

      return { message: 'Cita modificada exitosamente.' };
    });

    const response = modifyTransaction();
    res.json(response);

  } catch (error) {
    console.error('Error al modificar cita:', error.message);
    res.status(400).json({ error: error.message || 'Error al modificar la cita.' });
  }
});

module.exports = router;
