const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/users - Listar usuarios (Solo Admin)
router.get('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { role } = req.query;
    let sql = 'SELECT id, name, email, role, phone, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    sql += ' ORDER BY name ASC';
    const users = db.prepare(sql).all(...params);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar la lista de usuarios.' });
  }
});

// POST /api/users - Crear un usuario con rol (Solo Admin)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Nombre, correo, contraseña y rol son obligatorios.' });
    }

    const validRoles = ['cliente', 'barbero', 'personal', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol no válido.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(400).json({ error: 'El correo electrónico ya existe.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), email.toLowerCase().trim(), hashedPassword, role, phone || null);

    const userId = result.lastInsertRowid;

    // Si el nuevo usuario es un barbero, crear su registro correspondiente
    if (role === 'barbero') {
      db.prepare(`
        INSERT INTO barbers (user_id, bio, specialties, start_hour, end_hour, is_active)
        VALUES (?, 'Barbero profesional', 'Corte, Barba', '09:00', '20:00', 1)
      `).run(userId);
    }

    res.status(201).json({
      message: 'Usuario creado exitosamente.',
      user: {
        id: userId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
        phone: phone || null
      }
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error interno al crear usuario.' });
  }
});

// PUT /api/users/:id - Actualizar un usuario (Solo Admin)
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, role, phone, password } = req.body;

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedEmail = email !== undefined ? email.toLowerCase().trim() : existing.email;
    const updatedRole = role !== undefined ? role : existing.role;
    const updatedPhone = phone !== undefined ? phone : existing.phone;
    let updatedPass = existing.password;

    if (password && password.trim().length >= 6) {
      updatedPass = bcrypt.hashSync(password.trim(), 10);
    }

    db.prepare(`
      UPDATE users 
      SET name = ?, email = ?, role = ?, phone = ?, password = ?
      WHERE id = ?
    `).run(updatedName, updatedEmail, updatedRole, updatedPhone, updatedPass, userId);

    // Si cambió a rol barbero y no existe su entrada en barbers, crearla
    if (updatedRole === 'barbero') {
      const bExist = db.prepare('SELECT id FROM barbers WHERE user_id = ?').get(userId);
      if (!bExist) {
        db.prepare(`
          INSERT INTO barbers (user_id, bio, specialties, start_hour, end_hour, is_active)
          VALUES (?, 'Barbero profesional', 'Corte, Barba', '09:00', '20:00', 1)
        `).run(userId);
      }
    }

    res.json({ message: 'Usuario actualizado con éxito.' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

// DELETE /api/users/:id - Eliminar usuario (Solo Admin)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const userId = req.params.id;

    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador.' });
    }

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar el usuario.' });
  }
});

module.exports = router;
