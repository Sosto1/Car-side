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

function daysDiffFromNow(dateStr) {
  if (!dateStr) return 999;
  const target = new Date(dateStr);
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

function managerDecision(resId, approve) {
  const rec = db.reservations.find(r => r.id === resId);
  if (!rec) return;
  const vehicle = vehicleById(rec.vehicleId);
  pushLog("Správce → API", `PUT /reservations/${resId}/status (akce: ${approve ? "CONFIRM" : "REJECT"})`);
  rec.status = approve ? "CONFIRMED" : "REJECTED";
  pushNotif(rec.employeeEmail, `Vaše rezervace vozidla ${vehicle ? vehicle.name : ""} byla ${approve ? "schválena" : "zamítnuta"}.`);
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
    ? v.defects.map(d => `<div style="background:var(--paper); padding:6px 10px; border-radius:6px; font-size:12px; border-left:3px solid ${d.status === 'OPEN' ? 'var(--red)' : 'var(--accent)'}; margin-top:4px;"><b>${d.status === 'OPEN' ? '⚠️ Otevřená vada' : '✅ Vyřešeno'}:</b> ${d.text} <span style="color:var(--muted)">(${fmt(d.date)})</span></div>`).join("")
    : "<div style='color:var(--muted); margin-top:4px;'>Žádné hlášené vady.</div>";

  document.getElementById("vdTitle").textContent = `${v.name} (${v.plate})`;
  document.getElementById("vdBody").innerHTML = `
    <div><b>Typ / Lokalita:</b> ${v.type} · ${v.location}</div>
    <div><b>Najeté km:</b> ${v.mileage.toLocaleString()} km</div>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">${stkBadge} ${gcBadge}</div>
    <div style="margin-top:6px;"><b>Poznámky / Výbava:</b><br><span style="color:var(--muted);">${v.notes || "Bez poznámek."}</span></div>
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
function openAppealModal() {
  const box = document.getElementById("appealStatusBox");

  if (currentUser && currentUser.appeal) {
    const stLabel = currentUser.appeal.status === 'APPROVED' ? 'Schváleno (Oprávnění obnoveno)' : currentUser.appeal.status === 'REJECTED' ? 'Zamítnuto' : 'Čeká na vyřízení adminem';
    box.innerHTML = `<div style="background:var(--accent-soft); color:var(--accent-ink); padding:8px 10px; border-radius:6px; font-size:12px;"><b>Sledování odvolání:</b> Stav: <b>${stLabel}</b> (Odesláno: ${fmt(currentUser.appeal.date)})</div>`;
    document.getElementById("apText").value = currentUser.appeal.text;
  } else {
    box.innerHTML = "";
    document.getElementById("apText").value = "";
  }
  toggleModal("appealModal", true);
}
function closeAppealModal() { toggleModal("appealModal", false); }

function submitAppealForm(ev) {
  ev.preventDefault();
  if (!currentUser) return false;
  const text = document.getElementById("apText").value.trim();
  const fileInput = document.getElementById("apFile");
  const fileName = fileInput.files.length ? fileInput.files[0].name : "potvrzeni_bezuhonnosti.pdf";

  currentUser.appeal = {
    text,
    file: fileName,
    date: new Date().toISOString(),
    status: "PENDING"
  };

  db.users.filter(u => u.role === "admin").forEach(a => {
    pushNotif(a.email, `📩 Zaměstnanec ${currentUser.name} podal odvolání k zákazů řízení.`);
  });

  pushLog("Zaměstnanec", `Podáno odvolání k zákazu řízení (${currentUser.name})`);
  saveDb();
  closeAppealModal();
  alert("Vaše odvolání bylo odesláno k přezkoumání administrátorovi.");
  renderAll();
  return false;
}

function openAppealDetailModal(userId) {
  const u = db.users.find(x => x.id === userId);
  if (!u || !u.appeal) return;

  document.getElementById("adUserName").textContent = `${u.name} (${u.code || 'EMP-' + u.id})`;
  document.getElementById("adDate").textContent = fmt(u.appeal.date);
  document.getElementById("adText").textContent = u.appeal.text;
  document.getElementById("adFile").textContent = u.appeal.file || "potvrzeni_bezuhonnosti.pdf";

  document.getElementById("adFileBtn").onclick = () => {
    alert(`[Simulované prohlížení / stažení souboru]:\n\nNázev souboru: ${u.appeal.file || "priloha.pdf"}\nOdesílatel: ${u.name}\nObsah přílohy byl ověřen.`);
  };

  document.getElementById("adApproveBtn").onclick = () => decideAppeal(u.id, true);
  document.getElementById("adRejectBtn").onclick = () => decideAppeal(u.id, false);

  toggleModal("appealDetailModal", true);
}
function closeAppealDetailModal() { toggleModal("appealDetailModal", false); }

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

function renderFleetSidebar() {
  const el = document.getElementById("fleetList");
  if (!el) return;
  document.getElementById("fleetCount").textContent = db.vehicles.length;

  const now = new Date();
  const statusList = db.vehicles.map(v => {
    const stkDiff = daysDiffFromNow(v.stkDate);
    const reservations = db.reservations.filter(r => r.vehicleId === v.id && r.status !== "REJECTED");
    const activeRes = reservations.find(r => parseIsoLocal(r.start) <= now && now < parseIsoLocal(r.end));
    const upcomingRes = !activeRes ? reservations.filter(r => parseIsoLocal(r.start) > now).sort((a, b) => parseIsoLocal(a.start) - parseIsoLocal(a.start))[0] : null;

    let state = stkDiff < 0 ? "EXPIRED_STK" : activeRes ? "BUSY" : upcomingRes ? "UPCOMING" : "FREE";
    return { vehicle: v, state, activeRes, upcomingRes, stkDiff };
  });

  const nowMs = Date.now();
  el.innerHTML = statusList.map(item => {
    const v = item.vehicle;
    let badgeHtml = "";

    if (item.state === "EXPIRED_STK") {
      badgeHtml = `<span class="badge rejected" style="margin-top:6px; align-self:flex-start"><span class="dot"></span>Neplatná STK!</span>`;
    } else if (item.state === "BUSY") {
      const endMs = parseIsoLocal(item.activeRes.end).getTime();
      badgeHtml = `<span class="badge pending" style="margin-top:6px; align-self:flex-start"><span class="dot"></span>Obsazeno <span class="cd-timer" data-type="busy" data-target="${endMs}">(zbývá ${formatRemainingTime(endMs - nowMs)})</span></span>`;
    } else if (item.state === "UPCOMING") {
      const startMs = parseIsoLocal(item.upcomingRes.start).getTime();
      badgeHtml = `<span class="badge confirmed" style="margin-top:6px; align-self:flex-start"><span class="dot"></span>Dostupné <span class="cd-timer" data-type="upcoming" data-target="${startMs}">(pouze ${formatRemainingTime(startMs - nowMs)})</span></span>`;
    } else {
      badgeHtml = `<span class="badge confirmed" style="margin-top:6px; align-self:flex-start"><span class="dot"></span>Dostupné</span>`;
    }

    return `<div class="fleetcard" onclick="openVehicleDetailModal(${v.id})" style="cursor:pointer;" title="Klikněte pro detail"><span class="name">${v.name}</span><span class="meta">${v.type} · ${v.location}</span><span class="plate">${v.plate}</span>${badgeHtml}</div>`;
  }).join("") || `<div class="empty-note">Žádná vozidla ve flotile.</div>`;

  startFleetCountdownTimer();
}

function renderTimetable() {
  const containerEmp = document.getElementById("timetableGrid");
  const containerMng = document.getElementById("timetableGridManager");
  const targetContainers = [containerEmp, containerMng].filter(Boolean);
  if (!targetContainers.length) return;

  const today = new Date();
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  let daysHeader = days.map(d => `<div class="tt-col-head">${d.getDate()}. ${d.getMonth() + 1}.</div>`).join("");

  let html = `
    <div class="tt-table">
      <div class="tt-row tt-header">
        <div class="tt-vcol">Vozidlo</div>
        ${daysHeader}
      </div>
  `;

  db.vehicles.forEach(v => {
    const stkDiff = daysDiffFromNow(v.stkDate);
    const vRes = db.reservations.filter(r => r.vehicleId === v.id && r.status !== "REJECTED");

    let daysCells = days.map(d => {
      const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);

      if (stkDiff < 0) {
        return `<div class="tt-cell tt-blocked" title="Prošlá STK">STK!</div>`;
      }

      const activeOnDay = vRes.find(r => overlaps(dayStart, dayEnd, parseIsoLocal(r.start), parseIsoLocal(r.end)));

      if (activeOnDay) {
        return `<div class="tt-cell tt-busy" title="Rezervováno: ${activeOnDay.employeeName} (${fmt(activeOnDay.start)} - ${fmt(activeOnDay.end)})">${activeOnDay.employeeName.split(' ')[0]}</div>`;
      } else {
        return `<div class="tt-cell tt-free" title="Volno">✓</div>`;
      }
    }).join("");

    html += `
      <div class="tt-row">
        <div class="tt-vcol" onclick="openVehicleDetailModal(${v.id})" style="cursor:pointer;" title="Zobrazit detail">
          <b>${v.name}</b>
          <span class="sub">${v.plate}</span>
        </div>
        ${daysCells}
      </div>
    `;
  });

  html += `</div>`;

  targetContainers.forEach(c => c.innerHTML = html);
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
        redAlertItems.push({ type: "VADA", text: `<b>${v.name} (${v.plate})</b> — Akutní vada: "${d.text}" od ${d.reporterEmail}`, vId: v.id, defectId: d.id });
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
          <b>${item.vehicleName} (${item.plate})</b>: "${item.defect.text}"
          <div style="font-size:11px; color:var(--muted); margin-top:2px;">Nahlásil: ${item.defect.reporterEmail} · ${fmt(item.defect.date)}</div>
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
          <b>${item.vehicleName} (${item.plate})</b>: "${item.defect.text}"
          <div style="font-size:11px; color:var(--muted); margin-top:2px;">Nahlásil: ${item.defect.reporterEmail} · ${fmt(item.defect.date)}</div>
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

  const startVal = getInputValue("fStart"), endVal = getInputValue("fEnd");
  const start = parseIsoLocal(startVal), end = parseIsoLocal(endVal);

  sel.innerHTML = db.vehicles.map(v => {
    const stkDiff = daysDiffFromNow(v.stkDate);
    const isStkExpired = stkDiff < 0;
    const isClashed = (start && end && start < end) && db.reservations.some(r => r.vehicleId === v.id && (r.status === "CONFIRMED" || r.status === "PENDING") && overlaps(start, end, parseIsoLocal(r.start), parseIsoLocal(r.end)));

    const disabled = isStkExpired || isClashed;
    const statusText = isStkExpired ? " ❌ (Prošlá STK — Nelze rezervovat)" : isClashed ? " ❌ (Obsazeno v tomto termínu)" : " ✅ (Dostupné)";

    return `<option value="${v.id}" ${disabled ? "disabled" : ""}>${v.name} — ${v.plate}${statusText}</option>`;
  }).join("");
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
  const el = document.getElementById("resTable");
  if (!el) return;
  const list = db.reservations.slice().reverse();
  el.innerHTML = list.map(r => {
    const v = vehicleById(r.vehicleId);
    return `<tr>
      <td>${v ? v.name : "—"}</td>
      <td>${r.employeeName}</td>
      <td>${fmt(r.start)}</td>
      <td>${fmt(r.end)}</td>
      <td><span class="badge ${statusClass(r.status)}"><span class="dot"></span>${statusLabel(r.status)}</span></td>
      <td>
        <button class="btn line small" onclick="managerDecision(${r.id}, true)">Potvrdit</button>
        <button class="btn reject small" onclick="managerDecision(${r.id}, false)">Zrušit</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="empty-note">Žádné rezervace.</td></tr>`;
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