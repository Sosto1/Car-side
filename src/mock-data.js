/* ============================================================
   Car-side — Simulated Database Schema & Seed Data
   ============================================================ */

const INITIAL_DATABASE = {
  adminTab: "fleet",
  users: [
    { id: 1, name: "Jana Nováková", email: "jana.novakova@carside.cz", password: "heslo", role: "employee", status: "ACTIVE" },
    { id: 2, name: "Petr Dvořák", email: "petr.dvorak@carside.cz", password: "heslo", role: "employee", status: "ACTIVE" },
    { id: 3, name: "Lucie Horáková", email: "lucie.horakova@carside.cz", password: "heslo", role: "employee", status: "ACTIVE" },
    { id: 4, name: "Martin Kučera", email: "martin.kucera@carside.cz", password: "heslo", role: "manager", status: "ACTIVE" },
    { id: 5, name: "Eva Správcová", email: "admin@carside.cz", password: "heslo", role: "admin", status: "ACTIVE" }
  ],
  vehicles: [
    { id: 1, name: "Škoda Octavia Combi", plate: "4AB 1234", type: "Kombi", location: "Ostrava — centrála" },
    { id: 2, name: "Škoda Octavia Combi", plate: "4AB 5678", type: "Kombi", location: "Ostrava — centrála" },
    { id: 3, name: "Škoda Superb", plate: "1HI 9988", type: "Sedan", location: "Ostrava — centrála" },
    { id: 4, name: "Volkswagen Passat", plate: "3CD 5678", type: "Sedan", location: "Ostrava — centrála" },
    { id: 5, name: "Volkswagen Passat", plate: "3CD 9900", type: "Sedan", location: "Brno — pobočka" },
    { id: 6, name: "Ford Transit Custom", plate: "7EF 9012", type: "Dodávka", location: "Ostrava — servis" },
    { id: 7, name: "Ford Transit Custom", plate: "7EF 3411", type: "Dodávka", location: "Praha — pobočka" },
    { id: 8, name: "Toyota Corolla", plate: "2GH 3456", type: "Sedan", location: "Praha — pobočka" },
    { id: 9, name: "Toyota Corolla", plate: "2GH 7890", type: "Sedan", location: "Brno — pobočka" },
    { id: 10, name: "Dacia Duster", plate: "5IJ 7890", type: "SUV", location: "Brno — pobočka" },
    { id: 11, name: "Dacia Duster", plate: "5IJ 1122", type: "SUV", location: "Ostrava — centrála" },
    { id: 12, name: "Hyundai i30", plate: "8KL 3344", type: "Hatchback", location: "Praha — pobočka" }
  ],
  reservations: [
    { id: 1, vehicleId: 2, employeeEmail: "jana.novakova@carside.cz", employeeName: "Jana Nováková", start: "2026-09-27T08:00", end: "2026-09-27T17:00", status: "CONFIRMED" },
    { id: 2, vehicleId: 8, employeeEmail: "petr.dvorak@carside.cz", employeeName: "Petr Dvořák", start: "2026-09-28T08:00", end: "2026-10-02T17:00", status: "PENDING" }
  ],
  notifications: [
    { who: "jana.novakova@carside.cz", text: "Rezervace vozidla Škoda Octavia Combi byla automaticky potvrzena.", t: new Date().toISOString() },
    { who: "martin.kucera@carside.cz", text: "Nová rezervace ke schválení: Toyota Corolla (Petr Dvořák).", t: new Date().toISOString() }
  ],
  log: [
    { n: 1, actor: "Systém", text: "Inicializace aplikace — databáze načtena" }
  ],
  nextUserId: 6,
  nextVehicleId: 13,
  nextResId: 3,
  logSeq: 1
};