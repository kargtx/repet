const seed = {
  loggedIn: false,
  students: [
    { id: "1", name: "Алина Смирнова", subject: "Математика", rate: 1800, notes: "" },
    { id: "2", name: "Михаил Волков", subject: "Английский язык", rate: 1500, notes: "" },
    { id: "3", name: "София Ким", subject: "Физика", rate: 2000, notes: "" }
  ],
  lessons: [
    { id: "1", studentId: "1", date: "2026-09-02", time: "10:00", duration: "1 час", held: true, paid: true },
    { id: "2", studentId: "2", date: "2026-09-02", time: "14:00", duration: "45 минут", held: true, paid: false },
    { id: "3", studentId: "3", date: "2026-09-04", time: "16:00", duration: "2 часа", held: false, paid: false }
  ]
};
let state = { page: "calendar", modal: null };
const app = document.querySelector("#app");

const api = async (url, options = {}) => {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
};

const save = async () => {
  try {
    const data = await api("/api/state");
    seed.students = data.students.map(s => ({ ...s, id: String(s.id) }));
    seed.lessons = data.lessons.map(l => ({ ...l, id: String(l.id), studentId: String(l.studentId) }));
  } catch (err) {
    console.error("Failed to load state", err);
    throw err;
  }
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const initials = (name) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
const money = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
const today = "2026-09-02"; // Mocked today date
const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

function login() {
  app.innerHTML = `
    <main class="login">
      <section class="login-card fade-in">
        <div class="brand"><span class="brand-mark">Р</span> репет</div>
        <h1>С возвращением!</h1>
        <p class="sub">Войдите, чтобы управлять расписанием и учениками.</p>
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
      await api("/api/login", { 
        method: "POST", 
        body: JSON.stringify({ 
          phone: document.querySelector("#phone").value, 
          password: document.querySelector("#password").value 
        }) 
      });
      seed.loggedIn = true; 
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
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">Р</span> репет</div>
        <nav class="nav">
          ${navButton("calendar", "▦", "Календарь")}
          ${navButton("students", "♙", "Ученики")}
          ${navButton("finance", "↗", "Финансы")}
        </nav>
        <div class="sidebar-footer">Ваше расписание всегда под рукой.<br />Данные хранятся локально.</div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <p class="eyebrow">Среда, 2 сентября 2026</p>
            <h1>${state.page === "calendar" ? "Расписание" : state.page === "students" ? "Ученики" : "Финансы"}</h1>
          </div>
          <div class="user">
            <span class="user-name">Алексей</span>
            <span class="avatar">АК</span>
          </div>
        </header>
        <div class="content-fade-in">${content}</div>
      </main>
      <nav class="mobile-nav">
        ${navButton("calendar", "▦", "Календарь")}
        ${navButton("students", "♙", "Ученики")}
        ${navButton("finance", "↗", "Финансы")}
      </nav>
    </div>`;
}

function calendarPage() {
  const days = ["Пн", "Вт", "Сегодня", "Чт", "Пт", "Сб", "Вс"];
  const dates = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];
  const datesDisplay = ["31", "1", "2", "3", "4", "5", "6"];
  const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

  // Desktop Grid Render
  const gridCells = hours.map((hour) => `
    <div class="time">${hour}</div>
    ${dates.map((date) => {
      const lesson = seed.lessons.find((item) => item.date === date && item.time === hour);
      if (!lesson) return `<div class="slot" data-date="${date}" data-time="${hour}"></div>`;
      const student = seed.students.find((item) => item.id === lesson.studentId);
      return `<div class="slot has-lesson">
                <div class="lesson ${lesson.paid ? "green" : "orange"} shadow-hover" data-lesson="${lesson.id}">
                  <div class="lesson-name">${esc(student?.name || "Ученик")}</div>
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

  // Mobile List Render
  const mobileList = `
    <div class="mobile-calendar mobile-only">
      ${dates.map((date, index) => {
        const dayLessons = seed.lessons.filter(l => l.date === date).sort((a,b) => a.time.localeCompare(b.time));
        if (dayLessons.length === 0) return '';
        return `
          <div class="mobile-day">
            <h3 class="mobile-day-title ${date === today ? 'is-today' : ''}">${days[index]}, ${datesDisplay[index]} ${date.split("-")[1] === "09" ? "сентября" : "августа"}</h3>
            <div class="mobile-lessons">
              ${dayLessons.map(lesson => {
                const student = seed.students.find((item) => item.id === lesson.studentId);
                return `
                  <div class="mobile-lesson-card ${lesson.paid ? 'green' : 'orange'}" data-lesson="${lesson.id}">
                    <div class="mobile-lesson-time">${lesson.time} <span class="mobile-lesson-duration">(${lesson.duration})</span></div>
                    <div class="mobile-lesson-details">
                      <strong>${esc(student?.name || "Ученик")}</strong>
                      <span class="mobile-lesson-subject">${esc(student?.subject || "")}</span>
                    </div>
                    ${lesson.paid ? '<div class="mobile-lesson-badge paid">Оплачено</div>' : '<div class="mobile-lesson-badge pending">Ожидает</div>'}
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }).join("")}
      ${seed.lessons.length === 0 ? `<div class="empty">На этой неделе нет уроков</div>` : ''}
    </div>`;

  // Stats
  const todayCount = seed.lessons.filter((l) => l.date === today).length;
  const weekRevenue = seed.lessons.filter((l) => l.paid).reduce((sum, l) => sum + (seed.students.find((s) => s.id === l.studentId)?.rate || 0), 0);
  const pendingRevenue = seed.lessons.filter((l) => l.held && !l.paid).reduce((sum, l) => sum + (seed.students.find((s) => s.id === l.studentId)?.rate || 0), 0);

  return `
    <div class="stats">
      <div class="card stat-card shadow-hover">
        <div class="stat-label">Уроков сегодня</div>
        <div class="stat-value">${todayCount}</div>
        <div class="stat-detail">Всё по плану</div>
      </div>
      <div class="card stat-card shadow-hover">
        <div class="stat-label">Доход за неделю</div>
        <div class="stat-value">${money(weekRevenue)}</div>
        <div class="stat-detail">↑ 12% к прошлой неделе</div>
      </div>
      <div class="card stat-card shadow-hover">
        <div class="stat-label">Ожидают оплаты</div>
        <div class="stat-value">${money(pendingRevenue)}</div>
        <div class="stat-detail" style="color:var(--orange)">2 урока</div>
      </div>
    </div>
    <section class="card schedule-card">
      <div class="section-head">
        <h2>Эта неделя</h2>
        <button class="button primary small" data-action="add-lesson">＋ Добавить урок</button>
      </div>
      ${desktopCalendar}
      ${mobileList}
    </section>`;
}

function studentsPage() {
  return `
    <section class="card">
      <div class="section-head">
        <h2>Все ученики <span class="muted-count">(${seed.students.length})</span></h2>
        <button class="button primary small" data-action="add-student">＋ Добавить</button>
      </div>
      <div class="list">
        ${seed.students.length > 0 ? seed.students.map((student) => `
          <div class="row shadow-hover-row">
            <div class="person">
              <div class="person-avatar">${initials(student.name)}</div>
              <div>
                <div class="person-name">${esc(student.name)}</div>
                <div class="person-meta">${esc(student.subject)} · ${money(student.rate)}/час</div>
              </div>
            </div>
            <button class="button ghost small action-btn" data-edit-student="${student.id}">Изменить</button>
          </div>
        `).join("") : `<div class="empty">Учеников пока нет.</div>`}
      </div>
    </section>`;
}

function financePage() {
  const held = seed.lessons.filter((lesson) => lesson.held);
  const total = held.reduce((sum, lesson) => sum + (seed.students.find((student) => student.id === lesson.studentId)?.rate || 0), 0);
  
  return `
    <section class="stats">
      <div class="card stat-card shadow-hover">
        <div class="stat-label">Доход за день</div>
        <div class="stat-value">${money(total)}</div>
        <div class="stat-detail">2 проведённых урока</div>
      </div>
      <div class="card stat-card shadow-hover">
        <div class="stat-label">Доход за месяц</div>
        <div class="stat-value">${money(total * 4)}</div>
        <div class="stat-detail">↑ 8% к августу</div>
      </div>
      <div class="card stat-card shadow-hover">
        <div class="stat-label">Средний чек</div>
        <div class="stat-value">${money(held.length ? Math.round(total / held.length) : 0)}</div>
        <div class="stat-detail">за один урок</div>
      </div>
    </section>
    <section class="card">
      <div class="section-head">
        <h2>Последние уроки</h2>
        <button class="button ghost small" data-action="export">Экспорт календаря</button>
      </div>
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
  const editing = state.modal.type === "student" && state.modal.id;
  const student = editing ? seed.students.find((item) => item.id === state.modal.id) : {};
  const studentOptions = seed.students.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
  
  const body = state.modal.type === "student" ? `
    <form class="form" id="modal-form">
      <div class="field">
        <label>Имя и фамилия</label>
        <input name="name" required value="${esc(student?.name || "")}" placeholder="Например, Иван Петров" />
      </div>
      <div class="field">
        <label>Предмет</label>
        <input name="subject" required value="${esc(student?.subject || "")}" placeholder="Математика" />
      </div>
      <div class="field">
        <label>Ставка за час, ₽</label>
        <input name="rate" required type="number" min="0" value="${student?.rate || ""}" />
      </div>
      <div class="field">
        <label>Заметки</label>
        <textarea name="notes" rows="3">${esc(student?.notes || "")}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="button ghost" data-action="close">Отмена</button>
        <button class="button primary">Сохранить</button>
      </div>
    </form>` : `
    <form class="form" id="modal-form">
      <div class="field">
        <label>Ученик</label>
        <select name="studentId" required>
          ${studentOptions || '<option disabled selected>Сначала добавьте ученика</option>'}
        </select>
      </div>
      <div class="field">
        <label>Дата</label>
        <input name="date" type="date" required value="${state.modal.date || today}" />
      </div>
      <div class="field">
        <label>Время</label>
        <input name="time" type="time" required value="${state.modal.time || '10:00'}" />
      </div>
      <div class="field">
        <label>Длительность</label>
        <select name="duration">
          <option>45 минут</option>
          <option selected>1 час</option>
          <option>1.5 часа</option>
          <option>2 часа</option>
        </select>
      </div>
      <div class="checkbox-field">
        <label class="custom-checkbox">
          <input name="held" type="checkbox" />
          <span class="checkmark"></span>
          Урок уже проведён
        </label>
      </div>
      <div class="checkbox-field">
        <label class="custom-checkbox">
          <input name="paid" type="checkbox" />
          <span class="checkmark"></span>
          Оплата получена
        </label>
      </div>
      <div class="form-actions">
        <button type="button" class="button ghost" data-action="close">Отмена</button>
        <button class="button primary" ${!studentOptions ? 'disabled' : ''}>Добавить</button>
      </div>
    </form>`;

  return `
    <div class="modal-backdrop fade-in" id="modal-backdrop">
      <section class="modal slide-up">
        <div class="modal-head">
          <h2>${state.modal.type === "student" ? (editing ? "Изменить ученика" : "Новый ученик") : "Новый урок"}</h2>
          <button class="close" data-action="close">×</button>
        </div>
        ${body}
      </section>
    </div>`;
}

function render() {
  if (!seed.loggedIn) return login();
  const content = state.page === "calendar" ? calendarPage() : state.page === "students" ? studentsPage() : financePage();
  app.innerHTML = layout(content) + modal();
  
  // Navigation binding
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { 
    state.page = button.dataset.page; 
    render(); 
  }));
  
  // Actions binding
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "add-student") state.modal = { type: "student" };
    if (action === "add-lesson") state.modal = { type: "lesson" };
    if (action === "close") state.modal = null;
    if (action === "export") downloadCalendar();
    render();
  }));

  // Edit student
  app.querySelectorAll("[data-edit-student]").forEach((button) => button.addEventListener("click", () => { 
    state.modal = { type: "student", id: String(button.dataset.editStudent) }; 
    render(); 
  }));

  // Quick add from calendar slot
  app.querySelectorAll(".desktop-only .slot:not(.has-lesson)").forEach(slot => {
    slot.addEventListener("click", () => {
      state.modal = { type: "lesson", date: slot.dataset.date, time: slot.dataset.time };
      render();
    });
  });
  
  // Close modal on backdrop click
  const backdrop = app.querySelector("#modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        state.modal = null;
        render();
      }
    });
  }

  // Form submission
  app.querySelector("#modal-form")?.addEventListener("submit", async (event) => {
    event.preventDefault(); 
    const btn = event.currentTarget.querySelector('.button.primary');
    const originalText = btn.textContent;
    btn.textContent = "Сохранение...";
    btn.disabled = true;

    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      if (state.modal.type === "student") {
        const entry = { name: data.name, subject: data.subject, rate: Number(data.rate), notes: data.notes || "" };
        if (state.modal.id) await api(\`/api/students/\${state.modal.id}\`, { method: "PUT", body: JSON.stringify(entry) });
        else await api("/api/students", { method: "POST", body: JSON.stringify(entry) });
      } else {
        await api("/api/lessons", { method: "POST", body: JSON.stringify({ 
          studentId: data.studentId, 
          date: data.date, 
          time: data.time, 
          duration: data.duration, 
          held: data.held === "on", 
          paid: data.paid === "on" 
        }) });
      }
      await save(); 
      state.modal = null; 
      render();
    } catch (err) {
      alert(err.message || "Ошибка при сохранении");
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

function downloadCalendar() {
  const events = seed.lessons.map((lesson) => { 
    const student = seed.students.find((s) => s.id === lesson.studentId); 
    return \`BEGIN:VEVENT\\nSUMMARY:Урок — \${student?.name}\\nDTSTART:\${lesson.date.replaceAll("-", "")}T\${lesson.time.replace(":", "")}00\\nDURATION:PT60M\\nEND:VEVENT\`; 
  }).join("\\n");
  const blob = new Blob([\`BEGIN:VCALENDAR\\nVERSION:2.0\\n\${events}\\nEND:VCALENDAR\`], { type: "text/calendar" });
  const link = document.createElement("a"); 
  link.href = URL.createObjectURL(blob); 
  link.download = "repet-schedule.ics"; 
  link.click(); 
  URL.revokeObjectURL(link.href);
}

save().then(render).catch((error) => { 
  app.innerHTML = \`<main class="login"><section class="login-card"><h1>Сервер недоступен</h1><p class="sub">\${esc(error.message)}<br />Убедитесь, что сервер запущен.</p></section></main>\`; 
});
