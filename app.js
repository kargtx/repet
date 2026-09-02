const seed = {
  loggedIn: false,
  students: [
    { id: 1, name: "Алина Смирнова", subject: "Математика", rate: 1800, notes: "" },
    { id: 2, name: "Михаил Волков", subject: "Английский язык", rate: 1500, notes: "" },
    { id: 3, name: "София Ким", subject: "Физика", rate: 2000, notes: "" }
  ],
  lessons: [
    { id: 1, studentId: 1, date: "2026-09-02", time: "10:00", duration: "1 час", held: true, paid: true },
    { id: 2, studentId: 2, date: "2026-09-02", time: "14:00", duration: "45 минут", held: true, paid: false },
    { id: 3, studentId: 3, date: "2026-09-04", time: "16:00", duration: "2 часа", held: false, paid: false }
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
  const data = await api("/api/state");
  seed.students = data.students;
  seed.lessons = data.lessons;
};
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const initials = (name) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
const money = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
const today = "2026-09-02";
const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

function login() {
  app.innerHTML = `<main class="login"><section class="login-card">
    <div class="brand"><span class="brand-mark">Р</span> репет</div>
    <h1>С возвращением!</h1><p class="sub">Войдите, чтобы управлять расписанием и учениками.</p>
    <form class="form" id="login-form">
      <div class="field"><label for="phone">Номер телефона</label><input id="phone" required placeholder="+7 (999) 123-45-67" /></div>
      <div class="field"><label for="password">Пароль</label><input id="password" required type="password" minlength="4" placeholder="Введите пароль" /></div>
      <div id="login-error" class="error"></div><button class="button primary">Войти</button>
    </form>
  </section></main>`;
  document.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ phone: document.querySelector("#phone").value, password: document.querySelector("#password").value }) });
      seed.loggedIn = true; await save(); render();
    } catch (error) { document.querySelector("#login-error").textContent = error.message; }
  });
}

function navButton(page, icon, label) {
  return `<button class="${state.page === page ? "active" : ""}" data-page="${page}"><span class="nav-icon">${icon}</span>${label}</button>`;
}
function layout(content) {
  return `<div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">Р</span> репет</div>
    <nav class="nav">${navButton("calendar", "▦", "Календарь")}${navButton("students", "♙", "Ученики")}${navButton("finance", "↗", "Финансы")}</nav>
    <div class="sidebar-footer">Ваше расписание всегда под рукой.<br />Данные хранятся локально.</div></aside>
    <main class="main"><header class="topbar"><div><p class="eyebrow">Среда, 2 сентября 2026</p><h1>${state.page === "calendar" ? "Расписание" : state.page === "students" ? "Ученики" : "Финансы"}</h1></div>
      <div class="user"><span>Алексей</span><span class="avatar">АК</span></div></header>${content}</main>
    <nav class="mobile-nav">${navButton("calendar", "▦", "Календарь")}${navButton("students", "♙", "Ученики")}${navButton("finance", "↗", "Финансы")}</nav></div>`;
}

function calendarPage() {
  const days = ["Пн", "Вт", "Сегодня", "Чт", "Пт", "Сб", "Вс"];
  const dates = ["31", "1", "2", "3", "4", "5", "6"];
  const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  const cells = hours.map((hour) => `<div class="time">${hour}</div>${dates.map((_, index) => {
    const date = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"][index];
    const lesson = seed.lessons.find((item) => item.date === date && item.time === hour);
    if (!lesson) return `<div class="slot"></div>`;
    const student = seed.students.find((item) => item.id === lesson.studentId);
    return `<div class="slot"><div class="lesson ${lesson.paid ? "green" : "orange"}" data-lesson="${lesson.id}">${esc(student?.name || "Ученик")}<small>${lesson.duration}${lesson.paid ? " · оплачено" : ""}</small></div></div>`;
  }).join("")`).join("");
  return `<div class="stats"><div class="card"><div class="stat-label">Уроков сегодня</div><div class="stat-value">${seed.lessons.filter((l) => l.date === today).length}</div><div class="stat-detail">Всё по плану</div></div>
    <div class="card"><div class="stat-label">Доход за неделю</div><div class="stat-value">${money(seed.lessons.filter((l) => l.paid).reduce((sum, l) => sum + (seed.students.find((s) => s.id === l.studentId)?.rate || 0), 0))}</div><div class="stat-detail">↑ 12% к прошлой неделе</div></div>
    <div class="card"><div class="stat-label">Ожидают оплаты</div><div class="stat-value">${money(seed.lessons.filter((l) => l.held && !l.paid).reduce((sum, l) => sum + (seed.students.find((s) => s.id === l.studentId)?.rate || 0), 0))}</div><div class="stat-detail" style="color:var(--orange)">2 урока</div></div></div>
    <section class="card"><div class="section-head"><h2>Эта неделя</h2><button class="button primary small" data-action="add-lesson">＋ Добавить урок</button></div>
      <div class="calendar-wrap"><div class="calendar"><div></div>${days.map((day, index) => `<div class="day-head">${day}<strong>${dates[index]}</strong></div>`).join("")}${cells}</div></div></section>`;
}

function studentsPage() {
  return `<section class="card"><div class="section-head"><h2>Все ученики <span style="color:var(--muted);font-size:13px">(${seed.students.length})</span></h2><button class="button primary small" data-action="add-student">＋ Добавить ученика</button></div>
    <div class="list">${seed.students.map((student) => `<div class="row"><div class="person"><div class="person-avatar">${initials(student.name)}</div><div><div class="person-name">${esc(student.name)}</div><div class="person-meta">${esc(student.subject)} · ${money(student.rate)}/час</div></div></div><button class="button ghost small" data-edit-student="${student.id}">Изменить</button></div>`).join("")}</div></section>`;
}

function financePage() {
  const held = seed.lessons.filter((lesson) => lesson.held);
  const total = held.reduce((sum, lesson) => sum + (seed.students.find((student) => student.id === lesson.studentId)?.rate || 0), 0);
  return `<section class="stats"><div class="card"><div class="stat-label">Доход за день</div><div class="stat-value">${money(total)}</div><div class="stat-detail">2 проведённых урока</div></div><div class="card"><div class="stat-label">Доход за месяц</div><div class="stat-value">${money(total * 4)}</div><div class="stat-detail">↑ 8% к августу</div></div><div class="card"><div class="stat-label">Средний чек</div><div class="stat-value">${money(held.length ? Math.round(total / held.length) : 0)}</div><div class="stat-detail">за один урок</div></div></section>
    <section class="card"><div class="section-head"><h2>Последние уроки</h2><button class="button ghost small" data-action="export">Экспорт календаря</button></div><div class="list">${held.length ? held.map((lesson) => { const student = seed.students.find((s) => s.id === lesson.studentId); return `<div class="row"><div><div class="person-name">${esc(student?.name)}</div><div class="person-meta">${formatDate(lesson.date)} · ${lesson.time} · ${lesson.duration}</div></div><div style="text-align:right"><div class="price">${money(student?.rate || 0)}</div><span class="badge ${lesson.paid ? "paid" : "pending"}">${lesson.paid ? "Оплачено" : "Ожидает оплаты"}</span></div></div>`; }).join("") : `<div class="empty">Проведённых уроков пока нет.</div>`}</div></section>`;
}

function modal() {
  if (!state.modal) return "";
  const editing = state.modal.type === "student" && state.modal.id;
  const student = editing ? seed.students.find((item) => item.id === state.modal.id) : {};
  const studentOptions = seed.students.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
  const body = state.modal.type === "student" ? `<form class="form" id="modal-form"><div class="field"><label>Имя и фамилия</label><input name="name" required value="${esc(student.name || "")}" placeholder="Например, Иван Петров" /></div><div class="field"><label>Предмет</label><input name="subject" required value="${esc(student.subject || "")}" placeholder="Математика" /></div><div class="field"><label>Ставка за час, ₽</label><input name="rate" required type="number" min="0" value="${student.rate || ""}" /></div><div class="field"><label>Заметки</label><textarea name="notes" rows="3">${esc(student.notes || "")}</textarea></div><div class="form-actions"><button type="button" class="button ghost" data-action="close">Отмена</button><button class="button primary">Сохранить</button></div></form>` :
    `<form class="form" id="modal-form"><div class="field"><label>Ученик</label><select name="studentId" required>${studentOptions}</select></div><div class="field"><label>Дата</label><input name="date" type="date" required value="${today}" /></div><div class="field"><label>Время</label><input name="time" type="time" required value="10:00" /></div><div class="field"><label>Длительность</label><select name="duration"><option>45 минут</option><option selected>1 час</option><option>2 часа</option></select></div><div class="field"><label><input name="held" type="checkbox" /> Урок уже проведён</label></div><div class="field"><label><input name="paid" type="checkbox" /> Оплата получена</label></div><div class="form-actions"><button type="button" class="button ghost" data-action="close">Отмена</button><button class="button primary">Добавить</button></div></form>`;
  return `<div class="modal-backdrop"><section class="modal"><div class="modal-head"><h2>${state.modal.type === "student" ? (editing ? "Изменить ученика" : "Новый ученик") : "Новый урок"}</h2><button class="close" data-action="close">×</button></div>${body}</section></div>`;
}

function render() {
  if (!seed.loggedIn) return login();
  const content = state.page === "calendar" ? calendarPage() : state.page === "students" ? studentsPage() : financePage();
  app.innerHTML = layout(content) + modal();
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page = button.dataset.page; render(); }));
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "add-student") state.modal = { type: "student" };
    if (action === "add-lesson") state.modal = { type: "lesson" };
    if (action === "close") state.modal = null;
    if (action === "export") downloadCalendar();
    render();
  }));
  app.querySelectorAll("[data-edit-student]").forEach((button) => button.addEventListener("click", () => { state.modal = { type: "student", id: Number(button.dataset.editStudent) }; render(); }));
  app.querySelector("#modal-form")?.addEventListener("submit", (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    if (state.modal.type === "student") {
      const entry = { name: data.name, subject: data.subject, rate: Number(data.rate), notes: data.notes || "" };
      if (state.modal.id) await api(`/api/students/${state.modal.id}`, { method: "PUT", body: JSON.stringify(entry) });
      else await api("/api/students", { method: "POST", body: JSON.stringify(entry) });
    } else await api("/api/lessons", { method: "POST", body: JSON.stringify({ studentId: data.studentId, date: data.date, time: data.time, duration: data.duration, held: data.held === "on", paid: data.paid === "on" }) });
    await save(); state.modal = null; render();
  });
}
function downloadCalendar() {
  const events = seed.lessons.map((lesson) => { const student = seed.students.find((s) => s.id === lesson.studentId); return `BEGIN:VEVENT\nSUMMARY:Урок — ${student?.name}\nDTSTART:${lesson.date.replaceAll("-", "")}T${lesson.time.replace(":", "")}00\nDURATION:PT60M\nEND:VEVENT`; }).join("\n");
  const blob = new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\n${events}\nEND:VCALENDAR`], { type: "text/calendar" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "repet-schedule.ics"; link.click(); URL.revokeObjectURL(link.href);
}
save().then(render).catch((error) => { app.innerHTML = `<main class="login"><section class="login-card"><h1>Сервер недоступен</h1><p class="sub">${esc(error.message)}<br />Запустите приложение командой <code>npm start</code>.</p></section></main>`; });
