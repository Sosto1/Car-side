# Třídní diagramy – Car-side

Třídní diagramy navazují na [sekvenční diagramy SD01–SD08](../sekvencni_tridy/sekvencni_dokumentace.md)
a jsou vytvořené postupem z přednášky *Software Engineering*:

- **třídy** se hledají v sekvenčních diagramech – každý objekt (`r:Rezervace`, `v:Vozidlo` …) je instancí jedné třídy,
- **operace** třídy = zprávy, které objekt dané třídy v sekvenčních diagramech přijímá,
- **atributy** pochází z problémové domény a z kódu ([walking_skeleton.py](../../src/walking_skeleton.py), [mock-data.js](../../src/mock-data.js)),
- **vztahy** vyplývají z toho, kdo komu posílá zprávy (objekt může poslat zprávu jen tomu, s kým má vazbu).

| Diagram | Pohled | Soubor |
|---|---|---|
| TD01 | Doménový model (analýza) | [TD01_DomenovyModel.puml](TD01_DomenovyModel.puml) |
| TD02 | Role, rozhraní a rozšíření (návrh) | [TD02_RoleRozhrani.puml](TD02_RoleRozhrani.puml) |
| TD03 | Balíčkový diagram | [TD03_Balicky.puml](TD03_Balicky.puml) |

---

## TD01 – Doménový model

Obsahuje jen 7 navzájem propojených tříd ze sekvenčních diagramů (`Rezervace`, `Uzivatel`, `Vozidlo`, `Vada`,
`Odvolani`, `Databaze`, `NotifikacniSluzba`) s nejdůležitějšími atributy. Výčtové typy a datový typ `Soubor`
nejsou kresleny jako samostatné bloky – vystupují jen jako typy atributů a jejich hodnoty jsou uvedené níže.

| Vztah | Typ | Násobnost | Proč |
|---|---|---|---|
| Rezervace → Uzivatel (*ridic*) | asociace | `0..*` : `1` | každá rezervace má právě jednoho řidiče, řidič může mít více rezervací (ne ve stejném čase) |
| Rezervace → Vozidlo (*vozidlo*) | asociace | `0..*` : `1` | rezervace se týká jednoho vozidla, vozidlo má více rezervací v různých termínech |
| Vozidlo ◆— Vada | kompozice | `1` : `0..*` | vada nemůže existovat bez vozidla, vzniká přes `Vozidlo.nahlasVadu()` (SD06) |
| Uzivatel ◆— Odvolani | kompozice | `1` : `0..1` | uživatel má nejvýš jedno aktuální odvolání, vzniká přes `Uzivatel.podatOdvolani()` (SD07) |
| Databaze ◇— Uzivatel / Vozidlo / Rezervace | agregace | `1` : `0..*` | databáze objekty sdružuje, ale nevlastní je výhradně (jako `CarDatabase ◇ Car` v přednášce) |
| Rezervace / Uzivatel / Vozidlo ⇢ NotifikacniSluzba | závislost «use» | – | jen volají `odeslat()`, neuchovávají si ji (fire-and-forget, ADR-04) |

Typy použité u atributů:

| Typ | Hodnoty |
|---|---|
| `StavRezervace` | DRAFT, PENDING, CONFIRMED, REJECTED, CANCELLED, IN_PROGRESS, COMPLETED |
| `StavVozidla` | DOSTUPNE, V_PROVOZU, MIMO_PROVOZ |
| `StavVady` | OPEN, RESOLVED |
| `StavOdvolani` | PENDING, APPROVED, REJECTED |
| `Role` | EMPLOYEE, MANAGER, ADMIN |
| `Kolize` (výsledek SD02) | ZADNA, VOZIDLO, RIDIC |
| `Soubor` | příloha odvolání – název, typ, velikost (max. 2 MB), data |

Invarianty rezervace: aktivní rezervace téhož vozidla se nepřekrývají, řidič má v jednom čase max. 1 vozidlo,
délka ≤ 3 dny → CONFIRMED, jinak PENDING.

### Kontrola: zprávy ze sekvenčních diagramů → operace tříd

| Třída | Operace | Použito v |
|---|---|---|
| Rezervace | `«create»`, `odeslat`, `jeTerminPlatny`, `delkaDni`, `potvrdit`, `cekatNaSchvaleni` | SD01 |
| | `jeDostupne`, `prekryvaSe` | SD02 |
| | `schvalit`, `zamitnout` | SD03 |
| | `muzeMenit`, `zmenitTermin`, `zrusit` | SD04 |
| | `prevzit`, `vratit` | SD05 |
| Uzivatel | `muzeRidit` | SD01 |
| | `jeSpravce` | SD04 |
| | `podatOdvolani`, `getOdvolani`, `rozhodnoutOdvolani` | SD07 |
| | `«create»`, `nastavRoli`, `nastavOpravneni`, `resetovatHeslo`, `vygenerujToken` | SD08 |
| Vozidlo | `maPlatnouSTK` | SD01 |
| | `zapisStav`, `nastavStav`, `maOtevreneVady` | SD05 |
| | `nahlasVadu`, `pridejVadu`, `getOtevreneVady` | SD06 |
| Vada | `«create»`, `vyresit` | SD06 |
| Odvolani | `«create»`, `getPriloha`, `schvalit`, `zamitnout` | SD07 |
| Databaze | `najdiVozidlo`, `ulozRezervaci`, `najdiUzivatele(role)` | SD01, SD05, SD06, SD07 |
| | `najdiAktivniRezervace` | SD02 |
| | `najdiRezervace(stav)`, `najdiRezervace(u)` | SD03, SD04 |
| | `ulozVozidlo` | SD06 |
| | `ulozUzivatele`, `existujeEmail`, `najdiUzivatele(email)` | SD07, SD08 |
| NotifikacniSluzba | `odeslat` | SD01, SD03, SD04, SD06, SD07, SD08 |

---

## TD02 – Role, rozhraní a rozšíření

Zpřesnění doménového modelu pro návrh podle části *Roles, Types and Interfaces* z přednášky
(tam `Car` implementuje role `Selected` a `Specified`, se kterými pracuje `Order`):

- **Role** – `Rezervace` nepotřebuje znát celého uživatele ani celé vozidlo:
  - `Ridic` (`muzeRidit`, `getEmail`) – implementuje `Uzivatel`,
  - `RezervovatelneVozidlo` (`maPlatnouSTK`, `zapisStav`, `nastavStav`, `maOtevreneVady`) – implementuje `Vozidlo`,
  - `ServisovaneVozidlo` (`nahlasVadu`, `getOtevreneVady`, `maOtevreneVady`) – role vozidla při hlášení vad.
- **Generalizace** – `ElektrickeVozidlo` je specializace `Vozidla` (ADR-05, *Future Pressure C*): přidává nabití baterie,
  minimum 20 % a čas na dobití. Rezervace s ním pracuje stejně přes roli `RezervovatelneVozidlo`.
- **Porty a adaptéry** (hexagonální architektura, ADR-01):
  - `Databaze` je v návrhu rozhraní; implementace `InMemoryDatabaze` (CP1–CP4) a `SqlDatabaze` (CP5, PostgreSQL),
  - `NotifikacniSluzba` je rozhraní; `EmailNotifikace` je «boundary» adaptér na externí e-mailový IS (ADR-04),
    `MockNotifikace` se používá ve walking skeletonu a testech.
- **Závislosti** – `«instantiate»` (Vozidlo vytváří Vadu, Uzivatel vytváří Odvolani), `«use»` (volání portů).

> V TD01 je `Databaze` třída «singleton» (analytický pohled, odpovídá `:Databaze` v sekvenčních diagramech).
> V TD02 se z ní stává rozhraní, aby šla vyměnit implementace bez zásahu do domény.

---

## TD03 – Balíčkový diagram

| Balíček | Obsah | Odpovědnost |
|---|---|---|
| `cz.carside.domena.rezervace` | Rezervace, StavRezervace, Kolize | centrální balíček – rezervace a jejich pravidla |
| `cz.carside.domena.vozidla` | Vozidlo, ElektrickeVozidlo, Vada, RezervovatelneVozidlo, ServisovaneVozidlo, StavVozidla, StavVady | vozový park, technický stav, vady |
| `cz.carside.domena.uzivatele` | Uzivatel, Odvolani, Soubor, Ridic, Role, StavOdvolani | účty, role, oprávnění k řízení |
| `cz.carside.domena.porty` | Databaze, NotifikacniSluzba | rozhraní domény k okolí |
| `cz.carside.perzistence` | InMemoryDatabaze, SqlDatabaze | adaptéry ukládání dat |
| `cz.carside.notifikace` «boundary» | EmailNotifikace, MockNotifikace | adaptéry notifikací, hranice systému |

Závislosti «import» vedou jen dovnitř domény a k portům – adaptéry závisí na doméně, doména na adaptérech ne.

---

## Výstupy

| Složka | Obsah |
|---|---|
| `*.puml` | zdrojové PlantUML soubory |
| [png/](png/) | rastrové obrázky |
| [svg/](svg/) | vektorové obrázky |
| [pdf/](pdf/) | PDF každého diagramu zvlášť (v plné velikosti) |
| [Tridni_diagramy.pdf](Tridni_diagramy.pdf) | všechny diagramy v jednom PDF s přehledem tříd |
