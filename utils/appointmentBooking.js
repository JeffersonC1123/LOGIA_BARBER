const {
  calculateEndTime,
  doTimesOverlap,
  isWithinWorkingHours,
  isPastDateTime
} = require('./timeHelper');

function createAppointment(db, user, input) {
  const { barber_id, service_id, date, start_time, notes, client_id } = input;
  let targetClientId = user.id;

  if (['admin', 'personal'].includes(user.role) && client_id) {
    targetClientId = client_id;
  }

  if (!barber_id || !service_id || !date || !start_time) {
    throw new Error('Barbero, servicio, fecha y hora de inicio son obligatorios.');
  }

  const createBookingTransaction = db.transaction(() => {
    const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(service_id);
    if (!service) {
      throw new Error('El servicio seleccionado no está disponible.');
    }

    const barber = db.prepare(`
      SELECT b.*, u.name
      FROM barbers b
      JOIN users u ON b.user_id = u.id
      WHERE b.id = ? AND b.is_active = 1
    `).get(barber_id);

    if (!barber) {
      throw new Error('El barbero seleccionado no está disponible.');
    }

    if (isPastDateTime(date, start_time)) {
      throw new Error('No es posible reservar citas en fechas u horas pasadas.');
    }

    const endTime = calculateEndTime(start_time, service.duration_minutes);
    if (!isWithinWorkingHours(start_time, endTime, barber.start_hour, barber.end_hour)) {
      throw new Error(`El horario seleccionado (${start_time} - ${endTime}) está fuera de la jornada laboral de ${barber.name} (${barber.start_hour} - ${barber.end_hour}).`);
    }

    const existingAppointments = db.prepare(`
      SELECT id, start_time, end_time
      FROM appointments
      WHERE barber_id = ? AND date = ? AND status != 'cancelada'
    `).all(barber_id, date);

    const hasOverlap = existingAppointments.some(appointment =>
      doTimesOverlap(start_time, endTime, appointment.start_time, appointment.end_time)
    );

    if (hasOverlap) {
      throw new Error(`El horario de ${start_time} a ${endTime} ya se encuentra reservado para ${barber.name}. Por favor selecciona otro horario.`);
    }

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

  return createBookingTransaction();
}

module.exports = { createAppointment };