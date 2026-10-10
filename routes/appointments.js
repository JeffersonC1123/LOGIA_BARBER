const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { 
  calculateEndTime, 
  doTimesOverlap, 
  isWithinWorkingHours, 
  isPastDateTime 
} = require('../utils/timeHelper');

// POST /api/appointments - Crear nueva reserva (RF-004 y RF-005)
router.post('/', authenticateToken, (req, res) => {
  try {
    const { barber_id, service_id, date, start_time, notes, client_id } = req.body;

    // Determinar el cliente: Si es cliente reserva para sí mismo; si es admin/personal puede reservar a nombre de un cliente
    let targetClientId = req.user.id;
    if (['admin', 'personal'].includes(req.user.role) && client_id) {
      targetClientId = client_id;
    }

    if (!barber_id || !service_id || !date || !start_time) {
      return res.status(400).json({ error: 'Barbero, servicio, fecha y hora de inicio son obligatorios.' });
    }

    // Usar transacción de SQLite para garantizar atomicidad y prevenir condiciones de carrera simultáneas (RF-005)
    const createBookingTransaction = db.transaction(() => {
      // 1. Validar servicio
      const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(service_id);
      if (!service) {
        throw new Error('El servicio seleccionado no está disponible.');
      }

      // 2. Validar barbero
      const barber = db.prepare(`
        SELECT b.*, u.name 
        FROM barbers b 
        JOIN users u ON b.user_id = u.id 
        WHERE b.id = ? AND b.is_active = 1
      `).get(barber_id);

      if (!barber) {
        throw new Error('El barbero seleccionado no está disponible.');
      }

      // 3. Validar que la fecha/hora no esté en el pasado
      if (isPastDateTime(date, start_time)) {
        throw new Error('No es posible reservar citas en fechas u horas pasadas.');
      }

      // 4. Calcular hora de fin
      const endTime = calculateEndTime(start_time, service.duration_minutes);

      // 5. Validar jornada laboral del barbero
      if (!isWithinWorkingHours(start_time, endTime, barber.start_hour, barber.end_hour)) {
        throw new Error(`El horario seleccionado (${start_time} - ${endTime}) está fuera de la jornada laboral de ${barber.name} (${barber.start_hour} - ${barber.end_hour}).`);
      }

      // 6. Verificar si existe algún solapamiento de horarios (RF-005)
      const existingAppointments = db.prepare(`
        SELECT id, start_time, end_time 
        FROM appointments 
        WHERE barber_id = ? AND date = ? AND status != 'cancelada'
      `).all(barber_id, date);

      const hasOverlap = existingAppointments.some(app => 
        doTimesOverlap(start_time, endTime, app.start_time, app.end_time)
      );

      if (hasOverlap) {
        throw new Error(`El horario de ${start_time} a ${endTime} ya se encuentra reservado para ${barber.name}. Por favor selecciona otro horario.`);
      }

      // 7. Insertar la cita guardando el precio acordado en el momento de la reserva
      const result = db.prepare(`
        INSERT INTO appointments 
        (client_id, barber_id, service_id, date, start_time, end_time, price_at_booking, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
      `).run(
        targetClientId,
        barber_id,
        service_id,
        date,
        start_time,
        endTime,
        service.price,
        notes || ''
      );

      return {
        id: result.lastInsertRowid,
        client_id: targetClientId,
        barber_id: parseInt(barber_id),
        barber_name: barber.name,
        service_id: parseInt(service_id),
        service_name: service.name,
        date,
        start_time,
        end_time: endTime,
        price_at_booking: service.price,
        status: 'pendiente',
        notes: notes || ''
      };
    });

    const appointment = createBookingTransaction();

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
