const seed = {
  user: null, // { id, name, initials, role }
  students: [],
  tutors: [],
  users: [], // only for admin
  lessons: []
};
let state = { page: "calendar", modal: null };
const app = document.querySelector("#app");

const api = async (url, options = {}) => {
  const isQuery = url.includes("?");
  const authUrl = seed.user ? `${url}${isQuery ? "&" : "?"}userId=${seed.user.id}` : url;
  const response = await fetch(authUrl, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
};

const save = async () => {
  if (!seed.user) return;
  try {
    const data = await api("/api/state");
    seed.students = data.students;
    seed.tutors = data.tutors;
    seed.lessons = data.lessons;
    if (data.users) seed.users = data.users;
  } catch (err) {
    console.error("Failed to load state", err);
    if (err.message === "Не авторизован") { seed.user = null; render(); }
    throw err;
  }
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const money = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
const today = "2026-09-02"; // Mocked today
const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

function login() {
  app.innerHTML = `
    <main class="login">
      <section class="login-card fade-in">
        <div class="brand"><span class="brand-mark">Р</span> репет</div>
        <h1>С возвращением!</h1>
        <p class="sub">Войдите в свой аккаунт</p>
        <form class="form" id="login-form">
          <div class="field">
            <label for="phone">Номер телефона</label>
            <input id="phone" required placeholder="+7 (999) 123-45-67" />
          </div>
          <div class="field">
            <label for="password">Пароль</label>
            <input id="password" required type="password" minlength="4" placeholder="Введите пароль" />
          </div>
          <div id="login-error" class="error"></div>
          <button class="button primary">Войти</button>
        </form>
      </section>
    </main>`;
  
  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const btn = event.currentTarget.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = "Вход...";
    btn.disabled = true;
    try {
      const data = await api("/api/login", { 
        method: "POST", 
        body: JSON.stringify({ phone: document.querySelector("#phone").value, password: document.querySelector("#password").value }) 
      });
      seed.user = data.user;
      state.page = "calendar";
      await save(); 
      render();
    } catch (error) { 
      document.querySelector("#login-error").textContent = error.message; 
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

function navButton(page, icon, label) {
  return `<button class="${state.page === page ? "active" : ""}" data-page="${page}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span></button>`;
}

function layout(content) {
  const roleLabels = { admin: "Мастер (Админ)", tutor: "Репетитор", student: "Ученик" };
  const isAdmin = seed.user.role === "admin";
  const isTutor = seed.user.role === "tutor" || isAdmin;

  const navs = `
    ${navButton("calendar", "▦", "Календарь")}
    ${isTutor ? navButton("students", "♙", "Ученики") : ""}
    ${isTutor ? navButton("finance", "↗", "Финансы") : ""}
    ${isAdmin ? navButton("admin", "⚙", "Админка") : ""}
  `;

  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">Р</span> репет</div>
        <nav class="nav">${navs}</nav>
        <div class="sidebar-footer">
          <button class="button ghost small" data-action="logout" style="width:100%; margin-top:10px">Выйти</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <p class="eyebrow">${roleLabels[seed.user.role]}</p>
            <h1>${state.page === "calendar" ? "Расписание" : state.page === "students" ? "Ученики" : state.page === "admin" ? "Пользователи" : "Финансы"}</h1>
          </div>
          <div class="user">
            <span class="user-name">${esc(seed.user.name)}</span>
            <span class="avatar">${esc(seed.user.initials)}</span>
          </div>
        </header>
        <div class="content-fade-in">${content}</div>
      </main>
      <nav class="mobile-nav">${navs}</nav>
    </div>`;
}

function calendarPage() {
  const days = ["Пн", "Вт", "Сегодня", "Чт", "Пт", "Сб", "Вс"];
  const dates = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];
  const datesDisplay = ["31", "1", "2", "3", "4", "5", "6"];
  const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  const isTutor = seed.user.role === "tutor" || seed.user.role === "admin";

  const getLessonName = (lesson) => {
    if (seed.user.role === "student") {
      const t = seed.tutors.find(x => x.id === lesson.tutorId);
      return t ? t.name : "Урок";
    }
    const s = seed.students.find(x => x.id === lesson.studentId);
    return s ? s.name : "Урок";
  };

  const getLessonSub = (lesson) => {
    if (seed.user.role === "student") {
      const t = seed.tutors.find(x => x.id === lesson.tutorId);
      return "Репетитор" + (lesson.paid ? " · оплачено" : "");
    }
    const s = seed.students.find(x => x.id === lesson.studentId);
    return (s?.subject || "") + (lesson.paid ? " · оплачено" : "");
  };

  const gridCells = hours.map((hour) => `
    <div class="time">${hour}</div>
    ${dates.map((date) => {
      const lesson = seed.lessons.find((item) => item.date === date && item.time === hour);
      if (!lesson) return `<div class="slot" data-date="${date}" data-time="${hour}"></div>`;
      return `<div class="slot has-lesson">
                <div class="lesson ${lesson.paid ? "green" : "orange"} shadow-hover" data-lesson="${lesson.id}">
                  <div class="lesson-name">${esc(getLessonName(lesson))}</div>
                  <small>${lesson.duration} · ${esc(getLessonSub(lesson))}</small>
                </div>
              </div>`;
    }).join("")}
  `).join("");

  const desktopCalendar = `
    <div class="calendar-wrap desktop-only">
      <div class="calendar">
        <div class="calendar-header-corner"></div>
        ${days.map((day, index) => `<div class="day-head ${dates[index] === today ? 'is-today' : ''}">${day}<strong>${datesDisplay[index]}</strong></div>`).join("")}
        ${gridCells}
      </div>
    </div>`;

  const mobileList = `
    <div class="mobile-calendar mobile-only">
      ${dates.map((date, index) => {
        const dayLessons = seed.lessons.filter(l => l.date === date).sort((a,b) => a.time.localeCompare(b.time));
        if (dayLessons.length === 0) return '';
        return `
          <div class="mobile-day">
            <h3 class="mobile-day-title ${date === today ? 'is-today' : ''}">${days[index]}, ${datesDisplay[index]} сентября</h3>
            <div class="mobile-lessons">
              ${dayLessons.map(lesson => `
                  <div class="mobile-lesson-card ${lesson.paid ? 'green' : 'orange'}">
                    <div class="mobile-lesson-time">${lesson.time} <span class="mobile-lesson-duration">(${lesson.duration})</span></div>
                    <div class="mobile-lesson-details">
                      <strong>${esc(getLessonName(lesson))}</strong>
                      <span class="mobile-lesson-subject">${esc(getLessonSub(lesson))}</span>
                    </div>
                    ${lesson.paid ? '<div class="mobile-lesson-badge paid">Оплачено</div>' : '<div class="mobile-lesson-badge pending">Ожидает</div>'}
                  </div>
                `).join("")}
            </div>
          </div>
        `;
      }).join("")}
      ${seed.lessons.length === 0 ? `<div class="empty">На этой неделе нет уроков</div>` : ''}
    </div>`;

  let statsHTML = '';
  if (isTutor) {
    const weekRevenue = seed.lessons.filter((l) => l.paid).reduce((sum, l) => sum + (seed.students.find((s) => s.id === l.studentId)?.rate || 0), 0);
    const pendingRevenue = seed.lessons.filter((l) => l.held && !l.paid).reduce((sum, l) => sum + (seed.students.find((s) => s.id === l.studentId)?.rate || 0), 0);
    statsHTML = `
      <div class="stats">
        <div class="card stat-card shadow-hover">
          <div class="stat-label">Уроков сегодня</div><div class="stat-value">${seed.lessons.filter((l) => l.date === today).length}</div><div class="stat-detail">Всё по плану</div>
        </div>
        <div class="card stat-card shadow-hover">
          <div class="stat-label">Доход за неделю</div><div class="stat-value">${money(weekRevenue)}</div><div class="stat-detail">Оплачено</div>
        </div>
        <div class="card stat-card shadow-hover">
          <div class="stat-label">Ожидают оплаты</div><div class="stat-value">${money(pendingRevenue)}</div><div class="stat-detail" style="color:var(--orange)">По проведенным урокам</div>
        </div>
      </div>`;
  }

  return `
    ${statsHTML}
    <section class="card schedule-card">
      <div class="section-head">
        <h2>Эта неделя</h2>
        ${isTutor ? '<button class="button primary small" data-action="add-lesson">＋ Добавить урок</button>' : ''}
      </div>
      ${desktopCalendar}
      ${mobileList}
    </section>`;
}

function studentsPage() {
  return `
    <section class="card">
      <div class="section-head">
        <h2>Мои ученики <span class="muted-count">(${seed.students.length})</span></h2>
        ${seed.user.role === 'admin' ? '<button class="button primary small" data-action="add-student">＋ Новый ученик</button>' : ''}
      </div>
      <div class="list">
        ${seed.students.length > 0 ? seed.students.map((student) => `
          <div class="row shadow-hover-row">
            <div class="person">
              <div class="person-avatar">${esc(student.initials)}</div>
              <div>
                <div class="person-name">${esc(student.name)}</div>
                <div class="person-meta">${esc(student.subject)} · ${money(student.rate)}/час · Тел: ${esc(student.phone)}</div>
              </div>
            </div>
            <button class="button ghost small action-btn" data-edit-user="${student.id}">Изменить</button>
          </div>
        `).join("") : `<div class="empty">Учеников пока нет.</div>`}
      </div>
    </section>`;
}

function adminPage() {
  return `
    <section class="card" style="margin-bottom:20px;">
      <div class="section-head">
        <h2>Репетиторы <span class="muted-count">(${seed.tutors.length})</span></h2>
        <button class="button primary small" data-action="add-tutor">＋ Новый репетитор</button>
      </div>
      <div class="list">
        ${seed.tutors.map((tutor) => `
          <div class="row shadow-hover-row">
            <div class="person">
              <div class="person-avatar" style="background:#fff0f2; color:var(--red)">${esc(tutor.initials)}</div>
              <div>
                <div class="person-name">${esc(tutor.name)} ${tutor.role==='admin'?'(Админ)':''}</div>
                <div class="person-meta">Тел: ${esc(tutor.phone)}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="button ghost small" data-edit-user="${tutor.id}">Изменить</button>
              ${tutor.id !== seed.user.id ? `<button class="button danger small" data-delete-user="${tutor.id}">Удалить</button>` : ''}
            </div>
          </div>
        `).join("")}
      </div>
    </section>
    
    <section class="card">
      <div class="section-head">
        <h2>Все ученики <span class="muted-count">(${seed.students.length})</span></h2>
        <button class="button primary small" data-action="add-student">＋ Новый ученик</button>
      </div>
      <div class="list">
        ${seed.students.map((student) => `
          <div class="row shadow-hover-row">
            <div class="person">
              <div class="person-avatar">${esc(student.initials)}</div>
              <div>
                <div class="person-name">${esc(student.name)}</div>
                <div class="person-meta">${esc(student.subject)} · ${money(student.rate)}/час · Тел: ${esc(student.phone)}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="button ghost small" data-edit-user="${student.id}">Изменить</button>
              <button class="button danger small" data-delete-user="${student.id}">Удалить</button>
            </div>
          </div>
        `).join("")}
      </div>
    </section>`;
}

function financePage() {
  const held = seed.lessons.filter((lesson) => lesson.held);
  const total = held.reduce((sum, lesson) => sum + (seed.students.find((student) => student.id === lesson.studentId)?.rate || 0), 0);
  
  return `
    <section class="stats">
      <div class="card stat-card shadow-hover">
        <div class="stat-label">Доход за день</div><div class="stat-value">${money(total)}</div><div class="stat-detail">По проведенным</div>
      </div>
      <div class="card stat-card shadow-hover">
        <div class="stat-label">Доход за месяц</div><div class="stat-value">${money(total * 4)}</div><div class="stat-detail">Примерно</div>
      </div>
    </section>
    <section class="card">
      <div class="section-head"><h2>Последние уроки</h2></div>
      <div class="list">
        ${held.length ? held.map((lesson) => { 
          const student = seed.students.find((s) => s.id === lesson.studentId); 
          return `
            <div class="row shadow-hover-row">
              <div class="finance-info">
                <div class="person-name">${esc(student?.name)}</div>
                <div class="person-meta">${formatDate(lesson.date)} · ${lesson.time} · ${lesson.duration}</div>
              </div>
              <div class="finance-status">
                <div class="price">${money(student?.rate || 0)}</div>
                <span class="badge ${lesson.paid ? "paid" : "pending"}">${lesson.paid ? "Оплачено" : "Ожидает"}</span>
              </div>
            </div>`; 
        }).join("") : `<div class="empty">Проведённых уроков пока нет.</div>`}
      </div>
    </section>`;
}

function modal() {
  if (!state.modal) return "";
  const type = state.modal.type;
  const editing = (type === "student" || type === "tutor") && state.modal.id;
  
  if (type === "lesson") {
    const studentOptions = seed.students.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
    return `
      <div class="modal-backdrop fade-in" id="modal-backdrop">
        <section class="modal slide-up">
          <div class="modal-head">
            <h2>Новый урок</h2><button class="close" data-action="close">×</button>
          </div>
          <form class="form" id="modal-form">
            <input type="hidden" name="type" value="lesson" />
            <div class="field">
              <label>Ученик</label>
              <select name="studentId" required>${studentOptions || '<option disabled selected>Сначала добавьте ученика</option>'}</select>
            </div>
            <div class="field"><label>Дата</label><input name="date" type="date" required value="${state.modal.date || today}" /></div>
            <div class="field"><label>Время</label><input name="time" type="time" required value="${state.modal.time || '10:00'}" /></div>
            <div class="field">
              <label>Длительность</label>
              <select name="duration"><option>45 минут</option><option selected>1 час</option><option>1.5 часа</option><option>2 часа</option></select>
            </div>
            <div class="checkbox-field"><label class="custom-checkbox"><input name="held" type="checkbox" /><span class="checkmark"></span> Урок уже проведён</label></div>
            <div class="checkbox-field"><label class="custom-checkbox"><input name="paid" type="checkbox" /><span class="checkmark"></span> Оплата получена</label></div>
            <div class="form-actions"><button type="button" class="button ghost" data-action="close">Отмена</button><button class="button primary" ${!studentOptions ? 'disabled' : ''}>Добавить</button></div>
          </form>
        </section>
      </div>`;
  }
  
  if (type === "student" || type === "tutor") {
    const user = editing ? (type==="student"?seed.students:seed.tutors).find((item) => item.id === state.modal.id) : {};
    return `
      <div class="modal-backdrop fade-in" id="modal-backdrop">
        <section class="modal slide-up">
          <div class="modal-head">
            <h2>${editing ? 'Изменить профиль' : type === 'student' ? 'Новый ученик' : 'Новый репетитор'}</h2>
            <button class="close" data-action="close">×</button>
          </div>
          <form class="form" id="modal-form">
            <input type="hidden" name="type" value="user" />
            <input type="hidden" name="role" value="${type}" />
            <div class="field"><label>Имя и фамилия</label><input name="name" required value="${esc(user?.name || "")}" placeholder="Иван Иванов" /></div>
            <div class="field"><label>Телефон для входа</label><input name="phone" required value="${esc(user?.phone || "")}" placeholder="+7 (999) 000-00-00" /></div>
            <div class="field">
              <label>Пароль</label>
              <div style="display:flex; gap:8px;">
                <input name="password" id="user-password-input" ${editing?'':'required'} value="${editing?esc(user?.password || ""):""}" placeholder="${editing?'Оставьте пустым чтобы не менять':'Пароль'}" style="flex:1" />
                <button type="button" class="button ghost" onclick="document.getElementById('user-password-input').value = Math.random().toString(36).slice(-8); return false;">Сгенерировать</button>
              </div>
            </div>
            ${type === 'student' ? `
              <div class="field"><label>Предмет</label><input name="subject" required value="${esc(user?.subject || "")}" placeholder="Математика" /></div>
              <div class="field"><label>Ставка за час, ₽</label><input name="rate" required type="number" min="0" value="${user?.rate || ""}" /></div>
            ` : ''}
            <div class="field"><label>Заметки (опционально)</label><textarea name="notes" rows="2">${esc(user?.notes || "")}</textarea></div>
            <div class="form-actions"><button type="button" class="button ghost" data-action="close">Отмена</button><button class="button primary">Сохранить</button></div>
          </form>
        </section>
      </div>`;
  }
  return "";
}

function render() {
  if (!seed.user) return login();
  
  let content = "";
  if (state.page === "calendar") content = calendarPage();
  else if (state.page === "students") content = studentsPage();
  else if (state.page === "admin") content = adminPage();
  else if (state.page === "finance") content = financePage();
  
  app.innerHTML = layout(content) + modal();
  
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page = button.dataset.page; render(); }));
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
    const action = button.dataset.action;
    if (action === "add-student") state.modal = { type: "student" };
    if (action === "add-tutor") state.modal = { type: "tutor" };
    if (action === "add-lesson") state.modal = { type: "lesson" };
    if (action === "close") state.modal = null;
    if (action === "logout") { seed.user = null; state.page = "calendar"; }
    render();
  }));

  app.querySelectorAll("[data-edit-user]").forEach((button) => button.addEventListener("click", () => { 
    const id = button.dataset.editUser;
    const isStudent = seed.students.some(s => s.id === id);
    state.modal = { type: isStudent ? "student" : "tutor", id }; 
    render(); 
  }));

  app.querySelectorAll("[data-delete-user]").forEach((button) => button.addEventListener("click", async () => { 
    if (!confirm("Вы уверены, что хотите удалить этого пользователя? Это действие удалит и все его уроки.")) return;
    const id = button.dataset.deleteUser;
    try {
      await api(`/api/users/${id}`, { method: "DELETE" });
      await save(); render();
    } catch (e) { alert(e.message); }
  }));

  if (seed.user.role !== "student") {
    app.querySelectorAll(".desktop-only .slot:not(.has-lesson)").forEach(slot => {
      slot.addEventListener("click", () => {
        state.modal = { type: "lesson", date: slot.dataset.date, time: slot.dataset.time };
        render();
      });
    });
  }
  
  const backdrop = app.querySelector("#modal-backdrop");
  if (backdrop) backdrop.addEventListener("click", (e) => { if (e.target === backdrop) { state.modal = null; render(); } });

  app.querySelector("#modal-form")?.addEventListener("submit", async (event) => {
    event.preventDefault(); 
    const btn = event.currentTarget.querySelector('.button.primary');
    const originalText = btn.textContent;
    btn.textContent = "Сохранение..."; btn.disabled = true;

    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      if (data.type === "user") {
        const entry = { name: data.name, phone: data.phone, password: data.password, role: data.role, notes: data.notes };
        if (data.role === "student") { entry.subject = data.subject; entry.rate = data.rate; }
        
        if (state.modal.id) await api(`/api/users/${state.modal.id}`, { method: "PUT", body: JSON.stringify(entry) });
        else await api("/api/users", { method: "POST", body: JSON.stringify(entry) });
      } else if (data.type === "lesson") {
        await api("/api/lessons", { method: "POST", body: JSON.stringify({ 
          studentId: data.studentId, tutorId: seed.user.id, date: data.date, time: data.time, duration: data.duration, held: data.held === "on", paid: data.paid === "on" 
        })});
      }
      await save(); state.modal = null; render();
    } catch (err) {
      alert(err.message || "Ошибка при сохранении");
      btn.textContent = originalText; btn.disabled = false;
    }
  });
}

save().then(render).catch((error) => { 
  app.innerHTML = `<main class="login"><section class="login-card"><h1>Сервер недоступен</h1><p class="sub">${esc(error.message)}<br />Убедитесь, что сервер запущен.</p></section></main>`; 
});
