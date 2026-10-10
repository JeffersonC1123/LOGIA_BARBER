const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/reports/dashboard - Métricas para el Panel de Administración
router.get('/dashboard', authenticateToken, requireRole('admin', 'personal'), (req, res) => {
  try {
    // 1. Total ingresos recaudados
    const incomeRow = db.prepare(`
      SELECT SUM(amount) AS total_income 
      FROM payments 
      WHERE status = 'completado'
    `).get();

    // 2. Conteo de citas por estado
    const statusRows = db.prepare(`
      SELECT status, COUNT(*) AS count 
      FROM appointments 
      GROUP BY status
    `).all();

    const statusCounts = {
      total: 0,
      pendiente: 0,
      confirmada: 0,
      en_proceso: 0,
      completada: 0,
      cancelada: 0
    };

    statusRows.forEach(row => {
      statusCounts[row.status] = row.count;
      statusCounts.total += row.count;
    });

    // 3. Servicios más solicitados
    const topServices = db.prepare(`
      SELECT s.name, COUNT(a.id) AS total_bookings, SUM(a.price_at_booking) AS total_revenue
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.status != 'cancelada'
      GROUP BY s.id
      ORDER BY total_bookings DESC
      LIMIT 5
    `).all();

    // 4. Rendimiento por Barbero
    const barberPerformance = db.prepare(`
      SELECT 
        u.name AS barber_name,
        COUNT(a.id) AS total_appointments,
        SUM(CASE WHEN a.status = 'completada' THEN 1 ELSE 0 END) AS completed_appointments,
        SUM(CASE WHEN a.status = 'completada' THEN a.price_at_booking ELSE 0 END) AS generated_revenue
      FROM barbers b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN appointments a ON b.id = a.barber_id
      GROUP BY b.id
      ORDER BY completed_appointments DESC
    `).all();

    res.json({
      total_income: incomeRow.total_income || 0,
      status_counts: statusCounts,
      top_services: topServices,
      barber_performance: barberPerformance
    });

  } catch (error) {
    console.error('Error al generar métricas de dashboard:', error);
    res.status(500).json({ error: 'Error al obtener reporte del dashboard.' });
  }
});

module.exports = router;
