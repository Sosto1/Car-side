# Třídní diagramy – Car-side

Třídní diagramy navazují na [sekvenční diagramy SD01–SD10](../sekvencni_diagramy/sekvencni_dokumentace.md)
a jsou vytvořené postupem z přednášky *Software Engineering*:

- **třídy** se hledají v sekvenčních diagramech – každý objekt (`rs:ReservationService`, `fs:FleetService` …) je instancí jedné třídy,
- **operace** třídy = zprávy, které objekt dané třídy v sekvenčních diagramech přijímá (v diagramu jsou ty hlavní),
- **atributy** pochází z dat aplikace ([mock-data.js](../../src/mock-data.js)),
- **vztahy** vyplývají z toho, kdo s kým pracuje (služba spravuje data, rezervace odkazuje na vozidlo a řidiče …).

**Pojmenování:** třídy jsou v diagramech pojmenované **česky**, pod názvem je ve «» uvedeno, jak se třída
jmenuje v kódu. Atributy a metody jsou zapsané přesně podle kódu, aby šly dohledat
a odpovídaly sekvenčním diagramům.

| Diagram | Pohled | Soubor |
|---|---|---|
| TD01 | Třídní diagram systému – služby a data | [TD01_TridniDiagramSystemu.puml](TD01_TridniDiagramSystemu.puml) |
| TD02 | Ukládání a načítání dat – prohlížeč, server, databáze | [TD02_UkladaniDat.puml](TD02_UkladaniDat.puml) |

---

## TD01 – Třídní diagram systému

### Třídy

| Třída v diagramu | Třída v kódu | Soubor | K čemu slouží |
|---|---|---|---|
| **SlužbaRezervací** | `ReservationService` | [services.js](../../src/services.js) | vytvoření rezervace, kontrola kolizí, schválení / zamítnutí / zrušení |
| **SprávaVozidel** | `FleetService` | services.js | přidání, úprava a odebrání vozidla, hlášení a řešení vad |
| **SprávaUživatelů** | `UserService` | services.js | účty uživatelů, odvolání proti zákazu řízení |
| **Přihlášení** | `AuthService` | services.js | přihlášení a obnova hesla |
| **NotifikačníSlužba** | `NotificationService` | services.js | oznámení uživatelům (panel „Oznámení“) |
| **Rezervace** | `Reservation` | [mock-data.js](../../src/mock-data.js) | rezervace vozidla v termínu `start`–`end` |
| **Vozidlo** | `Vehicle` | mock-data.js | vozidlo – SPZ, platnost STK, najeté km |
| **Vada** | `Defect` | mock-data.js | vada nahlášená na vozidle |
| **Uživatel** | `User` | mock-data.js | zaměstnanec / správce / administrátor |
| **Odvolání** | `Appeal` | mock-data.js | žádost o obnovení oprávnění k řízení |

Datové třídy (Rezervace, Vozidlo, Vada, Uživatel, Odvolání) jsou v kódu obyčejné objekty bez metod –
veškerou práci s nimi dělají služby. V diagramu jsou uvedeny jen nejdůležitější atributy.

### Vztahy

| Vztah | Typ | Násobnost | Význam |
|---|---|---|---|
| SlužbaRezervací → Rezervace | asociace | `1` : `0..*` | služba vytváří rezervace a mění jejich stav |
| SprávaVozidel → Vozidlo | asociace | `1` : `0..*` | služba spravuje vozový park |
| SprávaUživatelů → Uživatel | asociace | `1` : `0..*` | služba spravuje účty |
| Přihlášení ⇢ Uživatel | závislost | – | při přihlášení vyhledá uživatele a ověří heslo |
| SlužbaRezervací → SprávaVozidel | asociace | – | `getVehicle()` – zjistí vozidlo a jeho STK |
| služby ⇢ NotifikačníSlužba | závislost «use» | – | posílají oznámení (`send`, `sendToRole`) |
| Rezervace → Vozidlo | asociace | `0..*` : `1` | každá rezervace je na jedno vozidlo (`vehicleId`) |
| Rezervace → Uživatel | asociace | `0..*` : `1` | každá rezervace má jednoho řidiče (`employeeEmail`) |
| Vozidlo ◆— Vada | kompozice | `1` : `0..*` | vady jsou uložené přímo ve vozidle, bez vozidla neexistují |
| Uživatel ◆— Odvolání | kompozice | `1` : `0..1` | uživatel má nejvýš jedno aktuální odvolání |

### Operace a sekvenční diagramy

| Třída | Operace | Sekvenční diagram |
|---|---|---|
| SlužbaRezervací | `create`, `needsApproval` | SD01 |
| | `hasVehicleClash` | SD02 |
| | `approve`, `reject` | SD03 |
| | `cancel` | SD04 |
| Přihlášení | `login`, `requestPasswordReset` | SD05 |
| SprávaVozidel | `reportDefect`, `resolveDefect` | SD06 |
| | `saveVehicle`, `removeVehicle` | SD09 |
| | `getVehicle` | SD01, SD03 |
| SprávaUživatelů | `fileAppeal`, `decideAppeal` | SD07 |
| | `saveUser` | SD08 |
| NotifikačníSlužba | `send`, `sendToRole` | SD01, SD03, SD04, SD06, SD07, SD08 |

Pravidlo stavu rezervace: délka **≤ 3 dny → CONFIRMED**, **> 3 dny → PENDING** (schvaluje správce).
Povolené změny stavu: PENDING → CONFIRMED / REJECTED, CONFIRMED → CANCELLED.

---

## TD02 – Ukládání a načítání dat

| Třída v diagramu | Třída v kódu | Soubor | K čemu slouží |
|---|---|---|---|
| **ÚložištěProhlížeče** | `LocalStore` | [services.js](../../src/services.js) | načtení a uložení dat do LocalStorage prohlížeče |
| **KlientAPI** | `ApiClient` | services.js | načtení dat ze serveru (`GET /api/…`) |
| **Data** | objekt `db` | [app.js](../../src/app.js) | všechna data aplikace v paměti |
| **RepozitářVozidel** | `VehicleRepository` | [server.js](../../server/server.js) | čtení tabulky `vehicles` |
| **RepozitářUživatelů** | `UserRepository` | server.js | čtení tabulky `users` |
| **RepozitářRezervací** | `ReservationRepository` | server.js | čtení a zápis tabulky `reservations` |

Průběh (podrobně v SD10): při startu se data načtou z LocalStorage (ÚložištěProhlížeče),
potom KlientAPI stáhne ze serveru vozidla, uživatele a rezervace a data přepíše.
Server je čte z databáze `database.sqlite` přes repozitáře.

> Změny provedené v aplikaci se ukládají jen do LocalStorage prohlížeče.
> `RepozitářRezervací.create()` (`POST /api/reservations`) na serveru existuje, ale klient ho zatím nevolá.

---

## Výstupy

| Složka | Obsah |
|---|---|
| `*.puml` | zdrojové PlantUML soubory |
| [png/](png/) | rastrové obrázky |
| [svg/](svg/) | vektorové obrázky |
| [pdf/](pdf/) | PDF každého diagramu zvlášť (v plné velikosti) |
| [Tridni_diagramy.pdf](Tridni_diagramy.pdf) | oba diagramy v jednom PDF |
