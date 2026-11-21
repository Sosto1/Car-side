# Sekvenční diagramy (objektová úroveň) – Car-side

Diagramy popisují, **jak skutečně běží kód** webové aplikace – každá zpráva v diagramu odpovídá
volání funkce nebo metody v souborech:

- [src/app.js](../../src/app.js) – uživatelské rozhraní (obsluha formulářů, vykreslování),
- [src/services.js](../../src/services.js) – třídy služeb s pravidly systému,
- [server/server.js](../../server/server.js) – REST API a repozitáře nad databází SQLite.

Postup podle přednášky *Software Engineering* (zpřesněný sekvenční diagram):

1. Z případu užití se vezme scénář (hlavní tok + alternativy).
2. Alternativy se zapíší kombinovanými fragmenty `alt`, `opt`, `loop`, `break`.
3. Místo obecného „Systému“ vystupují **objekty tříd** (`rs:ReservationService`, `fs:FleetService` …),
   zprávy jsou **operace s parametry**, návratové hodnoty jsou kreslené čárkovaně.
4. Opakovaně použitá interakce je vyčleněná do samostatného diagramu a volaná přes `ref` (SD02).
5. Ze zpráv mezi objekty se odvodí operace tříd pro [třídní diagramy](../tridni_diagramy/tridni_dokumentace.md).

Konvence: objekty jsou podtržené ve tvaru `jméno:Třída`. `app.js «UI»` je modul uživatelského rozhraní
(soubor s funkcemi, ne třída), `db «data v paměti»` je sdílený objekt s daty aplikace.

---

## Použité třídy a objekty

| Objekt | Třída / soubor | Role v systému | Operace použité v diagramech |
|---|---|---|---|
| `app.js` «UI» | [src/app.js](../../src/app.js) | Reaguje na akce uživatele, volá služby, ukládá data a překresluje stránku. | `submitReservation`, `managerDecision`, `handleLogin`, `logout`, `handleResetPassword`, `submitDefectForm`, `resolveDefect`, `saveDefectEdit`, `deleteDefect`, `submitAppealForm`, `openAppealDetailModal`, `decideAppeal`, `saveUserForm`, `triggerPasswordReset`, `saveVehicleForm`, `removeVehicle`, `loadDataFromApi`, `renderAll` |
| `rs` | **ReservationService** | Pravidla rezervací: vytvoření, kontrola kolizí, změny stavu. | `create`, `hasVehicleClash`, `hasEmployeeClash`, `isBlocking`, `needsApproval`, `approve`, `reject`, `cancel`, `changeStatus` |
| `fs` | **FleetService** | Vozový park a vady vozidel. | `getVehicle`, `saveVehicle`, `removeVehicle`, `reportDefect`, `findDefect`, `resolveDefect`, `updateDefect`, `deleteDefect` |
| `us` | **UserService** | Uživatelské účty a odvolání proti zákazu řízení. | `getUser`, `saveUser`, `sendPasswordReset`, `fileAppeal`, `decideAppeal` |
| `auth` | **AuthService** | Přihlášení a obnova hesla. | `login`, `findByEmail`, `requestPasswordReset` |
| `ns` | **NotificationService** | Oznámení uživatelům (panel „Oznámení“). | `send`, `sendToRole` |
| `log` | **AuditLog** | Systémový protokol (lišta „Log komunikace“). | `record` |
| `store` | **LocalStore** | Uložení dat do LocalStorage prohlížeče. | `load`, `save`, `createInitial` |
| `api` | **ApiClient** | Načtení dat ze serveru přes REST API. | `loadAll` |
| `server.js` «REST API» | Express aplikace | Endpointy `GET /api/vehicles`, `/api/users`, `/api/reservations`. | `GET /api/…` |
| `repo` | **VehicleRepository**, **UserRepository**, **ReservationRepository** | Čtení tabulek SQLite. | `findAll` |
| `db` | data v paměti (`Database`) | Uživatelé, vozidla, rezervace, oznámení, log. | `reservations`, `users`, `vehicles` (čtení a zápis) |

### Které třídy vystupují ve kterém diagramu

| Diagram | app.js | rs | fs | us | auth | ns | log | store | api | server + repo |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| SD01 Vytvoření rezervace | ✔ | ✔ | ✔ | | | ✔ | ✔ | ✔ | | |
| SD02 Kontrola dostupnosti (ref) | (volající) | ✔ | | | | | | | | |
| SD03 Schválení / zamítnutí | ✔ | ✔ | ✔ | | | ✔ | ✔ | ✔ | | |
| SD04 Zrušení rezervace | ✔ | ✔ | | | | ✔ | ✔ | ✔ | | |
| SD05 Přihlášení a obnova hesla | ✔ | | | | ✔ | | ✔ | | | |
| SD06 Nahlášení a správa vady | ✔ | | ✔ | | | ✔ | ✔ | ✔ | | |
| SD07 Odvolání proti zákazu řízení | ✔ | | | ✔ | | ✔ | ✔ | ✔ | | |
| SD08 Správa účtů | ✔ | | | ✔ | | ✔ | ✔ | ✔ | | |
| SD09 Správa vozidel | ✔ | | ✔ | | | | ✔ | ✔ | | |
| SD10 Načtení dat ze serveru | ✔ | | | | | | | ✔ | ✔ | ✔ |

---

## SD01 – Vytvoření rezervace vozidla
**Soubor:** [SD01_VytvoreniRezervace.puml](SD01_VytvoreniRezervace.puml) · **Use case:** Rezervace – *Vytvořit rezervaci*
**Kód:** `submitReservation()` → `ReservationService.create()`

1. Zaměstnanec odešle formulář, `app.js` zavolá `rs.create(currentUser, vehicleId, start, end)`.
2. Uživatel se zákazem řízení (`canDrive = false`) je odmítnut – zápis „403“ do logu (`break`).
3. `fs.getVehicle()` načte vozidlo; kontroluje se platný termín, platná STK, začátek v budoucnu a délka min. 30 minut (`break`).
4. `ref` **SD02** – kolize s jinou rezervací vozidla nebo zaměstnance (`break`).
5. `needsApproval()` určí stav: **≤ 3 dny → CONFIRMED**, **> 3 dny → PENDING**; rezervace se přidá do `db.reservations`.
6. `alt` notifikace: potvrzení zaměstnanci, nebo upozornění všem správcům + informace zaměstnanci.
7. `app.js` uloží data (`store.save(db)`) a překreslí stránku.

## SD02 – Kontrola dostupnosti vozidla (`ref`)
**Soubor:** [SD02_KontrolaDostupnosti.puml](SD02_KontrolaDostupnosti.puml) · **Use case:** «include» *Ověřit dostupnost vozidla*
**Kód:** `ReservationService.hasVehicleClash()`, `hasEmployeeClash()`, `isBlocking()`

Samostatná interakce volaná z SD01 a z UI (zašednutí obsazených vozidel ve formuláři – `renderVehicleSelect()`,
výběr termínu v kalendáři – `applyCalendarSelection()`). Služba projde v `loop` všechny rezervace v `db`:
počítají se jen blokující (`isBlocking` = *PENDING* nebo *CONFIRMED*) a jejich překryv se testuje
podmínkou `start1 < end2 && start2 < end1`.
- `hasVehicleClash` – pravidlo *rezervace stejného vozidla se nesmí překrývat*,
- `hasEmployeeClash` – pravidlo *1 zaměstnanec = max. 1 vozidlo ve stejném čase*.

## SD03 – Schválení / zamítnutí rezervace správcem
**Soubor:** [SD03_SchvaleniZamitnutiRezervace.puml](SD03_SchvaleniZamitnutiRezervace.puml) · **Use case:** Správa rezervací – *Schválit / zamítnout rezervaci*
**Kód:** `managerDecision(resId, approve)` → `ReservationService.approve()` / `reject()` → `changeStatus()`

Správce klikne v panelu „Ke schválení“. `alt` schválit / zamítnout – obě větve vedou do `changeStatus()`,
která najde rezervaci a ověří přechod podle tabulky `ALLOWED_TRANSITIONS`
(*PENDING → CONFIRMED*, *PENDING → REJECTED*). Nepovolený přechod skončí chybou (`break`).
Jinak se zapíše log, změní stav a zaměstnanec dostane oznámení. `app.js` data uloží a překreslí.

## SD04 – Zrušení rezervace správcem
**Soubor:** [SD04_ZruseniRezervace.puml](SD04_ZruseniRezervace.puml) · **Use case:** Správa rezervací – *Zrušit rezervaci*
**Kód:** `managerDecision(resId, false, true)` → `ReservationService.cancel()` → `changeStatus()`

Správce potvrdí dialog (jinak `break`). Zrušit lze jen potvrzenou rezervaci (*CONFIRMED → CANCELLED*),
jiný stav skončí chybou (`break`). Zrušená rezervace přestane blokovat vozidlo (`isBlocking = false`),
takže termín je hned volný. Zaměstnanec dostane oznámení, rezervace se přesune do sekce „Zamítnuté a zrušené“.

## SD05 – Přihlášení a obnova hesla
**Soubor:** [SD05_PrihlaseniObnovaHesla.puml](SD05_PrihlaseniObnovaHesla.puml) · **Use case:** *Přihlásit se*, *Obnovit heslo*
**Kód:** `handleLogin()`, `logout()`, `handleResetPassword()` → `AuthService`

- **Přihlášení:** `auth.login(email, password)` najde uživatele (`findByEmail`, bez ohledu na velikost písmen)
  a ověří heslo. `alt` špatné údaje → *401* a hláška; správné → *200*, `setSession(user)` uloží e-mail do LocalStorage
  a zobrazí se pohled podle role.
- **Odhlášení:** zápis do logu a smazání relace.
- **Obnova hesla:** `auth.requestPasswordReset(email)` – `alt` neznámý e-mail (*404*) / odeslání instrukcí (*200*).

## SD06 – Nahlášení a správa vady vozidla
**Soubor:** [SD06_NahlaseniVady.puml](SD06_NahlaseniVady.puml) · **Use case:** *Nahlásit vadu*, *Spravovat vady*
**Kód:** `submitDefectForm()`, `resolveDefect()`, `saveDefectEdit()`, `deleteDefect()` → `FleetService`

- **Nahlášení (zaměstnanec):** `fs.reportDefect()` přidá vadu ve stavu *OPEN* k vozidlu, upozorní všechny správce
  (`sendToRole("manager")`) a zapíše log.
- **Vyřešení (správce):** `fs.resolveDefect()` → stav *RESOLVED*, vada zmizí z „Kritických upozornění“.
- **Úprava / smazání (správce):** `alt` `updateDefect()` (text a stav) nebo `deleteDefect()`.

## SD07 – Odvolání proti zákazu řízení
**Soubor:** [SD07_OdvolaniZakazRizeni.puml](SD07_OdvolaniZakazRizeni.puml) · **Use case:** *Podat odvolání*, *Rozhodnout o odvolání*
**Kód:** `submitAppealForm()`, `decideAppeal()` → `UserService.fileAppeal()`, `decideAppeal()`

- **Podání:** příloha max. 1 MB (`break`). `us.fileAppeal(user, appeal, saveDb)` nastaví odvolání (*PENDING*)
  a hned ho uloží; když se uložení nepovede (plné úložiště), vrátí původní stav (`break`).
  Jinak upozorní administrátory a zapíše log.
- **Rozhodnutí:** administrátor otevře žádost s náhledem přílohy a zavolá `us.decideAppeal(userId, approve)`.
  `alt` schváleno → `canDrive = true`, *APPROVED*; zamítnuto → `canDrive = false`, *REJECTED*. Zaměstnanec dostane oznámení.

## SD08 – Správa uživatelských účtů
**Soubor:** [SD08_SpravaUctu.puml](SD08_SpravaUctu.puml) · **Use case:** *Spravovat uživatele*
**Kód:** `saveUserForm()`, `triggerPasswordReset()` → `UserService.saveUser()`, `sendPasswordReset()`

- **Vytvoření / úprava:** `alt` s vyplněným `id` se profil upraví (`getUser` + přepsání údajů);
  bez `id` se kontroluje unikátní e-mail (`break`) a vytvoří se účet s výchozím heslem `heslo`.
  Administrátor zde nastavuje roli a oprávnění k řízení.
- **Reset hesla:** `us.sendPasswordReset(email)` zapíše log a pošle uživateli oznámení s odkazem.

## SD09 – Správa vozového parku
**Soubor:** [SD09_SpravaVozidel.puml](SD09_SpravaVozidel.puml) · **Use case:** *Spravovat vozidla*
**Kód:** `saveVehicleForm()`, `removeVehicle()` → `FleetService.saveVehicle()`, `removeVehicle()`

- **Přidání / úprava:** `alt` s `id` se vozidlo upraví (např. nové datum STK), bez `id` se vytvoří nové bez vad.
- **Odebrání:** po potvrzení dialogu (jinak `break`) se odstraní vozidlo **i všechny jeho rezervace**.

## SD10 – Spuštění aplikace a načtení dat ze serveru
**Soubor:** [SD10_NacteniDatZeServeru.puml](SD10_NacteniDatZeServeru.puml) · **Kód:** `loadDb()`, `loadDataFromApi()` → `ApiClient`, `server.js`

1. `store.load()` – `alt` data z LocalStorage, nebo při prvním spuštění kopie výchozích dat z `mock-data.js`.
2. `api.loadAll()` – v `loop` pro `/vehicles`, `/users`, `/reservations`: `GET /api/…` → repozitář `findAll()`
   → `SELECT` v SQLite → převod JSON sloupců → odpověď *200 OK + JSON*.
3. `alt` server odpověděl → data v `db` se přepíšou daty ze serveru; server nedostupný → aplikace pokračuje s lokálními daty.
4. `renderAll()` vykreslí stránku.

> Změny provedené v aplikaci (SD01–SD09) se ukládají do LocalStorage prohlížeče, ne do SQLite.
> Server zatím slouží jen pro načtení dat; endpoint `POST /api/reservations` existuje, ale klient ho nevolá.

---

## Výstupy

| Složka | Obsah |
|---|---|
| `*.puml` | zdrojové PlantUML soubory |
| [png/](png/) | rastrové obrázky diagramů |
| [svg/](svg/) | vektorové obrázky diagramů |
| [pdf/](pdf/) | PDF každého diagramu zvlášť |
| [Sekvencni_diagramy.pdf](Sekvencni_diagramy.pdf) | všechny diagramy v jednom PDF |
