# Architektura systému, MVC a deployment model – Car-side

Přednáška *Software Engineering* popisuje architekturu jako základní uspořádání systému: jeho komponenty, vztahy mezi nimi
a vztah k okolí. Tento dokument ukazuje architekturu na třech úrovních:

| Diagram | Co ukazuje | Stav |
|---|---|---|
| [AR01](AR01_ArchitekturaSystemu.puml) | komponenty celého systému | cílový návrh |
| [AR02](AR02_MVC_Tridy.puml) | MVC třídy webového klienta | cílový návrh |
| [AR03](AR03_MVC_Sekvence.puml) | MVC za běhu při schválení rezervace | cílový návrh |
| [AR04](AR04_Nasazeni_Aktualni.puml) | deployment, jak systém běží dnes | skutečný stav |
| [AR05](AR05_Nasazeni_Cilove.puml) | deployment po dokončení projektu | cílový návrh |

---

## Architektura celého systému (AR01)

Systém má dvě hlavní části. **Webový klient** v prohlížeči se stará o zobrazení a ovládání. **Aplikační server** drží pravidla a data.

| Komponenta | Odpovědnost | Dnes v kódu |
|---|---|---|
| View, Controller, Model klienta | zobrazení, ovládání, data pro obrazovky (MVC) | vše společně v `src/app.js` |
| ApiKlient | jediné místo volání serveru | přímá volání `fetch` v `app.js` |
| REST API | příjem požadavků, převod na JSON | `server/server.js`, 3× GET a 1× POST |
| Doménové jádro | pravidla rezervací, vzory NV01–NV03 | na serveru chybí, pravidla jsou v `app.js`, vzorově ve `walking_skeleton.py` |
| Rozhraní a adaptéry | oddělení domény od databáze a e-mailu (NV04) | `server.js` volá `sqlite3` přímo |
| SQL databáze | trvalé uložení dat | `database.sqlite` |
| E-mailová služba | odesílání upozornění | není, notifikace jsou jen uvnitř aplikace |
| Telemetrie vozidel | automatický odečet km a baterie | budoucí hranice, zatím nerozhodnuto |

Rozdělení serveru odpovídá hexagonální architektuře z [architecture-and-decisions.md](../../docs/architecture-and-decisions.md): doména nezávisí
na databázi ani e-mailu, závisí jen na rozhraních `Databaze` a `NotifikacniSluzba` (ADR-01, ADR-04).

---

## MVC třídy (AR02, AR03)

Podle přednášky lze každou aplikaci rozdělit na doménový model a uživatelské rozhraní. MVC k tomu přidává tři role:

- **Model** drží stav a chování.
- **View** zobrazuje aktuální stav Modelu.
- **Controller** převádí akce uživatele na volání Modelu.

| Přednáška | Car-side | Role |
|---|---|---|
| `Model` | `Model` | správa pozorovatelů, `addObserver()`, `removeObserver()`, `notify()` |
| `View` | `View` | `update()`, `display()` |
| `Controller` | `Controller` | v přednášce `mouseClicked()`, `keyPressed()`; na webu `onSubmit()`, `onClick()` |
| `Counter` | `RezervaceModel` | konkrétní data a operace |
| `CounterView` | `KalendarView`, `MojeRezervaceView`, `SchvalovaniView` | konkrétní obrazovky |
| `CounterController` | `RezervaceController` | obsluha akcí v části rezervací |

`ApiKlient` v přednášce nemá protějšek. Přidává ho rozdělení na klienta a server: Model získává data ze serveru, ne z paměti.
Části vozidla a uživatelé mají stejnou strukturu a v diagramu nejsou, aby zůstal čitelný.

### Průběh akce (AR03)

1. Správce klikne na *Schválit* a `RezervaceController` zavolá `model.schvalit(id)`.
2. `RezervaceModel` zavolá přes `ApiKlient` server. Ten zpracuje schválení podle [NV06](../navrhove_vzory/NV06_Sekvence_SchvaleniRezervace.puml).
3. Model si uloží výsledek nebo chybu a zavolá `notify()`.
4. Každé přihlášené View se samo obnoví: `update()` → `display()` → načtení dat z Modelu.

Controller tedy nevykresluje a Model nezná konkrétní obrazovky. Novou obrazovku stačí přihlásit přes `addObserver()`.

### Vztah k vzoru Observer

Mechanismus `notify()` / `update()` je vzor Observer na dvou místech s různým účelem:

| | Kde běží | Kdo je pozorován | Kdo reaguje |
|---|---|---|---|
| [NV03](../navrhove_vzory/NV03_Observer.puml) | server | doménová `Rezervace` | e-mail, protokol |
| AR02 | prohlížeč | `RezervaceModel` | obrazovky |

Server nemůže přímo volat obrazovky v prohlížeči, proto jde o dvě oddělené vazby. Klient se o změně dozví z odpovědi na svůj požadavek.

### Současný `app.js` a třídy MVC

`app.js` má části MVC už dnes, jen jako volné funkce v jednom souboru:

| Role | Funkce v `src/app.js` | Cílová třída |
|---|---|---|
| Model | `db`, `loadDb()`, `saveDb()`, `computeFleetStatuses()` | `RezervaceModel` a modely dalších částí |
| Model (server) | `loadDataFromApi()` | `ApiKlient` |
| View | `renderTimetable()` | `KalendarView` |
| View | `renderMyReservations()` | `MojeRezervaceView` |
| View | `renderPending()` | `SchvalovaniView` |
| Controller | `submitReservation()`, `managerDecision()` | `RezervaceController` |
| Controller | `handleLogin()`, `saveVehicleForm()`, `saveUserForm()`, `submitDefectForm()`, `submitAppealForm()`, `decideAppeal()` | controllery dalších částí |
| ruční `notify()` | `renderAll()` volané po každé akci | `Model.notify()` |

---

## Deployment model (AR04, AR05)

Deployment diagram podle přednášky ukazuje rozložení běhových prvků na hardwaru. Používá stejné stereotypy uzlů jako příklad
v přednášce: `«workstation»`, `«network»`, `«application server»` a `«SQL server»`.

### Současný stav (AR04)

| Uzel | Spuštění | Port | Úloha |
|---|---|---|---|
| Webový prohlížeč | otevře se sám po startu `app.py` | – | běží v něm aplikace, data drží v `localStorage` |
| Python | `python src/app.py` | 8000 | posílá statické soubory ze `src/` |
| Node.js | `node .\server\server.js` z kořene projektu | 3000 | REST API nad `database.sqlite` |

Databáze je soubor na stejném počítači. Protože se soubory a API načítají z různých portů, server musí povolovat CORS.

### Cílový stav (AR05)

| Uzel | Stereotyp | Obsah |
|---|---|---|
| Počítače uživatelů | `«workstation»` | webový prohlížeč |
| LAN firmy | `«network»` | přístup k aplikaci přes HTTPS |
| Aplikační server | `«application server»` | soubory klienta, Node.js, REST API, doménové jádro |
| Databázový server | `«SQL server»` | PostgreSQL podle plánu CP5 v README |
| Internet | `«network»` | cesta k externí službě |
| E-mailová služba | `«external system»` | odesílání upozornění, výpadek neblokuje rezervace (ADR-04) |

Předpoklad: aplikaci používají zaměstnanci ve firemní síti. Přístup z internetu by vyžadoval přidat VPN nebo veřejnou adresu aplikačního serveru.

### Co chybí k cílovému stavu

Zjištěno čtením kódu, server nebyl spuštěn.

| Oblast | Současný stav | Co je potřeba |
|---|---|---|
| Zápis dat | `app.js` volá jen tři `GET`, změny zůstávají v `localStorage` a po obnovení stránky je přepíšou data z API | volat API i pro zápis |
| API | chybí změna stavu, vady, odvolání, uživatelé a vozidla | doplnit endpointy |
| Pravidla | `POST /api/reservations` uloží libovolná data včetně `status` | přesunout kontroly a stavy na server |
| Bezpečnost | `GET /api/users` vrací bez přihlášení i hesla, ta jsou uložená v čitelné podobě | přihlášení, hashování hesel, nevracet je z API |
| Konfigurace | adresa `http://localhost:3000` je natvrdo v `app.js`, CORS je povolený všem | adresa z konfigurace, omezení CORS |
| Repozitář | `node_modules` a `database.sqlite` jsou v gitu | přidat do `.gitignore` |
| E-mail | žádné odesílání neexistuje | doplnit `EmailNotifikace` |

---

## Výstupy

| Složka | Obsah |
|---|---|
| `*.puml` | zdrojové PlantUML soubory |
| [png/](png/) | rastrové obrázky |
| [svg/](svg/) | vektorové obrázky |
| [pdf/](pdf/) | PDF každého diagramu zvlášť |
| [Architektura_systemu.pdf](Architektura_systemu.pdf) | všechny diagramy v jednom PDF |
