/* ============================================================
   Car-side — Demo Logic with Auth & Simulated DB (Optimized)
   ============================================================ */

const STORE_KEY = "carside_db_v2";
const SESSION_KEY = "carside_session_user";
const STANDARD_MAX_DAYS = 3;
const MONTHS_CS = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];

let db = loadDb();
let currentUser = loadSession();
let fleetTimerInterval = null;

function loadDb() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return JSON.parse(JSON.stringify(INITIAL_DATABASE));
}

function saveDb() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {}
}

function loadSession() {
  try {
    const email = localStorage.getItem(SESSION_KEY);
    if (email) return db.users.find(u => u.email === email) || null;
  } catch (e) {}
  return null;
}

function setSession(user) {
  currentUser = user;
  if (user) localStorage.setItem(SESSION_KEY, user.email);
  else localStorage.removeItem(SESSION_KEY);
  renderAll();
}

function resetDemo() {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(SESSION_KEY);
  db = JSON.parse(JSON.stringify(INITIAL_DATABASE));
  currentUser = null;
  saveDb();
  renderAll();
}

/* ---------- Modals & Auth ---------- */
const toggleModal = (id, show) => document.getElementById(id)?.classList.toggle("hidden", !show);

function openLoginModal() { toggleModal("loginModal", true); document.getElementById("loginMsg").className = "formmsg"; }
function closeLoginModal() { toggleModal("loginModal", false); }
function openResetModal() { closeLoginModal(); toggleModal("resetModal", true); document.getElementById("resetMsg").className = "formmsg"; }
function closeResetModal() { toggleModal("resetModal", false); }
function openAddUserModal() { toggleModal("addUserModal", true); }
function closeAddUserModal() { toggleModal("addUserModal", false); }

function handleLogin(ev) {
  ev.preventDefault();
  const email = document.getElementById("lEmail").value.trim();
  const password = document.getElementById("lPassword").value;
  const msgEl = document.getElementById("loginMsg");

  pushLog("Auth Service", `POST /auth/login (${email})`);
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user || user.password !== password) {
    pushLog("Auth Service", "401 Unauthorized — Neplatný email nebo heslo");
    msgEl.textContent = "Nesprávný e-mail nebo heslo.";
    msgEl.className = "formmsg show err";
    renderLog();
    return false;
  }

  pushLog("Auth Service", `200 OK — Uživatel přihlášen (${user.name}, role: ${user.role})`);
  setSession(user);
  closeLoginModal();
  return false;
}

function quickLogin(email) {
  const user = db.users.find(u => u.email === email);
  if (user) {
    pushLog("Auth Service", `Demo přihlášení (${user.name})`);
    setSession(user);
    closeLoginModal();
  }
}

function logout() {
  if (currentUser) pushLog("Auth Service", `Uživatel ${currentUser.name} se odhlásil`);
  setSession(null);
}

function handleResetPassword(ev) {
  ev.preventDefault();
  const email = document.getElementById("rEmail").value.trim();
  const msgEl = document.getElementById("resetMsg");

  pushLog("Auth Service", `POST /auth/reset-password (${email})`);
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    pushLog("Auth Service", "404 Not Found — E-mail nenalezen");
    msgEl.textContent = "E-mail nebyl v systému nalezen.";
    msgEl.className = "formmsg show err";
    renderLog();
    return false;
  }

  pushLog("Auth Service", `200 OK — Odeslán e-mail s tokenem pro obnovu hesla na ${email}`);
  msgEl.textContent = "Instrukce pro obnovu hesla byly odeslány na váš e-mail.";
  msgEl.className = "formmsg show ok";
  renderLog();
  setTimeout(() => closeResetModal(), 2200);
  return false;
}

/* ---------- User Admin ---------- */
function handleAddUser(ev) {
  ev.preventDefault();
  const name = document.getElementById("nuName").value.trim();
  const email = document.getElementById("nuEmail").value.trim();
  const role = document.getElementById("nuRole").value;
  const password = document.getElementById("nuPassword").value;

  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    alert("Uživatel s tímto e-mailem již existuje.");
    return false;
  }

  const newUser = { id: db.nextUserId++, name, email, password, role, status: "ACTIVE" };
  db.users.push(newUser);
  pushLog("Admin Service", `PUT /users/${newUser.id} — vytvořen uživatel ${name} (${role})`);
  saveDb(); renderAll(); closeAddUserModal();
  return false;
}

function updateUserRole(userId, newRole) {
  const user = db.users.find(u => u.id === userId);
  if (!user) return;
  user.role = newRole;
  pushLog("Admin Service", `PUT /users/${userId} — změna role na ${newRole}`);
  saveDb(); renderAll();
}

function triggerPasswordReset(email) {
  pushLog("Admin Service", `Reset hesla vyvolán správcem pro ${email}`);
  pushNotif(email, "Správce vám zaslal odkaz pro resetování hesla.");
  alert(`Instrukce k resetu hesla byly zaslány na ${email}.`);
  saveDb(); renderAll();
}

/* ---------- Date & Time Utilities ---------- */
function parseIsoLocal(isoStr) {
  if (!isoStr) return null;
  const parts = isoStr.split("T");
  if (parts.length < 2) return new Date(isoStr);
  const [y, m, d] = parts[0].split("-").map(Number);
  const [hr, min] = parts[1].split(":").map(Number);
  return new Date(y, m - 1, d, hr, min);
}

function toDatetimeLocalStr(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const pad = n => String(n).padStart(2, '0');

function formatCsDateTime(date) {
  if (!date || isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}. ${pad(date.getMonth() + 1)}. ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCsShortTime(date) {
  if (!date || isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const getInputValue = id => document.getElementById(id)?.dataset.iso || "";

function setInputValue(id, dateObj) {
  const el = document.getElementById(id);
  if (!el || !dateObj) return;
  el.dataset.iso = toDatetimeLocalStr(dateObj);
  el.value = formatCsDateTime(dateObj);
}

function formatRemainingTime(ms) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60, h = Math.floor(ms / 3600000) % 24, d = Math.floor(ms / 86400000);
  return (d > 0 ? `${d}d ` : "") + `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function startFleetCountdownTimer() {
  if (fleetTimerInterval) clearInterval(fleetTimerInterval);
  fleetTimerInterval = setInterval(updateFleetCountdowns, 1000);
}

function updateFleetCountdowns() {
  const timerElements = document.querySelectorAll(".cd-timer");
  if (!timerElements.length) return;

  let shouldRerender = false;
  const now = Date.now();

  timerElements.forEach(el => {
    const diff = Number(el.dataset.target) - now;
    if (diff <= 0) {
      shouldRerender = true;
    } else {
      const remainingText = formatRemainingTime(diff);
      el.textContent = el.dataset.type === "busy" ? `(zbývá ${remainingText})` : `(pouze ${remainingText})`;
    }
  });

  if (shouldRerender) {
    renderFleetSidebar();
    renderVehicleSelect();
  }
}

/* ---------- Custom Picker Logic ---------- */
let activePickerInputId = null, activePickerCallback = null;
let cdpSelectedDate = new Date();
let cdpViewYear = cdpSelectedDate.getFullYear(), cdpViewMonth = cdpSelectedDate.getMonth();

function openPicker(inputId, onConfirmCb = null) {
  activePickerInputId = inputId;
  activePickerCallback = onConfirmCb;
  const currentIso = getInputValue(inputId);

  cdpSelectedDate = currentIso ? (parseIsoLocal(currentIso) || new Date()) : new Date();
  if (!currentIso) cdpSelectedDate.setMinutes(0, 0, 0);

  cdpViewYear = cdpSelectedDate.getFullYear();
  cdpViewMonth = cdpSelectedDate.getMonth();

  populateTimeSelects();
  renderCdp();
  toggleModal("cdpModal", true);
}

function closePicker() {
  toggleModal("cdpModal", false);
  activePickerInputId = null;
  activePickerCallback = null;
}

function populateTimeSelects() {
  const hSel = document.getElementById("cdpHour"), mSel = document.getElementById("cdpMin");
  hSel.innerHTML = Array.from({length: 24}, (_, i) => `<option value="${i}">${pad(i)}</option>`).join("");
  mSel.innerHTML = Array.from({length: 12}, (_, i) => `<option value="${i * 5}">${pad(i * 5)}</option>`).join("");

  hSel.value = cdpSelectedDate.getHours();
  mSel.value = Math.round(cdpSelectedDate.getMinutes() / 5) * 5 % 60;
}

function renderCdp() {
  document.getElementById("cdpMonthTitle").textContent = `${MONTHS_CS[cdpViewMonth]} ${cdpViewYear}`;
  const grid = document.getElementById("cdpGrid");
  grid.innerHTML = "";

  const firstDay = new Date(cdpViewYear, cdpViewMonth, 1);
  const startDay = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(cdpViewYear, cdpViewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(cdpViewYear, cdpViewMonth, 0).getDate();
  const now = new Date();

  for (let i = startDay - 1; i >= 0; i--) {
    grid.insertAdjacentHTML("beforeend", `<button type="button" class="cdp-day muted">${prevMonthDays - i}</button>`);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isSelected = cdpSelectedDate.getFullYear() === cdpViewYear && cdpSelectedDate.getMonth() === cdpViewMonth && cdpSelectedDate.getDate() === d;
    const isToday = now.getFullYear() === cdpViewYear && now.getMonth() === cdpViewMonth && now.getDate() === d;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `cdp-day${isSelected ? " selected" : ""}${isToday ? " today" : ""}`;
    btn.textContent = d;
    btn.onclick = () => {
      cdpSelectedDate.setFullYear(cdpViewYear, cdpViewMonth, d);
      renderCdp();
    };
    grid.appendChild(btn);
  }

  const totalCells = grid.children.length;
  const targetTotal = totalCells > 35 ? 42 : 35;
  for (let n = 1; n <= (targetTotal - totalCells); n++) {
    grid.insertAdjacentHTML("beforeend", `<button type="button" class="cdp-day muted">${n}</button>`);
  }
}

function cdpChangeMonth(delta) {
  cdpViewMonth += delta;
  if (cdpViewMonth < 0) { cdpViewMonth = 11; cdpViewYear--; }
  else if (cdpViewMonth > 11) { cdpViewMonth = 0; cdpViewYear++; }
  renderCdp();
}

function cdpOnTimeChange() {
  cdpSelectedDate.setHours(Number(document.getElementById("cdpHour").value), Number(document.getElementById("cdpMin").value), 0, 0);
}

function cdpSetToday() {
  const now = new Date();
  cdpSelectedDate = new Date(now);
  cdpViewYear = now.getFullYear();
  cdpViewMonth = now.getMonth();
  populateTimeSelects();
  renderCdp();
}

function cdpConfirm() {
  cdpOnTimeChange();
  if (activePickerInputId) setInputValue(activePickerInputId, cdpSelectedDate);
  if (typeof activePickerCallback === "function") activePickerCallback();
  closePicker();
  renderVehicleSelect();
  renderFleetSidebar();
}

/* ---------- Presets ---------- */
function setPreset(type) {
  const now = new Date();
  let start = new Date(now), end = new Date(now);

  if (type === 'tomorrow_1') {
    start.setDate(now.getDate() + 1); start.setHours(8, 0, 0, 0);
    end.setDate(now.getDate() + 1); end.setHours(17, 0, 0, 0);
  } else if (type === 'tomorrow_2') {
    start.setDate(now.getDate() + 1); start.setHours(8, 0, 0, 0);
    end.setDate(now.getDate() + 2); end.setHours(17, 0, 0, 0);
  } else if (type === 'tomorrow_3') {
    start.setDate(now.getDate() + 1); start.setHours(8, 0, 0, 0);
    end.setDate(now.getDate() + 3); end.setHours(17, 0, 0, 0);
  } else if (type === 'weekend') {
    const dayOfWeek = now.getDay();
    let daysUntilFriday = 5 - dayOfWeek;
    if (dayOfWeek === 6) daysUntilFriday = -1;
    if (dayOfWeek === 0) daysUntilFriday = -2;

    start.setDate(now.getDate() + daysUntilFriday); start.setHours(15, 0, 0, 0);
    end = new Date(start); end.setDate(start.getDate() + 2); end.setHours(18, 0, 0, 0);
  }

  setInputValue("fStart", start);
  setInputValue("fEnd", end);
  renderVehicleSelect();
  renderFleetSidebar();
}

function initDateInputs(force = false) {
  if (force || !getInputValue("fStart")) setPreset('tomorrow_1');
  else { renderVehicleSelect(); renderFleetSidebar(); }
}

/* ---------- Helpers ---------- */
const vehicleById = id => db.vehicles.find(v => v.id === id);
function fmt(dtStr) {
  const d = parseIsoLocal(dtStr);
  return (!d || isNaN(d)) ? dtStr : d.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

function pushLog(actor, text) {
  db.logSeq += 1;
  db.log.push({ n: db.logSeq, actor, text });
  if (db.log.length > 60) db.log = db.log.slice(-60);
}

function pushNotif(who, text) {
  db.notifications.unshift({ who, text, t: new Date().toISOString() });
  db.notifications = db.notifications.slice(0, 12);
}

const statusLabel = s => s === "CONFIRMED" ? "Potvrzeno" : s === "PENDING" ? "Čeká na schválení" : "Zamítnuto";
const statusClass = s => s === "CONFIRMED" ? "confirmed" : s === "PENDING" ? "pending" : "rejected";
const roleLabel = r => r === "admin" ? "Administrátor" : r === "manager" ? "Správce flotily" : "Zaměstnanec";

function setAdminTab(tab) { db.adminTab = tab; saveDb(); renderAll(); }
function toggleLog() { db.logOpen = !db.logOpen; saveDb(); renderAll(); }

/* ---------- Reservation Logic ---------- */
function submitReservation(ev) {
  ev.preventDefault();
  if (!currentUser) return false;

  const vehicleId = Number(document.getElementById("fVehicle").value);
  const startVal = getInputValue("fStart"), endVal = getInputValue("fEnd");
  const msgEl = document.getElementById("formMsg");
  msgEl.className = "formmsg";

  const vehicle = vehicleById(vehicleId);
  const start = parseIsoLocal(startVal), end = parseIsoLocal(endVal);
  const now = new Date();

  pushLog("Zaměstnanec → API", `POST /reservations (${vehicle ? vehicle.name : vehicleId}, ${startVal}, ${endVal})`);

  if (!vehicle || !start || !end || !(start < end)) {
    pushLog("API → Zaměstnanec", "400 — neplatný termín nebo chybějící vozidlo");
    msgEl.textContent = "Zkontrolujte prosím termín nebo zvolte dostupné vozidlo.";
    msgEl.classList.add("show", "err");
    saveDb(); renderLog(); renderNotifs();
    return false;
  }

  if (start < now) {
    pushLog("API → Zaměstnanec", "400 — datum v minulosti");
    msgEl.textContent = "Nelze vytvořit rezervaci v minulosti. Zvolte prosím aktuální nebo budoucí termín.";
    msgEl.classList.add("show", "err");
    saveDb(); renderLog(); renderNotifs();
    return false;
  }

  if ((end - start) / 60000 < 30) {
    pushLog("API → Zaměstnanec", "400 — příliš krátká rezervace (< 30 min)");
    msgEl.textContent = "Minimální časový blok půjčení je 30 minut.";
    msgEl.classList.add("show", "err");
    saveDb(); renderLog(); renderNotifs();
    return false;
  }

  pushLog("API → Databáze", "Dotaz na existující rezervace (kontrola překryvu časů)");
  const clash = db.reservations.some(r => r.vehicleId === vehicleId && r.status !== "REJECTED" && overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end)));

  if (clash) {
    pushLog("Databáze → API", "Nalezen překryv — vozidlo není v termínu dostupné");
    pushLog("API → Zaměstnanec", "409 Conflict — vozidlo obsazeno");
    msgEl.textContent = `Vozidlo ${vehicle.name} je v tomto termínu již rezervováno. Zvolte jiný termín nebo vozidlo.`;
    msgEl.classList.add("show", "err");
    saveDb(); renderLog(); renderNotifs();
    return false;
  }
  pushLog("Databáze → API", "Žádný překryv (vozidlo dostupné)");

  const days = (end - start) / 86400000;
  const isStandard = days <= STANDARD_MAX_DAYS;
  const status = isStandard ? "CONFIRMED" : "PENDING";

  db.reservations.push({ id: db.nextResId++, vehicleId, employeeEmail: currentUser.email, employeeName: currentUser.name, start: startVal, end: endVal, status });

  if (isStandard) {
    pushLog("API → Databáze", "Ulož rezervaci (status = CONFIRMED)");
    pushLog("API → Zaměstnanec", "201 Created — stav: CONFIRMED");
    pushNotif(currentUser.email, `Rezervace vozidla ${vehicle.name} byla automaticky potvrzena.`);
    msgEl.textContent = `Hotovo — rezervace vozidla ${vehicle.name} byla automaticky potvrzena.`;
    msgEl.classList.add("show", "ok");
  } else {
    pushLog("API → Databáze", "Ulož rezervaci (status = PENDING)");
    pushLog("API → Správce", "Odeslat notifikaci: \"Nová rezervace ke schválení\"");
    pushLog("API → Zaměstnanec", "201 Created — stav: PENDING");
    db.users.filter(u => u.role === "manager").forEach(m => {
      pushNotif(m.email, `Nová rezervace ke schválení: ${vehicle.name} (${currentUser.name}, ${Math.ceil(days)} dní).`);
    });
    pushNotif(currentUser.email, `Rezervace vozidla ${vehicle.name} přesahuje 3 dny a čeká na schválení správce.`);
    msgEl.textContent = `Termín přesahuje ${STANDARD_MAX_DAYS} dny — rezervace čeká na schválení správce vozového parku.`;
    msgEl.classList.add("show", "ok");
  }

  saveDb();
  document.getElementById("resForm").reset();
  initDateInputs(true);
  renderAll();
  return false;
}

function managerDecision(resId, approve) {
  const rec = db.reservations.find(r => r.id === resId);
  if (!rec) return;
  const vehicle = vehicleById(rec.vehicleId);
  pushLog("Správce → API", `PUT /reservations/${resId}/status (akce: ${approve ? "CONFIRM" : "REJECT"})`);
  rec.status = approve ? "CONFIRMED" : "REJECTED";
  pushNotif(rec.employeeEmail, `Vaše rezervace vozidla ${vehicle ? vehicle.name : ""} byla ${approve ? "schválena" : "zamítnuta"}.`);
  saveDb(); renderAll();
}

/* ---------- Admin CRUD ---------- */
function addVehicle() {
  const id = db.nextVehicleId++;
  db.vehicles.push({ id, name: "Nové vozidlo", plate: "0XX 0000", type: "Sedan", location: "Ostrava — centrála" });
  pushLog("Správce → API", `PUT /vehicles/${id} (přímá úprava dat)`);
  saveDb(); renderAll();
}

function updateVehicle(id, field, value) {
  const v = vehicleById(id);
  if (!v) return;
  v[field] = value;
  saveDb(); renderNotifs(); renderLog(); renderFleetSidebar(); renderVehicleSelect();
}

function removeVehicle(id) {
  db.vehicles = db.vehicles.filter(v => v.id !== id);
  db.reservations = db.reservations.filter(r => r.vehicleId !== id);
  pushLog("Správce → API", `DELETE /vehicles/${id}`);
  saveDb(); renderAll();
}

function updateReservationField(id, field, value) {
  const r = db.reservations.find(r => r.id === id);
  if (!r) return;
  r[field] = value;
  saveDb(); renderLog(); renderAll();
}

/* ---------- Rendering ---------- */
function renderAll() {
  renderTopBarAuth();

  const loggedOutView = document.getElementById("loggedOutView");
  const employeeView = document.getElementById("employeeView");
  const managerView = document.getElementById("managerView");
  const adminView = document.getElementById("adminView");

  if (!currentUser) {
    loggedOutView.classList.remove("hidden");
    employeeView.classList.add("hidden");
    managerView.classList.add("hidden");
    adminView.classList.add("hidden");
  } else {
    loggedOutView.classList.add("hidden");
    employeeView.classList.toggle("hidden", currentUser.role !== "employee");
    managerView.classList.toggle("hidden", currentUser.role !== "manager" && currentUser.role !== "admin");
    adminView.classList.toggle("hidden", currentUser.role !== "admin");
  }

  renderFleetSidebar();
  renderNotifs();
  renderVehicleSelect();
  renderMyReservations();
  renderPending();
  renderAdminTabs();
  renderFleetTable();
  renderReservationsTable();
  renderUsersTable();
  renderLog();
  initDateInputs();
}

function renderTopBarAuth() {
  const wrap = document.getElementById("topbarAuth");
  if (!wrap) return;
  wrap.innerHTML = !currentUser
    ? `<button class="btn confirm small" onclick="openLoginModal()">Přihlásit se</button>`
    : `<div class="user-badge"><span class="user-info"><b>${currentUser.name}</b> (${roleLabel(currentUser.role)})</span><button class="btn line small" onclick="logout()">Odhlásit se</button></div>`;
}

function renderVehicleTimetableHtml(vehicleId) {
  const now = new Date();
  const futureReservations = db.reservations
    .filter(r => r.vehicleId === vehicleId && r.status !== "REJECTED" && parseIsoLocal(r.end) > now)
    .sort((a, b) => parseIsoLocal(a.start) - parseIsoLocal(b.start))
    .slice(0, 3);

  if (!futureReservations.length) {
    return `<div class="timetable-wrap"><div class="timetable-title">Harmonogram</div><div style="font-size: 0.8rem; color: #94a3b8;">Žádné nadcházející rezervace.</div></div>`;
  }

  const itemsHtml = futureReservations.map(r => {
    const s = parseIsoLocal(r.start), e = parseIsoLocal(r.end);
    const isActive = s <= now && now < e;
    return `<div class="timetable-item ${isActive ? 'active' : ''}"><span>📅 ${formatCsShortTime(s)} — ${formatCsShortTime(e)}</span><span style="font-size: 0.75rem; opacity: 0.8;">${r.employeeName}</span></div>`;
  }).join("");

  return `<div class="timetable-wrap"><div class="timetable-title">Harmonogram obsazenosti</div><div class="timetable-list">${itemsHtml}</div></div>`;
}

function renderFleetSidebar() {
  const el = document.getElementById("fleetList");
  if (!el) return;
  document.getElementById("fleetCount").textContent = db.vehicles.length;

  const now = new Date();
  const statusList = db.vehicles.map(v => {
    const reservations = db.reservations.filter(r => r.vehicleId === v.id && r.status !== "REJECTED");
    const activeRes = reservations.find(r => parseIsoLocal(r.start) <= now && now < parseIsoLocal(r.end));
    const upcomingRes = !activeRes ? reservations.filter(r => parseIsoLocal(r.start) > now).sort((a, b) => parseIsoLocal(a.start) - parseIsoLocal(b.start))[0] : null;

    let state = activeRes ? "BUSY" : upcomingRes ? "UPCOMING" : "FREE";
    return {
      vehicle: v, state, activeRes, upcomingRes,
      sortTime: activeRes ? parseIsoLocal(activeRes.end).getTime() : (upcomingRes ? parseIsoLocal(upcomingRes.start).getTime() : 0)
    };
  });

  statusList.sort((a, b) => {
    const order = { FREE: 1, UPCOMING: 2, BUSY: 3 };
    return order[a.state] !== order[b.state] ? order[a.state] - order[b.state] : a.sortTime - b.sortTime;
  });

  const nowMs = Date.now();
  el.innerHTML = statusList.slice(0, 5).map(item => {
    const v = item.vehicle;
    const timetableHtml = renderVehicleTimetableHtml(v.id);

    if (item.state === "BUSY") {
      const endMs = parseIsoLocal(item.activeRes.end).getTime();
      return `<div class="fleetcard"><span class="name">${v.name}</span><span class="meta">${v.type} · ${v.location}</span><span class="plate">${v.plate}</span><span class="badge pending" style="margin-top:6px; align-self:flex-start"><span class="dot"></span>Obsazeno <span class="cd-timer" data-type="busy" data-target="${endMs}">(zbývá ${formatRemainingTime(endMs - nowMs)})</span></span>${timetableHtml}</div>`;
    } else if (item.state === "UPCOMING") {
      const startMs = parseIsoLocal(item.upcomingRes.start).getTime();
      return `<div class="fleetcard"><span class="name">${v.name}</span><span class="meta">${v.type} · ${v.location}</span><span class="plate">${v.plate}</span><span class="badge confirmed" style="margin-top:6px; align-self:flex-start"><span class="dot"></span>Dostupné <span class="cd-timer" data-type="upcoming" data-target="${startMs}">(pouze ${formatRemainingTime(startMs - nowMs)})</span></span>${timetableHtml}</div>`;
    } else {
      return `<div class="fleetcard"><span class="name">${v.name}</span><span class="meta">${v.type} · ${v.location}</span><span class="plate">${v.plate}</span><span class="badge confirmed" style="margin-top:6px; align-self:flex-start"><span class="dot"></span>Dostupné</span>${timetableHtml}</div>`;
    }
  }).join("") || `<div class="empty-note">Žádná vozidla ve flotile.</div>`;

  startFleetCountdownTimer();
}

function renderNotifs() {
  const el = document.getElementById("notifList");
  if (!el) return;
  if (!currentUser) { el.innerHTML = `<div class="empty-note">Pro zobrazení notifikací se přihlaste.</div>`; return; }
  const relevant = db.notifications.filter(n => n.who === currentUser.email);
  el.innerHTML = relevant.map(n => `<div class="notif"><b>Systém:</b> ${n.text}<time>${fmt(n.t)}</time></div>`).join("") || `<div class="empty-note">Zatím žádná oznámení.</div>`;
}

function renderVehicleSelect() {
  const sel = document.getElementById("fVehicle");
  if (!sel) return;

  const startVal = getInputValue("fStart"), endVal = getInputValue("fEnd");
  const start = parseIsoLocal(startVal), end = parseIsoLocal(endVal);
  const prev = sel.value;

  sel.innerHTML = db.vehicles.map(v => {
    const isClashed = (start && end && start < end) && db.reservations.some(r => r.vehicleId === v.id && (r.status === "CONFIRMED" || r.status === "PENDING") && overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end)));
    return `<option value="${v.id}" ${isClashed ? "disabled" : ""}>${v.name} — ${v.plate}${isClashed ? " ❌ (Obsazeno v tomto termínu)" : " ✅ (Dostupné)"}</option>`;
  }).join("");

  const firstAvailable = db.vehicles.find(v => !start || !end || !(start < end) || !db.reservations.some(r => r.vehicleId === v.id && (r.status === "CONFIRMED" || r.status === "PENDING") && overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end))));

  if (prev && !sel.querySelector(`option[value="${prev}"]`)?.disabled) sel.value = prev;
  else if (firstAvailable) sel.value = firstAvailable.id;
}

function renderMyReservations() {
  if (!currentUser) return;
  const list = db.reservations.filter(r => r.employeeEmail === currentUser.email).slice().reverse();
  document.getElementById("myResCount").textContent = list.length;
  document.getElementById("myResList").innerHTML = list.map(r => {
    const v = vehicleById(r.vehicleId);
    return `<div class="ritem"><div><div class="veh">${v ? v.name : "Neznámé vozidlo"}</div><div class="when">${fmt(r.start)} → ${fmt(r.end)}</div></div><span class="badge ${statusClass(r.status)}"><span class="dot"></span>${statusLabel(r.status)}</span></div>`;
  }).join("") || `<div class="empty-note">Zatím nemáte žádné rezervace.</div>`;
}

function renderPending() {
  const list = db.reservations.filter(r => r.status === "PENDING");
  document.getElementById("pendingCount").textContent = list.length;
  document.getElementById("pendingList").innerHTML = list.map(r => {
    const v = vehicleById(r.vehicleId);
    return `<div class="ritem"><div><div class="veh">${v ? v.name : "Neznámé vozidlo"}</div><div class="when">${fmt(r.start)} → ${fmt(r.end)}</div><div class="who">${r.employeeName} (${r.employeeEmail})</div></div><div class="actions"><button class="btn confirm small" onclick="managerDecision(${r.id}, true)">Schválit</button><button class="btn reject small" onclick="managerDecision(${r.id}, false)">Zamítnout</button></div></div>`;
  }).join("") || `<div class="empty-note">Žádné požadavky ke schválení.</div>`;
}

function renderAdminTabs() {
  const tabFleet = document.getElementById("tabFleet"), tabRes = document.getElementById("tabRes");
  if (!tabFleet || !tabRes) return;
  const activeTab = db.adminTab || "fleet";
  tabFleet.classList.toggle("active", activeTab === "fleet");
  tabRes.classList.toggle("active", activeTab === "res");
  document.getElementById("adminFleet").classList.toggle("hidden", activeTab !== "fleet");
  document.getElementById("adminRes").classList.toggle("hidden", activeTab !== "res");
}

function renderFleetTable() {
  const el = document.getElementById("fleetTable");
  if (!el) return;
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
  if (!el) return;
  const list = db.reservations.slice().reverse();
  el.innerHTML = list.map(r => {
    const v = vehicleById(r.vehicleId);
    return `<tr>
      <td>${v ? v.name : "—"}</td>
      <td>${r.employeeName}</td>
      <td><input id="admin_start_${r.id}" type="text" readonly value="${formatCsDateTime(parseIsoLocal(r.start))}" data-iso="${r.start}" onclick="openPicker('admin_start_${r.id}', () => updateReservationField(${r.id}, 'start', getInputValue('admin_start_${r.id}')))"></td>
      <td><input id="admin_end_${r.id}" type="text" readonly value="${formatCsDateTime(parseIsoLocal(r.end))}" data-iso="${r.end}" onclick="openPicker('admin_end_${r.id}', () => updateReservationField(${r.id}, 'end', getInputValue('admin_end_${r.id}')))"></td>
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

function renderUsersTable() {
  const el = document.getElementById("usersTable");
  if (!el) return;
  document.getElementById("userCount").textContent = db.users.length;
  el.innerHTML = db.users.map(u => `<tr>
    <td><b>${u.name}</b></td>
    <td>${u.email}</td>
    <td>
      <select onchange="updateUserRole(${u.id}, this.value)">
        <option value="employee" ${u.role === "employee" ? "selected" : ""}>Zaměstnanec</option>
        <option value="manager" ${u.role === "manager" ? "selected" : ""}>Správce flotily</option>
        <option value="admin" ${u.role === "admin" ? "selected" : ""}>Administrátor</option>
      </select>
    </td>
    <td><button class="btn line small" onclick="triggerPasswordReset('${u.email}')">Reset hesla</button></td>
  </tr>`).join("");
}

function renderLog() {
  document.getElementById("logWrap").classList.toggle("open", db.logOpen);
  document.getElementById("logSub").textContent = `${db.log.length} událostí`;
  const el = document.getElementById("logBody");
  el.innerHTML = db.log.map(l => `<div class="logline"><span class="n">${l.n}</span><span class="actor">${l.actor}</span><span class="txt">${l.text}</span></div>`).join("");
  el.scrollTop = el.scrollHeight;
}

renderAll();