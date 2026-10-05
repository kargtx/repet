const initTheme = () => {
  const theme = localStorage.getItem('theme') || 'light';
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
};
initTheme();

const tzOffsets = {
  "Калининград (UTC+2)": 2,
  "Москва (UTC+3)": 3,
  "Самара (UTC+4)": 4,
  "Екатеринбург (UTC+5)": 5,
  "Омск (UTC+6)": 6,
  "Красноярск (UTC+7)": 7,
  "Иркутск (UTC+8)": 8,
  "Якутск (UTC+9)": 9,
  "Владивосток (UTC+10)": 10,
  "Магадан (UTC+11)": 11,
  "Камчатка (UTC+12)": 12
};

const getTzOffset = () => tzOffsets[localStorage.getItem('timezone') || "Москва (UTC+3)"] || 3;
const shiftTime = (timeStr, diff) => {
  if (!timeStr) return timeStr;
  const [h, m] = timeStr.split(':');
  let newH = (parseInt(h) + diff + 24) % 24;
  return `${newH.toString().padStart(2, '0')}:${m}`;
};

const seed = { user: null, students: [], tutors: [], users: [], lessons: [] };
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
    if (err.message === "Не авторизован") { seed.user = null; render(); }
    throw err;
  }
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const money = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
const todayObj = new Date();
const today = new Date(todayObj.getTime() - (todayObj.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
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
            <label for="login">Логин</label>
            <input id="login" required placeholder="Введите логин" />
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
    btn.textContent = "Вход..."; btn.disabled = true;
    try {
      const data = await api("/api/login", { 
        method: "POST", 
        body: JSON.stringify({ login: document.querySelector("#login").value, password: document.querySelector("#password").value }) 
      });
      seed.user = data.user; state.page = "calendar";
      await save(); render();
    } catch (error) { 
      document.querySelector("#login-error").textContent = error.message; 
      btn.textContent = originalText; btn.disabled = false;
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
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const tzOptions = Object.keys(tzOffsets).map(tz => `<option value="${tz}" ${localStorage.getItem('timezone') === tz ? 'selected' : (tz==="Москва (UTC+3)" && !localStorage.getItem('timezone') ? 'selected' : '')}>${tz}</option>`).join("");

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
          <div style="margin-bottom:12px">
            <select id="app-timezone" class="input-small" style="width:100%; padding: 6px; border-radius:6px; border:1px solid var(--line); background:var(--surface); color:var(--ink); font-size:11px;">
              ${tzOptions}
            </select>
          </div>
          <button class="button ghost small" data-action="logout" style="width:100%">Выйти</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <p class="eyebrow">${roleLabels[seed.user.role]}</p>
            <h1>${state.page === "calendar" ? "Расписание" : state.page === "students" ? "Ученики" : state.page === "admin" ? "Пользователи" : "Финансы"}</h1>
          </div>
          <div class="user">
            <button class="button ghost small" data-action="toggle-theme" title="Сменить тему">${isDark ? '☀️' : '🌙'}</button>
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
  let dayOfWeek = todayObj.getDay() || 7;
  const monday = new Date(todayObj);
  monday.setDate(todayObj.getDate() - dayOfWeek + 1);
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const dates = [], datesDisplay = [];
  const monthNames = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
    dates.push(dateStr); datesDisplay.push(d.getDate().toString());
    if (dateStr === today) days[i] = "Сегодня";
  }
  const hours = ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];
  const isTutor = seed.user.role === "tutor" || seed.user.role === "admin";
  const diff = getTzOffset() - 3; // base is MSK (3)

  const getLessonName = (lesson) => {
    if (seed.user.role === "student") return (seed.tutors.find(x => x.id === lesson.tutorId)?.name || "Урок");
    return (seed.students.find(x => x.id === lesson.studentId)?.name || "Урок");
  };

  const gridCells = hours.map((hour) => `
    <div class="time">${hour}</div>
    ${dates.map((date) => {
      const dbHour = shiftTime(hour, -diff); // Find lesson in DB time
      const lesson = seed.lessons.find((item) => item.date === date && item.time === dbHour);
      if (!lesson) return `<div class="slot" data-date="${date}" data-time="${hour}"></div>`;
      return `<div class="slot has-lesson">
                <div class="lesson ${lesson.paid ? "green" : "orange"} shadow-hover" data-lesson="${lesson.id}">
                  <div class="lesson-name">${esc(getLessonName(lesson))}</div>
                  <small>${lesson.duration}${lesson.paid ? " · оплачено" : ""}</small>
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
            <h3 class="mobile-day-title ${date === today ? 'is-today' : ''}">${days[index]}, ${datesDisplay[index]} ${monthNames[new Date(date).getMonth()]}</h3>
            <div class="mobile-lessons">
              ${dayLessons.map(lesson => `
                  <div class="mobile-lesson-card ${lesson.paid ? 'green' : 'orange'}">
                    <div class="mobile-lesson-time">${shiftTime(lesson.time, diff)} <span class="mobile-lesson-duration">(${lesson.duration})</span></div>
                    <div class="mobile-lesson-details">
                      <strong>${esc(getLessonName(lesson))}</strong>
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

  return `
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
        ${seed.user.role === 'admin' || seed.user.role === 'tutor' ? '<button class="button primary small" data-action="add-student">＋ Новый ученик</button>' : ''}
      </div>
      <div class="list">
        ${seed.students.length > 0 ? seed.students.map((student) => `
          <div class="row shadow-hover-row">
            <div class="person">
              <div class="person-avatar">${esc(student.initials)}</div>
              <div>
                <div class="person-name">${esc(student.name)}</div>
                <div class="person-meta">${esc(student.grade ? student.grade + ' · ' : '')}${esc(student.subject)} · ${money(student.rate)}/час<br/>Логин: ${esc(student.login)}${student.telegram ? ' · ' + esc(student.telegram) : ''}</div>
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
                <div class="person-meta">Логин: ${esc(tutor.login)}</div>
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
                <div class="person-meta">${esc(student.grade ? student.grade + ' · ' : '')}${esc(student.subject)} · ${money(student.rate)}/час<br/>Логин: ${esc(student.login)}${student.telegram ? ' · ' + esc(student.telegram) : ''}<br/>Репетитор: ${esc(seed.tutors.find(t => t.id === student.tutorId)?.name || 'Не привязан')}</div>
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
      <div class="card stat-card shadow-hover"><div class="stat-label">Доход</div><div class="stat-value">${money(total)}</div><div class="stat-detail">По проведенным</div></div>
    </section>`;
}

function modal() {
  if (!state.modal) return "";
  const type = state.modal.type;
  const editing = (type === "student" || type === "tutor") && state.modal.id;
  const diff = getTzOffset() - 3;
  
  if (type === "lesson") {
    const studentOptions = seed.students.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
    return `
      <div class="modal-backdrop fade-in" id="modal-backdrop">
        <section class="modal slide-up">
          <div class="modal-head"><h2>Новый урок</h2><button class="close" data-action="close">×</button></div>
          <form class="form" id="modal-form">
            <input type="hidden" name="type" value="lesson" />
            <div class="field"><label>Ученик</label><select name="studentId" required>${studentOptions || '<option disabled selected>Сначала добавьте ученика</option>'}</select></div>
            <div class="field"><label>Дата</label><input name="date" type="date" required value="${state.modal.date || today}" /></div>
            <div class="field"><label>Время (ваше местное)</label><input name="time" type="time" required value="${state.modal.time || shiftTime('10:00', diff)}" /></div>
            <div class="field"><label>Длительность</label><select name="duration"><option>45 минут</option><option selected>1 час</option><option>1.5 часа</option><option>2 часа</option></select></div>
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
          <div class="modal-head"><h2>${editing ? 'Изменить профиль' : type === 'student' ? 'Новый ученик' : 'Новый репетитор'}</h2><button class="close" data-action="close">×</button></div>
          <form class="form" id="modal-form">
            <input type="hidden" name="type" value="user" />
            <input type="hidden" name="role" value="${type}" />
            ${type === 'student' && seed.user.role === 'admin' ? `
              <div class="field"><label>Привязать к репетитору</label><select name="tutorId" required>
                ${seed.tutors.map(t => `<option value="${t.id}" ${user?.tutorId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
              </select></div>
            ` : ''}
            <div class="field"><label>Имя и фамилия</label><input name="name" required value="${esc(user?.name || "")}" placeholder="Иван Иванов" /></div>
            <div class="field"><label>Логин для входа</label><input name="login" value="${esc(user?.login || "")}" placeholder="Например, ivan_2026" /></div>
            <div class="field">
              <label>Пароль</label>
              <div style="display:flex; gap:8px;">
                <input name="password" id="user-password-input" value="${editing?esc(user?.password || ""):""}" placeholder="${editing?'Оставьте пустым чтобы не менять':'Пароль'}" style="flex:1" />
                <button type="button" class="button ghost" onclick="document.getElementById('user-password-input').value = Math.random().toString(36).slice(-8); return false;">Сгенерировать</button>
              </div>
            </div>
            ${type === 'student' ? `
              <div class="field"><label>Ник в ТГ</label><input name="telegram" value="${esc(user?.telegram || "")}" placeholder="@username" /></div>
              <div class="field"><label>Класс</label><input name="grade" value="${esc(user?.grade || "")}" placeholder="Например, 11 класс" /></div>
              <div class="field"><label>Предмет</label><input name="subject" required value="${esc(user?.subject || "")}" placeholder="Математика" /></div>
              <div class="field"><label>Ставка за час, ₽</label><input name="rate" required type="number" min="0" value="${user?.rate || ""}" /></div>
            ` : ''}
            <div class="field"><label>Заметки</label><textarea name="notes" rows="2">${esc(user?.notes || "")}</textarea></div>
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
  
  app.querySelector("#app-timezone")?.addEventListener("change", (e) => {
    localStorage.setItem('timezone', e.target.value);
    render();
  });

  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page = button.dataset.page; render(); }));
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
    const action = button.dataset.action;
    if (action === "add-student") state.modal = { type: "student" };
    if (action === "add-tutor") state.modal = { type: "tutor" };
    if (action === "add-lesson") state.modal = { type: "lesson" };
    if (action === "close") state.modal = null;
    if (action === "toggle-theme") {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
      render();
    }
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
    if (!confirm("Вы уверены? Удалятся и все уроки.")) return;
    try { await api(`/api/users/${button.dataset.deleteUser}`, { method: "DELETE" }); await save(); render(); } catch (e) { alert(e.message); }
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
    const originalText = btn.textContent; btn.textContent = "Сохранение..."; btn.disabled = true;

    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      if (data.type === "user") {
        const entry = { name: data.name, login: data.login, password: data.password, role: data.role, notes: data.notes };
        if (data.role === "student") { 
          entry.subject = data.subject; entry.telegram = data.telegram; entry.grade = data.grade; entry.rate = data.rate; 
          if (data.tutorId) entry.tutorId = data.tutorId;
        }
        if (state.modal.id) await api(`/api/users/${state.modal.id}`, { method: "PUT", body: JSON.stringify(entry) });
        else await api("/api/users", { method: "POST", body: JSON.stringify(entry) });
      } else if (data.type === "lesson") {
        const diff = getTzOffset() - 3;
        await api("/api/lessons", { method: "POST", body: JSON.stringify({ 
          studentId: data.studentId, tutorId: seed.user.id, date: data.date, 
          time: shiftTime(data.time, -diff), // save in DB timezone (MSK)
          duration: data.duration, held: data.held === "on", paid: data.paid === "on" 
        })});
      }
      await save(); state.modal = null; render();
    } catch (err) { alert(err.message); btn.textContent = originalText; btn.disabled = false; }
  });
}

save().then(render).catch((error) => { 
  app.innerHTML = `<main class="login"><section class="login-card"><h1>Сервер недоступен</h1><p class="sub">${esc(error.message)}</p></section></main>`; 
});
