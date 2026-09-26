/* ============================================================
   Car-side — demo/prototype front-end
   Simulates the "Rezervační API" + "Databáze" from the sequence
   diagram entirely in the browser (localStorage as persistence).
   ============================================================ */

const STORE_KEY = "carside_demo_v1";
const EMPLOYEES = ["Jana Nováková", "Petr Dvořák", "Lucie Horáková", "Tomáš Beneš"];
const MANAGER_NAME = "Správce (Fleet Manager)";
const STANDARD_MAX_DAYS = 3;

function defaultData() {
  const now = new Date();
  const inHours = h => new Date(now.getTime() + h * 3600 * 1000).toISOString().slice(0,16);
  return {
    role: "employee",
    currentUser: EMPLOYEES[0],
    adminTab: "fleet",
    logOpen: false,
    nextVehicleId: 6,
    nextResId: 3,
    logSeq: 3,
    vehicles: [
      { id: 1, name: "Škoda Octavia Combi", plate: "4AB 1234", type: "Kombi", location: "Ostrava — centrála" },
      { id: 2, name: "Volkswagen Passat",   plate: "3CD 5678", type: "Sedan", location: "Ostrava — centrála" },
      { id: 3, name: "Ford Transit Custom", plate: "7EF 9012", type: "Dodávka", location: "Ostrava — servis" },
      { id: 4, name: "Toyota Corolla",      plate: "2GH 3456", type: "Sedan", location: "Praha — pobočka" },
      { id: 5, name: "Dacia Duster",        plate: "5IJ 7890", type: "SUV", location: "Brno — pobočka" },
    ],
    reservations: [
      { id: 1, vehicleId: 2, employee: "Jana Nováková", start: inHours(20), end: inHours(24), status: "CONFIRMED" },
      { id: 2, vehicleId: 4, employee: "Petr Dvořák", start: inHours(48), end: inHours(168), status: "PENDING" },
    ],
    notifications: [
      { who: "Jana Nováková", text: "Rezervace vozidla Volkswagen Passat byla automaticky potvrzena.", t: now.toISOString() },
      { who: MANAGER_NAME, text: "Nová rezervace ke schválení: Toyota Corolla (Petr Dvořák).", t: now.toISOString() },
    ],
    log: [
      { n: 1, actor: "Zaměstnanec → API", text: "POST /reservations (Volkswagen Passat)" },
      { n: 2, actor: "API → Databáze", text: "Dotaz na existující rezervace (kontrola překryvu časů)" },
      { n: 3, actor: "API → Zaměstnanec", text: "201 Created — stav: CONFIRMED" },
    ],
  };
}

let db = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore, fall through to defaults */ }
  return defaultData();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { /* storage unavailable */ }
}
function resetDemo() {
  db = defaultData();
  save();
  renderAll();
}

/* ---------- helpers ---------- */
function vehicleById(id) { return db.vehicles.find(v => v.id === id); }
function fmt(dtStr) {
  const d = new Date(dtStr);
  if (isNaN(d)) return dtStr;
  return d.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function overlaps(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && bStart < aEnd; }
function pushLog(actor, text) {
  db.logSeq += 1;
  db.log.push({ n: db.logSeq, actor, text });
  if (db.log.length > 60) db.log = db.log.slice(-60);
}
function pushNotif(who, text) {
  db.notifications.unshift({ who, text, t: new Date().toISOString() });
  db.notifications = db.notifications.slice(0, 12);
}
function statusLabel(s) { return s === "CONFIRMED" ? "Potvrzeno" : s === "PENDING" ? "Čeká na schválení" : "Zamítnuto"; }
function statusClass(s) { return s === "CONFIRMED" ? "confirmed" : s === "PENDING" ? "pending" : "rejected"; }

/* ---------- role / nav ---------- */
function setRole(role) {
  db.role = role;
  save();
  renderAll();
}
function setUser(name) { db.currentUser = name; save(); renderAll(); }
function setAdminTab(tab) { db.adminTab = tab; save(); renderAll(); }
function toggleLog() { db.logOpen = !db.logOpen; save(); renderAll(); }

/* ---------- core business logic (mirrors the sequence diagram) ---------- */
function submitReservation(ev) {
  ev.preventDefault();
  const vehicleId = Number(document.getElementById("fVehicle").value);
  const startVal = document.getElementById("fStart").value;
  const endVal = document.getElementById("fEnd").value;
  const msgEl = document.getElementById("formMsg");
  msgEl.className = "formmsg";

  const vehicle = vehicleById(vehicleId);
  const start = new Date(startVal), end = new Date(endVal);

  pushLog("Zaměstnanec → API", `POST /reservations (${vehicle ? vehicle.name : vehicleId}, ${startVal}, ${endVal})`);

  if (!vehicle || !startVal || !endVal || !(start < end)) {
    pushLog("API → Zaměstnanec", "400 — neplatný termín");
    msgEl.textContent = "Zkontrolujte prosím vozidlo a termín — konec musí být po začátku.";
    msgEl.classList.add("show", "err");
    save(); renderLog(); renderNotifs();
    return false;
  }

  pushLog("API → Databáze", "Dotaz na existující rezervace (kontrola překryvu časů)");
  const clash = db.reservations.some(r =>
    r.vehicleId === vehicleId &&
    r.status !== "REJECTED" &&
    overlaps(start, end, new Date(r.start), new Date(r.end))
  );

  if (clash) {
    pushLog("Databáze → API", "Nalezen překryv — vozidlo není v termínu dostupné");
    pushLog("API → Zaměstnanec", "409 Conflict — vozidlo obsazeno");
    msgEl.textContent = `Vozidlo ${vehicle.name} je v tomto termínu již rezervováno. Zvolte jiný termín nebo vozidlo.`;
    msgEl.classList.add("show", "err");
    save(); renderLog(); renderNotifs();
    return false;
  }
  pushLog("Databáze → API", "Žádný překryv (vozidlo dostupné)");

  const days = (end - start) / (1000 * 60 * 60 * 24);
  const isStandard = days <= STANDARD_MAX_DAYS;
  const status = isStandard ? "CONFIRMED" : "PENDING";

  const rec = {
    id: db.nextResId++,
    vehicleId, employee: db.currentUser,
    start: startVal, end: endVal, status,
  };
  db.reservations.push(rec);

  if (isStandard) {
    pushLog("API → Databáze", `Ulož rezervaci (status = CONFIRMED)`);
    pushLog("Databáze → API", "reservation_id");
    pushLog("API → Zaměstnanec", "201 Created — stav: CONFIRMED");
    pushNotif(db.currentUser, `Rezervace vozidla ${vehicle.name} byla automaticky potvrzena.`);
    msgEl.textContent = `Hotovo — rezervace vozidla ${vehicle.name} byla automaticky potvrzena.`;
    msgEl.classList.add("show", "ok");
  } else {
    pushLog("API → Databáze", `Ulož rezervaci (status = PENDING)`);
    pushLog("Databáze → API", "reservation_id");
    pushLog("API → Správce", `Odeslat notifikaci: "Nová rezervace ke schválení"`);
    pushLog("API → Zaměstnanec", "201 Created — stav: PENDING");
    pushNotif(MANAGER_NAME, `Nová rezervace ke schválení: ${vehicle.name} (${db.currentUser}, ${Math.ceil(days)} dní).`);
    pushNotif(db.currentUser, `Rezervace vozidla ${vehicle.name} přesahuje 3 dny a čeká na schválení správce.`);
    msgEl.textContent = `Termín přesahuje ${STANDARD_MAX_DAYS} dny — rezervace čeká na schválení správce vozového parku.`;
    msgEl.classList.add("show", "ok");
  }

  save();
  document.getElementById("resForm").reset();
  renderAll();
  return false;
}

function managerDecision(resId, approve) {
  const rec = db.reservations.find(r => r.id === resId);
  if (!rec) return;
  const vehicle = vehicleById(rec.vehicleId);
  pushLog("Správce → API", `PUT /reservations/${resId}/status (akce: ${approve ? "CONFIRM" : "REJECT"})`);
  pushLog("API → Databáze", "Aktualizace stavu rezervace");
  rec.status = approve ? "CONFIRMED" : "REJECTED";
  pushLog("Databáze → API", "OK");
  pushLog("API → Správce", "200 OK (stav upraven)");
  pushLog("API → Zaměstnanec", `Odeslat notifikaci: "Vaše rezervace byla ${approve ? "schválena" : "zamítnuta"}"`);
  pushNotif(rec.employee, `Vaše rezervace vozidla ${vehicle ? vehicle.name : ""} byla ${approve ? "schválena" : "zamítnuta"}.`);
  save();
  renderAll();
}

/* ---------- admin: direct data edits ---------- */
function addVehicle() {
  const id = db.nextVehicleId++;
  db.vehicles.push({ id, name: "Nové vozidlo", plate: "0XX 0000", type: "Sedan", location: "Ostrava — centrála" });
  pushLog("Správce → API", `PUT /vehicles/${id} (přímá úprava dat)`);
  pushLog("API → Databáze", "Aktualizace existujícího záznamu");
  pushLog("Databáze → API", "200 OK (změny uloženy)");
  save(); renderAll();
}
function updateVehicle(id, field, value) {
  const v = vehicleById(id);
  if (!v) return;
  v[field] = value;
  pushLog("Správce → API", `PUT /vehicles/${id} (přímá úprava dat)`);
  pushLog("API → Databáze", "Aktualizace existujícího záznamu");
  pushLog("Databáze → API", "200 OK (změny uloženy)");
  save(); renderNotifs(); renderLog(); renderFleetSidebar();
}
function removeVehicle(id) {
  db.vehicles = db.vehicles.filter(v => v.id !== id);
  db.reservations = db.reservations.filter(r => r.vehicleId !== id);
  pushLog("Správce → API", `DELETE /vehicles/${id}`);
  save(); renderAll();
}
function updateReservationField(id, field, value) {
  const r = db.reservations.find(r => r.id === id);
  if (!r) return;
  r[field] = value;
  pushLog("Správce → API", `PUT /reservations/${id} (přímá úprava dat)`);
  pushLog("API → Databáze", "Aktualizace existujícího záznamu");
  pushLog("Databáze → API", "200 OK (změny uloženy)");
  save(); renderLog();
}

/* ============================================================
   Rendering
   ============================================================ */
function renderAll() {
  document.getElementById("btnRoleEmp").classList.toggle("active", db.role === "employee");
  document.getElementById("btnRoleMgr").classList.toggle("active", db.role === "manager");
  document.getElementById("employeeView").classList.toggle("hidden", db.role !== "employee");
  document.getElementById("managerView").classList.toggle("hidden", db.role !== "manager");

  renderUserPick();
  renderFleetSidebar();
  renderNotifs();
  renderVehicleSelect();
  renderMyReservations();
  renderPending();
  renderAdminTabs();
  renderFleetTable();
  renderReservationsTable();
  renderLog();
}

function renderUserPick() {
  const sel = document.getElementById("userPick");
  sel.innerHTML = EMPLOYEES.map(n => `<option value="${n}" ${n === db.currentUser ? "selected" : ""}>${n}</option>`).join("");
}

function renderFleetSidebar() {
  const el = document.getElementById("fleetList");
  document.getElementById("fleetCount").textContent = db.vehicles.length;
  const now = new Date();
  el.innerHTML = db.vehicles.map(v => {
    const busy = db.reservations.some(r => r.vehicleId === v.id && r.status !== "REJECTED" &&
      new Date(r.start) <= now && now <= new Date(r.end));
    return `<div class="fleetcard">
      <span class="name">${v.name}</span>
      <span class="meta">${v.type} · ${v.location}</span>
      <span class="plate">${v.plate}</span>
      <span class="badge ${busy ? "pending" : "confirmed"}" style="margin-top:6px; align-self:flex-start">
        <span class="dot"></span>${busy ? "Právě používáno" : "Dostupné"}
      </span>
    </div>`;
  }).join("") || `<div class="empty-note">Žádná vozidla ve flotile.</div>`;
}

function renderNotifs() {
  const el = document.getElementById("notifList");
  const relevant = db.role === "manager"
    ? db.notifications.filter(n => n.who === MANAGER_NAME)
    : db.notifications.filter(n => n.who === db.currentUser);
  el.innerHTML = relevant.map(n => `<div class="notif"><b>${n.who === MANAGER_NAME ? "Správce" : "Vy"}:</b> ${n.text}
    <time>${fmt(n.t)}</time></div>`).join("") || `<div class="empty-note">Zatím žádná oznámení.</div>`;
}

function renderVehicleSelect() {
  const sel = document.getElementById("fVehicle");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = db.vehicles.map(v => `<option value="${v.id}">${v.name} — ${v.plate}</option>`).join("");
  if (prev) sel.value = prev;
}

function renderMyReservations() {
  const list = db.reservations.filter(r => r.employee === db.currentUser).slice().reverse();
  document.getElementById("myResCount").textContent = list.length;
  const el = document.getElementById("myResList");
  el.innerHTML = list.map(r => {
    const v = vehicleById(r.vehicleId);
    return `<div class="ritem">
      <div>
        <div class="veh">${v ? v.name : "Neznámé vozidlo"}</div>
        <div class="when">${fmt(r.start)} → ${fmt(r.end)}</div>
      </div>
      <span class="badge ${statusClass(r.status)}"><span class="dot"></span>${statusLabel(r.status)}</span>
    </div>`;
  }).join("") || `<div class="empty-note">Zatím nemáte žádné rezervace.</div>`;
}

function renderPending() {
  const list = db.reservations.filter(r => r.status === "PENDING");
  document.getElementById("pendingCount").textContent = list.length;
  const el = document.getElementById("pendingList");
  el.innerHTML = list.map(r => {
    const v = vehicleById(r.vehicleId);
    return `<div class="ritem">
      <div>
        <div class="veh">${v ? v.name : "Neznámé vozidlo"}</div>
        <div class="when">${fmt(r.start)} → ${fmt(r.end)}</div>
        <div class="who">${r.employee}</div>
      </div>
      <div class="actions">
        <button class="btn confirm small" onclick="managerDecision(${r.id}, true)">Schválit</button>
        <button class="btn reject small" onclick="managerDecision(${r.id}, false)">Zamítnout</button>
      </div>
    </div>`;
  }).join("") || `<div class="empty-note">Žádné požadavky ke schválení.</div>`;
}

function renderAdminTabs() {
  document.getElementById("tabFleet").classList.toggle("active", db.adminTab === "fleet");
  document.getElementById("tabRes").classList.toggle("active", db.adminTab === "res");
  document.getElementById("adminFleet").classList.toggle("hidden", db.adminTab !== "fleet");
  document.getElementById("adminRes").classList.toggle("hidden", db.adminTab !== "res");
}

function renderFleetTable() {
  const el = document.getElementById("fleetTable");
  el.innerHTML = db.vehicles.map(v => `<tr>
      <td><input value="${v.name}" onchange="updateVehicle(${v.id}, 'name', this.value)"></td>
      <td><input value="${v.plate}" onchange="updateVehicle(${v.id}, 'plate', this.value)"></td>
      <td><input value="${v.type}" onchange="updateVehicle(${v.id}, 'type', this.value)"></td>
      <td><input value="${v.location}" onchange="updateVehicle(${v.id}, 'location', this.value)"></td>
      <td><button class="btn line small" onclick="removeVehicle(${v.id})">Odebrat</button></td>
    </tr>`).join("");
}

function renderReservationsTable() {
  const el = document.getElementById("resTable");
  const list = db.reservations.slice().reverse();
  el.innerHTML = list.map(r => {
    const v = vehicleById(r.vehicleId);
    return `<tr>
      <td>${v ? v.name : "—"}</td>
      <td>${r.employee}</td>
      <td><input type="datetime-local" value="${r.start}" onchange="updateReservationField(${r.id}, 'start', this.value)"></td>
      <td><input type="datetime-local" value="${r.end}" onchange="updateReservationField(${r.id}, 'end', this.value)"></td>
      <td>
        <select onchange="updateReservationField(${r.id}, 'status', this.value)">
          <option value="PENDING" ${r.status === "PENDING" ? "selected" : ""}>Čeká na schválení</option>
          <option value="CONFIRMED" ${r.status === "CONFIRMED" ? "selected" : ""}>Potvrzeno</option>
          <option value="REJECTED" ${r.status === "REJECTED" ? "selected" : ""}>Zamítnuto</option>
        </select>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" class="empty-note">Žádné rezervace.</td></tr>`;
}

function renderLog() {
  const wrap = document.getElementById("logWrap");
  wrap.classList.toggle("open", db.logOpen);
  document.getElementById("logSub").textContent = `${db.log.length} událostí`;
  const el = document.getElementById("logBody");
  el.innerHTML = db.log.map(l => `<div class="logline">
      <span class="n">${l.n}</span><span class="actor">${l.actor}</span><span class="txt">${l.text}</span>
    </div>`).join("");
  el.scrollTop = el.scrollHeight;
}

renderAll();