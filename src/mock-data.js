/* ============================================================
   Car-side — Simulated Database Schema & Seed Data
   ============================================================ */

/* Pomocné funkce: ukázkové termíny jsou relativní k aktuálnímu času,
   aby demo (kalendář i seznam vozidel) fungovalo kdykoliv a nebylo celé v minulosti. */
const _pad2 = n => String(n).padStart(2, "0");
const _iso = d => `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}T${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`;
const _inHours = h => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + h); return _iso(d); };
const _onDay = (days, hour) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return _iso(d); };

const INITIAL_DATABASE = {
  adminTab: "fleet",
  users: [
    { id: 1, code: "EMP-001", firstName: "Jana", lastName: "Nováková", name: "Jana Nováková", email: "jana.novakova@carside.cz", phone: "+420 771 123 456", password: "heslo", role: "employee", status: "ACTIVE", canDrive: true, appeal: null },
    { id: 2, code: "EMP-002", firstName: "Petr", lastName: "Dvořák", name: "Petr Dvořák", email: "petr.dvorak@carside.cz", phone: "+420 772 234 567", password: "heslo", role: "employee", status: "ACTIVE", canDrive: false, appeal: { text: "Žádám o opětovné udělení oprávnění k řízení. Lhůta odebrání uplynula a neeviduji žádné přestupky.", file: "potvrzeni_bezuhonnosti.pdf", fileType: "application/pdf", fileSize: 763, fileData: "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAyMTggPj4Kc3RyZWFtCkJUIC9GMSAyMCBUZiA2MCA3NDAgVGQgKFBvdHZyemVuaSBvIGJlenVob25ub3N0aSAtIERFTU8pIFRqIEVUCkJUIC9GMSAxMiBUZiA2MCA3MTAgVGQgKFVrYXprb3ZhIHByaWxvaGEgayBvZHZvbGFuaSAtIFBldHIgRHZvcmFrKSBUaiBFVApCVCAvRjEgMTIgVGYgNjAgNjkwIFRkIChTb3Vib3Igc2xvdXppIHBvdXplIGsgb3Rlc3RvdmFuaSB6b2JyYXplbmkgcHJpbG9oeS4pIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwNTEwIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNTgwCiUlRU9GCg==", date: "2026-09-28T10:00", status: "PENDING" } },
    { id: 3, code: "EMP-003", firstName: "Lucie", lastName: "Horáková", name: "Lucie Horáková", email: "lucie.horakova@carside.cz", phone: "+420 773 345 678", password: "heslo", role: "employee", status: "ACTIVE", canDrive: true, appeal: null },
    { id: 4, code: "MNG-001", firstName: "Martin", lastName: "Kučera", name: "Martin Kučera", email: "martin.kucera@carside.cz", phone: "+420 774 456 789", password: "heslo", role: "manager", status: "ACTIVE", canDrive: true, appeal: null },
    { id: 5, code: "ADM-001", firstName: "Eva", lastName: "Správcová", name: "Eva Správcová", email: "admin@carside.cz", phone: "+420 775 567 890", password: "heslo", role: "admin", status: "ACTIVE", canDrive: true, appeal: null }
  ],
  vehicles: [
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
  ],
  reservations: [
    { id: 1, vehicleId: 2, employeeEmail: "jana.novakova@carside.cz", employeeName: "Jana Nováková", start: _inHours(-2), end: _inHours(5), status: "CONFIRMED" },
    { id: 2, vehicleId: 8, employeeEmail: "petr.dvorak@carside.cz", employeeName: "Petr Dvořák", start: _onDay(2, 8), end: _onDay(6, 17), status: "PENDING" },
    { id: 3, vehicleId: 4, employeeEmail: "lucie.horakova@carside.cz", employeeName: "Lucie Horáková", start: _onDay(1, 9), end: _onDay(1, 15), status: "CONFIRMED" },
    { id: 4, vehicleId: 6, employeeEmail: "martin.kucera@carside.cz", employeeName: "Martin Kučera", start: _inHours(-1), end: _onDay(1, 12), status: "CONFIRMED" },
    { id: 5, vehicleId: 1, employeeEmail: "lucie.horakova@carside.cz", employeeName: "Lucie Horáková", start: _onDay(-3, 8), end: _onDay(-3, 17), status: "CONFIRMED" },
    { id: 6, vehicleId: 7, employeeEmail: "jana.novakova@carside.cz", employeeName: "Jana Nováková", start: _onDay(-1, 8), end: _onDay(-1, 12), status: "REJECTED" },
    { id: 7, vehicleId: 12, employeeEmail: "lucie.horakova@carside.cz", employeeName: "Lucie Horáková", start: _inHours(3), end: _inHours(6), status: "CONFIRMED" }
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
  nextResId: 8,
  nextDefectId: 102,
  logSeq: 1
};