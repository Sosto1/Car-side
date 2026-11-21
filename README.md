# Car-side 🚗
> Webový systém pro firemní car-sharing a správu vozového parku.

**Verze 1.0.0** · Projekt vzniká v rámci předmětu Softwarové inženýrství (SWI) na VŠB-TUO.

Car-side řeší rezervaci firemních vozidel zaměstnanci, schvalování delších rezervací správcem vozového parku, kontrolu technického stavu vozidel (STK, povinné ručení, hlášení vad) a správu uživatelských účtů včetně oprávnění k řízení.

---

## ✨ Funkce

**Zaměstnanec**
- rezervace vozidla přes formulář nebo výběrem v týdenním kalendáři obsazenosti,
- rezervace do 3 dnů se potvrdí automaticky, delší čekají na schválení správce,
- kontrola kolizí (vozidlo ani zaměstnanec nemůže mít dvě rezervace ve stejném čase) a platnosti STK,
- nahlášení vady na vozidle,
- odvolání proti zákazu řízení s přílohou.

**Správce vozového parku**
- schválení, zamítnutí a zrušení rezervací,
- správa vozidel (STK, povinné ručení, najeté km),
- kritická upozornění a přehled prošlých / končících STK a ručení,
- správa nahlášených vad.

**Administrátor**
- vše, co správce,
- správa uživatelů, rolí a oprávnění k řízení,
- rozhodování o odvoláních včetně náhledu přílohy.

---

## 🖥️ Spuštění aplikace

Potřeba: **Node.js** a **Python 3**. Spusťte ve dvou terminálech v kořenové složce projektu:

```bash
node server/server.js     # REST API + databáze SQLite na http://localhost:3000
python src/app.py         # webová aplikace na http://localhost:8000 (otevře se v prohlížeči)
```

### Demo účty (heslo u všech: `heslo`)

| Účet | Role | Co vyzkoušet |
|---|---|---|
| `jana.novakova@carside.cz` | Zaměstnanec | tvorba rezervací, hlášení vad |
| `petr.dvorak@carside.cz` | Zaměstnanec se zákazem řízení | odvolání proti zákazu řízení |
| `martin.kucera@carside.cz` | Správce vozového parku | schvalování rezervací, správa vozidel a vad |
| `admin@carside.cz` | Administrátor | správa uživatelů, rozhodování o odvoláních |

### Průchod aplikací
1. **Přihlášení:** vpravo nahoře *Přihlásit se* – lze použít rychlé přihlášení demo profilem.
2. **Vytvoření rezervace:** vyberte vozidlo a termín (formulář nebo tažením v kalendáři). Termín delší než 3 dny čeká na schválení správce.
3. **Pravidla v reálném čase:** kalendář ukazuje obsazenost, boční panel odpočítává čas do uvolnění vozidla, vozidla s prošlou STK nelze vybrat.
4. **Log komunikace:** v dolní liště lze rozbalit protokol systémových událostí.
5. **Obnovit výchozí databázi:** tlačítko pod logem vrátí demo data do původního stavu.

---

## 🏗️ Architektura

```plaintext
Prohlížeč                                           Server (Node.js)
┌───────────────────────────────────────┐          ┌──────────────────────────────┐
│ index.html + app.js   (UI)            │          │ server.js  (Express REST API) │
│        │                              │  HTTP    │   VehicleRepository           │
│        ▼                              │  JSON    │   UserRepository              │
│ services.js  (služby a pravidla)      │ ───────► │   ReservationRepository       │
│   ReservationService, FleetService,   │          │        │                      │
│   UserService, AuthService, …         │          │        ▼                      │
│        │                              │          │ database.sqlite  (SQLite)     │
│        ▼                              │          └──────────────────────────────┘
│ LocalStorage  (ukládání změn)         │
└───────────────────────────────────────┘
```

- **`src/app.js`** – uživatelské rozhraní: obsluha formulářů a vykreslování.
- **`src/services.js`** – pravidla systému ve třídách: `ReservationService` (rezervace, kolize, schvalování), `FleetService` (vozidla, vady), `UserService` (účty, odvolání), `AuthService` (přihlášení), `NotificationService`, `AuditLog`, `LocalStore`, `ApiClient`.
- **`server/server.js`** – REST API (`GET /api/vehicles`, `/api/users`, `/api/reservations`, `POST /api/reservations`) s repozitáři nad databází SQLite.

Podrobně viz [třídní](diagrams/tridni_diagramy/tridni_dokumentace.md) a [sekvenční diagramy](diagrams/sekvencni_diagramy/sekvencni_dokumentace.md).

---

## 📚 Dokumentace projektu

- **[Project Frame & Intent and Change](docs/intent-and-change.md)** – doména, účel systému, stakeholdeři, doménová pravidla, předpoklady a neznámé.
- **[Architecture & Decisions](docs/architecture-and-decisions.md)** – architektonický styl, komponenty a rozhodnutí ADR-01 až ADR-05.
- **[Evidence & Evolution](docs/evidence-and-evolution.md)** – C01 Engineering Spike, definice CP1 Walking Skeleton a roadmapa.
- **[Future Pressure](docs/future-pressure.md)** – rozbor zavedení elektromobilů (kapacita baterie, dobíjení).

**UML diagramy** (složka [diagrams/](diagrams/)):
- [Případy užití](diagrams/usecase-diagram/usecase_dokumentace.md)
- [Sekvenční diagramy](diagrams/sekvencni_diagramy/sekvencni_dokumentace.md) – rezervace, schvalování, vady, odvolání, účty, vozidla, načtení dat (SD01–SD10, [PDF](diagrams/sekvencni_diagramy/Sekvencni_diagramy.pdf))
- [Třídní diagramy](diagrams/tridni_diagramy/tridni_dokumentace.md) – třídní diagram systému a ukládání dat (TD01–TD02, [PDF](diagrams/tridni_diagramy/Tridni_diagramy.pdf))
- [Stavové diagramy](diagrams/stavove/stavove_dokumentace.md) – rezervace, vozidlo, oprávnění řidiče (STD01–STD03, [PDF](diagrams/stavove/Stavove_diagramy.pdf))
- [Aktivitní diagramy](diagrams/aktivitni/) – schvalování, převzetí vozu, správa účtů a vozidel
- [Architektura, MVC a nasazení](diagrams/architektura/architektura_dokumentace.md) (AR01–AR05, [PDF](diagrams/architektura/Architektura_systemu.pdf))
- [Návrhové vzory](diagrams/navrhove_vzory/navrhove_vzory_dokumentace.md) – State, Chain of Responsibility, Observer, Adapter (NV01–NV06, [PDF](diagrams/navrhove_vzory/Navrhove_vzory.pdf))

---

## 🦴 CP1 Walking Skeleton

Samostatný spustitelný prototyp doménového jádra v Pythonu (bez externích knihoven). Ověřuje celý vertikální řez:
**požadavek → doménová validace → změna stavu → perzistence → notifikace → odpověď**.

```bash
python src/walking_skeleton.py
```

Scénář krok za krokem:
1. **Inicializace** in-memory úložiště, mock notifikační služby a dat (Jana, Petr se zákazem řízení, správce Martin, Škoda Octavia a Škoda Superb s prošlou STK).
2. **Standardní rezervace (≤ 3 dny)** – uloží se rovnou jako `CONFIRMED` a odejde potvrzení.
3. **Kolize** – překrývající se rezervace stejného vozu je odmítnuta (`ValueError`).
4. **Zákaz řízení** – Petr rezervaci nevytvoří (`PermissionError`).
5. **Prošlá STK** – vůz Škoda Superb nelze rezervovat.
6. **Rezervace > 3 dny** – uloží se jako `PENDING`, správce ji schválí → `CONFIRMED`.
7. **Storno** – rezervace přejde do `CANCELLED` a termín se uvolní.

Na konci se vypíše `VŠECHNY KONTROLY CP1 WALKING SKELETON ÚSPĚŠNĚ PROBĚHLY (PASS)`.

---

## 📁 Struktura projektu

```plaintext
Car-side/
├── README.md                     # Přehled projektu a návod ke spuštění
├── Todo                          # Seznam úkolů pro další fáze
├── docs/                         # Projektová dokumentace (doména, ADR, roadmapa, future pressure)
├── diagrams/                     # UML diagramy (puml, png, svg, pdf) a jejich dokumentace
│   ├── usecase-diagram/          # Případy užití
│   ├── sekvencni_diagramy/       # Sekvenční diagramy SD01–SD10
│   ├── tridni_diagramy/          # Třídní diagramy TD01–TD02
│   ├── stavove/                  # Stavové diagramy STD01–STD03
│   ├── aktivitni/                # Aktivitní diagramy
│   ├── architektura/             # Architektura, MVC a nasazení AR01–AR05
│   └── navrhove_vzory/           # Návrhové vzory NV01–NV06
├── src/                          # Webová aplikace (klient)
│   ├── index.html                # Uživatelské rozhraní
│   ├── style.css                 # Vzhled
│   ├── app.js                    # Obsluha formulářů a vykreslování
│   ├── services.js               # Služby a pravidla systému
│   ├── mock-data.js              # Výchozí demo data
│   ├── app.py                    # Lokální HTTP server pro webovou aplikaci (port 8000)
│   └── walking_skeleton.py       # CP1 Walking Skeleton
├── server/                       # Backend
│   ├── server.js                 # REST API + repozitáře (port 3000)
│   └── package.json              # Závislosti (express, sqlite3, cors)
└── database.sqlite               # Databáze SQLite (vytvoří a naplní ji server)
```

---

## ⚠️ Známá omezení verze 1.0.0

- Server slouží pro **načtení dat**; změny provedené v aplikaci (rezervace, schválení, vady, uživatelé) se ukládají do **LocalStorage prohlížeče**, ne do databáze.
- Hesla jsou v demo datech uložena jako prostý text a přihlášení se ověřuje na straně klienta.

---

## 🚀 Roadmap

- [x] **CP1:** Walking Skeleton – ověření doménových invariantů, překryvů a notifikací.
- [x] **CP2:** Model rolí a autorizace (zaměstnanec / správce / administrátor).
- [x] **CP3 / CP4:** Webové rozhraní, kalendář obsazenosti, evidence STK a vad, odvolání proti zákazu řízení.
- [x] **CP5 (část 1):** REST API (Node.js + Express) nad databází SQLite – načítání dat.
- [ ] **CP5 (část 2):** Ukládání všech změn přes REST API do databáze.
- [ ] **CP5 (část 3):** Autentizace na serveru (tokeny) a šifrování hesel.
- [ ] **Budoucí rozšíření:** IoT telemetrie (GPS, tachometr) a správa dobíjení elektromobilů dle *Future Pressure C*.
