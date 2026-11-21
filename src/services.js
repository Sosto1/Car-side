/* ============================================================
   Car-side — Služby (aplikační logika)
   ------------------------------------------------------------
   Pořadí načtení v index.html: mock-data.js → services.js → app.js
   Třídy zde obsahují pravidla systému (rezervace, vozidla, uživatelé).
   Soubor app.js obsluhuje uživatelské rozhraní a tyto služby volá.
   Data drží globální objekt `db` (ukládá se do LocalStorage přes LocalStore).
   Pomocné funkce pro data (parseIsoLocal, overlaps, fmt, …) jsou v app.js.
   ============================================================ */

const STANDARD_MAX_DAYS = 3;

/* Stavy rezervace a povolené přechody mezi nimi (stavový automat). */
const ReservationStatus = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED"
});

const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["CANCELLED"],
  REJECTED: [],
  CANCELLED: []
});

/* ---------- Úložiště dat v prohlížeči ---------- */
class LocalStore {
  constructor(key, initialData) {
    this.key = key;
    this.initialData = initialData;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return this.createInitial();
  }

  save(data) {
    try { localStorage.setItem(this.key, JSON.stringify(data)); return true; } catch (e) { return false; }
  }

  clear() {
    localStorage.removeItem(this.key);
  }

  /** Jsou už v prohlížeči uložená data (tj. nejde o první spuštění)? */
  hasSavedData() {
    try { return localStorage.getItem(this.key) !== null; } catch (e) { return false; }
  }

  createInitial() {
    return JSON.parse(JSON.stringify(this.initialData));
  }
}

/* ---------- Komunikace se serverem (REST API) ---------- */
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async get(path) {
    const res = await fetch(this.baseUrl + path);
    return res.ok ? res.json() : null;
  }

  /** Načte vozidla, uživatele a rezervace ze serveru. */
  async loadAll() {
    return {
      vehicles: await this.get("/vehicles"),
      users: await this.get("/users"),
      reservations: await this.get("/reservations")
    };
  }
}

/* ---------- Systémový protokol ---------- */
class AuditLog {
  record(actor, text) {
    db.logSeq += 1;
    db.log.push({ n: db.logSeq, actor, text });
    if (db.log.length > 60) db.log = db.log.slice(-60);
  }
}

/* ---------- Notifikace uživatelům ---------- */
class NotificationService {
  send(email, text) {
    db.notifications.unshift({ who: email, text, t: new Date().toISOString() });
    db.notifications = db.notifications.slice(0, 12);
  }

  sendToRole(role, text) {
    db.users.filter(u => u.role === role).forEach(u => this.send(u.email, text));
  }

  forUser(email) {
    return db.notifications.filter(n => n.who === email);
  }
}

/* ---------- Přihlášení ---------- */
class AuthService {
  constructor(auditLog) {
    this.auditLog = auditLog;
  }

  findByEmail(email) {
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  /** Vrátí přihlášeného uživatele, nebo null při špatných údajích. */
  login(email, password) {
    this.auditLog.record("Auth Service", `POST /auth/login (${email})`);
    const user = this.findByEmail(email);
    if (!user || user.password !== password) {
      this.auditLog.record("Auth Service", "401 Unauthorized — Neplatný email nebo heslo");
      return null;
    }
    this.auditLog.record("Auth Service", `200 OK — Uživatel přihlášen (${user.name}, role: ${user.role})`);
    return user;
  }

  /** Vrátí true, pokud e-mail v systému existuje. */
  requestPasswordReset(email) {
    this.auditLog.record("Auth Service", `POST /auth/reset-password (${email})`);
    if (!this.findByEmail(email)) {
      this.auditLog.record("Auth Service", "404 Not Found — E-mail nenalezen");
      return false;
    }
    this.auditLog.record("Auth Service", `200 OK — Odeslán e-mail s tokenem pro obnovu hesla na ${email}`);
    return true;
  }
}

/* ---------- Rezervace ---------- */
class ReservationService {
  constructor(notifications, auditLog) {
    this.notifications = notifications;
    this.auditLog = auditLog;
  }

  /** Rezervace, která blokuje vozidlo (čeká na schválení nebo je potvrzená). */
  isBlocking(r) {
    return r.status === ReservationStatus.PENDING || r.status === ReservationStatus.CONFIRMED;
  }

  hasVehicleClash(vehicleId, start, end) {
    return db.reservations.some(r =>
      r.vehicleId === vehicleId && this.isBlocking(r) && overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end)));
  }

  hasEmployeeClash(email, start, end) {
    return db.reservations.some(r =>
      r.employeeEmail === email && this.isBlocking(r) && overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end)));
  }

  needsApproval(start, end) {
    return (end - start) / 86400000 > STANDARD_MAX_DAYS;
  }

  /**
   * Vytvoří rezervaci. Při porušení pravidla vyhodí Error s hláškou pro uživatele.
   * Výsledný stav: do 3 dnů CONFIRMED, jinak PENDING (čeká na správce).
   */
  create(user, vehicleId, startVal, endVal) {
    if (user.canDrive === false) {
      this.auditLog.record("API → Zaměstnanec", "403 Forbidden — Uživatel má zákaz řízení");
      throw new Error("Máte pozastavené oprávnění k řízení služebních vozidel. Rezervaci nelze vytvořit.");
    }

    const vehicle = vehicleById(vehicleId);
    const start = parseIsoLocal(startVal), end = parseIsoLocal(endVal);
    this.auditLog.record("Zaměstnanec → API", `POST /reservations (${vehicle ? vehicle.name : vehicleId}, ${startVal}, ${endVal})`);

    if (!vehicle || !start || !end || !(start < end)) {
      throw new Error("Zkontrolujte prosím termín nebo zvolte dostupné vozidlo.");
    }
    if (daysDiffFromNow(vehicle.stkDate) < 0) {
      throw new Error(`Vozidlo ${vehicle.name} má prošlou STK (${formatCsDate(new Date(vehicle.stkDate))}) a nelze jej rezervovat!`);
    }
    if (start < new Date()) {
      throw new Error("Nelze vytvořit rezervaci v minulosti. Zvolte prosím aktuální nebo budoucí termín.");
    }
    if ((end - start) / 60000 < 30) {
      throw new Error("Minimální časový blok půjčení je 30 minut.");
    }
    if (this.hasEmployeeClash(user.email, start, end)) {
      this.auditLog.record("API → Zaměstnanec", "409 Conflict — Zaměstnanec již má rezervaci v daném čase");
      throw new Error("V tomto časovém rozmezí již máte zarezervované jiné vozidlo. V jednom čase lze mít max 1 auto.");
    }
    if (this.hasVehicleClash(vehicleId, start, end)) {
      throw new Error(`Vozidlo ${vehicle.name} je v tomto termínu již rezervováno. Zvolte jiný termín nebo vozidlo.`);
    }

    const pending = this.needsApproval(start, end);
    const reservation = {
      id: db.nextResId++,
      vehicleId,
      employeeEmail: user.email,
      employeeName: user.name,
      start: startVal,
      end: endVal,
      status: pending ? ReservationStatus.PENDING : ReservationStatus.CONFIRMED
    };
    db.reservations.push(reservation);

    if (pending) {
      const days = Math.ceil((end - start) / 86400000);
      this.notifications.sendToRole("manager", `Nová rezervace ke schválení: ${vehicle.name} (${user.name}, ${days} dní).`);
      this.notifications.send(user.email, `Rezervace vozidla ${vehicle.name} přesahuje 3 dny a čeká na schválení správce.`);
    } else {
      this.notifications.send(user.email, `Rezervace vozidla ${vehicle.name} byla automaticky potvrzena.`);
    }
    return reservation;
  }

  approve(resId) { return this.changeStatus(resId, ReservationStatus.CONFIRMED, "CONFIRM", "schválena"); }

  reject(resId) { return this.changeStatus(resId, ReservationStatus.REJECTED, "REJECT", "zamítnuta"); }

  cancel(resId) { return this.changeStatus(resId, ReservationStatus.CANCELLED, "CANCEL", "zrušena správcem"); }

  /** Změní stav rezervace, pokud to stavový automat dovoluje, a informuje zaměstnance. */
  changeStatus(resId, newStatus, action, verb) {
    const rec = db.reservations.find(r => r.id === resId);
    if (!rec) return null;
    if (!ALLOWED_TRANSITIONS[rec.status].includes(newStatus)) {
      throw new Error(`Rezervaci ve stavu ${rec.status} nelze změnit na ${newStatus}.`);
    }

    this.auditLog.record("Správce → API", `PUT /reservations/${resId}/status (akce: ${action})`);
    rec.status = newStatus;
    const vehicle = vehicleById(rec.vehicleId);
    this.notifications.send(rec.employeeEmail, `Vaše rezervace vozidla ${vehicle ? vehicle.name : ""} (${fmt(rec.start)}) byla ${verb}.`);
    return rec;
  }
}

/* ---------- Vozový park a vady ---------- */
class FleetService {
  constructor(notifications, auditLog) {
    this.notifications = notifications;
    this.auditLog = auditLog;
  }

  getVehicle(id) {
    return db.vehicles.find(v => v.id === id);
  }

  /** Uloží vozidlo – s id upraví existující, bez id vytvoří nové. */
  saveVehicle(id, data) {
    if (id) {
      const v = this.getVehicle(id);
      if (!v) return null;
      Object.assign(v, data);
      this.auditLog.record("Správce", `Aktualizováno vozidlo ID ${v.id} (${v.name})`);
      return v;
    }
    const vehicle = { id: db.nextVehicleId++, ...data, defects: [] };
    db.vehicles.push(vehicle);
    this.auditLog.record("Správce", `Vytvořeno nové vozidlo ID ${vehicle.id} (${vehicle.name})`);
    return vehicle;
  }

  /** Odebere vozidlo z flotily včetně jeho rezervací. */
  removeVehicle(id) {
    db.vehicles = db.vehicles.filter(v => v.id !== id);
    db.reservations = db.reservations.filter(r => r.vehicleId !== id);
    this.auditLog.record("Správce", `Odebráno vozidlo ID ${id}`);
  }

  reportDefect(vehicleId, reporterEmail, text) {
    const v = this.getVehicle(vehicleId);
    if (!v) return null;
    if (!v.defects) v.defects = [];

    const defect = { id: db.nextDefectId++, reporterEmail, text, date: new Date().toISOString(), status: "OPEN" };
    v.defects.push(defect);
    this.notifications.sendToRole("manager", `⚠️ Nahlášena nová vada u vozidla ${v.name} (${v.plate})`);
    this.auditLog.record("Zaměstnanec", `Nahlášena vada u vozidla ${v.name}: ${text}`);
    return defect;
  }

  findDefect(vehicleId, defectId) {
    const v = this.getVehicle(vehicleId);
    return v && v.defects ? v.defects.find(d => d.id === defectId) || null : null;
  }

  resolveDefect(vehicleId, defectId) {
    const d = this.findDefect(vehicleId, defectId);
    if (!d) return null;
    d.status = "RESOLVED";
    this.auditLog.record("Správce", `Vada ID ${defectId} na vozidle ${this.getVehicle(vehicleId).name} označena jako vyřešená`);
    return d;
  }

  updateDefect(vehicleId, defectId, text, status) {
    const d = this.findDefect(vehicleId, defectId);
    if (!d) return null;
    d.text = text;
    d.status = status;
    this.auditLog.record("Správce", `Upravena vada ID ${defectId} u vozidla ${this.getVehicle(vehicleId).name}`);
    return d;
  }

  deleteDefect(vehicleId, defectId) {
    const v = this.getVehicle(vehicleId);
    if (!v || !v.defects) return;
    v.defects = v.defects.filter(x => x.id !== defectId);
    this.auditLog.record("Správce", `Smazána vada ID ${defectId} u vozidla ${v.name}`);
  }
}

/* ---------- Uživatelé, oprávnění k řízení a odvolání ---------- */
class UserService {
  constructor(notifications, auditLog) {
    this.notifications = notifications;
    this.auditLog = auditLog;
  }

  getUser(id) {
    return db.users.find(u => u.id === id);
  }

  /** Uloží uživatele – s id upraví existujícího, bez id vytvoří nového. */
  saveUser(id, data) {
    if (id) {
      const u = this.getUser(id);
      if (!u) return null;
      Object.assign(u, data);
      this.auditLog.record("Admin", `Upraven profil uživatele ${u.name} (kód: ${u.code})`);
      return u;
    }
    if (db.users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error("Uživatel s tímto e-mailem již existuje.");
    }
    const user = { id: db.nextUserId++, ...data, password: "heslo", status: "ACTIVE", appeal: null };
    db.users.push(user);
    this.auditLog.record("Admin", `Vytvořen nový profil uživatele ${user.name} (${user.role})`);
    return user;
  }

  sendPasswordReset(email) {
    this.auditLog.record("Admin", `Reset hesla vyvolán pro ${email}`);
    this.notifications.send(email, "Správce vám zaslal odkaz pro resetování hesla.");
  }

  /**
   * Zaměstnanec podá odvolání proti zákazu řízení.
   * `persist` uloží data; když se uložení nepovede, odvolání se vrátí zpět.
   */
  fileAppeal(user, appeal, persist) {
    const previous = user.appeal;
    user.appeal = { ...appeal, date: new Date().toISOString(), status: "PENDING" };
    if (!persist()) {
      user.appeal = previous;
      throw new Error("Odvolání se nepodařilo uložit — úložiště prohlížeče je plné. Zkuste menší přílohu.");
    }
    this.notifications.sendToRole("admin", `📩 Zaměstnanec ${user.name} podal odvolání k zákazu řízení.`);
    this.auditLog.record("Zaměstnanec", `Podáno odvolání k zákazu řízení (${user.name})${appeal.file ? `, příloha: ${appeal.file}` : ""}`);
    return user.appeal;
  }

  /** Administrátor odvolání schválí (obnoví oprávnění k řízení) nebo zamítne. */
  decideAppeal(userId, approve) {
    const u = this.getUser(userId);
    if (!u || !u.appeal) return null;

    u.canDrive = approve;
    u.appeal.status = approve ? "APPROVED" : "REJECTED";
    this.notifications.send(u.email, `Vaše odvolání k zákazu řízení bylo administrátorem ${approve ? "SCHVÁLENO (oprávnění k řízení obnoveno)" : "ZAMÍTNUTO"}.`);
    this.auditLog.record("Admin", `Odvolání uživatele ${u.name} bylo ${approve ? "SCHVÁLENO" : "ZAMÍTNUTO"}`);
    return u;
  }
}
