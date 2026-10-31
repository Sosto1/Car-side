const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Chyba při připojování k DB:', err.message);
    else console.log('Připojeno k SQLite databázi.');
});

// Pomocné funkce pro dynamické datumy (stejné jako v mock-data.js)
const _pad2 = n => String(n).padStart(2, "0");
const _iso = d => `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}T${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`;
const _inHours = h => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + h); return _iso(d); };
const _onDay = (days, hour) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return _iso(d); };

// Vytvoření tabulek a vložení kompletních výchozích dat
db.serialize(() => {
    // 1. Tabulka vozidel
    db.run(`CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        plate TEXT,
        type TEXT,
        location TEXT,
        stkDate TEXT,
        greenCardDate TEXT,
        mileage INTEGER,
        notes TEXT,
        defects TEXT
    )`, () => {
        db.get("SELECT COUNT(*) AS count FROM vehicles", (err, row) => {
            if (row && row.count === 0) {
                console.log("Vkládám výchozí vozidla do databáze...");
                const vehicles = [
                    { id: 1, name: "Škoda Octavia Combi", plate: "4AB 1234", type: "Kombi", location: "Ostrava — centrála", stkDate: "2026-11-20", greenCardDate: "2027-05-15", mileage: 125000, notes: "Drobná oděrka na zadním nárazníku.", defects: [] },
                    { id: 2, name: "Škoda Octavia Combi", plate: "4AB 5678", type: "Kombi", location: "Ostrava — centrála", stkDate: "2026-10-25", greenCardDate: "2026-10-18", mileage: 98000, notes: "Pravidelně servisováno.", defects: [] },
                    { id: 3, name: "Škoda Superb", plate: "1HI 9988", type: "Sedan", location: "Ostrava — centrála", stkDate: "2026-09-15", greenCardDate: "2027-01-10", mileage: 164000, notes: "Prošlá STK! Nutno neprodleně převézt na servis.", defects: [{ id: 101, reporterEmail: "jana.novakova@carside.cz", text: "Nefunkční vyhřívání sedadla řidiče.", date: "2026-09-25T14:30", status: "OPEN" }] },
                    { id: 4, name: "Volkswagen Passat", plate: "3CD 5678", type: "Sedan", location: "Ostrava — centrála", stkDate: "2027-03-20", greenCardDate: "2027-03-20", mileage: 82000, notes: "", defects: [] },
                    { id: 5, name: "Volkswagen Passat", plate: "3CD 9900", type: "Sedan", location: "Brno — pobočka", stkDate: "2026-10-10", greenCardDate: "2026-10-12", mileage: 110000, notes: "STK končí do jednoho měsíce.", defects: [] },
                    { id: 6, name: "Ford Transit Custom", plate: "7EF 9012", type: "Dodávka", location: "Ostrava — servis", stkDate: "2027-08-11", greenCardDate: "2027-08-11", mileage: 210000, notes: "", defects: [] },
                    { id: 7, name: "Ford Transit Custom", plate: "7EF 3411", type: "Dodávka", location: "Praha — pobočka", stkDate: "2027-02-01", greenCardDate: "2027-02-01", mileage: 140000, notes: "", defects: [] },
                    { id: 8, name: "Toyota Corolla", plate: "2GH 3456", type: "Sedan", location: "Praha — pobočka", stkDate: "2027-06-18", greenCardDate: "2027-06-18", mileage: 45000, notes: "Zimní pneumatiky uloženy v kufru.", defects: [] },
                    { id: 9, name: "Toyota Corolla", plate: "2GH 7890", type: "Sedan", location: "Brno — pobočka", stkDate: "2027-04-12", greenCardDate: "2027-04-12", mileage: 62000, notes: "", defects: [] },
                    { id: 10, name: "Dacia Duster", plate: "5IJ 7890", type: "SUV", location: "Brno — pobočka", stkDate: "2027-09-01", greenCardDate: "2027-09-01", mileage: 73000, notes: "", defects: [] },
                    { id: 11, name: "Dacia Duster", plate: "5IJ 1122", type: "SUV", location: "Ostrava — centrála", stkDate: "2026-12-01", greenCardDate: "2026-12-01", mileage: 55000, notes: "", defects: [] },
                    { id: 12, name: "Hyundai i30", plate: "8KL 3344", type: "Hatchback", location: "Praha — pobočka", stkDate: "2027-01-15", greenCardDate: "2027-01-15", mileage: 38000, notes: "", defects: [] }
                ];

                const stmt = db.prepare(`INSERT INTO vehicles (id, name, plate, type, location, stkDate, greenCardDate, mileage, notes, defects) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                vehicles.forEach(v => {
                    stmt.run(v.id, v.name, v.plate, v.type, v.location, v.stkDate, v.greenCardDate, v.mileage, v.notes, JSON.stringify(v.defects));
                });
                stmt.finalize();
            }
        });
    });

    // 2. Tabulka uživatelů
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT,
        firstName TEXT,
        lastName TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        password TEXT,
        role TEXT,
        status TEXT,
        canDrive INTEGER,
        appeal TEXT
    )`, () => {
        db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
            if (row && row.count === 0) {
                console.log("Vkládám výchozí uživatele do databáze...");
                const users = [
                    { id: 1, code: "EMP-001", firstName: "Jana", lastName: "Nováková", name: "Jana Nováková", email: "jana.novakova@carside.cz", phone: "+420 771 123 456", password: "heslo", role: "employee", status: "ACTIVE", canDrive: 1, appeal: null },
                    { id: 2, code: "EMP-002", firstName: "Petr", lastName: "Dvořák", name: "Petr Dvořák", email: "petr.dvorak@carside.cz", phone: "+420 772 234 567", password: "heslo", role: "employee", status: "ACTIVE", canDrive: 0, appeal: JSON.stringify({ text: "Žádám o opětovné udělení oprávnění k řízení...", file: "potvrzeni_bezuhonnosti.pdf", fileType: "application/pdf", fileSize: 763, fileData: "", date: "2026-09-28T10:00", status: "PENDING" }) },
                    { id: 3, code: "EMP-003", firstName: "Lucie", lastName: "Horáková", name: "Lucie Horáková", email: "lucie.horakova@carside.cz", phone: "+420 773 345 678", password: "heslo", role: "employee", status: "ACTIVE", canDrive: 1, appeal: null },
                    { id: 4, code: "MNG-001", firstName: "Martin", lastName: "Kučera", name: "Martin Kučera", email: "martin.kucera@carside.cz", phone: "+420 774 456 789", password: "heslo", role: "manager", status: "ACTIVE", canDrive: 1, appeal: null },
                    { id: 5, code: "ADM-001", firstName: "Eva", lastName: "Správcová", name: "Eva Správcová", email: "admin@carside.cz", phone: "+420 775 567 890", password: "heslo", role: "admin", status: "ACTIVE", canDrive: 1, appeal: null }
                ];

                const stmt = db.prepare(`INSERT INTO users (id, code, firstName, lastName, name, email, phone, password, role, status, canDrive, appeal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                users.forEach(u => {
                    stmt.run(u.id, u.code, u.firstName, u.lastName, u.name, u.email, u.phone, u.password, u.role, u.status, u.canDrive, u.appeal);
                });
                stmt.finalize();
            }
        });
    });

    // 3. Tabulka rezervací
    db.run(`CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicleId INTEGER,
        employeeEmail TEXT,
        employeeName TEXT,
        start TEXT,
        end TEXT,
        status TEXT
    )`, () => {
        db.get("SELECT COUNT(*) AS count FROM reservations", (err, row) => {
            if (row && row.count === 0) {
                console.log("Vkládám výchozí rezervace do databáze...");
                const reservations = [
                    { id: 1, vehicleId: 2, employeeEmail: "jana.novakova@carside.cz", employeeName: "Jana Nováková", start: _inHours(-2), end: _inHours(5), status: "CONFIRMED" },
                    { id: 2, vehicleId: 8, employeeEmail: "petr.dvorak@carside.cz", employeeName: "Petr Dvořák", start: _onDay(2, 8), end: _onDay(6, 17), status: "PENDING" },
                    { id: 3, vehicleId: 4, employeeEmail: "lucie.horakova@carside.cz", employeeName: "Lucie Horáková", start: _onDay(1, 9), end: _onDay(1, 15), status: "CONFIRMED" },
                    { id: 4, vehicleId: 6, employeeEmail: "martin.kucera@carside.cz", employeeName: "Martin Kučera", start: _inHours(-1), end: _onDay(1, 12), status: "CONFIRMED" },
                    { id: 5, vehicleId: 1, employeeEmail: "lucie.horakova@carside.cz", employeeName: "Lucie Horáková", start: _onDay(-3, 8), end: _onDay(-3, 17), status: "CONFIRMED" },
                    { id: 6, vehicleId: 7, employeeEmail: "jana.novakova@carside.cz", employeeName: "Jana Nováková", start: _onDay(-1, 8), end: _onDay(-1, 12), status: "REJECTED" },
                    { id: 7, vehicleId: 12, employeeEmail: "lucie.horakova@carside.cz", employeeName: "Lucie Horáková", start: _inHours(3), end: _inHours(6), status: "CONFIRMED" }
                ];

                const stmt = db.prepare(`INSERT INTO reservations (id, vehicleId, employeeEmail, employeeName, start, end, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                reservations.forEach(r => {
                    stmt.run(r.id, r.vehicleId, r.employeeEmail, r.employeeName, r.start, r.end, r.status);
                });
                stmt.finalize();
            }
        });
    });
});

// --- REST API ENDPOINTY ---

// 1. Vozidla
app.get('/api/vehicles', (req, res) => {
    db.all("SELECT * FROM vehicles", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = rows.map(v => ({ ...v, defects: JSON.parse(v.defects || '[]') }));
        res.json(formatted);
    });
});

// 2. Uživatelé
app.get('/api/users', (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = rows.map(u => ({ 
            ...u, 
            canDrive: Boolean(u.canDrive), 
            appeal: u.appeal ? JSON.parse(u.appeal) : null 
        }));
        res.json(formatted);
    });
});

// 3. Rezervace
app.get('/api/reservations', (req, res) => {
    db.all("SELECT * FROM reservations", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/reservations', (req, res) => {
    const { vehicleId, employeeEmail, employeeName, start, end, status } = req.body;
    const query = `INSERT INTO reservations (vehicleId, employeeEmail, employeeName, start, end, status) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(query, [vehicleId, employeeEmail, employeeName, start, end, status], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, status });
    });
});

// Spuštění serveru
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server běží na http://localhost:${PORT}`);
});