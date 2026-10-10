/**
 * Convierte "HH:MM" a minutos desde medianoche.
 * Ej: "09:30" => 570
 */
function timeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convierte minutos a "HH:MM"
 * Ej: 570 => "09:30"
 */
function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  return `${hStr}:${mStr}`;
}

/**
 * Calcula la hora final dado inicio y duración en minutos
 */
function calculateEndTime(startTime, durationMinutes) {
  const startMin = timeToMinutes(startTime);
  const endMin = startMin + durationMinutes;
  return minutesToTime(endMin);
}

/**
 * Verifica si dos rangos de tiempo se solapan
 * [start1, end1] y [start2, end2]
 */
function doTimesOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return s1 < e2 && e1 > s2;
}

/**
 * Verifica si la cita está dentro de la jornada laboral
 */
function isWithinWorkingHours(startTime, endTime, workStart, workEnd) {
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);
  const ws = timeToMinutes(workStart);
  const we = timeToMinutes(workEnd);

  return s >= ws && e <= we;
}

/**
 * Verifica si una fecha y hora están en el pasado.
 * dateStr: YYYY-MM-DD, timeStr: HH:MM
 */
function isPastDateTime(dateStr, timeStr) {
  const appointmentDate = new Date(`${dateStr}T${timeStr}:00`);
  const now = new Date();
  return appointmentDate < now;
}

/**
 * Genera bloques de tiempo disponibles dados la jornada laboral y las citas ocupadas
 */
function generateAvailableSlots(startHour, endHour, durationMinutes, bookedSlots = []) {
  const slots = [];
  let current = timeToMinutes(startHour);
  const endLimit = timeToMinutes(endHour);

  while (current + durationMinutes <= endLimit) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + durationMinutes);

    // Verificar si se cruza con alguna cita existente
    const isOccupied = bookedSlots.some(b => 
      doTimesOverlap(slotStart, slotEnd, b.start_time, b.end_time)
    );

    slots.push({
      start_time: slotStart,
      end_time: slotEnd,
      available: !isOccupied
    });

    // Incrementar en lapsos de 30 min (o según duración)
    current += 30;
  }

  return slots;
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  calculateEndTime,
  doTimesOverlap,
  isWithinWorkingHours,
  isPastDateTime,
  generateAvailableSlots
};
