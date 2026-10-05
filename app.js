const API_BASE = "http://167.17.177.242:3100";

const initTheme = () => {
  const theme = localStorage.getItem('theme') || 'light';
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
};
initTheme();

const tzOffsets = {
  "Калининград (UTC+2)": 2, "Москва (UTC+3)": 3, "Самара (UTC+4)": 4, "Екатеринбург (UTC+5)": 5,
  "Омск (UTC+6)": 6, "Красноярск (UTC+7)": 7, "Иркутск (UTC+8)": 8, "Якутск (UTC+9)": 9,
  "Владивосток (UTC+10)": 10, "Магадан (UTC+11)": 11, "Камчатка (UTC+12)": 12
};

const getTzOffset = () => tzOffsets[localStorage.getItem('timezone') || "Москва (UTC+3)"] || 3;
const shiftTime = (timeStr, diff) => {
  if (!timeStr) return timeStr;
  const [h, m] = timeStr.split(':');
  let newH = (parseInt(h) + diff + 24) % 24;
  return `${newH.toString().padStart(2, '0')}:${m}`;
};

const seed = { user: null, students: [], tutors: [], users: [], lessons: [] };
const todayObj = new Date();
const today = new Date(todayObj.getTime() - (todayObj.getTimezoneOffset() * 60000)).toISOString().split("T")[0];

let state = { 
  page: "calendar", 
  modal: null, 
  calendarDate: new Date(todayObj), 
  calendarView: localStorage.getItem('calendarView') || 'week' 
};
const app = document.querySelector("#app");

const api = async (url, options = {}) => {
  const isQuery = url.includes("?");
  const authUrl = seed.user ? `${url}${isQuery ? "&" : "?"}userId=${seed.user.id}` : url;
  const fullUrl = authUrl.startsWith("/") ? `${API_BASE}${authUrl}` : authUrl;
  const response = await fetch(fullUrl, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
};

const save = async () => {
  if (!seed.user) return;
  try {
    const data = await api("/api/state");
    seed.students = data.students || [];
    seed.tutors = data.tutors || [];
    seed.lessons = data.lessons || [];
    if (data.users) seed.users = data.users;
  } catch (err) {
    if (err.message === "Не авторизован") { seed.user = null; render(); }
    throw err;
  }
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const money = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
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
  const isTutor = seed.user.role === "tutor" || seed.user.role === "admin";
  const diff = getTzOffset() - 3;
  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const hours = ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];
  
  let d = new Date(state.calendarDate);
  let days = [], dates = [], datesDisplay = [];
  let headerLabel = "";

  if (state.calendarView === 'day') {
    const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
    dates = [dateStr];
    datesDisplay = [d.getDate().toString()];
    days = [dayNames[(d.getDay() || 7) - 1]];
    headerLabel = `${d.getDate()} ${monthNames[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
  } 
  else if (state.calendarView === 'week') {
    let dayOfWeek = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek + 1);
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      const dateStr = new Date(cur.getTime() - (cur.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
      dates.push(dateStr); datesDisplay.push(cur.getDate().toString());
      days.push(dateStr === today ? "Сегодня" : dayNames[i]);
    }
    const endOfWeek = new Date(monday); endOfWeek.setDate(monday.getDate() + 6);
    headerLabel = `${monday.getDate()} ${monthNames[monday.getMonth()].substring(0,3)} - ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()].substring(0,3)} ${endOfWeek.getFullYear()}`;
  } 
  else if (state.calendarView === 'month') {
    headerLabel = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    let dayOfWeek = startOfMonth.getDay() || 7;
    const firstDay = new Date(startOfMonth);
    firstDay.setDate(startOfMonth.getDate() - dayOfWeek + 1);
    
    for (let i = 0; i < 42; i++) { // 6 weeks
      const cur = new Date(firstDay);
      cur.setDate(firstDay.getDate() + i);
      const dateStr = new Date(cur.getTime() - (cur.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
      dates.push(dateStr);
      datesDisplay.push(cur.getDate().toString());
    }
  }

  const getLessonName = (lesson) => {
    if (seed.user.role === "student") return (seed.tutors.find(x => x.id === lesson.tutorId)?.name || "Урок");
    return (seed.students.find(x => x.id === lesson.studentId)?.name || "Урок");
  };

  let calendarBody = "";

  if (state.calendarView === 'month') {
    calendarBody = `
      <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--line); border: 1px solid var(--line);">
        ${dayNames.map(day => `<div style="background:var(--surface); padding:8px; text-align:center; font-weight:bold; font-size:12px;">${day}</div>`).join("")}
        ${dates.map((date, idx) => {
          const dayLessons = seed.lessons.filter(l => l.date === date);
          const isCurrentMonth = new Date(date).getMonth() === d.getMonth();
          return `
            <div style="background:var(--surface); min-height: 80px; padding: 4px; opacity: ${isCurrentMonth ? 1 : 0.5};" class="${date === today ? 'is-today-cell' : ''}" data-date="${date}">
              <div style="font-size:12px; margin-bottom:4px; text-align:right; font-weight:${date===today?'bold':'normal'}; color:${date===today?'var(--primary)':'var(--muted)'}">${datesDisplay[idx]}</div>
              <div style="display:flex; flex-direction:column; gap:2px;">
                ${dayLessons.slice(0,3).map(l => `<div class="shadow-hover" data-edit-lesson="${l.id}" style="font-size:10px; padding:2px 4px; border-radius:4px; cursor:pointer; background:${l.paid?'var(--green-light)':'var(--orange-light)'}; color:${l.paid?'#10b981':'#f59e0b'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${shiftTime(l.time, diff)} ${esc(getLessonName(l))}</div>`).join("")}
                ${dayLessons.length > 3 ? `<div style="font-size:10px; color:var(--muted); text-align:center;">+${dayLessons.length - 3}</div>` : ''}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else {
    calendarBody = `
      <div class="calendar-wrap desktop-only">
        <div class="calendar" style="grid-template-columns: 70px repeat(${dates.length}, 1fr);">
          <div class="calendar-header-corner"></div>
          ${days.map((day, index) => `<div class="day-head ${dates[index] === today ? 'is-today' : ''}">${day}<strong>${datesDisplay[index]}</strong></div>`).join("")}
          ${hours.map((hour) => `
            <div class="time">${hour}</div>
            ${dates.map((date) => {
              const dbHour = shiftTime(hour, -diff);
              const lesson = seed.lessons.find((item) => item.date === date && item.time === dbHour);
              if (!lesson) return `<div class="slot" data-date="${date}" data-time="${hour}"></div>`;
              return `<div class="slot has-lesson">
                        <div class="lesson ${lesson.paid ? "green" : "orange"} shadow-hover" data-edit-lesson="${lesson.id}">
                          <div class="lesson-name">${esc(getLessonName(lesson))}</div>
                          <small>${lesson.duration}${lesson.paid ? " · оплачено" : ""}</small>
                        </div>
                      </div>`;
            }).join("")}
          `).join("")}
        </div>
      </div>
      <div class="mobile-calendar mobile-only">
        ${dates.map((date, index) => {
          const dayLessons = seed.lessons.filter(l => l.date === date).sort((a,b) => a.time.localeCompare(b.time));
          if (dayLessons.length === 0) return '';
          return `
            <div class="mobile-day">
              <h3 class="mobile-day-title ${date === today ? 'is-today' : ''}">${days[index]}, ${datesDisplay[index]} ${monthNames[new Date(date).getMonth()].toLowerCase()}</h3>
              <div class="mobile-lessons">
                ${dayLessons.map(lesson => `
                    <div class="mobile-lesson-card ${lesson.paid ? 'green' : 'orange'}" data-edit-lesson="${lesson.id}">
                      <div class="mobile-lesson-time">${shiftTime(lesson.time, diff)} <span class="mobile-lesson-duration">(${lesson.duration})</span></div>
                      <div class="mobile-lesson-details"><strong>${esc(getLessonName(lesson))}</strong></div>
                      ${lesson.paid ? '<div class="mobile-lesson-badge paid">Оплачено</div>' : '<div class="mobile-lesson-badge pending">Ожидает</div>'}
                    </div>
                  `).join("")}
              </div>
            </div>
          `;
        }).join("")}
        ${seed.lessons.filter(l => dates.includes(l.date)).length === 0 ? `<div class="empty">Нет уроков</div>` : ''}
      </div>
    `;
  }

  return `
    <section class="card schedule-card">
      <div class="section-head" style="flex-wrap: wrap; gap: 12px;">
        <div style="display:flex; align-items:center; gap: 12px;">
          <div style="display:flex; align-items:center; background:var(--surface); border:1px solid var(--line); border-radius:6px; overflow:hidden;">
            <button class="button ghost" data-action="prev-date" style="border-radius:0; padding:6px 12px;">&lt;</button>
            <span style="padding:0 12px; font-weight:600; font-size:14px; min-width:140px; text-align:center;">${headerLabel}</span>
            <button class="button ghost" data-action="next-date" style="border-radius:0; padding:6px 12px;">&gt;</button>
          </div>
          <button class="button ghost small" data-action="today-date">Сегодня</button>
        </div>
        <div style="display:flex; align-items:center; gap: 12px;">
          <select id="calendar-view-select" class="input-small" style="padding:6px; border-radius:6px; border:1px solid var(--line); background:var(--surface); color:var(--ink);">
            <option value="day" ${state.calendarView==='day'?'selected':''}>День</option>
            <option value="week" ${state.calendarView==='week'?'selected':''}>Неделя</option>
            <option value="month" ${state.calendarView==='month'?'selected':''}>Месяц</option>
          </select>
          ${isTutor ? '<button class="button primary small" data-action="add-lesson">＋ Добавить</button>' : ''}
        </div>
      </div>
      ${calendarBody}
    </section>`;
}

function financePage() {
  const now = new Date();
  const getStartOfWeek = (d) => { const date = new Date(d); const day = date.getDay() || 7; date.setDate(date.getDate() - day + 1); return date.toISOString().split("T")[0]; };
  const getStartOfMonth = (d) => { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]; };
  const getStartOfYear = (d) => { return new Date(d.getFullYear(), 0, 1).toISOString().split("T")[0]; };
  
  const startOfWeek = getStartOfWeek(now);
  const startOfMonth = getStartOfMonth(now);
  const startOfYear = getStartOfYear(now);

  let weekPaid = 0; let monthPaid = 0; let yearPaid = 0;
  let totalDebtSum = 0; let totalDebtCount = 0;
  const debts = {}; 

  seed.lessons.forEach(l => {
     if (!l.held) return;
     const student = seed.students.find(s => s.id === l.studentId);
     const rate = student?.rate || 0;
     if (l.paid) {
       if (l.date >= startOfWeek) weekPaid += rate;
       if (l.date >= startOfMonth) monthPaid += rate;
       if (l.date >= startOfYear) yearPaid += rate;
     } else {
       totalDebtCount++; totalDebtSum += rate;
       if (!debts[l.studentId]) debts[l.studentId] = { student, count: 0, total: 0 };
       debts[l.studentId].count++; debts[l.studentId].total += rate;
     }
  });

  return `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
      <div class="card stat-card shadow-hover"><div class="stat-label">Доход за неделю</div><div class="stat-value" style="color:var(--green)">${money(weekPaid)}</div><div class="stat-detail">Оплаченные уроки</div></div>
      <div class="card stat-card shadow-hover"><div class="stat-label">Доход за месяц</div><div class="stat-value">${money(monthPaid)}</div></div>
      <div class="card stat-card shadow-hover"><div class="stat-label">Доход за год</div><div class="stat-value">${money(yearPaid)}</div></div>
      <div class="card stat-card shadow-hover" style="border-left:4px solid var(--orange)"><div class="stat-label">Долг учеников</div><div class="stat-value" style="color:var(--orange)">${money(totalDebtSum)}</div><div class="stat-detail">${totalDebtCount} уроков</div></div>
    </div>
    
    <section class="card">
      <div class="section-head"><h2>Долги по ученикам</h2></div>
      <div class="list">
        ${Object.values(debts).map(debt => `
          <div class="row shadow-hover-row">
            <div class="person">
              <div class="person-avatar">${esc(debt.student?.initials)}</div>
              <div>
                <div class="person-name">${esc(debt.student?.name || 'Удаленный ученик')}</div>
                <div class="person-meta">${debt.count} неоплаченных занятий</div>
              </div>
            </div>
            <div style="font-weight:600; font-size:16px; color:var(--orange)">${money(debt.total)}</div>
          </div>
        `).join("")}
        ${Object.keys(debts).length === 0 ? `<div class="empty">Все проведенные уроки оплачены!</div>` : ''}
      </div>
    </section>
  `;
}

function studentsPage() { /* ... existing ... */ 
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
function adminPage() { /* ... existing ... */ 
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

function modal() {
  if (!state.modal) return "";
  const type = state.modal.type;
  const editing = state.modal.id;
  const diff = getTzOffset() - 3;
  
  if (type === "lesson" || type === "edit-lesson") {
    const isEdit = type === "edit-lesson";
    const lesson = isEdit ? seed.lessons.find(l => l.id === state.modal.id) : {};
    const studentOptions = seed.students.map((item) => `<option value="${item.id}" ${lesson.studentId===item.id?'selected':''}>${esc(item.name)}</option>`).join("");
    return `
      <div class="modal-backdrop fade-in" id="modal-backdrop">
        <section class="modal slide-up">
          <div class="modal-head"><h2>${isEdit ? 'Редактировать урок' : 'Новый урок'}</h2><button class="close" data-action="close">×</button></div>
          <form class="form" id="modal-form">
            <input type="hidden" name="type" value="lesson" />
            ${isEdit ? `<input type="hidden" name="id" value="${lesson.id}" />` : ''}
            <div class="field"><label>Ученик</label><select name="studentId" required ${isEdit?'disabled':''}>${studentOptions || '<option disabled selected>Сначала добавьте ученика</option>'}</select></div>
            <div class="field"><label>Дата</label><input name="date" type="date" required value="${lesson.date || state.modal.date || today}" /></div>
            <div class="field"><label>Время (ваше местное)</label><input name="time" type="time" required value="${lesson.time ? shiftTime(lesson.time, diff) : state.modal.time || shiftTime('15:00', diff)}" /></div>
            <div class="field"><label>Длительность</label><select name="duration"><option ${lesson.duration==='45 минут'?'selected':''}>45 минут</option><option ${!lesson.duration || lesson.duration==='1 час'?'selected':''}>1 час</option><option ${lesson.duration==='1.5 часа'?'selected':''}>1.5 часа</option><option ${lesson.duration==='2 часа'?'selected':''}>2 часа</option></select></div>
            <div class="checkbox-field"><label class="custom-checkbox"><input name="held" type="checkbox" ${lesson.held?'checked':''} /><span class="checkmark"></span> Урок проведен</label></div>
            <div class="checkbox-field"><label class="custom-checkbox"><input name="paid" type="checkbox" ${lesson.paid?'checked':''} /><span class="checkmark"></span> Оплата получена</label></div>
            ${!isEdit ? `
              <div class="field" style="margin-top:8px; padding-top:8px; border-top:1px solid var(--line);">
                <label>Повторять урок каждую неделю (вперед)</label>
                <select name="repeatWeeks">
                  <option value="1">Не повторять (только 1 раз)</option>
                  <option value="4">Весь месяц (4 недели)</option>
                  <option value="12">Три месяца (12 недель)</option>
                  <option value="24">Полгода (24 недели)</option>
                </select>
              </div>
            ` : ''}
            <div class="form-actions"><button type="button" class="button ghost" data-action="close">Отмена</button><button class="button primary" ${!studentOptions ? 'disabled' : ''}>${isEdit?'Сохранить':'Добавить'}</button></div>
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
    localStorage.setItem('timezone', e.target.value); render();
  });
  
  app.querySelector("#calendar-view-select")?.addEventListener("change", (e) => {
    state.calendarView = e.target.value;
    localStorage.setItem('calendarView', e.target.value);
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
    }
    if (action === "logout") { seed.user = null; state.page = "calendar"; }
    
    // Calendar navigation
    if (action === "prev-date") {
      if (state.calendarView === 'day') state.calendarDate.setDate(state.calendarDate.getDate() - 1);
      if (state.calendarView === 'week') state.calendarDate.setDate(state.calendarDate.getDate() - 7);
      if (state.calendarView === 'month') state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
    }
    if (action === "next-date") {
      if (state.calendarView === 'day') state.calendarDate.setDate(state.calendarDate.getDate() + 1);
      if (state.calendarView === 'week') state.calendarDate.setDate(state.calendarDate.getDate() + 7);
      if (state.calendarView === 'month') state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
    }
    if (action === "today-date") {
      state.calendarDate = new Date(todayObj);
    }

    render();
  }));

  app.querySelectorAll("[data-edit-user]").forEach((button) => button.addEventListener("click", () => { 
    const id = button.dataset.editUser;
    const isStudent = seed.students.some(s => s.id === id);
    state.modal = { type: isStudent ? "student" : "tutor", id }; 
    render(); 
  }));
  
  app.querySelectorAll("[data-edit-lesson]").forEach((button) => button.addEventListener("click", (e) => { 
    e.stopPropagation();
    state.modal = { type: "edit-lesson", id: button.dataset.editLesson }; 
    render(); 
  }));

  app.querySelectorAll("[data-delete-user]").forEach((button) => button.addEventListener("click", async () => { 
    if (!confirm("Вы уверены? Удалятся и все уроки.")) return;
    try { await api(`/api/users/${button.dataset.deleteUser}`, { method: "DELETE" }); await save(); render(); } catch (e) { alert(e.message); }
  }));

  if (seed.user.role !== "student") {
    app.querySelectorAll(".desktop-only .slot:not(.has-lesson), .is-today-cell").forEach(slot => {
      slot.addEventListener("click", (e) => {
        if(e.target.closest('[data-edit-lesson]')) return;
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
        const payload = { 
          studentId: data.studentId, tutorId: seed.user.id, date: data.date, 
          time: shiftTime(data.time, -diff),
          duration: data.duration, held: data.held === "on", paid: data.paid === "on",
          repeatWeeks: data.repeatWeeks || 1
        };
        if (data.id) await api(`/api/lessons/${data.id}`, { method: "PUT", body: JSON.stringify(payload) });
        else await api("/api/lessons", { method: "POST", body: JSON.stringify(payload) });
      }
      await save(); state.modal = null; render();
    } catch (err) { alert(err.message); btn.textContent = originalText; btn.disabled = false; }
  });
}

save().then(render).catch((error) => { 
  app.innerHTML = `<main class="login"><section class="login-card"><h1>Сервер недоступен</h1><p class="sub">${esc(error.message)}</p></section></main>`; 
});
