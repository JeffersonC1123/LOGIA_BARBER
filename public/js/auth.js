/**
 * Barbería Pro - Módulo de Autenticación
 */

const Auth = {
  getUser() {
    const userStr = localStorage.getItem('barberia_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isLoggedIn() {
    return !!localStorage.getItem('barberia_token');
  },

  getRole() {
    const user = this.getUser();
    return user ? user.role : null;
  },

  setSession(token, user) {
    localStorage.setItem('barberia_token', token);
    localStorage.setItem('barberia_user', JSON.stringify(user));
    this.updateUI();
  },

  logout() {
    localStorage.removeItem('barberia_token');
    localStorage.removeItem('barberia_user');
    showToast('Sesión cerrada correctamente.', 'info');
    this.updateUI();
    if (window.App) {
      window.App.renderHome();
    }
  },

  async login(email, password) {
    try {
      const data = await API.post('/auth/login', { email, password });
      this.setSession(data.token, data.user);
      showToast(`¡Bienvenido/a, ${data.user.name}!`, 'success');
      closeModal('auth-modal');
      if (window.App) {
        window.App.handleRoleRedirect();
      }
      return data;
    } catch (error) {
      showToast(error.message, 'error');
      throw error;
    }
  },

  async register(userData) {
    try {
      const data = await API.post('/auth/register', userData);
      this.setSession(data.token, data.user);
      showToast('¡Registro exitoso! Sesión iniciada.', 'success');
      closeModal('auth-modal');
      if (window.App) {
        window.App.handleRoleRedirect();
      }
      return data;
    } catch (error) {
      showToast(error.message, 'error');
      throw error;
    }
  },

  // Acceso Rápido para Demostración
  async quickLogin(role) {
    const credentials = {
      admin: { email: 'admin@barberiapro.com', pass: 'Admin123!' },
      barbero: { email: 'carlos@barberiapro.com', pass: 'Barbero123!' },
      personal: { email: 'recepcion@barberiapro.com', pass: 'Personal123!' },
      cliente: { email: 'juan@gmail.com', pass: 'Cliente123!' }
    };

    const target = credentials[role];
    if (target) {
      await this.login(target.email, target.pass);
    }
  },

  updateUI() {
    const user = this.getUser();
    const navUserContainer = document.getElementById('nav-user-container');
    const roleNavLinks = document.getElementById('role-nav-links');

    if (!navUserContainer) return;

    if (user) {
      navUserContainer.innerHTML = `
        <span class="role-badge">${user.role}</span>
        <span style="font-weight: 600; font-size: 0.9rem;">${user.name}</span>
        <button class="btn btn-outline btn-sm" onclick="Auth.logout()">Cerrar Sesión</button>
      `;

      // Renderizar accesos rápidos según el rol
      let roleLinksHTML = '';
      if (user.role === 'cliente') {
        roleLinksHTML = `<li><a href="#mis-citas" onclick="App.renderClientDashboard()">Mis Citas</a></li>`;
      } else if (user.role === 'barbero') {
        roleLinksHTML = `<li><a href="#mi-agenda" onclick="App.renderBarberAgenda()">Mi Agenda</a></li>`;
      } else if (user.role === 'personal') {
        roleLinksHTML = `<li><a href="#gestion-pagos" onclick="App.renderPersonalDashboard()">Citas & Pagos</a></li>`;
      } else if (user.role === 'admin') {
        roleLinksHTML = `<li><a href="#admin-panel" onclick="App.renderAdminPanel()">Panel Admin</a></li>`;
      }

      if (roleNavLinks) roleNavLinks.innerHTML = roleLinksHTML;

    } else {
      navUserContainer.innerHTML = `
        <button class="btn btn-outline btn-sm" onclick="App.showLoginModal()">Iniciar Sesión</button>
        <button class="btn btn-gold btn-sm" onclick="App.showRegisterModal()">Registrarse</button>
      `;
      if (roleNavLinks) roleNavLinks.innerHTML = '';
    }
  }
};
