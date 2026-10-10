const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/services - Obtener catálogo de servicios
router.get('/', (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    let sql = 'SELECT * FROM services';
    if (!showAll) {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY name ASC';
    const services = db.prepare(sql).all();
    res.json(services);
  } catch (error) {
    console.error('Error al obtener servicios:', error);
    res.status(500).json({ error: 'Error al obtener la lista de servicios.' });
  }
});

// GET /api/services/:id - Obtener un servicio por ID
router.get('/:id', (req, res) => {
  try {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado.' });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el servicio.' });
  }
});

// POST /api/services - Crear nuevo servicio (Solo Admin)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, description, price, duration_minutes } = req.body;

    if (!name || price == null || !duration_minutes) {
      return res.status(400).json({ error: 'Nombre, precio y duración son obligatorios.' });
    }

    if (price <= 0 || duration_minutes <= 0) {
      return res.status(400).json({ error: 'El precio y la duración deben ser mayores a cero.' });
    }

    const result = db.prepare(`
      INSERT INTO services (name, description, price, duration_minutes, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(name.trim(), description || '', parseFloat(price), parseInt(duration_minutes));

    res.status(201).json({
      message: 'Servicio creado exitosamente.',
      service: {
        id: result.lastInsertRowid,
        name: name.trim(),
        description: description || '',
        price: parseFloat(price),
        duration_minutes: parseInt(duration_minutes),
        is_active: 1
      }
    });
  } catch (error) {
    console.error('Error al crear servicio:', error);
    res.status(500).json({ error: 'Error interno al crear el servicio.' });
  }
});

// PUT /api/services/:id - Actualizar servicio (Solo Admin)
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, description, price, duration_minutes, is_active } = req.body;
    const serviceId = req.params.id;

    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    if (!existing) {
      return res.status(404).json({ error: 'Servicio no encontrado.' });
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedDesc = description !== undefined ? description : existing.description;
    const updatedPrice = price !== undefined ? parseFloat(price) : existing.price;
    const updatedDuration = duration_minutes !== undefined ? parseInt(duration_minutes) : existing.duration_minutes;
    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    db.prepare(`
      UPDATE services
      SET name = ?, description = ?, price = ?, duration_minutes = ?, is_active = ?
      WHERE id = ?
    `).run(updatedName, updatedDesc, updatedPrice, updatedDuration, updatedActive, serviceId);

    res.json({
      message: 'Servicio actualizado exitosamente.',
      service: {
        id: parseInt(serviceId),
        name: updatedName,
        description: updatedDesc,
        price: updatedPrice,
        duration_minutes: updatedDuration,
        is_active: updatedActive
      }
    });
  } catch (error) {
    console.error('Error al actualizar servicio:', error);
    res.status(500).json({ error: 'Error al actualizar el servicio.' });
  }
});

// DELETE /api/services/:id - Desactivar/Eliminar servicio (Solo Admin)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const serviceId = req.params.id;
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    if (!existing) {
      return res.status(404).json({ error: 'Servicio no encontrado.' });
    }

    // Cambiar estado a inactivo para no romper historial de citas pasadas
    db.prepare('UPDATE services SET is_active = 0 WHERE id = ?').run(serviceId);

    res.json({ message: 'Servicio desactivado exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el servicio.' });
  }
});

module.exports = router;
