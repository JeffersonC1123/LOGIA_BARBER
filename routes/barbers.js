const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateAvailableSlots } = require('../utils/timeHelper');

// GET /api/barbers - Listar barberos activos con sus detalles
router.get('/', (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    let sql = `
      SELECT 
        b.id,
        b.user_id,
        u.name,
        u.email,
        u.phone,
        b.bio,
        b.specialties,
        b.start_hour,
        b.end_hour,
        b.is_active
      FROM barbers b
      JOIN users u ON b.user_id = u.id
    `;
    if (!showAll) {
      sql += ' WHERE b.is_active = 1';
    }
    sql += ' ORDER BY u.name ASC';

    const barbers = db.prepare(sql).all();
    res.json(barbers);
  } catch (error) {
    console.error('Error al obtener barberos:', error);
    res.status(500).json({ error: 'Error al obtener la lista de barberos.' });
  }
});

// GET /api/barbers/:id/availability - Consultar disponibilidad de horarios de un barbero en una fecha
router.get('/:id/availability', (req, res) => {
  try {
    const barberId = req.params.id;
    const { date, service_id } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'La fecha (date=YYYY-MM-DD) es obligatoria.' });
    }

    const barber = db.prepare(`
      SELECT b.*, u.name 
      FROM barbers b 
      JOIN users u ON b.user_id = u.id 
      WHERE b.id = ? AND b.is_active = 1
    `).get(barberId);

    if (!barber) {
      return res.status(404).json({ error: 'Barbero no encontrado o inactivo.' });
    }

    // Obtener la duración del servicio seleccionado si existe, sino 30 min por defecto
    let durationMinutes = 30;
    if (service_id) {
      const service = db.prepare('SELECT duration_minutes FROM services WHERE id = ?').get(service_id);
      if (service) {
        durationMinutes = service.duration_minutes;
      }
    }

    // Obtener citas agendadas de este barbero en la fecha dada (excluyendo canceladas)
    const bookedAppointments = db.prepare(`
      SELECT start_time, end_time 
      FROM appointments 
      WHERE barber_id = ? AND date = ? AND status != 'cancelada'
    `).all(barberId, date);

    const slots = generateAvailableSlots(
      barber.start_hour,
      barber.end_hour,
      durationMinutes,
      bookedAppointments
    );

    res.json({
      barber_id: barber.id,
      barber_name: barber.name,
      date,
      duration_minutes: durationMinutes,
      working_hours: {
        start: barber.start_hour,
        end: barber.end_hour
      },
      slots
    });
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({ error: 'Error al obtener la disponibilidad.' });
  }
});

// POST /api/barbers - Crear perfil de barbero (Solo Admin)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { user_id, bio, specialties, start_hour, end_hour } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'El ID de usuario es obligatorio.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Actualizar rol del usuario a 'barbero' si no lo era
    if (user.role !== 'barbero') {
      db.prepare("UPDATE users SET role = 'barbero' WHERE id = ?").run(user_id);
    }

    const existingBarber = db.prepare('SELECT id FROM barbers WHERE user_id = ?').get(user_id);
    if (existingBarber) {
      return res.status(400).json({ error: 'Este usuario ya tiene un perfil de barbero.' });
    }

    const result = db.prepare(`
      INSERT INTO barbers (user_id, bio, specialties, start_hour, end_hour, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(
      user_id,
      bio || '',
      specialties || '',
      start_hour || '09:00',
      end_hour || '20:00'
    );

    res.status(201).json({
      message: 'Perfil de barbero creado exitosamente.',
      barber_id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error al crear barbero:', error);
    res.status(500).json({ error: 'Error interno al registrar el barbero.' });
  }
});

// PUT /api/barbers/:id - Actualizar horario/datos de barbero (Admin o el propio Barbero)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const barberId = req.params.id;
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId);

    if (!barber) {
      return res.status(404).json({ error: 'Barbero no encontrado.' });
    }

    // Verificar permisos: Admin o el propio Barbero
    if (req.user.role !== 'admin' && (req.user.role !== 'barbero' || req.user.id !== barber.user_id)) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este perfil.' });
    }

    const { bio, specialties, start_hour, end_hour, is_active } = req.body;

    const updatedBio = bio !== undefined ? bio : barber.bio;
    const updatedSpec = specialties !== undefined ? specialties : barber.specialties;
    const updatedStart = start_hour !== undefined ? start_hour : barber.start_hour;
    const updatedEnd = end_hour !== undefined ? end_hour : barber.end_hour;
    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : barber.is_active;

    db.prepare(`
      UPDATE barbers
      SET bio = ?, specialties = ?, start_hour = ?, end_hour = ?, is_active = ?
      WHERE id = ?
    `).run(updatedBio, updatedSpec, updatedStart, updatedEnd, updatedActive, barberId);

    res.json({ message: 'Perfil de barbero actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar barbero:', error);
    res.status(500).json({ error: 'Error al actualizar datos del barbero.' });
  }
});

module.exports = router;
