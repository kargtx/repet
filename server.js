const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "database.json");
const PUBLIC_FILES = { "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/app.js": "app.js" };

function defaultDatabase() {
  return {
    users: [
      { id: "1", phone: "+79376419123", password: "Itsjoke775", name: "Гарифуллин Карим", initials: "ГК", role: "admin" },
      { id: "2", phone: "", password: "", name: "Николай", initials: "Н", role: "student", subject: "", rate: 1500, notes: "" },
      { id: "3", phone: "", password: "", name: "Ксения", initials: "К", role: "student", subject: "", rate: 1200, notes: "" },
      { id: "4", phone: "", password: "", name: "Маша", initials: "М", role: "student", subject: "", rate: 1500, notes: "" },
      { id: "5", phone: "", password: "", name: "Роман", initials: "Р", role: "student", subject: "", rate: 1500, notes: "" },
      { id: "6", phone: "", password: "", name: "Тимофей", initials: "Т", role: "student", subject: "", rate: 1500, notes: "" }
    ],
    lessons: []
  };
}

function readDatabase() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultDatabase(), null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function writeDatabase(database) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));
}
function send(response, status, body, contentType = "application/json; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(contentType.startsWith("application/json") ? JSON.stringify(body) : body);
}
function getBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; if (body.length > 1e6) request.destroy(); });
    request.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); } });
    request.on("error", reject);
  });
}
function id() { return crypto.randomUUID(); }
function initials(name) { return String(name || "").split(" ").map(p => p[0]).slice(0,2).join("").toUpperCase(); }

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/state") {
      const userId = url.searchParams.get("userId");
      const database = readDatabase();
      const user = database.users.find(u => u.id === userId);
      if (!user) return send(response, 401, { error: "Не авторизован" });
      
      const students = database.users.filter(u => u.role === "student");
      const tutors = database.users.filter(u => u.role === "tutor" || u.role === "admin");
      let lessons = database.lessons;
      
      if (user.role === "student") {
        lessons = lessons.filter(l => l.studentId === user.id);
      } else if (user.role === "tutor") {
        lessons = lessons.filter(l => l.tutorId === user.id);
      }
      
      return send(response, 200, { 
        students, 
        tutors, 
        lessons, 
        users: user.role === "admin" ? database.users : undefined 
      });
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
      const { phone, password } = await getBody(request);
      const database = readDatabase();
      let normalizedPhone = String(phone || "").replace(/\D/g, "");
      if (normalizedPhone.length === 11 && normalizedPhone.startsWith("8")) {
        normalizedPhone = "7" + normalizedPhone.slice(1);
      }
      const user = database.users.find((item) => {
        let itemPhone = item.phone.replace(/\D/g, "");
        if (itemPhone.length === 11 && itemPhone.startsWith("8")) itemPhone = "7" + itemPhone.slice(1);
        return itemPhone === normalizedPhone && item.password === password;
      });
      return user ? send(response, 200, { user: { id: user.id, name: user.name, initials: user.initials, role: user.role } }) : send(response, 401, { error: "Неверный номер телефона или пароль" });
    }

    if (request.method === "POST" && url.pathname === "/api/users") {
      const database = readDatabase();
      const input = await getBody(request);
      // Only admin or tutor can create users (tutors usually create students)
      const creatorId = url.searchParams.get("userId");
      const creator = database.users.find(u => u.id === creatorId);
      if (!creator || creator.role === "student") return send(response, 403, { error: "Нет прав" });
      if (input.role !== "student" && creator.role !== "admin") return send(response, 403, { error: "Только администратор может создавать репетиторов" });

      const user = { 
        id: id(), 
        phone: String(input.phone || "").trim(),
        password: String(input.password || "").trim(),
        name: String(input.name || "").trim(), 
        initials: initials(input.name),
        role: input.role || "student",
        subject: input.role === "student" ? String(input.subject || "").trim() : undefined, 
        telegram: input.role === "student" ? String(input.telegram || "").trim() : undefined,
        grade: input.role === "student" ? String(input.grade || "").trim() : undefined,
        rate: input.role === "student" ? Number(input.rate) : undefined, 
        notes: String(input.notes || "").trim() 
      };
      if (!user.name || !user.phone || !user.password) return send(response, 400, { error: "Заполните обязательные поля" });
      
      database.users.push(user); 
      writeDatabase(database); 
      return send(response, 201, user);
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/users/")) {
      const database = readDatabase();
      const userIdToEdit = url.pathname.split("/").pop();
      const user = database.users.find((item) => item.id === userIdToEdit);
      if (!user) return send(response, 404, { error: "Пользователь не найден" });
      
      const input = await getBody(request);
      user.name = String(input.name || "").trim();
      user.initials = initials(user.name);
      if (input.phone) user.phone = String(input.phone).trim();
      if (input.password) user.password = String(input.password).trim();
      if (user.role === "student") {
        user.subject = String(input.subject || "").trim();
        user.telegram = String(input.telegram || "").trim();
        user.grade = String(input.grade || "").trim();
        user.rate = Number(input.rate);
      }
      user.notes = String(input.notes || "").trim();
      
      writeDatabase(database); 
      return send(response, 200, user);
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/users/")) {
      const database = readDatabase();
      const creatorId = url.searchParams.get("userId");
      const creator = database.users.find(u => u.id === creatorId);
      if (!creator || creator.role !== "admin") return send(response, 403, { error: "Нет прав" });

      const userIdToDelete = url.pathname.split("/").pop();
      database.users = database.users.filter(u => u.id !== userIdToDelete);
      database.lessons = database.lessons.filter(l => l.studentId !== userIdToDelete && l.tutorId !== userIdToDelete);
      
      writeDatabase(database);
      return send(response, 200, { success: true });
    }

    if (request.method === "POST" && url.pathname === "/api/lessons") {
      const database = readDatabase();
      const input = await getBody(request);
      const studentId = String(input.studentId);
      const tutorId = String(url.searchParams.get("userId") || input.tutorId);
      
      if (!database.users.some((u) => u.id === studentId && u.role === "student")) return send(response, 400, { error: "Ученик не найден" });
      
      const lesson = { id: id(), tutorId, studentId, date: String(input.date), time: String(input.time), duration: String(input.duration), held: Boolean(input.held), paid: Boolean(input.paid) };
      database.lessons.push(lesson); 
      writeDatabase(database); 
      return send(response, 201, lesson);
    }

    if (request.method === "GET" && PUBLIC_FILES[url.pathname]) {
      const file = path.join(__dirname, PUBLIC_FILES[url.pathname]);
      const type = file.endsWith(".css") ? "text/css; charset=utf-8" : file.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
      return send(response, 200, fs.readFileSync(file), type);
    }
    
    send(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    send(response, 500, { error: "Внутренняя ошибка сервера" });
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`Репет запущен: http://0.0.0.0:${PORT}`));
