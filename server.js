const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "database.json");
const PUBLIC_FILES = { "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/app.js": "app.js" };

function defaultDatabase() {
  return {
    users: [{ id: 1, phone: "+79991234567", password: "demo", name: "Алексей", initials: "АК" }],
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

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/state") {
      const database = readDatabase();
      return send(response, 200, { students: database.students, lessons: database.lessons });
    }
    if (request.method === "POST" && url.pathname === "/api/login") {
      const { phone, password } = await getBody(request);
      const database = readDatabase();
      const normalizedPhone = String(phone || "").replace(/\D/g, "");
      const user = database.users.find((item) => item.phone.replace(/\D/g, "") === normalizedPhone && item.password === password);
      return user ? send(response, 200, { user: { name: user.name, initials: user.initials } }) : send(response, 401, { error: "Неверный номер телефона или пароль" });
    }
    if (request.method === "POST" && url.pathname === "/api/students") {
      const database = readDatabase();
      const input = await getBody(request);
      const student = { id: id(), name: String(input.name || "").trim(), subject: String(input.subject || "").trim(), rate: Number(input.rate), notes: String(input.notes || "").trim() };
      if (!student.name || !student.subject || !Number.isFinite(student.rate) || student.rate < 0) return send(response, 400, { error: "Проверьте данные ученика" });
      database.students.push(student); writeDatabase(database); return send(response, 201, student);
    }
    if (request.method === "PUT" && url.pathname.startsWith("/api/students/")) {
      const database = readDatabase();
      const student = database.students.find((item) => item.id === url.pathname.split("/").pop());
      if (!student) return send(response, 404, { error: "Ученик не найден" });
      const input = await getBody(request);
      Object.assign(student, { name: String(input.name || "").trim(), subject: String(input.subject || "").trim(), rate: Number(input.rate), notes: String(input.notes || "").trim() });
      writeDatabase(database); return send(response, 200, student);
    }
    if (request.method === "POST" && url.pathname === "/api/lessons") {
      const database = readDatabase();
      const input = await getBody(request);
      const studentId = typeof input.studentId === "string" ? Number(input.studentId) : input.studentId;
      if (!database.students.some((student) => student.id === studentId)) return send(response, 400, { error: "Ученик не найден" });
      const lesson = { id: id(), studentId, date: String(input.date), time: String(input.time), duration: String(input.duration), held: Boolean(input.held), paid: Boolean(input.paid) };
      database.lessons.push(lesson); writeDatabase(database); return send(response, 201, lesson);
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
server.listen(PORT, () => console.log(`Репет запущен: http://localhost:${PORT}`));
