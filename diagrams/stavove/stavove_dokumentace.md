# Stavové diagramy – Car-side

Diagramy jsou kreslené jako **stavový tok** – vedle stavů objektu ukazují i to, **který aktér a jakou akcí
(use case + REST endpoint)** objekt mezi stavy převádí. Odvozené jsou ze [sekvenčních diagramů SD01–SD08](../sekvencni_tridy/sekvencni_dokumentace.md),
stavy odpovídají výčtovým typům z [třídního diagramu TD01](../tridni_diagramy/tridni_dokumentace.md).

| Diagram | Objekt | Odvozeno z | Soubor |
|---|---|---|---|
| STD01 | Rezervace | SD01, SD02, SD03, SD04, SD05 | [STD01_Rezervace.puml](STD01_Rezervace.puml) |
| STD02 | Vozidlo | SD05, SD06 | [STD02_Vozidlo.puml](STD02_Vozidlo.puml) |
| STD03 | Uzivatel – oprávnění k řízení | SD01, SD07, SD08 | [STD03_OpravneniRidice.puml](STD03_OpravneniRidice.puml) |

## Jak diagramy číst

| Prvek | Význam |
|---|---|
| ⬛ černý zaoblený blok | stav objektu, např. `ČEKÁ NA SCHVÁLENÍ (PENDING)` |
| šedý blok nad černým | vedlejší stav (vada, odvolání) + stav, ve kterém objekt zůstává |
| 🟨 žlutý blok | akce **zaměstnance** |
| 🟦 tyrkysový blok | akce **správce vozového parku** |
| 🟪 fialový blok | akce **administrátora** |
| světle modrý blok | **automatická** akce systému |
| ◆ kosočtverec | rozhodnutí aktéra (barva = kdo rozhoduje), popisky hran = volby |
| 🟢 START / 🔴 X | začátek / konec životního cyklu |
| červená hrana | zrušení, zamítnutí nebo chyba |

## Use casy a endpointy

| UC | Akce | Aktér | Endpoint | Diagram |
|---|---|---|---|---|
| UC1 | Vytvořit rezervaci | Zaměstnanec | `POST /reservations` | STD01, STD03 |
| UC2 | Ověřit rezervaci (termín, řidič, STK, dostupnost) | Systém | – | STD01 |
| UC3 | Schválit rezervaci | Správce | `PUT /reservations/{id}/status` | STD01 |
| UC4 | Zamítnout rezervaci | Správce | `PUT /reservations/{id}/status` | STD01 |
| UC5 | Upravit termín rezervace | Zaměstnanec | `PUT /reservations/{id}` | STD01 |
| UC6 | Zrušit rezervaci | Zaměstnanec / Správce | `PATCH /reservations/{id}` | STD01 |
| UC7 | Převzít vozidlo | Zaměstnanec | `POST /reservations/{id}/pickup` | STD01, STD02 |
| UC8 | Vrátit vozidlo | Zaměstnanec | `POST /reservations/{id}/return` | STD01, STD02 |
| UC9 | Přidat vozidlo | Správce | `POST /vehicles` | STD02 |
| UC10 | Nahlásit vadu | Zaměstnanec | `POST /vehicles/{id}/defects` | STD02 |
| UC11 | Kontrola platnosti STK | Systém | – | STD02 |
| UC12 | Vyřešit vadu | Správce | `PATCH /vehicles/{id}/defects/{d}` | STD02 |
| UC13 | Upravit vozidlo (nová STK) | Správce | `PUT /vehicles/{id}` | STD02 |
| UC14 | Odebrat vozidlo | Správce | `DELETE /vehicles/{id}` | STD02 |
| UC15 | Vytvořit účet | Administrátor | `POST /users` | STD03 |
| UC16 | Změnit oprávnění k řízení | Administrátor | `PUT /users/{id}` | STD03 |
| UC17 | Podat odvolání s přílohou | Zaměstnanec | `POST /users/{id}/appeal` | STD03 |
| UC18 | Schválit odvolání | Administrátor | `PATCH /users/{id}/appeal` | STD03 |
| UC19 | Zamítnout odvolání | Administrátor | `PATCH /users/{id}/appeal` | STD03 |

> Současná webová aplikace ([app.js](../../src/app.js)) loguje `POST /reservations`, `PUT /reservations/{id}/status`
> a `POST /auth/...`. Ostatní endpointy jsou návrh REST API pro CP5.

---

## STD01 – Rezervace

1. Zaměstnanec vytvoří rezervaci (**UC1**) → `KONCEPT (DRAFT)`, po `odeslat()` ji systém ověří (**UC2**, SD01/SD02).
2. Systém rozhodne: chyba → rezervace se neuloží; **≤ 3 dny** → `POTVRZENA`; **> 3 dny** → `ČEKÁ NA SCHVÁLENÍ`.
3. Ve stavu *ČEKÁ NA SCHVÁLENÍ* správce schválí (**UC3**) nebo zamítne (**UC4** → `ZAMÍTNUTA`); zaměstnanec může zrušit (**UC6**).
4. Ve stavu *POTVRZENA*:
   - zaměstnanec upraví termín (**UC5**) – systém znovu zkontroluje dostupnost: volno ≤ 3 dny → zůstává potvrzená,
     volno > 3 dny → znovu ke schválení, obsazeno → beze změny,
   - zaměstnanec nebo správce zruší (**UC6** → `ZRUŠENA`),
   - zaměstnanec převezme vozidlo (**UC7** → `PROBÍHÁ`) a vrátí ho (**UC8** → `DOKONČENA`).

## STD02 – Vozidlo

1. Správce přidá vozidlo (**UC9**) → `DOSTUPNÉ`.
2. Zaměstnanec převezme vozidlo (**UC7**) → `V PROVOZU`; při vrácení (**UC8**) systém zkontroluje otevřené vady:
   bez vad → `DOSTUPNÉ`, s vadou → `MIMO PROVOZ`.
3. Vadu lze nahlásit (**UC10**) v obou stavech – stav vozidla se nemění, vada je ve stavu *OPEN*.
4. Systém denně kontroluje STK (**UC11**); prošlá STK → `MIMO PROVOZ`.
5. Ve stavu *MIMO PROVOZ* správce vyřeší vadu (**UC12**) nebo zadá novou STK (**UC13**); bez dalších vad a s platnou STK → `DOSTUPNÉ`.
6. Dostupné vozidlo může správce vyřadit z flotily (**UC14**).

## STD03 – Oprávnění k řízení

1. Administrátor vytvoří účet (**UC15**) a určí, zda uživatel `MŮŽE ŘÍDIT`, nebo má oprávnění `POZASTAVENO`.
2. Uživatel, který může řídit, může rezervovat (**UC1**, STD01). Administrátor mu oprávnění může odebrat (**UC16**).
3. Uživatel s pozastaveným oprávněním podá odvolání (**UC17**); systém zkontroluje přílohu (max. 2 MB) a uloží ho.
4. Administrátor odvolání schválí (**UC18** → `MŮŽE ŘÍDIT`) nebo zamítne (**UC19** → zůstává `POZASTAVENO`).

---

## Vykreslení

Diagramy jsou zapsané v jazyce Graphviz DOT uvnitř PlantUML (`@startdot … @enddot`), protože PlantUML stavový
diagram neumí kosočtverce s popiskem ani barevné bloky aktérů. Vykreslení potřebuje Graphviz:
veřejný PlantUML server (nastavený ve VS Code) ho má, při lokálním vykreslení je třeba nastavit
proměnnou `GRAPHVIZ_DOT` na cestu k `dot.exe`.

| Složka | Obsah |
|---|---|
| `*.puml` | zdrojové soubory |
| [png/](png/) | rastrové obrázky |
| [svg/](svg/) | vektorové obrázky |
| [pdf/](pdf/) | PDF každého diagramu zvlášť |
| [Stavove_diagramy.pdf](Stavove_diagramy.pdf) | všechny diagramy v jednom PDF s legendou |
