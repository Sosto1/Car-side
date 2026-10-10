/* ============================================================
   Car-side — Logic with Auth, Timetable & Vehicle/User Modals
   ============================================================ */

const STORE_KEY = "carside_db_v3";
const SESSION_KEY = "carside_session_user";
const STANDARD_MAX_DAYS = 3;
const MONTHS_CS = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];

let db = loadDb();
let currentUser = loadSession();
let fleetTimerInterval = null;
let stkActiveFilter = "ALL";

function loadDb() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return JSON.parse(JSON.stringify(INITIAL_DATABASE));
}

function saveDb() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); return true; } catch (e) { return false; }
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

function goHome() {
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- Modals & Auth ---------- */
const toggleModal = (id, show) => document.getElementById(id)?.classList.toggle("hidden", !show);

function openLoginModal() { toggleModal("loginModal", true); document.getElementById("loginMsg").className = "formmsg"; }
function closeLoginModal() { toggleModal("loginModal", false); }
function openResetModal() { closeLoginModal(); toggleModal("resetModal", true); document.getElementById("resetMsg").className = "formmsg"; }
function closeResetModal() { toggleModal("resetModal", false); }

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

function formatCsDate(date) {
  if (!date || isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}. ${pad(date.getMonth() + 1)}. ${date.getFullYear()}`;
}

const getInputValue = id => document.getElementById(id)?.dataset.iso || "";

function setInputValue(id, dateObj, dateOnly = false) {
  const el = document.getElementById(id);
  if (!el || !dateObj) return;
  if (dateOnly) {
    const yyyy = dateObj.getFullYear();
    const mm = pad(dateObj.getMonth() + 1);
    const dd = pad(dateObj.getDate());
    const iso = `${yyyy}-${mm}-${dd}`;
    el.dataset.iso = iso;
    el.value = formatCsDate(dateObj);
  } else {
    el.dataset.iso = toDatetimeLocalStr(dateObj);
    el.value = formatCsDateTime(dateObj);
  }
}

function parseDateOnly(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(str);
}

function daysDiffFromNow(dateStr) {
  if (!dateStr) return 999;
  const target = parseDateOnly(dateStr);
  const now = new Date();
  target.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  return Math.ceil((target - now) / 86400000);
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

/* ---------- Custom Picker Logic (With Date-Only Mode) ---------- */
let activePickerInputId = null, activePickerCallback = null;
let cdpSelectedDate = new Date();
let cdpViewYear = cdpSelectedDate.getFullYear(), cdpViewMonth = cdpSelectedDate.getMonth();
let cdpDateOnly = false;

function openPicker(inputId, onConfirmCb = null, dateOnly = false) {
  activePickerInputId = inputId;
  activePickerCallback = onConfirmCb;
  cdpDateOnly = dateOnly;

  const timeBox = document.querySelector(".cdp-timebox");
  if (timeBox) timeBox.style.display = dateOnly ? "none" : "flex";

  const currentIso = getInputValue(inputId);

  if (dateOnly) {
    cdpSelectedDate = currentIso ? new Date(currentIso) : new Date();
  } else {
    cdpSelectedDate = currentIso ? (parseIsoLocal(currentIso) || new Date()) : new Date();
    if (!currentIso) cdpSelectedDate.setMinutes(0, 0, 0);
  }

  cdpViewYear = cdpSelectedDate.getFullYear();
  cdpViewMonth = cdpSelectedDate.getMonth();

  if (!dateOnly) populateTimeSelects();
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
  if (!hSel || !mSel) return;
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
  if (cdpDateOnly) return;
  cdpSelectedDate.setHours(Number(document.getElementById("cdpHour").value), Number(document.getElementById("cdpMin").value), 0, 0);
}

function cdpSetToday() {
  const now = new Date();
  cdpSelectedDate = new Date(now);
  cdpViewYear = now.getFullYear();
  cdpViewMonth = now.getMonth();
  if (!cdpDateOnly) populateTimeSelects();
  renderCdp();
}

function cdpConfirm() {
  if (!cdpDateOnly) cdpOnTimeChange();
  if (activePickerInputId) setInputValue(activePickerInputId, cdpSelectedDate, cdpDateOnly);
  if (typeof activePickerCallback === "function") activePickerCallback();
  closePicker();
  renderVehicleSelect();
  renderFleetSidebar();
  renderTimetable();
}

/* ---------- Presets (Fixing Weekend Past Conflict Bug) ---------- */
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
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    if (dayOfWeek === 6) { // Sobota: start od aktuálního času + 1 minuta
      start = new Date(now.getTime() + 60000);
      end = new Date(now);
      end.setDate(now.getDate() + 1); // Neděle
      end.setHours(18, 0, 0, 0);
    } else if (dayOfWeek === 0) { // Neděle: start od aktuálního času + 1 minuta
      start = new Date(now.getTime() + 60000);
      end = new Date(now);
      end.setHours(21, 0, 0, 0);
      if (end <= start) end = new Date(start.getTime() + 4 * 3600000);
    } else { // Pondělí - Pátek
      let daysUntilFriday = 5 - dayOfWeek;
      start.setDate(now.getDate() + daysUntilFriday); start.setHours(15, 0, 0, 0);
      end = new Date(start); end.setDate(start.getDate() + 2); end.setHours(18, 0, 0, 0);
    }
  }

  // Bezpečnostní pojistka proti konfliktu s minulostí (+1 minuta)
  if (start <= now) start = new Date(now.getTime() + 60000);
  if (end <= start) end = new Date(start.getTime() + 2 * 3600000);

  setInputValue("fStart", start);
  setInputValue("fEnd", end);
  renderVehicleSelect();
  renderFleetSidebar();
  renderTimetable();
}

function initDateInputs(force = false) {
  if (force || !getInputValue("fStart")) setPreset('tomorrow_1');
  else { renderVehicleSelect(); renderFleetSidebar(); renderTimetable(); }
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

const esc = str => String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = d => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtDate = d => d.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function setAdminTab(tab) { db.adminTab = tab; saveDb(); renderAll(); }
function toggleLog() { db.logOpen = !db.logOpen; saveDb(); renderAll(); }

/* ---------- Reservation Logic ---------- */
function submitReservation(ev) {
  ev.preventDefault();
  if (!currentUser) return false;

  const msgEl = document.getElementById("formMsg");
  msgEl.className = "formmsg";

  if (currentUser.canDrive === false) {
    pushLog("API → Zaměstnanec", "403 Forbidden — Uživatel má zákaz řízení");
    msgEl.textContent = "Máte pozastavené oprávnění k řízení služebních vozidel. Rezervaci nelze vytvořit.";
    msgEl.classList.add("show", "err");
    return false;
  }

  const vehicleId = Number(document.getElementById("fVehicle").value);
  const startVal = getInputValue("fStart"), endVal = getInputValue("fEnd");
  const vehicle = vehicleById(vehicleId);
  const start = parseIsoLocal(startVal), end = parseIsoLocal(endVal);
  const now = new Date();

  pushLog("Zaměstnanec → API", `POST /reservations (${vehicle ? vehicle.name : vehicleId}, ${startVal}, ${endVal})`);

  if (!vehicle || !start || !end || !(start < end)) {
    msgEl.textContent = "Zkontrolujte prosím termín nebo zvolte dostupné vozidlo.";
    msgEl.classList.add("show", "err");
    return false;
  }

  const stkDiff = daysDiffFromNow(vehicle.stkDate);
  if (stkDiff < 0) {
    msgEl.textContent = `Vozidlo ${vehicle.name} má prošlou STK (${formatCsDate(new Date(vehicle.stkDate))}) a nelze jej rezervovat!`;
    msgEl.classList.add("show", "err");
    return false;
  }

  if (start < now) {
    msgEl.textContent = "Nelze vytvořit rezervaci v minulosti. Zvolte prosím aktuální nebo budoucí termín.";
    msgEl.classList.add("show", "err");
    return false;
  }

  if ((end - start) / 60000 < 30) {
    msgEl.textContent = "Minimální časový blok půjčení je 30 minut.";
    msgEl.classList.add("show", "err");
    return false;
  }

  const employeeClash = db.reservations.some(r =>
    r.employeeEmail === currentUser.email &&
    r.status !== "REJECTED" &&
    overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end))
  );

  if (employeeClash) {
    pushLog("API → Zaměstnanec", "409 Conflict — Zaměstnanec již má rezervaci v daném čase");
    msgEl.textContent = "V tomto časovém rozmezí již máte zarezervované jiné vozidlo. V jednom čase lze mít max 1 auto.";
    msgEl.classList.add("show", "err");
    return false;
  }

  const clash = db.reservations.some(r => r.vehicleId === vehicleId && r.status !== "REJECTED" && overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end)));

  if (clash) {
    msgEl.textContent = `Vozidlo ${vehicle.name} je v tomto termínu již rezervováno. Zvolte jiný termín nebo vozidlo.`;
    msgEl.classList.add("show", "err");
    return false;
  }

  const days = (end - start) / 86400000;
  const isStandard = days <= STANDARD_MAX_DAYS;
  const status = isStandard ? "CONFIRMED" : "PENDING";

  db.reservations.push({ id: db.nextResId++, vehicleId, employeeEmail: currentUser.email, employeeName: currentUser.name, start: startVal, end: endVal, status });

  if (isStandard) {
    pushNotif(currentUser.email, `Rezervace vozidla ${vehicle.name} byla automaticky potvrzena.`);
    msgEl.textContent = `Hotovo — rezervace vozidla ${vehicle.name} byla automaticky potvrzena.`;
    msgEl.classList.add("show", "ok");
  } else {
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

function managerDecision(resId, approve, isCancel = false) {
  const rec = db.reservations.find(r => r.id === resId);
  if (!rec) return;
  if (isCancel && !confirm("Opravdu chcete zrušit tuto potvrzenou rezervaci? Zaměstnanec bude informován.")) return;
  const vehicle = vehicleById(rec.vehicleId);
  const action = approve ? "CONFIRM" : isCancel ? "CANCEL" : "REJECT";
  pushLog("Správce → API", `PUT /reservations/${resId}/status (akce: ${action})`);
  rec.status = approve ? "CONFIRMED" : "REJECTED";
  const verb = approve ? "schválena" : isCancel ? "zrušena správcem" : "zamítnuta";
  pushNotif(rec.employeeEmail, `Vaše rezervace vozidla ${vehicle ? vehicle.name : ""} (${fmt(rec.start)}) byla ${verb}.`);
  saveDb(); renderAll();
}

/* ---------- Vehicle Modal Form CRUD ---------- */
function openVehicleModal(id = null) {
  const modal = document.getElementById("vehicleModal");
  const title = document.getElementById("vModalTitle");
  if (!modal) return;

  if (id) {
    const v = vehicleById(id);
    if (!v) return;
    title.textContent = `Upravit vozidlo: ${v.name}`;
    document.getElementById("mvId").value = v.id;
    document.getElementById("mvName").value = v.name;
    document.getElementById("mvPlate").value = v.plate;
    document.getElementById("mvType").value = v.type;
    document.getElementById("mvLocation").value = v.location;

    setInputValue("mvStkDate", new Date(v.stkDate || Date.now()), true);
    setInputValue("mvGreenCardDate", new Date(v.greenCardDate || Date.now()), true);

    document.getElementById("mvMileage").value = v.mileage || 0;
    document.getElementById("mvNotes").value = v.notes || "";
  } else {
    title.textContent = "Přidat nové vozidlo";
    document.getElementById("mvId").value = "";
    document.getElementById("mvName").value = "";
    document.getElementById("mvPlate").value = "";
    document.getElementById("mvType").value = "Kombi";
    document.getElementById("mvLocation").value = "Ostrava — centrála";

    setInputValue("mvStkDate", new Date("2027-12-31"), true);
    setInputValue("mvGreenCardDate", new Date("2027-12-31"), true);

    document.getElementById("mvMileage").value = 0;
    document.getElementById("mvNotes").value = "";
  }

  toggleModal("vehicleModal", true);
}

function closeVehicleModal() { toggleModal("vehicleModal", false); }

function saveVehicleForm(ev) {
  ev.preventDefault();
  const idVal = document.getElementById("mvId").value;
  const name = document.getElementById("mvName").value.trim();
  const plate = document.getElementById("mvPlate").value.trim();
  const type = document.getElementById("mvType").value;
  const location = document.getElementById("mvLocation").value.trim();
  const stkDate = getInputValue("mvStkDate");
  const greenCardDate = getInputValue("mvGreenCardDate");
  const mileage = Number(document.getElementById("mvMileage").value);
  const notes = document.getElementById("mvNotes").value.trim();

  if (idVal) {
    const v = vehicleById(Number(idVal));
    if (v) {
      v.name = name; v.plate = plate; v.type = type; v.location = location;
      v.stkDate = stkDate; v.greenCardDate = greenCardDate; v.mileage = mileage; v.notes = notes;
      pushLog("Správce", `Aktualizováno vozidlo ID ${v.id} (${v.name})`);
    }
  } else {
    const newId = db.nextVehicleId++;
    db.vehicles.push({ id: newId, name, plate, type, location, stkDate, greenCardDate, mileage, notes, defects: [] });
    pushLog("Správce", `Vytvořeno nové vozidlo ID ${newId} (${name})`);
  }

  saveDb();
  closeVehicleModal();
  renderAll();
  return false;
}

function removeVehicle(id) {
  if (!confirm("Opravdu chcete odebrat toto vozidlo z flotily?")) return;
  db.vehicles = db.vehicles.filter(v => v.id !== id);
  db.reservations = db.reservations.filter(r => r.vehicleId !== id);
  pushLog("Správce", `Odebráno vozidlo ID ${id}`);
  saveDb(); renderAll();
}

function openVehicleDetailModal(id) {
  const v = vehicleById(id);
  if (!v) return;

  const stkDiff = daysDiffFromNow(v.stkDate);
  const gcDiff = daysDiffFromNow(v.greenCardDate);

  let stkBadge = stkDiff < 0 ? `<span class="badge rejected">Prošlá STK (${formatCsDate(new Date(v.stkDate))})</span>` : stkDiff <= 30 ? `<span class="badge pending">STK končí za ${stkDiff} dní</span>` : `<span class="badge confirmed">STK platná do ${formatCsDate(new Date(v.stkDate))}</span>`;
  let gcBadge = gcDiff < 0 ? `<span class="badge rejected">Prošlé ručení (${formatCsDate(new Date(v.greenCardDate))})</span>` : gcDiff <= 30 ? `<span class="badge pending">Ručení končí za ${gcDiff} dní</span>` : `<span class="badge confirmed">Ručení platné do ${formatCsDate(new Date(v.greenCardDate))}</span>`;

  let defectsHtml = (v.defects && v.defects.length)
    ? v.defects.map(d => `<div style="background:var(--paper); padding:6px 10px; border-radius:6px; font-size:12px; border-left:3px solid ${d.status === 'OPEN' ? 'var(--red)' : 'var(--accent)'}; margin-top:4px;"><b>${d.status === 'OPEN' ? '⚠️ Otevřená vada' : '✅ Vyřešeno'}:</b> ${esc(d.text)} <span style="color:var(--muted)">(${fmt(d.date)})</span></div>`).join("")
    : "<div style='color:var(--muted); margin-top:4px;'>Žádné hlášené vady.</div>";

  document.getElementById("vdTitle").textContent = `${v.name} (${v.plate})`;
  document.getElementById("vdBody").innerHTML = `
    <div><b>Typ / Lokalita:</b> ${v.type} · ${v.location}</div>
    <div><b>Najeté km:</b> ${v.mileage.toLocaleString()} km</div>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">${stkBadge} ${gcBadge}</div>
    <div style="margin-top:6px;"><b>Poznámky / Výbava:</b><br><span style="color:var(--muted);">${esc(v.notes) || "Bez poznámek."}</span></div>
    <div style="margin-top:6px;"><b>Hlášené vady:</b><br>${defectsHtml}</div>
  `;

  toggleModal("vehicleDetailModal", true);
}
function closeVehicleDetailModal() { toggleModal("vehicleDetailModal", false); }

/* ---------- User Modal Form CRUD (With Separate Jméno / Příjmení) ---------- */
function openUserModal(id = null) {
  const modal = document.getElementById("userModal");
  const title = document.getElementById("uModalTitle");

  if (id) {
    const u = db.users.find(x => x.id === id);
    if (!u) return;
    title.textContent = `Upravit uživatele: ${u.name}`;
    document.getElementById("muId").value = u.id;
    document.getElementById("muCode").value = u.code || `EMP-${u.id}`;
    document.getElementById("muFirstName").value = u.firstName || u.name.split(" ")[0] || "";
    document.getElementById("muLastName").value = u.lastName || u.name.split(" ").slice(1).join(" ") || "";
    document.getElementById("muEmail").value = u.email;
    document.getElementById("muPhone").value = u.phone || "";
    document.getElementById("muRole").value = u.role;
    document.getElementById("muCanDrive").checked = u.canDrive !== false;
  } else {
    title.textContent = "Přidat nového zaměstnance";
    document.getElementById("muId").value = "";
    document.getElementById("muCode").value = `EMP-${String(db.nextUserId).padStart(3, '0')}`;
    document.getElementById("muFirstName").value = "";
    document.getElementById("muLastName").value = "";
    document.getElementById("muEmail").value = "";
    document.getElementById("muPhone").value = "";
    document.getElementById("muRole").value = "employee";
    document.getElementById("muCanDrive").checked = true;
  }

  toggleModal("userModal", true);
}

function closeUserModal() { toggleModal("userModal", false); }

function saveUserForm(ev) {
  ev.preventDefault();
  const idVal = document.getElementById("muId").value;
  const code = document.getElementById("muCode").value.trim();
  const firstName = document.getElementById("muFirstName").value.trim();
  const lastName = document.getElementById("muLastName").value.trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const email = document.getElementById("muEmail").value.trim();
  const phone = document.getElementById("muPhone").value.trim();
  const role = document.getElementById("muRole").value;
  const canDrive = document.getElementById("muCanDrive").checked;

  if (idVal) {
    const u = db.users.find(x => x.id === Number(idVal));
    if (u) {
      u.code = code; u.firstName = firstName; u.lastName = lastName; u.name = fullName;
      u.email = email; u.phone = phone; u.role = role; u.canDrive = canDrive;
      pushLog("Admin", `Upraven profil uživatele ${u.name} (kód: ${code})`);
    }
  } else {
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      alert("Uživatel s tímto e-mailem již existuje.");
      return false;
    }
    const newId = db.nextUserId++;
    db.users.push({ id: newId, code, firstName, lastName, name: fullName, email, phone, password: "heslo", role, status: "ACTIVE", canDrive, appeal: null });
    pushLog("Admin", `Vytvořen nový profil uživatele ${fullName} (${role})`);
  }

  saveDb();
  closeUserModal();
  renderAll();
  return false;
}

function triggerPasswordReset(email) {
  pushLog("Admin", `Reset hesla vyvolán pro ${email}`);
  pushNotif(email, "Správce vám zaslal odkaz pro resetování hesla.");
  alert(`Instrukce k resetu hesla byly zaslány na ${email}.`);
  saveDb(); renderAll();
}

/* ---------- Defect Reporting & Editing Modal ---------- */
function openReportDefectModal(vehicleId = null) {
  const sel = document.getElementById("rdVehicle");
  sel.innerHTML = db.vehicles.map(v => `<option value="${v.id}">${v.name} (${v.plate})</option>`).join("");
  if (vehicleId) sel.value = vehicleId;
  toggleModal("reportDefectModal", true);
}
function closeReportDefectModal() { toggleModal("reportDefectModal", false); }

function submitDefectForm(ev) {
  ev.preventDefault();
  const vId = Number(document.getElementById("rdVehicle").value);
  const text = document.getElementById("rdText").value.trim();
  const v = vehicleById(vId);

  if (!v) return false;
  if (!v.defects) v.defects = [];

  v.defects.push({
    id: db.nextDefectId++,
    reporterEmail: currentUser ? currentUser.email : "zamestnanec@carside.cz",
    text,
    date: new Date().toISOString(),
    status: "OPEN"
  });

  db.users.filter(u => u.role === "manager").forEach(m => {
    pushNotif(m.email, `⚠️ Nahlášena nová vada u vozidla ${v.name} (${v.plate})`);
  });

  pushLog("Zaměstnanec", `Nahlášena vada u vozidla ${v.name}: ${text}`);
  saveDb();
  closeReportDefectModal();
  alert("Hlášení o vadě bylo úspěšně odesláno správci flotily.");
  renderAll();
  return false;
}

function resolveDefect(vehicleId, defectId) {
  const v = vehicleById(vehicleId);
  if (!v || !v.defects) return;
  const d = v.defects.find(x => x.id === defectId);
  if (d) {
    d.status = "RESOLVED";
    pushLog("Správce", `Vada ID ${defectId} na vozidle ${v.name} označena jako vyřešená`);
    saveDb(); renderAll();
  }
}

function openEditDefectModal(vehicleId, defectId) {
  const v = vehicleById(vehicleId);
  if (!v || !v.defects) return;
  const d = v.defects.find(x => x.id === defectId);
  if (!d) return;

  document.getElementById("edVehicleId").value = vehicleId;
  document.getElementById("edDefectId").value = defectId;
  document.getElementById("edText").value = d.text;
  document.getElementById("edStatus").value = d.status;

  toggleModal("editDefectModal", true);
}
function closeEditDefectModal() { toggleModal("editDefectModal", false); }

function saveDefectEdit(ev) {
  ev.preventDefault();
  const vId = Number(document.getElementById("edVehicleId").value);
  const dId = Number(document.getElementById("edDefectId").value);
  const text = document.getElementById("edText").value.trim();
  const status = document.getElementById("edStatus").value;

  const v = vehicleById(vId);
  if (v && v.defects) {
    const d = v.defects.find(x => x.id === dId);
    if (d) {
      d.text = text;
      d.status = status;
      pushLog("Správce", `Upravena vada ID ${dId} u vozidla ${v.name}`);
    }
  }

  saveDb();
  closeEditDefectModal();
  renderAll();
  return false;
}

function deleteDefect(vehicleId, defectId) {
  if (!confirm("Opravdu chcete smazat tuto hlášenou vadu?")) return;
  const v = vehicleById(vehicleId);
  if (v && v.defects) {
    v.defects = v.defects.filter(x => x.id !== defectId);
    pushLog("Správce", `Smazána vada ID ${defectId} u vozidla ${v.name}`);
    saveDb(); renderAll();
  }
}

/* ---------- Appeal Modal Logic & Admin Appeal Review ---------- */
const APPEAL_MAX_BYTES = 1024 * 1024; // bez databáze se příloha ukládá do LocalStorage prohlížeče → limit 1 MB
let appealPreviewUrl = null;

const readFileAsDataUrl = file => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(fr.result);
  fr.onerror = () => reject(fr.error);
  fr.readAsDataURL(file);
});

function dataUrlToBlob(dataUrl, forcedType) {
  const [head, b64] = dataUrl.split(",");
  const mime = forcedType || (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function formatBytes(n) {
  if (!n) return "";
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} kB` : `${(n / 1048576).toFixed(1)} MB`;
}

function guessMimeFromName(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" })[ext] || "";
}

function openAppealModal() {
  const box = document.getElementById("appealStatusBox");
  document.getElementById("appealMsg").className = "formmsg";
  document.getElementById("apFile").value = "";

  if (currentUser && currentUser.appeal) {
    const ap = currentUser.appeal;
    const stLabel = ap.status === 'APPROVED' ? 'Schváleno (Oprávnění obnoveno)' : ap.status === 'REJECTED' ? 'Zamítnuto' : 'Čeká na vyřízení adminem';
    const fileInfo = ap.file ? ` · Příloha: ${esc(ap.file)}` : "";
    box.innerHTML = `<div style="background:var(--accent-soft); color:var(--accent-ink); padding:8px 10px; border-radius:6px; font-size:12px;"><b>Sledování odvolání:</b> Stav: <b>${stLabel}</b> (Odesláno: ${fmt(ap.date)})${fileInfo}</div>`;
    document.getElementById("apText").value = ap.text;
  } else {
    box.innerHTML = "";
    document.getElementById("apText").value = "";
  }
  toggleModal("appealModal", true);
}
function closeAppealModal() { toggleModal("appealModal", false); }

async function submitAppealForm(ev) {
  ev.preventDefault();
  if (!currentUser) return false;

  const msgEl = document.getElementById("appealMsg");
  const showErr = text => { msgEl.textContent = text; msgEl.className = "formmsg show err"; };
  msgEl.className = "formmsg";

  const text = document.getElementById("apText").value.trim();
  const file = document.getElementById("apFile").files[0] || null;
  let attachment = { file: null, fileType: null, fileSize: 0, fileData: null };

  if (file) {
    if (file.size > APPEAL_MAX_BYTES) {
      showErr(`Příloha je příliš velká (${formatBytes(file.size)}). Maximum je ${formatBytes(APPEAL_MAX_BYTES)} — zmenšete soubor nebo nahrajte sken s nižším rozlišením.`);
      return false;
    }
    try {
      attachment = {
        file: file.name,
        fileType: file.type || guessMimeFromName(file.name) || "application/octet-stream",
        fileSize: file.size,
        fileData: await readFileAsDataUrl(file)
      };
    } catch (e) {
      showErr("Soubor se nepodařilo načíst. Zkuste jej vybrat znovu.");
      return false;
    }
  }

  const previous = currentUser.appeal;
  currentUser.appeal = { text, ...attachment, date: new Date().toISOString(), status: "PENDING" };

  if (!saveDb()) {
    currentUser.appeal = previous;
    showErr("Odvolání se nepodařilo uložit — úložiště prohlížeče je plné. Zkuste menší přílohu.");
    return false;
  }

  db.users.filter(u => u.role === "admin").forEach(a => {
    pushNotif(a.email, `📩 Zaměstnanec ${currentUser.name} podal odvolání k zákazu řízení.`);
  });

  pushLog("Zaměstnanec", `Podáno odvolání k zákazu řízení (${currentUser.name})${attachment.file ? `, příloha: ${attachment.file}` : ""}`);
  saveDb();
  document.getElementById("apFile").value = "";
  closeAppealModal();
  alert("Vaše odvolání bylo odesláno k přezkoumání administrátorovi.");
  renderAll();
  return false;
}

function revokeAppealPreview() {
  if (appealPreviewUrl) { URL.revokeObjectURL(appealPreviewUrl); appealPreviewUrl = null; }
}

function renderAppealAttachment(ap) {
  const box = document.getElementById("adFileBox");
  revokeAppealPreview();

  if (!ap.file) {
    box.innerHTML = `<span class="sub">Žadatel nepřiložil žádnou přílohu.</span>`;
    return;
  }
  if (!ap.fileData) {
    box.innerHTML = `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"><span class="badge pending">${esc(ap.file)}</span></div>
      <p class="sub" style="margin:6px 0 0;">Obsah této přílohy není v systému uložen (starší záznam). Požádejte zaměstnance o opětovné podání odvolání s přílohou.</p>`;
    return;
  }

  let blob;
  try { blob = dataUrlToBlob(ap.fileData, ap.fileType); }
  catch (e) { box.innerHTML = `<span class="sub">Přílohu se nepodařilo otevřít — soubor je poškozený.</span>`; return; }

  appealPreviewUrl = URL.createObjectURL(blob);
  const url = appealPreviewUrl;
  const type = blob.type || "";
  const preview = type.startsWith("image/")
    ? `<img class="ad-preview" src="${url}" alt="Příloha odvolání">`
    : type === "application/pdf"
      ? `<iframe class="ad-preview" src="${url}" title="Příloha odvolání"></iframe>`
      : `<p class="sub" style="margin:8px 0 0;">Pro tento typ souboru není náhled dostupný — stáhněte si jej.</p>`;

  box.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
      <span class="badge confirmed">${esc(ap.file)}</span>
      <span class="sub">${formatBytes(ap.fileSize || blob.size)}</span>
    </div>
    ${preview}
    <div class="ad-file-actions">
      <a class="btn line small" href="${url}" target="_blank" rel="noopener">Otevřít v novém okně</a>
      <a class="btn line small" href="${url}" download="${esc(ap.file)}">Stáhnout</a>
    </div>`;
}

function openAppealDetailModal(userId) {
  const u = db.users.find(x => x.id === userId);
  if (!u || !u.appeal) return;

  document.getElementById("adUserName").textContent = `${u.name} (${u.code || 'EMP-' + u.id})`;
  document.getElementById("adDate").textContent = fmt(u.appeal.date);
  document.getElementById("adText").textContent = u.appeal.text;
  renderAppealAttachment(u.appeal);

  document.getElementById("adApproveBtn").onclick = () => decideAppeal(u.id, true);
  document.getElementById("adRejectBtn").onclick = () => decideAppeal(u.id, false);

  toggleModal("appealDetailModal", true);
}
function closeAppealDetailModal() { revokeAppealPreview(); toggleModal("appealDetailModal", false); }

function decideAppeal(userId, approve) {
  const u = db.users.find(x => x.id === userId);
  if (!u || !u.appeal) return;

  u.canDrive = approve;
  u.appeal.status = approve ? "APPROVED" : "REJECTED";

  pushNotif(u.email, `Vaše odvolání k zákazu řízení bylo administrátorem ${approve ? "SCHVÁLENO (oprávnění k řízení obnoveno)" : "ZAMÍTNUTO"}.`);
  pushLog("Admin", `Odvolání uživatele ${u.name} bylo ${approve ? "SCHVÁLENO" : "ZAMÍTNUTO"}`);

  saveDb();
  closeAppealDetailModal();
  renderAll();
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

  if (currentUser && currentUser.role === "employee") {
    const banBanner = document.getElementById("driverBanBanner");
    const subBtn = document.getElementById("subResBtn");
    if (currentUser.canDrive === false) {
      banBanner.classList.remove("hidden");
      subBtn.disabled = true;
      subBtn.style.opacity = "0.5";
      subBtn.textContent = "Řízení pozastaveno (Nelze rezervovat)";
    } else {
      banBanner.classList.add("hidden");
      subBtn.disabled = false;
      subBtn.style.opacity = "1";
      subBtn.textContent = "Vytvořit rezervaci";
    }
  }

  renderFleetSidebar();
  renderNotifs();
  renderTimetable();
  renderAlertsList();
  renderVehicleSelect();
  renderMyReservations();
  renderPending();
  renderAdminTabs();
  renderFleetTable();
  renderReservationsTable();
  renderStkTab();
  renderDefectsTab();
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

/* ---------- Fleet sidebar: max 5 vozidel, volná nahoře, obsazená podle času uvolnění ---------- */
const SIDEBAR_LIMIT = 5;

function computeFleetStatuses() {
  const now = new Date();
  const list = db.vehicles.map(v => {
    const stkDiff = daysDiffFromNow(v.stkDate);
    const res = db.reservations
      .filter(r => r.vehicleId === v.id && r.status !== "REJECTED")
      .map(r => ({ s: parseIsoLocal(r.start), e: parseIsoLocal(r.end) }))
      .filter(x => x.e > now)
      .sort((a, b) => a.s - b.s);

    if (stkDiff < 0) return { vehicle: v, state: "EXPIRED_STK", rank: 3, sortKey: 0 };

    const active = res.find(x => x.s <= now);
    if (active) {
      // navazující rezervace za sebou → vozidlo je skutečně volné až po poslední z nich
      let freeAt = active.e;
      res.forEach(x => { if (x.s <= freeAt && x.e > freeAt) freeAt = x.e; });
      return { vehicle: v, state: "BUSY", rank: 2, sortKey: freeAt.getTime(), freeAt };
    }
    if (res.length) return { vehicle: v, state: "UPCOMING", rank: 1, sortKey: -res[0].s.getTime(), nextStart: res[0].s };
    return { vehicle: v, state: "FREE", rank: 0, sortKey: 0 };
  });

  return list.sort((a, b) =>
    a.rank - b.rank || a.sortKey - b.sortKey ||
    (a.vehicle.name + a.vehicle.plate).localeCompare(b.vehicle.name + b.vehicle.plate, "cs")
  );
}

function renderFleetSidebar() {
  const el = document.getElementById("fleetList");
  if (!el) return;

  const all = computeFleetStatuses();
  const shown = all.slice(0, SIDEBAR_LIMIT);
  document.getElementById("fleetCount").textContent = all.length > shown.length ? `${shown.length} z ${all.length}` : all.length;

  const nowMs = Date.now();
  const badgeStyle = `style="margin-top:6px; align-self:flex-start"`;

  el.innerHTML = shown.map(item => {
    const v = item.vehicle;
    let badgeHtml = "", extra = "";

    if (item.state === "EXPIRED_STK") {
      badgeHtml = `<span class="badge rejected" ${badgeStyle}><span class="dot"></span>Neplatná STK!</span>`;
    } else if (item.state === "BUSY") {
      const endMs = item.freeAt.getTime();
      badgeHtml = `<span class="badge pending" ${badgeStyle}><span class="dot"></span>Obsazeno <span class="cd-timer" data-type="busy" data-target="${endMs}">(zbývá ${formatRemainingTime(endMs - nowMs)})</span></span>`;
      extra = `<span class="meta">Volné od ${fmtDate(item.freeAt)}</span>`;
    } else if (item.state === "UPCOMING") {
      const startMs = item.nextStart.getTime();
      badgeHtml = `<span class="badge confirmed" ${badgeStyle}><span class="dot"></span>Dostupné <span class="cd-timer" data-type="upcoming" data-target="${startMs}">(pouze ${formatRemainingTime(startMs - nowMs)})</span></span>`;
    } else {
      badgeHtml = `<span class="badge confirmed" ${badgeStyle}><span class="dot"></span>Dostupné</span>`;
    }

    return `<div class="fleetcard" onclick="openVehicleDetailModal(${v.id})" style="cursor:pointer;" title="Klikněte pro detail"><span class="name">${esc(v.name)}</span><span class="meta">${esc(v.type)} · ${esc(v.location)}</span><span class="plate">${esc(v.plate)}</span>${badgeHtml}${extra}</div>`;
  }).join("") || `<div class="empty-note">Žádná vozidla ve flotile.</div>`;

  if (all.length > shown.length) {
    el.insertAdjacentHTML("beforeend", `<div class="empty-note fleet-more">Zobrazeno ${shown.length} nejdostupnějších vozidel z ${all.length}.</div>`);
  }

  startFleetCountdownTimer();
}

/* ---------- Kalendář rezervací (týdenní pohled jako Google Kalendář) ---------- */
const TT_HOUR_H = 44;          // výška jedné hodiny v px (musí odpovídat --tt-hh)
const TT_SLOT_MIN = 30;        // krok výběru termínu
const TT_DEFAULT_MIN = 120;    // délka termínu při pouhém kliknutí
const DAYS_CS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const ttState = { vehicleId: null, overview: false, weekOffset: 0 };
let ttDrag = null;

const canBookFromCalendar = () => !!currentUser && currentUser.role === "employee" && currentUser.canDrive !== false;

function ensureTtVehicle() {
  if (vehicleById(ttState.vehicleId)) return;
  const best = computeFleetStatuses().find(x => x.state !== "EXPIRED_STK") || computeFleetStatuses()[0];
  ttState.vehicleId = best ? best.vehicle.id : null;
}

function ttWeekDays() {
  const base = addDays(startOfWeek(new Date()), ttState.weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(base, i));
}

function ttSetVehicle(val) {
  if (val === "ALL") ttState.overview = true;
  else { ttState.overview = false; ttState.vehicleId = Number(val); }
  renderVehicleSelect();
  renderTimetable();
}
function ttShiftWeek(delta) { ttState.weekOffset += delta; renderTimetable(); }
function ttToday() { ttState.weekOffset = 0; renderTimetable(); }

function onFormVehicleChange() {
  const id = Number(document.getElementById("fVehicle").value);
  if (!vehicleById(id)) return;
  ttState.vehicleId = id;
  ttState.overview = false;
  renderTimetable();
}

function scrollToResForm() {
  document.getElementById("resForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function ttNotice(text, type, withButton = false) {
  document.querySelectorAll(".tt2-notice").forEach(n => {
    n.className = `tt2-notice ${type}`;
    n.innerHTML = `<span>${text}</span>${withButton ? `<button type="button" class="btn confirm small" onclick="scrollToResForm()">Pokračovat k rezervaci ↓</button>` : ""}`;
  });
}

function buildTtToolbar(days) {
  const options = [`<option value="ALL" ${ttState.overview ? "selected" : ""}>Přehled všech vozidel</option>`]
    .concat(db.vehicles.map(v => `<option value="${v.id}" ${!ttState.overview && v.id === ttState.vehicleId ? "selected" : ""}>${esc(v.name)} — ${esc(v.plate)}</option>`))
    .join("");
  const range = `${days[0].getDate()}. ${days[0].getMonth() + 1}. – ${formatCsDate(days[6])}`;
  return `
    <div class="tt2-toolbar">
      <select class="tt2-select" onchange="ttSetVehicle(this.value)" aria-label="Vozidlo v kalendáři">${options}</select>
      <div class="tt2-nav">
        <button type="button" class="cdp-nav" onclick="ttShiftWeek(-1)" title="Předchozí týden" aria-label="Předchozí týden">&lsaquo;</button>
        <button type="button" class="btn line small" onclick="ttToday()">Dnes</button>
        <button type="button" class="cdp-nav" onclick="ttShiftWeek(1)" title="Další týden" aria-label="Další týden">&rsaquo;</button>
      </div>
      <span class="tt2-range">${range}</span>
    </div>
    <div class="tt2-notice hidden"></div>`;
}

function buildOverviewHtml(days) {
  const now = new Date();
  const head = days.map((d, i) => `<div class="tt-col-head${sameDay(d, now) ? " tt-today" : ""}">${DAYS_CS[i]} ${d.getDate()}. ${d.getMonth() + 1}.</div>`).join("");

  const rows = db.vehicles.map(v => {
    const stkEnd = addDays(parseDateOnly(v.stkDate), 1);
    const vRes = db.reservations.filter(r => r.vehicleId === v.id && r.status !== "REJECTED");

    const cells = days.map(d => {
      const ds = startOfDay(d), de = addDays(ds, 1);
      if (ds >= stkEnd) return `<div class="tt-cell tt-blocked" title="Prošlá STK" onclick="ttSetVehicle(${v.id})">STK!</div>`;

      const onDay = vRes.filter(r => overlaps(ds, de, parseIsoLocal(r.start), parseIsoLocal(r.end)));
      if (!onDay.length) return `<div class="tt-cell tt-free" title="Volno" onclick="ttSetVehicle(${v.id})">✓</div>`;

      const allPending = onDay.every(r => r.status === "PENDING");
      const first = esc(onDay[0].employeeName.split(" ")[0]) + (onDay.length > 1 ? ` +${onDay.length - 1}` : "");
      const title = onDay.map(r => `${r.employeeName} (${fmt(r.start)} - ${fmt(r.end)})${r.status === "PENDING" ? " — čeká na schválení" : ""}`).join("\n");
      return `<div class="tt-cell tt-busy${allPending ? " tt-pending" : ""}" title="${esc(title)}" onclick="ttSetVehicle(${v.id})">${first}</div>`;
    }).join("");

    return `<div class="tt-row">
      <div class="tt-vcol" onclick="ttSetVehicle(${v.id})" style="cursor:pointer;" title="Zobrazit kalendář vozidla"><b>${esc(v.name)}</b><span class="sub">${esc(v.plate)}</span></div>
      ${cells}
    </div>`;
  }).join("");

  return `<div class="timetable-wrap"><div class="tt-table"><div class="tt-row tt-header"><div class="tt-vcol">Vozidlo</div>${head}</div>${rows}</div></div>
    <div class="tt2-hint">Kliknutím na vozidlo nebo den otevřete jeho podrobný kalendář.</div>`;
}

function buildCalendarHtml(days) {
  const v = vehicleById(ttState.vehicleId);
  if (!v) return `<div class="empty-note">Žádná vozidla ve flotile.</div>`;

  const H = TT_HOUR_H, now = new Date();
  const canBook = canBookFromCalendar();
  const stkEnd = addDays(parseDateOnly(v.stkDate), 1);   // od tohoto okamžiku je vozidlo zablokováno
  const vRes = db.reservations.filter(r => r.vehicleId === v.id && r.status !== "REJECTED");

  // termín právě vybraný ve formuláři (zobrazí se jako přerušovaný blok)
  let sel = null;
  if (currentUser && currentUser.role === "employee") {
    const fs = parseIsoLocal(getInputValue("fStart")), fe = parseIsoLocal(getInputValue("fEnd"));
    if (fs && fe && fs < fe) sel = { s: fs, e: fe };
  }

  const segment = (s, e, ds, de) => {
    const segS = new Date(Math.max(s, ds)), segE = new Date(Math.min(e, de));
    if (segS >= segE) return null;
    return {
      top: (segS - ds) / 60000 * (H / 60),
      height: Math.max((segE - segS) / 60000 * (H / 60), 20),
      startsHere: s >= ds, endsHere: e <= de
    };
  };

  const head = days.map((d, i) => `<div class="tt2-dayhead${sameDay(d, now) ? " today" : ""}"><span>${DAYS_CS[i]}</span><b>${d.getDate()}</b></div>`).join("");
  const hours = Array.from({ length: 23 }, (_, i) => `<div class="tt2-hour" style="top:${(i + 1) * H}px">${pad(i + 1)}:00</div>`).join("");
  let anyBlocked = false;

  const cols = days.map(d => {
    const ds = startOfDay(d), de = addDays(ds, 1);
    const isToday = sameDay(d, now);
    const blocked = ds >= stkEnd;
    if (blocked) anyBlocked = true;

    let inner = "";
    const pastPx = Math.min(Math.max((now - ds) / 60000 * (H / 60), 0), 24 * H);
    if (pastPx > 0) inner += `<div class="tt2-pastfill" style="height:${pastPx}px"></div>`;

    vRes.forEach(r => {
      const s = parseIsoLocal(r.start), e = parseIsoLocal(r.end);
      const seg = segment(s, e, ds, de);
      if (!seg) return;
      const mine = currentUser && r.employeeEmail === currentUser.email;
      const timeLabel = seg.startsHere && seg.endsHere ? `${hhmm(s)}–${hhmm(e)}` : seg.startsHere ? `od ${hhmm(s)}` : seg.endsHere ? `do ${hhmm(e)}` : "celý den";
      const name = mine ? "Vaše rezervace" : esc(r.employeeName);
      const title = `${r.employeeName} — ${fmt(r.start)} → ${fmt(r.end)} (${statusLabel(r.status)})`;
      inner += `<div class="tt2-ev ${r.status === "PENDING" ? "pending" : "confirmed"}${mine ? " mine" : ""}${seg.startsHere ? "" : " cont-top"}${seg.endsHere ? "" : " cont-bottom"}" style="top:${seg.top}px; height:${seg.height}px" title="${esc(title)}"><span class="n">${name}</span><span class="t">${timeLabel}${r.status === "PENDING" ? " · čeká" : ""}</span></div>`;
    });

    if (sel) {
      const seg = segment(sel.s, sel.e, ds, de);
      if (seg) {
        const label = seg.startsHere && seg.endsHere ? `${hhmm(sel.s)}–${hhmm(sel.e)}` : "Vybraný termín";
        inner += `<div class="tt2-sel" style="top:${seg.top}px; height:${seg.height}px"><span class="n">Vybráno</span><span class="t">${label}</span></div>`;
      }
    }

    if (isToday) inner += `<div class="tt2-now" style="top:${(now - ds) / 60000 * (H / 60)}px"></div>`;

    return `<div class="tt2-daycol${isToday ? " today" : ""}${blocked ? " blocked" : ""}" data-day="${ds.getTime()}">${inner}</div>`;
  }).join("");

  const stkDiff = daysDiffFromNow(v.stkDate);
  const stkBanner = stkDiff < 0
    ? `<div class="formmsg err show">Vozidlo má prošlou STK (${formatCsDate(parseDateOnly(v.stkDate))}) a nelze jej rezervovat.</div>`
    : anyBlocked
      ? `<div class="formmsg err show">STK vozidla platí do ${formatCsDate(parseDateOnly(v.stkDate))} — po tomto dni nelze vozidlo rezervovat (šrafované dny).</div>`
      : "";

  const hint = canBook
    ? `<div class="tt2-hint">Kliknutím do volného místa vyberete termín (${TT_DEFAULT_MIN / 60} h), tažením nastavíte vlastní délku. Delší termíny upravíte ve formuláři níže.</div>`
    : currentUser && currentUser.role === "employee"
      ? `<div class="tt2-hint">Máte pozastavené oprávnění k řízení — kalendář je pouze pro čtení.</div>`
      : "";

  return `${stkBanner}${hint}
    <div class="tt2-scroll${canBook ? "" : " tt2-readonly"}">
      <div class="tt2-inner" style="--tt-hh:${H}px">
        <div class="tt2-head"><div class="tt2-corner"></div>${head}</div>
        <div class="tt2-body"><div class="tt2-times">${hours}</div>${cols}</div>
      </div>
    </div>
    <div class="tt2-legend">
      <span><i class="lg confirmed"></i>Potvrzeno</span>
      <span><i class="lg pending"></i>Čeká na schválení</span>
      ${currentUser && currentUser.role === "employee" ? `<span><i class="lg sel"></i>Vybraný termín</span>` : ""}
      <span><i class="lg blocked"></i>Nelze rezervovat</span>
    </div>`;
}

function renderTimetable() {
  const containers = [document.getElementById("timetableGrid"), document.getElementById("timetableGridManager")].filter(Boolean);
  if (!containers.length) return;

  ensureTtVehicle();
  const days = ttWeekDays();
  const html = buildTtToolbar(days) + (ttState.overview ? buildOverviewHtml(days) : buildCalendarHtml(days));

  containers.forEach(c => {
    const prev = c.querySelector(".tt2-scroll");
    const prevTop = prev ? prev.scrollTop : null;
    const prevLeft = prev ? prev.scrollLeft : 0;
    c.innerHTML = html;

    const sc = c.querySelector(".tt2-scroll");
    if (!sc) return;
    if (prevTop !== null) { sc.scrollTop = prevTop; sc.scrollLeft = prevLeft; }
    else {
      const h = ttState.weekOffset === 0 ? Math.min(Math.max(new Date().getHours() - 2, 6), 14) : 7;
      sc.scrollTop = h * TT_HOUR_H;
    }

    if (canBookFromCalendar()) {
      sc.querySelectorAll(".tt2-daycol:not(.blocked)").forEach(col => {
        col.addEventListener("pointerdown", onTtPointerDown);
        col.addEventListener("pointermove", onTtPointerMove);
        col.addEventListener("pointerup", onTtPointerUp);
        col.addEventListener("pointercancel", onTtPointerCancel);
      });
    }
  });
}

/* --- výběr termínu klikem / tažením --- */
function ttSlotAt(col, clientY) {
  const slots = 24 * 60 / TT_SLOT_MIN;
  const idx = Math.floor((clientY - col.getBoundingClientRect().top) / (TT_HOUR_H * TT_SLOT_MIN / 60));
  return Math.max(0, Math.min(slots - 1, idx));
}

function ttDrawGhost() {
  if (!ttDrag || !ttDrag.moved) return;
  const lo = Math.min(ttDrag.anchor, ttDrag.cur), hi = Math.max(ttDrag.anchor, ttDrag.cur) + 1;
  let g = ttDrag.col.querySelector(".tt2-ghost");
  if (!g) { g = document.createElement("div"); g.className = "tt2-ghost"; ttDrag.col.appendChild(g); }
  const slotPx = TT_HOUR_H * TT_SLOT_MIN / 60;
  const t = n => `${pad(Math.floor(n * TT_SLOT_MIN / 60) % 24)}:${pad(n * TT_SLOT_MIN % 60)}`;
  g.style.top = `${lo * slotPx}px`;
  g.style.height = `${(hi - lo) * slotPx}px`;
  g.innerHTML = `<span class="t">${t(lo)}–${hi * TT_SLOT_MIN >= 1440 ? "24:00" : t(hi)}</span>`;
}

function onTtPointerDown(e) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (e.target.closest(".tt2-ev")) return;
  const col = e.currentTarget;
  const dayStart = new Date(Number(col.dataset.day));
  const idx = ttSlotAt(col, e.clientY);
  if (new Date(dayStart.getTime() + (idx + 1) * TT_SLOT_MIN * 60000) <= new Date()) return;   // minulost
  ttDrag = { col, dayStart, anchor: idx, cur: idx, moved: false, pointerId: e.pointerId };
  try { col.setPointerCapture(e.pointerId); } catch (err) {}
}

function onTtPointerMove(e) {
  if (!ttDrag || e.pointerId !== ttDrag.pointerId) return;
  const idx = ttSlotAt(ttDrag.col, e.clientY);
  if (idx === ttDrag.cur) return;
  ttDrag.cur = idx;
  if (idx !== ttDrag.anchor) ttDrag.moved = true;
  ttDrawGhost();
}

function onTtPointerCancel() {
  if (!ttDrag) return;
  ttDrag.col.querySelector(".tt2-ghost")?.remove();
  ttDrag = null;
}

function onTtPointerUp(e) {
  if (!ttDrag || e.pointerId !== ttDrag.pointerId) return;
  const d = ttDrag;
  ttDrag = null;
  try { d.col.releasePointerCapture(e.pointerId); } catch (err) {}
  const slotsPerDay = 24 * 60 / TT_SLOT_MIN;
  const lo = Math.min(d.anchor, d.cur);
  let hi = Math.max(d.anchor, d.cur) + 1;
  if (!d.moved) hi = Math.min(lo + TT_DEFAULT_MIN / TT_SLOT_MIN, slotsPerDay);
  applyCalendarSelection(d.dayStart, lo, hi);
}

function applyCalendarSelection(dayStart, lo, hi) {
  const v = vehicleById(ttState.vehicleId);
  if (!v || !canBookFromCalendar()) return;

  const step = TT_SLOT_MIN * 60000, now = new Date();
  let start = new Date(dayStart.getTime() + lo * step);
  let end = new Date(dayStart.getTime() + hi * step);
  if (start < now) start = new Date(Math.ceil(now.getTime() / 300000) * 300000);   // začátek v minulosti → nejbližších 5 min
  if (end - start < step) end = new Date(start.getTime() + step);

  document.getElementById("formMsg").className = "formmsg";

  const clash = db.reservations.some(r => r.vehicleId === v.id && r.status !== "REJECTED" && overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end)));
  if (clash) {
    renderTimetable();
    ttNotice("Vybraný termín se kryje s jinou rezervací tohoto vozidla. Zvolte volné místo v kalendáři.", "err");
    return;
  }

  setInputValue("fStart", start);
  setInputValue("fEnd", end);
  renderVehicleSelect();
  renderFleetSidebar();
  renderTimetable();
  ttNotice(`Vybráno: <b>${esc(v.name)}</b>, ${fmtDate(start)} → ${fmtDate(end)}. Termín je předvyplněný ve formuláři.`, "ok", true);
}

/* ---------- Manager Alert List (RED Critical ONLY) ---------- */
function renderAlertsList() {
  const el = document.getElementById("alertsList");
  if (!el) return;

  let redAlertItems = [];

  db.vehicles.forEach(v => {
    const stkDiff = daysDiffFromNow(v.stkDate);
    const gcDiff = daysDiffFromNow(v.greenCardDate);

    if (stkDiff < 0) {
      redAlertItems.push({ type: "STK", text: `<b>${v.name} (${v.plate})</b> má prošlou STK (${formatCsDate(new Date(v.stkDate))})!`, vId: v.id });
    }
    if (gcDiff < 0) {
      redAlertItems.push({ type: "RUČENÍ", text: `<b>${v.name} (${v.plate})</b> má neplatné povinné ručení (${formatCsDate(new Date(v.greenCardDate))})!`, vId: v.id });
    }
    if (v.defects) {
      v.defects.filter(d => d.status === "OPEN").forEach(d => {
        redAlertItems.push({ type: "VADA", text: `<b>${v.name} (${v.plate})</b> — Akutní vada: "${esc(d.text)}" od ${esc(d.reporterEmail)}`, vId: v.id, defectId: d.id });
      });
    }
  });

  document.getElementById("alertCount").textContent = redAlertItems.length;

  if (!redAlertItems.length) {
    el.innerHTML = `<div class="empty-note">✅ Žádná kritická upozornění. Všechna vozidla mají platnou STK, ručení a žádné otevřené vady.</div>`;
    return;
  }

  el.innerHTML = redAlertItems.map(item => `
    <div class="ritem">
      <div>
        <span class="badge rejected" style="margin-right:6px;"><span class="dot"></span>${item.type}</span>
        ${item.text}
      </div>
      <div class="actions">
        ${item.defectId ? `<button class="btn confirm small" onclick="resolveDefect(${item.vId},${item.defectId})">Označit vyřešeno</button>` : `<button class="btn line small" onclick="openVehicleModal(${item.vId})">Upravit dáta</button>`}
      </div>
    </div>
  `).join("");
}

/* ---------- Tab: STK / Ručení (Sorted, Sjednoceno, Odděleno) ---------- */
function setStkFilter(filter) {
  stkActiveFilter = filter;
  ["filterStkAll", "filterStkOnly", "filterGcOnly"].forEach(id => {
    document.getElementById(id)?.classList.remove("active");
  });
  if (filter === 'ALL') document.getElementById("filterStkAll")?.classList.add("active");
  if (filter === 'STK') document.getElementById("filterStkOnly")?.classList.add("active");
  if (filter === 'GC') document.getElementById("filterGcOnly")?.classList.add("active");

  renderStkTab();
}

function renderStkTab() {
  const container = document.getElementById("stkTabList");
  if (!container) return;

  let items = [];

  db.vehicles.forEach(v => {
    const stkDiff = daysDiffFromNow(v.stkDate);
    const gcDiff = daysDiffFromNow(v.greenCardDate);

    if (stkActiveFilter === "ALL" || stkActiveFilter === "STK") {
      let isRed = stkDiff < 0;
      let isOrange = stkDiff >= 0 && stkDiff <= 30;
      if (isRed || isOrange) {
        items.push({
          vId: v.id, vehicleName: v.name, plate: v.plate,
          type: "STK",
          dateStr: formatCsDate(new Date(v.stkDate)),
          diff: stkDiff,
          isRed
        });
      }
    }

    if (stkActiveFilter === "ALL" || stkActiveFilter === "GC") {
      let isRed = gcDiff < 0;
      let isOrange = gcDiff >= 0 && gcDiff <= 30;
      if (isRed || isOrange) {
        items.push({
          vId: v.id, vehicleName: v.name, plate: v.plate,
          type: "Ručení",
          dateStr: formatCsDate(new Date(v.greenCardDate)),
          diff: gcDiff,
          isRed
        });
      }
    }
  });

  items.sort((a, b) => a.diff - b.diff);

  const redItems = items.filter(x => x.isRed);
  const orangeItems = items.filter(x => !x.isRed);

  let html = "";

  if (redItems.length > 0) {
    html += `<div style="margin-top:10px; margin-bottom:6px;"><h3 style="color:var(--red); font-size:14px;">🔴 Prošlé Termíny (Červená prioritní chyba)</h3></div>`;
    html += redItems.map(item => `
      <div class="ritem">
        <div>
          <span class="badge rejected" style="margin-right:6px;"><span class="dot"></span>${item.type}</span>
          <b>${item.vehicleName} (${item.plate})</b> — Vypršelo dne: <code>${item.dateStr}</code> (před ${Math.abs(item.diff)} dny)
        </div>
        <div class="actions">
          <button class="btn line small" onclick="openVehicleModal(${item.vId})">Upravit vozidlo</button>
        </div>
      </div>
    `).join("");
  }

  if (redItems.length > 0 && orangeItems.length > 0) {
    html += `<hr style="border:0; border-top:2px dashed var(--line); margin:18px 0;">`;
  }

  if (orangeItems.length > 0) {
    html += `<div style="margin-top:10px; margin-bottom:6px;"><h3 style="color:var(--amber); font-size:14px;">🟠 Blížící se vypršení platnosti (Oranžové upozornění - do 30 dní)</h3></div>`;
    html += orangeItems.map(item => `
      <div class="ritem">
        <div>
          <span class="badge pending" style="margin-right:6px;"><span class="dot"></span>${item.type}</span>
          <b>${item.vehicleName} (${item.plate})</b> — Termín končí: <code>${item.dateStr}</code> (zbývá ${item.diff} dní)
        </div>
        <div class="actions">
          <button class="btn line small" onclick="openVehicleModal(${item.vId})">Upravit vozidlo</button>
        </div>
      </div>
    `).join("");
  }

  if (!redItems.length && !orangeItems.length) {
    html = `<div class="empty-note">Žádná vozidla nevyžadují v dohledné době řešení STK nebo Povinného ručení.</div>`;
  }

  container.innerHTML = html;
}

/* ---------- Tab: Hlášené vady / Chyby (Rozdělené, Upravitelné) ---------- */
function renderDefectsTab() {
  const container = document.getElementById("defectsTabList");
  if (!container) return;

  let openDefects = [];
  let resolvedDefects = [];

  db.vehicles.forEach(v => {
    if (v.defects) {
      v.defects.forEach(d => {
        const item = { vId: v.id, vehicleName: v.name, plate: v.plate, defect: d };
        if (d.status === "OPEN") openDefects.push(item);
        else resolvedDefects.push(item);
      });
    }
  });

  let html = "";

  if (openDefects.length > 0) {
    html += `<div style="margin-top:10px; margin-bottom:6px;"><h3 style="color:var(--red); font-size:14px;">🔴 Otevřené nevyřešené vady (${openDefects.length})</h3></div>`;
    html += openDefects.map(item => `
      <div class="ritem">
        <div>
          <span class="badge rejected" style="margin-right:6px;"><span class="dot"></span>Otevřená</span>
          <b>${item.vehicleName} (${item.plate})</b>: "${esc(item.defect.text)}"
          <div style="font-size:11px; color:var(--muted); margin-top:2px;">Nahlásil: ${esc(item.defect.reporterEmail)} · ${fmt(item.defect.date)}</div>
        </div>
        <div class="actions">
          <button class="btn confirm small" onclick="resolveDefect(${item.vId}, ${item.defect.id})">Označit vyřešeno</button>
          <button class="btn line small" onclick="openEditDefectModal(${item.vId}, ${item.defect.id})">Upravit</button>
          <button class="btn reject small" onclick="deleteDefect(${item.vId}, ${item.defect.id})">Smazat</button>
        </div>
      </div>
    `).join("");
  }

  if (openDefects.length > 0 && resolvedDefects.length > 0) {
    html += `<hr style="border:0; border-top:2px dashed var(--line); margin:18px 0;">`;
  }

  if (resolvedDefects.length > 0) {
    html += `<div style="margin-top:10px; margin-bottom:6px;"><h3 style="color:var(--accent); font-size:14px;">✅ Vyřešené vady a opravy (${resolvedDefects.length})</h3></div>`;
    html += resolvedDefects.map(item => `
      <div class="ritem" style="opacity:0.75;">
        <div>
          <span class="badge confirmed" style="margin-right:6px;"><span class="dot"></span>Vyřešeno</span>
          <b>${item.vehicleName} (${item.plate})</b>: "${esc(item.defect.text)}"
          <div style="font-size:11px; color:var(--muted); margin-top:2px;">Nahlásil: ${esc(item.defect.reporterEmail)} · ${fmt(item.defect.date)}</div>
        </div>
        <div class="actions">
          <button class="btn line small" onclick="openEditDefectModal(${item.vId}, ${item.defect.id})">Upravit</button>
          <button class="btn reject small" onclick="deleteDefect(${item.vId}, ${item.defect.id})">Smazat</button>
        </div>
      </div>
    `).join("");
  }

  if (!openDefects.length && !resolvedDefects.length) {
    html = `<div class="empty-note">Žádné nahlášené vady v systému.</div>`;
  }

  container.innerHTML = html;
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

  ensureTtVehicle();
  const startVal = getInputValue("fStart"), endVal = getInputValue("fEnd");
  const start = parseIsoLocal(startVal), end = parseIsoLocal(endVal);

  sel.innerHTML = db.vehicles.map(v => {
    const stkDiff = daysDiffFromNow(v.stkDate);
    const isStkExpired = stkDiff < 0;
    const isClashed = (start && end && start < end) && db.reservations.some(r => r.vehicleId === v.id && (r.status === "CONFIRMED" || r.status === "PENDING") && overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end)));

    const disabled = isStkExpired || isClashed;
    const statusText = isStkExpired ? " ❌ (Prošlá STK — Nelze rezervovat)" : isClashed ? " ❌ (Obsazeno v tomto termínu)" : " ✅ (Dostupné)";

    return `<option value="${v.id}" ${disabled ? "disabled" : ""}>${esc(v.name)} — ${esc(v.plate)}${statusText}</option>`;
  }).join("");

  // vybrané vozidlo se drží společně s kalendářem (a nepřeskočí na první položku při změně termínu)
  if (vehicleById(ttState.vehicleId)) sel.value = String(ttState.vehicleId);
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
  const tabFleet = document.getElementById("tabFleet"), tabRes = document.getElementById("tabRes"), tabStk = document.getElementById("tabStk"), tabDefects = document.getElementById("tabDefects");
  if (!tabFleet || !tabRes || !tabStk || !tabDefects) return;

  const activeTab = db.adminTab || "fleet";
  tabFleet.classList.toggle("active", activeTab === "fleet");
  tabRes.classList.toggle("active", activeTab === "res");
  tabStk.classList.toggle("active", activeTab === "stk");
  tabDefects.classList.toggle("active", activeTab === "defects");

  document.getElementById("adminFleet").classList.toggle("hidden", activeTab !== "fleet");
  document.getElementById("adminRes").classList.toggle("hidden", activeTab !== "res");
  document.getElementById("adminStk").classList.toggle("hidden", activeTab !== "stk");
  document.getElementById("adminDefects").classList.toggle("hidden", activeTab !== "defects");
}

function renderFleetTable() {
  const el = document.getElementById("fleetTable");
  if (!el) return;
  el.innerHTML = db.vehicles.map(v => {
    const stkDiff = daysDiffFromNow(v.stkDate);
    const stkBadge = stkDiff < 0 ? `<span class="badge rejected">Prošlá</span>` : formatCsDate(new Date(v.stkDate));
    return `<tr>
      <td><b>${v.name}</b></td>
      <td><code>${v.plate}</code></td>
      <td>${stkBadge}</td>
      <td>${formatCsDate(new Date(v.greenCardDate))}</td>
      <td>${(v.mileage || 0).toLocaleString()} km</td>
      <td>${v.location}</td>
      <td>
        <button class="btn line small" onclick="openVehicleModal(${v.id})">Upravit</button>
        <button class="btn reject small" onclick="removeVehicle(${v.id})">Smazat</button>
      </td>
    </tr>`;
  }).join("");
}

function renderReservationsTable() {
  const el = document.getElementById("resSections");
  if (!el) return;

  const now = new Date();
  const items = db.reservations.map(r => ({ r, s: parseIsoLocal(r.start), e: parseIsoLocal(r.end) }));
  const pending = items.filter(x => x.r.status === "PENDING").sort((a, b) => a.s - b.s);
  const confirmed = items.filter(x => x.r.status === "CONFIRMED");
  const upcoming = confirmed.filter(x => x.e > now).sort((a, b) => a.s - b.s);
  const finished = confirmed.filter(x => x.e <= now).sort((a, b) => b.s - a.s);
  const rejected = items.filter(x => x.r.status === "REJECTED").sort((a, b) => b.s - a.s);

  const cells = x => {
    const v = vehicleById(x.r.vehicleId);
    return `<td>${v ? esc(v.name) : "—"}<br><span class="mono" style="font-size:11px; color:var(--muted);">${v ? esc(v.plate) : ""}</span></td>
      <td>${esc(x.r.employeeName)}</td><td>${fmt(x.r.start)}</td><td>${fmt(x.r.end)}</td>`;
  };
  const badge = r => `<span class="badge ${statusClass(r.status)}"><span class="dot"></span>${statusLabel(r.status)}</span>`;
  const table = (rows, withActions) => `<table class="atable">
      <thead><tr><th>Vozidlo</th><th>Zaměstnanec</th><th>Začátek</th><th>Konec</th><th>Stav</th>${withActions ? "<th>Akce</th>" : ""}</tr></thead>
      <tbody>${rows}</tbody></table>`;
  const section = (title, cls, count, body) => `<section class="res-section">
      <div class="section-head"><h3 class="res-h ${cls}">${title}</h3><span class="count-pill">${count}</span></div>${body}</section>`;

  // 1) čekající na schválení → Schválit / Zamítnout
  const pendingRows = pending.map(x => `<tr>${cells(x)}<td>${badge(x.r)}</td>
      <td><button class="btn confirm small" onclick="managerDecision(${x.r.id}, true)">Schválit</button>
          <button class="btn reject small" onclick="managerDecision(${x.r.id}, false)">Zamítnout</button></td></tr>`).join("");

  // 2) schválené → pouze Zrušit (a jen pokud ještě neskončily)
  const confirmedRows = upcoming.map(x => `<tr>${cells(x)}<td>${badge(x.r)}${x.s <= now ? ` <span class="res-note">probíhá</span>` : ""}</td>
      <td><button class="btn reject small" onclick="managerDecision(${x.r.id}, false, true)">Zrušit</button></td></tr>`).join("")
    + finished.map(x => `<tr class="res-past">${cells(x)}<td>${badge(x.r)} <span class="res-note">proběhlo</span></td><td><span style="color:var(--muted)">—</span></td></tr>`).join("");

  // 3) zamítnuté / zrušené → jen historie
  const rejectedRows = rejected.map(x => `<tr class="res-past">${cells(x)}<td>${badge(x.r)}</td></tr>`).join("");

  el.innerHTML =
    section("⏳ Čekají na schválení", "pending", pending.length,
      pending.length ? table(pendingRows, true) : `<div class="empty-note">Žádné rezervace nečekají na schválení.</div>`) +
    section("✅ Schválené rezervace", "confirmed", confirmed.length,
      confirmed.length ? table(confirmedRows, true) : `<div class="empty-note">Zatím žádné schválené rezervace.</div>`) +
    (rejected.length ? `<details class="res-section res-rejected"><summary><span class="res-h rejected">Zamítnuté a zrušené</span> <span class="count-pill">${rejected.length}</span></summary>${table(rejectedRows, false)}</details>` : "");
}

function renderUsersTable() {
  const el = document.getElementById("usersTable");
  if (!el) return;
  document.getElementById("userCount").textContent = db.users.length;
  el.innerHTML = db.users.map(u => {
    const canDriveBadge = u.canDrive !== false ? `<span class="badge confirmed"><span class="dot"></span>Povoleno</span>` : `<span class="badge rejected"><span class="dot"></span>Zákaz</span>`;

    let appealBadge = `<span style="color:var(--muted)">—</span>`;
    if (u.appeal) {
      const isPending = u.appeal.status === 'PENDING';
      appealBadge = `<button class="btn ${isPending ? 'confirm' : 'line'} small" onclick="openAppealDetailModal(${u.id})">📄 Žádost (${fmt(u.appeal.date)})</button>`;
    }

    return `<tr>
      <td><code>${u.code || 'EMP-' + u.id}</code></td>
      <td><b>${u.name}</b></td>
      <td>${u.email}<br><span style="font-size:11px; color:var(--muted);">${u.phone || ''}</span></td>
      <td>${roleLabel(u.role)}</td>
      <td>${canDriveBadge}</td>
      <td>${appealBadge}</td>
      <td>
        <button class="btn line small" onclick="openUserModal(${u.id})">Upravit</button>
        <button class="btn ghost small" onclick="triggerPasswordReset('${u.email}')">Reset hesla</button>
      </td>
    </tr>`;
  }).join("");
}

function renderLog() {
  document.getElementById("logWrap").classList.toggle("open", db.logOpen);
  document.getElementById("logSub").textContent = `${db.log.length} událostí`;
  const el = document.getElementById("logBody");
  el.innerHTML = db.log.map(l => `<div class="logline"><span class="n">${l.n}</span><span class="actor">${l.actor}</span><span class="txt">${l.text}</span></div>`).join("");
  el.scrollTop = el.scrollHeight;
}

renderAll();

// posun čáry „teď“ v kalendáři (každou minutu, pokud uživatel právě nic nevybírá)
setInterval(() => {
  if (ttDrag || document.activeElement?.closest?.(".tt2-toolbar")) return;
  renderTimetable();
}, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { renderTimetable(); renderFleetSidebar(); } });
