/**
 * Barbería Pro - Aplicación Principal (UI & Controlador)
 */

window.App = {
  selectedService: null,
  selectedBarber: null,
  selectedDate: null,
  selectedSlot: null,

  init() {
    Auth.updateUI();
    this.renderHome();
  },

  handleRoleRedirect() {
    const role = Auth.getRole();
    if (role === 'admin') this.renderAdminPanel();
    else if (role === 'barbero') this.renderBarberAgenda();
    else if (role === 'personal') this.renderPersonalDashboard();
    else this.renderClientDashboard();
  },

  // =========================================================================
  // VISTA INICIO / CATALOGO DE SERVICIOS
  // =========================================================================
  async renderHome() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <section class="hero">
        <div class="container">
          <h1>💈 Barbería <span>Pro</span></h1>
          <p>Tu estilo, tu imagen, nuestra pasión. Reserva tu cita online en segundos con los mejores barberos profesionales de la ciudad.</p>
          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-gold" onclick="App.openBookingWizard()">📅 Reservar Cita Ahora</button>
            <a href="#servicios" class="btn btn-outline">Ver Servicios y Precios</a>
          </div>

          <div class="demo-access">
            <h4>⚡ Botones de Demostración Rápida (1-Click Login por Rol)</h4>
            <div class="demo-buttons">
              <button class="btn btn-sm btn-secondary" onclick="Auth.quickLogin('cliente')">👤 Probar como Cliente</button>
              <button class="btn btn-sm btn-secondary" onclick="Auth.quickLogin('barbero')">✂️ Probar como Barbero</button>
              <button class="btn btn-sm btn-secondary" onclick="Auth.quickLogin('personal')">💳 Probar como Recepción/Pago</button>
              <button class="btn btn-sm btn-gold" onclick="Auth.quickLogin('admin')">⚙️ Probar como Admin</button>
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" class="section container">
        <div class="section-title">
          <h2>Nuestros Servicios Exclusivos</h2>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">Precios transparentes y la mejor atención personalizada</p>
        </div>
        <div id="services-grid" class="grid">
          <p style="text-align:center; grid-column: 1/-1;">Cargando catálogo de servicios...</p>
        </div>
      </section>

      <section id="barberos" class="section container" style="background: var(--bg-secondary); border-radius: var(--radius-lg); margin-bottom: 3rem; padding: 2.5rem;">
        <div class="section-title">
          <h2>Nuestros Maestros Barberos</h2>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">Especialistas capacitados en tendencias clásicas y contemporáneas</p>
        </div>
        <div id="barbers-grid" class="grid">
          <p style="text-align:center; grid-column: 1/-1;">Cargando equipo de barberos...</p>
        </div>
      </section>
    `;

    await this.loadServicesCatalog();
    await this.loadBarbersTeam();
  },

  async loadServicesCatalog() {
    try {
      const services = await API.get('/services');
      const grid = document.getElementById('services-grid');
      if (!services || services.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1;">No hay servicios disponibles por el momento.</p>`;
        return;
      }

      grid.innerHTML = services.map(s => `
        <div class="card">
          <h3 class="card-title">${s.name}</h3>
          <p class="card-desc">${s.description || 'Servicio profesional de barbería y estilismo.'}</p>
          <div class="card-meta">
            <div>
              <span class="price">$${s.price.toFixed(2)}</span>
              <span class="duration">⏱️ ${s.duration_minutes} min</span>
            </div>
            <button class="btn btn-gold btn-sm" onclick="App.selectServiceAndBook(${s.id})">Agendar</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async loadBarbersTeam() {
    try {
      const barbers = await API.get('/barbers');
      const grid = document.getElementById('barbers-grid');
      if (!barbers || barbers.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1;">No hay barberos disponibles.</p>`;
        return;
      }

      grid.innerHTML = barbers.map(b => `
        <div class="card">
          <div style="font-size: 2.5rem; text-align: center; margin-bottom: 0.5rem;">💈</div>
          <h3 class="card-title" style="text-align:center;">${b.name}</h3>
          <p style="font-size: 0.85rem; color: var(--gold-primary); text-align:center; margin-bottom: 0.5rem;">
            Especialidades: ${b.specialties || 'Corte, Barba'}
          </p>
          <p class="card-desc">${b.bio || 'Barbero profesional listo para brindarte la mejor experiencia.'}</p>
          <div style="font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 0.5rem;">
            🕒 Horario: ${b.start_hour} a ${b.end_hour}
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  // =========================================================================
  // WIZARD DE RESERVA DE CITAS (RF-004, RF-005)
  // =========================================================================
  async openBookingWizard(serviceId = null) {
    if (!Auth.isLoggedIn()) {
      showToast('Debes iniciar sesión para agendar una cita.', 'info');
      this.showLoginModal();
      return;
    }

    try {
      const services = await API.get('/services');
      const barbers = await API.get('/barbers');

      const todayStr = new Date().toISOString().split('T')[0];

      const modalHTML = `
        <div class="modal-header">
          <h3 class="modal-title">📅 Reservar Cita - Barbería Pro</h3>
          <button class="modal-close" onclick="closeModal('booking-modal')">&times;</button>
        </div>
        <form id="booking-form" onsubmit="App.submitBooking(event)">
          
          <div class="form-group">
            <label>1. Selecciona el Servicio</label>
            <select id="book-service" class="form-control" onchange="App.onBookingServiceChange()" required>
              <option value="">-- Seleccionar Servicio --</option>
              ${services.map(s => `
                <option value="${s.id}" data-duration="${s.duration_minutes}" data-price="${s.price}" ${serviceId == s.id ? 'selected' : ''}>
                  ${s.name} (${s.duration_minutes} min) - $${s.price.toFixed(2)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>2. Selecciona el Barbero</label>
            <select id="book-barber" class="form-control" onchange="App.onBookingDateBarberChange()" required>
              <option value="">-- Seleccionar Barbero --</option>
              ${barbers.map(b => `
                <option value="${b.id}">${b.name} (${b.start_hour} - ${b.end_hour})</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>3. Selecciona la Fecha</label>
            <input type="date" id="book-date" class="form-control" min="${todayStr}" value="${todayStr}" onchange="App.onBookingDateBarberChange()" required />
          </div>

          <div class="form-group">
            <label>4. Selecciona el Horario Disponible</label>
            <div id="slots-container">
              <p style="color: var(--text-muted); font-size: 0.88rem;">Selecciona un barbero para ver los horarios disponibles...</p>
            </div>
            <input type="hidden" id="book-slot" required />
          </div>

          <div class="form-group">
            <label>Observaciones o Nota especial (Opcional)</label>
            <input type="text" id="book-notes" class="form-control" placeholder="Ej: Degradado bajo, preferencia navaja..." />
          </div>

          <div id="booking-summary" style="background: var(--bg-card); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-gold); margin-bottom: 1.5rem; display: none;">
            <div style="display: flex; justify-content: space-between; font-weight: 700;">
              <span>Total a Pagar en Local:</span>
              <span id="summary-price" style="color: var(--gold-primary); font-size: 1.2rem;">$0.00</span>
            </div>
          </div>

          <button type="submit" class="btn btn-gold" style="width: 100%;">Confirmar Reserva</button>
        </form>
      `;

      showModal('booking-modal', modalHTML);

      if (serviceId) {
        this.onBookingServiceChange();
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  selectServiceAndBook(serviceId) {
    this.openBookingWizard(serviceId);
  },

  onBookingServiceChange() {
    const serviceSelect = document.getElementById('book-service');
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    const summaryBox = document.getElementById('booking-summary');
    const priceSpan = document.getElementById('summary-price');

    if (selectedOption && selectedOption.value) {
      const price = parseFloat(selectedOption.dataset.price);
      priceSpan.innerText = `$${price.toFixed(2)}`;
      summaryBox.style.display = 'block';
    } else {
      summaryBox.style.display = 'none';
    }

    this.onBookingDateBarberChange();
  },

  async onBookingDateBarberChange() {
    const barberId = document.getElementById('book-barber').value;
    const date = document.getElementById('book-date').value;
    const serviceId = document.getElementById('book-service').value;
    const slotsContainer = document.getElementById('slots-container');

    if (!barberId || !date) {
      slotsContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.88rem;">Selecciona barbero y fecha para ver horarios.</p>`;
      return;
    }

    slotsContainer.innerHTML = `<p style="color: var(--gold-primary); font-size: 0.88rem;">Calculando disponibilidad de la agenda...</p>`;

    try {
      const data = await API.get(`/barbers/${barberId}/availability?date=${date}&service_id=${serviceId}`);
      
      if (!data.slots || data.slots.length === 0) {
        slotsContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.88rem;">No hay horarios en la jornada de este barbero.</p>`;
        return;
      }

      slotsContainer.innerHTML = `
        <div class="slots-grid">
          ${data.slots.map(slot => `
            <button type="button" 
              class="slot-btn ${slot.available ? 'available' : 'occupied'}"
              ${slot.available ? `onclick="App.selectSlot('${slot.start_time}', this)"` : 'disabled'}
            >
              ${slot.start_time}
            </button>
          `).join('')}
        </div>
      `;

      this.selectedSlot = null;
      document.getElementById('book-slot').value = '';
    } catch (e) {
      slotsContainer.innerHTML = `<p style="color: var(--status-cancelled); font-size: 0.88rem;">Error al cargar horarios.</p>`;
    }
  },

  selectSlot(startTime, btn) {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    this.selectedSlot = startTime;
    document.getElementById('book-slot').value = startTime;
  },

  async submitBooking(e) {
    e.preventDefault();
    const barber_id = document.getElementById('book-barber').value;
    const service_id = document.getElementById('book-service').value;
    const date = document.getElementById('book-date').value;
    const start_time = document.getElementById('book-slot').value;
    const notes = document.getElementById('book-notes').value;

    if (!start_time) {
      showToast('Por favor selecciona un horario disponible.', 'error');
      return;
    }

    try {
      await API.post('/appointments', {
        barber_id,
        service_id,
        date,
        start_time,
        notes
      });

      showToast('¡Cita reservada con éxito!', 'success');
      closeModal('booking-modal');
      this.handleRoleRedirect();
    } catch (error) {
      showToast(error.message, 'error');
    }
  },

  // =========================================================================
  // VISTA CLIENTE ("Mis Citas" - RF-007)
  // =========================================================================
  async renderClientDashboard() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <section class="section container">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
          <div>
            <h2>Mis Citas Reservadas</h2>
            <p style="color: var(--text-muted);">Consulta tu historial y estado de reservas</p>
          </div>
          <button class="btn btn-gold" onclick="App.openBookingWizard()">+ Nueva Reserva</button>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha & Hora</th>
                <th>Servicio</th>
                <th>Barbero</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="client-appointments-tbody">
              <tr><td colspan="7" style="text-align:center;">Cargando tus citas...</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    `;

    try {
      const appointments = await API.get('/appointments');
      const tbody = document.getElementById('client-appointments-tbody');

      if (!appointments || appointments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">No tienes citas registradas aún. ¡Reserva tu primera cita!</td></tr>`;
        return;
      }

      tbody.innerHTML = appointments.map(a => `
        <tr>
          <td><strong>#${a.id}</strong></td>
          <td>${a.date} <br><small style="color: var(--gold-primary);">${a.start_time} - ${a.end_time}</small></td>
          <td>${a.service_name}</td>
          <td>${a.barber_name}</td>
          <td style="font-weight:700;">$${a.price_at_booking.toFixed(2)}</td>
          <td><span class="badge badge-${a.status}">${a.status}</span></td>
          <td>
            ${(a.status === 'pendiente' || a.status === 'confirmada') ? `
              <button class="btn btn-danger btn-sm" onclick="App.cancelAppointment(${a.id})">Cancelar</button>
            ` : '-'}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  async cancelAppointment(appointmentId) {
    if (!confirm('¿Estás seguro de que deseas cancelar esta cita? El horario será liberado.')) return;

    try {
      await API.put(`/appointments/${appointmentId}/status`, { status: 'cancelada' });
      showToast('Cita cancelada correctamente. El horario ha sido liberado.', 'success');
      this.handleRoleRedirect();
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  // =========================================================================
  // VISTA BARBERO ("Mi Agenda" - RF-006)
  // =========================================================================
  async renderBarberAgenda() {
    const main = document.getElementById('main-content');
    const todayStr = new Date().toISOString().split('T')[0];

    main.innerHTML = `
      <section class="section container">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
          <div>
            <h2>✂️ Agenda del Barbero</h2>
            <p style="color: var(--text-muted);">Gestiona los estados de tus clientes del día</p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <label style="font-size: 0.9rem;">Filtrar Fecha:</label>
            <input type="date" id="barber-date-filter" class="form-control" style="width: auto;" value="${todayStr}" onchange="App.loadBarberAgendaData()" />
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Cliente & Contacto</th>
                <th>Servicio</th>
                <th>Notas</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Cambiar Estado</th>
              </tr>
            </thead>
            <tbody id="barber-agenda-tbody">
              <tr><td colspan="7" style="text-align:center;">Cargando tu agenda...</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    `;

    await this.loadBarberAgendaData();
  },

  async loadBarberAgendaData() {
    const date = document.getElementById('barber-date-filter').value;
    const tbody = document.getElementById('barber-agenda-tbody');

    try {
      const appointments = await API.get(`/appointments?date=${date}`);

      if (!appointments || appointments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">No tienes citas agendadas para la fecha seleccionada (${date}).</td></tr>`;
        return;
      }

      tbody.innerHTML = appointments.map(a => `
        <tr>
          <td><strong style="color: var(--gold-primary);">${a.start_time} - ${a.end_time}</strong></td>
          <td>${a.client_name}<br><small style="color: var(--text-muted);">${a.client_phone || 'Sin tel.'}</small></td>
          <td>${a.service_name}</td>
          <td><small>${a.notes || '-'}</small></td>
          <td>$${a.price_at_booking.toFixed(2)}</td>
          <td><span class="badge badge-${a.status}">${a.status}</span></td>
          <td>
            <select class="form-control" style="padding: 0.3rem 0.5rem; font-size: 0.85rem;" onchange="App.updateAppointmentStatus(${a.id}, this.value)">
              <option value="pendiente" ${a.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="confirmada" ${a.status === 'confirmada' ? 'selected' : ''}>Confirmada</option>
              <option value="en_proceso" ${a.status === 'en_proceso' ? 'selected' : ''}>En Proceso</option>
              <option value="completada" ${a.status === 'completada' ? 'selected' : ''}>Completada</option>
              <option value="cancelada" ${a.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
            </select>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  async updateAppointmentStatus(appointmentId, newStatus) {
    try {
      await API.put(`/appointments/${appointmentId}/status`, { status: newStatus });
      showToast(`Estado de la cita #${appointmentId} actualizado a "${newStatus}".`, 'success');
      this.loadBarberAgendaData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  // =========================================================================
  // VISTA PERSONAL / RECEPCION ("Gestión & Pagos" - RF-008)
  // =========================================================================
  async renderPersonalDashboard() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <section class="section container">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
          <div>
            <h2>💳 Gestión de Recepción y Registro de Pagos</h2>
            <p style="color: var(--text-muted);">Control de citas globales y cobro autorizado de servicios</p>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha & Hora</th>
                <th>Cliente</th>
                <th>Barbero</th>
                <th>Servicio</th>
                <th>Precio</th>
                <th>Estado Cita</th>
                <th>Estado Pago</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody id="personal-appointments-tbody">
              <tr><td colspan="9" style="text-align:center;">Cargando lista general de citas...</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    `;

    try {
      const appointments = await API.get('/appointments');
      const tbody = document.getElementById('personal-appointments-tbody');

      if (!appointments || appointments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No hay citas registradas.</td></tr>`;
        return;
      }

      tbody.innerHTML = appointments.map(a => `
        <tr>
          <td><strong>#${a.id}</strong></td>
          <td>${a.date}<br><small style="color: var(--gold-primary);">${a.start_time}</small></td>
          <td>${a.client_name}</td>
          <td>${a.barber_name}</td>
          <td>${a.service_name}</td>
          <td style="font-weight:700;">$${a.price_at_booking.toFixed(2)}</td>
          <td><span class="badge badge-${a.status}">${a.status}</span></td>
          <td>
            ${a.payment_id ? `
              <span class="badge" style="background: rgba(39, 174, 96, 0.2); color:#27ae60;">
                PAGADO (${a.payment_method.toUpperCase()})
              </span>
            ` : `
              <span class="badge" style="background: rgba(230, 126, 34, 0.2); color:#e67e22;">
                PENDIENTE PAGO
              </span>
            `}
          </td>
          <td>
            ${(!a.payment_id && a.status !== 'cancelada') ? `
              <button class="btn btn-gold btn-sm" onclick="App.openPaymentModal(${a.id}, ${a.price_at_booking})">Registrar Pago</button>
            ` : '-'}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  openPaymentModal(appointmentId, price) {
    const modalHTML = `
      <div class="modal-header">
        <h3 class="modal-title">💳 Registrar Pago de Cita #${appointmentId}</h3>
        <button class="modal-close" onclick="closeModal('payment-modal')">&times;</button>
      </div>
      <form onsubmit="App.submitPayment(event, ${appointmentId})">
        <div class="form-group">
          <label>Monto a Cobrar ($)</label>
          <input type="number" id="pay-amount" class="form-control" step="0.01" value="${price}" required />
        </div>
        <div class="form-group">
          <label>Método de Pago</label>
          <select id="pay-method" class="form-control" required>
            <option value="efectivo">Efectivo 💵</option>
            <option value="tarjeta">Tarjeta Débito/Crédito 💳</option>
            <option value="transferencia">Transferencia Bancaria 📲</option>
          </select>
        </div>
        <button type="submit" class="btn btn-gold" style="width: 100%;">Completar y Guardar Pago</button>
      </form>
    `;
    showModal('payment-modal', modalHTML);
  },

  async submitPayment(e, appointmentId) {
    e.preventDefault();
    const amount = document.getElementById('pay-amount').value;
    const payment_method = document.getElementById('pay-method').value;

    try {
      await API.post('/payments', {
        appointment_id: appointmentId,
        amount,
        payment_method
      });
      showToast('Pago registrado correctamente. Cita completada.', 'success');
      closeModal('payment-modal');
      this.renderPersonalDashboard();
    } catch (error) {
      showToast(error.message, 'error');
    }
  },

  // =========================================================================
  // VISTA ADMINISTRADOR (RF-009)
  // =========================================================================
  async renderAdminPanel() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <section class="section container">
        <div style="margin-bottom: 2rem;">
          <h2>⚙️ Panel de Administración General</h2>
          <p style="color: var(--text-muted);">Gestión de métricas, servicios, barberos y usuarios</p>
        </div>

        <div class="tabs">
          <button class="tab-btn active" onclick="App.switchAdminTab('dashboard')">📊 Dashboard & Métricas</button>
          <button class="tab-btn" onclick="App.switchAdminTab('services')">💈 Servicios</button>
          <button class="tab-btn" onclick="App.switchAdminTab('barbers')">✂️ Barberos</button>
          <button class="tab-btn" onclick="App.switchAdminTab('users')">👥 Usuarios</button>
        </div>

        <div id="admin-tab-content">
          <!-- Contenido dinámico por pestaña -->
        </div>
      </section>
    `;

    this.switchAdminTab('dashboard');
  },

  async switchAdminTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event && event.target && event.target.classList.add('active');

    const container = document.getElementById('admin-tab-content');

    if (tabName === 'dashboard') {
      container.innerHTML = `<p>Cargando métricas...</p>`;
      try {
        const stats = await API.get('/reports/dashboard');
        container.innerHTML = `
          <div class="stats-grid">
            <div class="stat-card">
              <h3>Ingresos Totales</h3>
              <div class="value" style="color: var(--gold-primary);">$${stats.total_income.toFixed(2)}</div>
            </div>
            <div class="stat-card">
              <h3>Total Citas</h3>
              <div class="value">${stats.status_counts.total}</div>
            </div>
            <div class="stat-card">
              <h3>Completadas</h3>
              <div class="value" style="color: #27ae60;">${stats.status_counts.completada}</div>
            </div>
            <div class="stat-card">
              <h3>Canceladas</h3>
              <div class="value" style="color: #c0392b;">${stats.status_counts.cancelada}</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
            <div class="card">
              <h3 class="card-title">Top Servicios Más Reservados</h3>
              <table class="table" style="margin-top: 1rem;">
                <thead>
                  <tr><th>Servicio</th><th>Reservas</th><th>Total Recaudado</th></tr>
                </thead>
                <tbody>
                  ${stats.top_services.map(s => `
                    <tr>
                      <td>${s.name}</td>
                      <td>${s.total_bookings}</td>
                      <td style="color:var(--gold-primary);">$${s.total_revenue.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="card">
              <h3 class="card-title">Rendimiento por Barbero</h3>
              <table class="table" style="margin-top: 1rem;">
                <thead>
                  <tr><th>Barbero</th><th>Citas Realizadas</th><th>Ingresos</th></tr>
                </thead>
                <tbody>
                  ${stats.barber_performance.map(b => `
                    <tr>
                      <td>${b.barber_name}</td>
                      <td>${b.completed_appointments} / ${b.total_appointments}</td>
                      <td style="color:var(--gold-primary);">$${b.generated_revenue.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (e) {
        showToast(e.message, 'error');
      }
    } else if (tabName === 'services') {
      this.loadAdminServicesTab(container);
    } else if (tabName === 'barbers') {
      this.loadAdminBarbersTab(container);
    } else if (tabName === 'users') {
      this.loadAdminUsersTab(container);
    }
  },

  async loadAdminServicesTab(container) {
    container.innerHTML = `<p>Cargando servicios...</p>`;
    try {
      const services = await API.get('/services?all=true');
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>Gestión de Servicios</h3>
          <button class="btn btn-gold btn-sm" onclick="App.openCreateServiceModal()">+ Crear Nuevo Servicio</button>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr><th>ID</th><th>Nombre</th><th>Descripción</th><th>Precio</th><th>Duración</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              ${services.map(s => `
                <tr>
                  <td>#${s.id}</td>
                  <td><strong>${s.name}</strong></td>
                  <td><small>${s.description || '-'}</small></td>
                  <td>$${s.price.toFixed(2)}</td>
                  <td>${s.duration_minutes} min</td>
                  <td>${s.is_active ? '<span style="color:#27ae60;">Activo</span>' : '<span style="color:#c0392b;">Inactivo</span>'}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="App.openEditServiceModal(${JSON.stringify(s).replace(/"/g, '&quot;')})">Editar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  openCreateServiceModal() {
    const modalHTML = `
      <div class="modal-header">
        <h3 class="modal-title">💈 Crear Nuevo Servicio</h3>
        <button class="modal-close" onclick="closeModal('service-modal')">&times;</button>
      </div>
      <form onsubmit="App.submitCreateService(event)">
        <div class="form-group">
          <label>Nombre del Servicio</label>
          <input type="text" id="serv-name" class="form-control" required />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <input type="text" id="serv-desc" class="form-control" />
        </div>
        <div class="form-group">
          <label>Precio ($)</label>
          <input type="number" step="0.01" id="serv-price" class="form-control" required />
        </div>
        <div class="form-group">
          <label>Duración (minutos)</label>
          <input type="number" id="serv-duration" class="form-control" value="30" required />
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%;">Guardar Servicio</button>
      </form>
    `;
    showModal('service-modal', modalHTML);
  },

  async submitCreateService(e) {
    e.preventDefault();
    try {
      await API.post('/services', {
        name: document.getElementById('serv-name').value,
        description: document.getElementById('serv-desc').value,
        price: document.getElementById('serv-price').value,
        duration_minutes: document.getElementById('serv-duration').value
      });
      showToast('Servicio creado correctamente.', 'success');
      closeModal('service-modal');
      this.switchAdminTab('services');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openEditServiceModal(s) {
    const modalHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Editar Servicio #${s.id}</h3>
        <button class="modal-close" onclick="closeModal('service-modal')">&times;</button>
      </div>
      <form onsubmit="App.submitEditService(event, ${s.id})">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="serv-name" class="form-control" value="${s.name}" required />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <input type="text" id="serv-desc" class="form-control" value="${s.description || ''}" />
        </div>
        <div class="form-group">
          <label>Precio ($)</label>
          <input type="number" step="0.01" id="serv-price" class="form-control" value="${s.price}" required />
        </div>
        <div class="form-group">
          <label>Duración (minutos)</label>
          <input type="number" id="serv-duration" class="form-control" value="${s.duration_minutes}" required />
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select id="serv-active" class="form-control">
            <option value="1" ${s.is_active ? 'selected' : ''}>Activo</option>
            <option value="0" ${!s.is_active ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%;">Actualizar Servicio</button>
      </form>
    `;
    showModal('service-modal', modalHTML);
  },

  async submitEditService(e, serviceId) {
    e.preventDefault();
    try {
      await API.put(`/services/${serviceId}`, {
        name: document.getElementById('serv-name').value,
        description: document.getElementById('serv-desc').value,
        price: document.getElementById('serv-price').value,
        duration_minutes: document.getElementById('serv-duration').value,
        is_active: document.getElementById('serv-active').value === '1'
      });
      showToast('Servicio actualizado correctamente.', 'success');
      closeModal('service-modal');
      this.switchAdminTab('services');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async loadAdminUsersTab(container) {
    container.innerHTML = `<p>Cargando usuarios...</p>`;
    try {
      const users = await API.get('/users');
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>Gestión de Usuarios</h3>
          <button class="btn btn-gold btn-sm" onclick="App.openCreateUserModal()">+ Crear Usuario</button>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Rol</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>#${u.id}</td>
                  <td><strong>${u.name}</strong></td>
                  <td>${u.email}</td>
                  <td>${u.phone || '-'}</td>
                  <td><span class="role-badge">${u.role}</span></td>
                  <td>
                    <button class="btn btn-danger btn-sm" onclick="App.deleteUser(${u.id})">Eliminar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  openCreateUserModal() {
    const modalHTML = `
      <div class="modal-header">
        <h3 class="modal-title">👤 Crear Nuevo Usuario</h3>
        <button class="modal-close" onclick="closeModal('user-modal')">&times;</button>
      </div>
      <form onsubmit="App.submitCreateUser(event)">
        <div class="form-group">
          <label>Nombre Completo</label>
          <input type="text" id="usr-name" class="form-control" required />
        </div>
        <div class="form-group">
          <label>Correo Electrónico</label>
          <input type="email" id="usr-email" class="form-control" required />
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <input type="password" id="usr-pass" class="form-control" required />
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input type="text" id="usr-phone" class="form-control" />
        </div>
        <div class="form-group">
          <label>Rol de Usuario</label>
          <select id="usr-role" class="form-control" required>
            <option value="cliente">Cliente</option>
            <option value="barbero">Barbero</option>
            <option value="personal">Personal (Recepción/Cajero)</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%;">Guardar Usuario</button>
      </form>
    `;
    showModal('user-modal', modalHTML);
  },

  async submitCreateUser(e) {
    e.preventDefault();
    try {
      await API.post('/users', {
        name: document.getElementById('usr-name').value,
        email: document.getElementById('usr-email').value,
        password: document.getElementById('usr-pass').value,
        phone: document.getElementById('usr-phone').value,
        role: document.getElementById('usr-role').value
      });
      showToast('Usuario creado con éxito.', 'success');
      closeModal('user-modal');
      this.switchAdminTab('users');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteUser(userId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;
    try {
      await API.delete(`/users/${userId}`);
      showToast('Usuario eliminado.', 'success');
      this.switchAdminTab('users');
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  async loadAdminBarbersTab(container) {
    container.innerHTML = `<p>Cargando barberos...</p>`;
    try {
      const barbers = await API.get('/barbers?all=true');
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>Gestión de Barberos y Horarios</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr><th>ID</th><th>Barbero</th><th>Especialidades</th><th>Horario Jornada</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              ${barbers.map(b => `
                <tr>
                  <td>#${b.id}</td>
                  <td><strong>${b.name}</strong><br><small>${b.email}</small></td>
                  <td>${b.specialties || '-'}</td>
                  <td>${b.start_hour} a ${b.end_hour}</td>
                  <td>${b.is_active ? '<span style="color:#27ae60;">Activo</span>' : '<span style="color:#c0392b;">Inactivo</span>'}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="App.openEditBarberHoursModal(${JSON.stringify(b).replace(/"/g, '&quot;')})">Editar Horario</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  openEditBarberHoursModal(b) {
    const modalHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Editar Horario: ${b.name}</h3>
        <button class="modal-close" onclick="closeModal('barber-modal')">&times;</button>
      </div>
      <form onsubmit="App.submitEditBarberHours(event, ${b.id})">
        <div class="form-group">
          <label>Hora de Inicio Jornada</label>
          <input type="time" id="barb-start" class="form-control" value="${b.start_hour}" required />
        </div>
        <div class="form-group">
          <label>Hora de Fin Jornada</label>
          <input type="time" id="barb-end" class="form-control" value="${b.end_hour}" required />
        </div>
        <div class="form-group">
          <label>Especialidades</label>
          <input type="text" id="barb-spec" class="form-control" value="${b.specialties || ''}" />
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%;">Actualizar Horario</button>
      </form>
    `;
    showModal('barber-modal', modalHTML);
  },

  async submitEditBarberHours(e, barberId) {
    e.preventDefault();
    try {
      await API.put(`/barbers/${barberId}`, {
        start_hour: document.getElementById('barb-start').value,
        end_hour: document.getElementById('barb-end').value,
        specialties: document.getElementById('barb-spec').value
      });
      showToast('Horario de barbero actualizado.', 'success');
      closeModal('barber-modal');
      this.switchAdminTab('barbers');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // =========================================================================
  // MODALES DE LOGIN / REGISTRO
  // =========================================================================
  showLoginModal() {
    const modalHTML = `
      <div class="modal-header">
        <h3 class="modal-title">🔐 Iniciar Sesión</h3>
        <button class="modal-close" onclick="closeModal('auth-modal')">&times;</button>
      </div>
      <form onsubmit="App.submitLogin(event)">
        <div class="form-group">
          <label>Correo Electrónico</label>
          <input type="email" id="login-email" class="form-control" placeholder="tu@correo.com" required />
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <input type="password" id="login-password" class="form-control" placeholder="••••••••" required />
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%;">Entrar</button>
      </form>
      <div style="text-align:center; margin-top: 1rem; font-size: 0.9rem;">
        ¿No tienes cuenta? <a href="#" style="color:var(--gold-primary);" onclick="App.showRegisterModal()">Regístrate aquí</a>
      </div>
    `;
    showModal('auth-modal', modalHTML);
  },

  showRegisterModal() {
    const modalHTML = `
      <div class="modal-header">
        <h3 class="modal-title">📝 Registro de Cliente</h3>
        <button class="modal-close" onclick="closeModal('auth-modal')">&times;</button>
      </div>
      <form onsubmit="App.submitRegister(event)">
        <div class="form-group">
          <label>Nombre Completo</label>
          <input type="text" id="reg-name" class="form-control" placeholder="Juan Pérez" required />
        </div>
        <div class="form-group">
          <label>Correo Electrónico</label>
          <input type="email" id="reg-email" class="form-control" placeholder="tu@correo.com" required />
        </div>
        <div class="form-group">
          <label>Contraseña (mínimo 6 caracteres)</label>
          <input type="password" id="reg-password" class="form-control" placeholder="••••••••" required minlength="6" />
        </div>
        <div class="form-group">
          <label>Teléfono de Contacto</label>
          <input type="tel" id="reg-phone" class="form-control" placeholder="+57 300 000 0000" />
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%;">Crear Cuenta</button>
      </form>
    `;
    showModal('auth-modal', modalHTML);
  },

  async submitLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    await Auth.login(email, pass);
  },

  async submitRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;

    await Auth.register({ name, email, password, phone, role: 'cliente' });
  }
};

// Functions de Utilidad Modal & Toast
function showModal(id, htmlContent) {
  let modalOverlay = document.getElementById(id);
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = id;
    modalOverlay.className = 'modal-overlay';
    document.body.appendChild(modalOverlay);
  }
  modalOverlay.innerHTML = `<div class="modal">${htmlContent}</div>`;
  modalOverlay.classList.add('active');
}

function closeModal(id) {
  const modalOverlay = document.getElementById(id);
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
  }
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
