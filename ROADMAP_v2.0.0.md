# Car-side – plán verze 2.0.0 🚀

Tento dokument shrnuje, co chceme ve verzi **2.0.0** změnit a doplnit oproti verzi 1.0.0.
Vývoj probíhá ve větvi `v2.0.0`, opravy chyb ve větvi `bugs`, stabilní verze je v `main`.

**Hlavní cíl verze 2.0.0:** aplikace ukládá všechna data na server do databáze, pravidla ověřuje server
a kód odpovídá navrženým diagramům (architektura, MVC, návrhové vzory).

---

## 1. Ukládání dat na server (CP5 – část 2) 🔴 priorita

Ve verzi 1.0.0 se změny ukládají jen do LocalStorage prohlížeče – jiný prohlížeč nebo počítač je neuvidí
a do `database.sqlite` se nedostanou.

- [ ] Nové REST endpointy v `server/server.js`:
  - [ ] rezervace – `POST /api/reservations`, `PUT /api/reservations/{id}/status` (schválit / zamítnout / zrušit)
  - [ ] vozidla – `POST /api/vehicles`, `PUT /api/vehicles/{id}`, `DELETE /api/vehicles/{id}`
  - [ ] vady – `POST /api/vehicles/{id}/defects`, `PUT` / `DELETE /api/vehicles/{id}/defects/{defectId}`
  - [ ] uživatelé – `POST /api/users`, `PUT /api/users/{id}`
  - [ ] odvolání – `POST /api/users/{id}/appeal`, `PUT /api/users/{id}/appeal` (rozhodnutí)
  - [ ] oznámení a systémový log – `GET /api/notifications`, `GET /api/log`
- [ ] Repozitáře doplnit o metody `create`, `update`, `delete`.
- [ ] Vady a odvolání uložit do samostatných tabulek (místo JSON textu ve sloupci).
- [ ] Klient (`ApiClient` v `src/services.js`) posílá každou změnu na server; LocalStorage už není zdroj dat.
- [ ] Přidat přímou vazbu rezervace → uživatel přes `userId` (místo e-mailu a jména).

## 2. Pravidla a bezpečnost na serveru 🔴 priorita

- [ ] Přihlášení přes server (`POST /api/auth/login`) s tokenem relace.
- [ ] Hesla ukládat zahashovaná (bcrypt / scrypt), ne jako prostý text.
- [ ] Server kontroluje roli u každé akce (zaměstnanec / správce / administrátor).
- [ ] Server ověřuje doménová pravidla (dnes jen v prohlížeči):
  - [ ] rezervace stejného vozidla se nepřekrývají (ADR-02),
  - [ ] zaměstnanec má v jednom čase max. 1 vozidlo,
  - [ ] platná STK, oprávnění k řízení, min. délka 30 minut,
  - [ ] délka > 3 dny → PENDING, jinak CONFIRMED (ADR-03).
- [ ] Chyby vracet se srozumitelnými HTTP kódy (400, 401, 403, 404, 409).

## 3. Kód podle diagramů („udělat web podle diagramu“)

- [ ] **Návrhový vzor State** pro rezervaci podle `diagrams/navrhove_vzory/NV01_State.puml`
  (každý stav jako třída s povolenými přechody místo tabulky `ALLOWED_TRANSITIONS`).
- [ ] **MVC** podle `diagrams/architektura/AR02_MVC_Tridy.puml` – rozdělit `src/app.js` na model, pohledy a controllery.
- [ ] **Observer** (NV03) – pohledy se překreslí samy po změně dat místo ručního volání `renderAll()`.
- [ ] **Adapter** (NV04) – notifikační služba jako rozhraní s adaptérem (in-app / e-mail).
- [ ] Cílové nasazení podle `diagrams/architektura/AR05_Nasazeni_Cilove.puml` – jeden server, který obslouží API i webovou aplikaci.

## 4. Nové funkce (z diagramů případů užití, zatím neimplementované)

- [ ] **Převzetí a vrácení vozidla** – stavy rezervace `IN_PROGRESS` a `COMPLETED`, zápis stavu tachometru.
- [ ] **Úprava a zrušení vlastní rezervace zaměstnancem** (dnes ruší jen správce).
- [ ] **Stav vozidla** (dostupné / v provozu / mimo provoz) podle stavového diagramu STD02.
- [ ] **E-mailové notifikace** přes externí službu (ADR-04).
- [ ] **Historie jízd** a přehled najetých kilometrů.
- [ ] **Elektromobily** (*Future Pressure C*, ADR-05) – stav baterie, minimum 20 % nabití, čas na dobití.

## 5. Kvalita a testy

- [ ] Automatické testy doménových pravidel (rezervace, kolize, stavy).
- [ ] Testy REST API (přihlášení, oprávnění, chybové stavy).
- [ ] Walking skeleton propojit se skutečným kódem serveru.

## 6. Dokumentace a change management

- [ ] Sjednotit stavové diagramy a návrhové vzory s názvy tříd v kódu.
- [ ] Aktualizovat sekvenční a třídní diagramy po přechodu na ukládání přes server.
- [ ] Popsat change management: větve `main` (stabilní) / `bugs` (opravy) / `v2.0.0` (vývoj),
      pull requesty, pojmenování commitů a tagů (`1.0.0`, `2.0.0`).
- [ ] Změnový log (CHANGELOG) mezi verzemi 1.0.0 a 2.0.0.

## 7. Vylepšení UI (návrhy)

- [ ] Vyhledávání a filtrování vozidel (typ, lokalita).
- [ ] Mobilní zobrazení kalendáře.
- [ ] Potvrzovací okna místo systémových `alert` / `confirm`.

---

## Postup vydání 2.0.0

1. Vývoj a commity ve větvi `v2.0.0`.
2. Opravy chyb z větve `bugs` průběžně slučovat do `main` i do `v2.0.0`.
3. Po dokončení bodů 1 a 2 (priorita 🔴) sloučit `v2.0.0` do `main`.
4. Aktualizovat `README.md` a vytvořit release s tagem `2.0.0`.
