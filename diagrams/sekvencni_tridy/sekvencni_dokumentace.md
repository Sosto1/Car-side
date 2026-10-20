# Sekvenční diagramy (objektová úroveň) – Car-side

Diagramy navazují na use case diagramy a jsou vytvořené postupem z přednášky
*Software Engineering* (zpřesněný sekvenční diagram, „Refined Sequence Diagram“):

1. Z případu užití se vezme scénář (hlavní tok + alternativy).
2. Scénáře se spojí pomocí kombinovaných fragmentů `alt`, `opt`, `loop`, `break`.
3. Místo obecného „Systému“ vystupují **objekty doménových tříd** (`r:Rezervace`, `:Databaze` …),
   zprávy jsou **operace s parametry** a návratové hodnoty jsou kreslené čárkovaně.
4. Opakovaně použitá interakce je vyčleněná do samostatného diagramu a volaná přes `ref` (SD02).
5. Ze zpráv mezi objekty se pak odvodí operace tříd pro třídní diagram (viz tabulka níže).

Konvence: objekty jsou podtržené ve tvaru `jméno:Třída`, `«create»` značí vznik objektu,
`«boundary» / «IS e-mail»` je externí systém (e-mailová brána) mimo hranici aplikace.

---

## Použité třídy

Záměrně je použito jen **7 tříd** – 6 doménových a 1 externí rozhraní. Jména odpovídají
návrhu třídního diagramu ([pokus.puml](../tridni/pokus.puml)) a kódu ([walking_skeleton.py](../../src/walking_skeleton.py), [app.js](../../src/app.js)).

| Třída | Role v systému | Operace odvozené ze sekvenčních diagramů |
|---|---|---|
| **Rezervace** | Centrální objekt – řídí životní cyklus rezervace (DRAFT → PENDING/CONFIRMED → IN_PROGRESS → COMPLETED, případně REJECTED/CANCELLED) a hlídá pravidla. | `«create» Rezervace(u, idVozidla, od, do)`, `odeslat()`, `jeTerminPlatny(): boolean`, `delkaDni(): float`, `potvrdit()`, `cekatNaSchvaleni()`, `jeDostupne(v, u, od, do): Kolize`, `prekryvaSe(od, do): boolean`, `schvalit()`, `zamitnout()`, `muzeMenit(u): boolean`, `zmenitTermin(od, do)`, `zrusit()`, `prevzit(km, palivo)`, `vratit(km, palivo)` |
| **Uzivatel** | Účet zaměstnance / správce / administrátora, nese roli a oprávnění k řízení (`canDrive`). | `«create» Uzivatel(jmeno, email, telefon)`, `muzeRidit(): boolean`, `jeSpravce(): boolean`, `nastavRoli(role)`, `nastavOpravneni(canDrive)`, `podatOdvolani(text, priloha)`, `getOdvolani(): Odvolani`, `rozhodnoutOdvolani(schvaleno)`, `resetovatHeslo()`, `vygenerujToken()` |
| **Vozidlo** | Sdílený zdroj, který se rezervuje; eviduje STK, tachometr, stav a vady. | `maPlatnouSTK(datum): boolean`, `zapisStav(km, palivo)`, `nastavStav(stav)`, `nahlasVadu(popis, u)`, `pridejVadu(d)`, `getOtevreneVady(): List<Vada>`, `maOtevreneVady(): boolean` |
| **Vada** | Nahlášená závada / poškození vozidla (OPEN → RESOLVED). | `«create» Vada(popis, nahlasil)`, `vyresit()` |
| **Odvolani** | Žádost o obnovení oprávnění k řízení (PENDING → APPROVED / REJECTED). | `«create» Odvolani(text, priloha)`, `getPriloha(): Soubor`, `schvalit()`, `zamitnout()` |
| **Databaze** | Perzistence – vyhledání a uložení uživatelů, vozidel a rezervací (analogie `CarDatabase` z přednášky). | `najdiVozidlo(id): Vozidlo`, `najdiAktivniRezervace(): List<Rezervace>`, `najdiRezervace(stav \| u): List<Rezervace>`, `ulozRezervaci(r)`, `najdiUzivatele(role \| email)`, `existujeEmail(email): boolean`, `ulozUzivatele(u)`, `ulozVozidlo(v)` |
| **NotifikacniSluzba** «boundary» | Externí e-mailová služba (systémová hranice z ADR – asynchronní notifikace). | `odeslat(prijemce, zprava)` |

### Které třídy vystupují ve kterém diagramu

| Diagram | Rezervace | Uzivatel | Vozidlo | Vada | Odvolani | Databaze | NotifikacniSluzba |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| SD01 Vytvoření rezervace | ✔ | ✔ | ✔ | | | ✔ | ✔ |
| SD02 Kontrola dostupnosti (ref) | ✔ (2×) | | | | | ✔ | |
| SD03 Schválení / zamítnutí | ✔ | | | | | ✔ | ✔ |
| SD04 Úprava a zrušení | ✔ | ✔ | | | | ✔ | ✔ |
| SD05 Převzetí a vrácení | ✔ | | ✔ | | | ✔ | |
| SD06 Nahlášení vady | | | ✔ | ✔ | | ✔ | ✔ |
| SD07 Odvolání proti zákazu řízení | | ✔ | | | ✔ | ✔ | ✔ |
| SD08 Správa účtů | | ✔ | | | | ✔ | ✔ |

---

## SD01 – Vytvoření rezervace vozidla
**Soubor:** [SD01_VytvoreniRezervace.puml](SD01_VytvoreniRezervace.puml) · **Use case:** Rezervace / Správa rezervací – *Vytvořit rezervaci*
**Účastníci:** Zaměstnanec, `r:Rezervace`, `u:Uzivatel`, `:Databaze`, `v:Vozidlo`, `:NotifikacniSluzba`

1. Zaměstnanec vyplní formulář → vznikne `«create» r:Rezervace` ve stavu *DRAFT* a zavolá `odeslat()`.
2. `r.jeTerminPlatny()` – od < do, ne v minulosti, min. 30 minut (jinak `break`).
3. `u.muzeRidit()` – uživatel s pozastaveným oprávněním je odmítnut (`break`).
4. `:Databaze.najdiVozidlo()` a `v.maPlatnouSTK(od)` – vozidlo s prošlou STK nelze rezervovat (`break`).
5. `ref` **SD02** – kontrola překryvu termínu (vozidlo i řidič); při kolizi `break`.
6. `r.delkaDni()` → `alt`:
   - **≤ 3 dny:** `potvrdit()` → *CONFIRMED*, uložení, e-mail zaměstnanci.
   - **> 3 dny:** `cekatNaSchvaleni()` → *PENDING*, uložení, `loop` e-mail všem správcům + e-mail zaměstnanci.

## SD02 – Kontrola dostupnosti vozidla (`ref`)
**Soubor:** [SD02_KontrolaDostupnosti.puml](SD02_KontrolaDostupnosti.puml) · **Use case:** «include» *Kontrola dostupnosti vozidla*
**Účastníci:** `r:Rezervace`, `:Databaze`, `a:Rezervace` (každá existující aktivní rezervace)

Samostatná interakce, na kterou se odkazuje z SD01 a SD04. Implementuje obecné pravidlo
*Confirmed reservations must not overlap* a doménové pravidlo *1 zaměstnanec = max. 1 vozidlo ve stejném čase*.
`r` si z databáze načte aktivní rezervace (CONFIRMED, PENDING, IN_PROGRESS) a v `loop` se každé `a` ptá
`prekryvaSe(od, do)`. Při překryvu rozliší kolizi **VOZIDLO** (stejné auto) nebo **RIDIC** (stejný zaměstnanec).

## SD03 – Schválení / zamítnutí rezervace správcem
**Soubor:** [SD03_SchvaleniRezervace.puml](SD03_SchvaleniRezervace.puml) · **Use case:** Správa rezervací – *Schválit / zamítnout rezervaci*
**Účastníci:** Správce vozového parku, `:Databaze`, `r:Rezervace`, `:NotifikacniSluzba`, Zaměstnanec

Správce si načte rezervace ve stavu *PENDING* a vybere jednu. `alt`:
- **schválit:** `r.schvalit()` → *CONFIRMED*, uložení, e-mail zaměstnanci.
- **zamítnout:** `r.zamitnout()` → *REJECTED* (termín se uvolní), uložení, e-mail zaměstnanci.

V obou větvích `break`, pokud rezervace už není ve stavu *PENDING*.

## SD04 – Úprava a zrušení rezervace
**Soubor:** [SD04_UpravaZruseniRezervace.puml](SD04_UpravaZruseniRezervace.puml) · **Use case:** Rezervace – *Upravit / zrušit rezervaci*
**Účastníci:** Zaměstnanec / Správce, `:Databaze`, `r:Rezervace`, `u:Uzivatel`, `:NotifikacniSluzba`

1. `r.muzeMenit(u)` – vlastní rezervaci mění zaměstnanec, cizí jen správce (`u.jeSpravce()`).
2. `alt` **upravit termín:** `zmenitTermin()` → `jeTerminPlatny()` → `ref` **SD02** → při volném termínu změna,
   při délce > 3 dny návrat do *PENDING* (nové schválení – SD03), uložení a e-mail; jinak chyba.
3. `alt` **zrušit:** `zrusit()` → *CANCELLED*, termín se uvolní, uložení a e-mail.

## SD05 – Převzetí a vrácení vozidla
**Soubor:** [SD05_PrevzetiVraceniVozidla.puml](SD05_PrevzetiVraceniVozidla.puml) · **Use case:** Provoz vozidla – *Kontrola stavu při převzetí / vrácení* («include» zadání tachometru a paliva)
**Účastníci:** Zaměstnanec, `r:Rezervace`, `v:Vozidlo`, `:Databaze`

- **Převzetí:** `r.prevzit(km, palivo)` – jen potvrzená rezervace v jejím termínu (`break`).
  Zapíše se stav tachometru, vozidlo → *V_PROVOZU*, rezervace → *IN_PROGRESS*.
- **Vrácení:** `r.vratit(km, palivo)` – zapíše konečný stav a spočítá najeté km.
  `opt` při poškození `ref` **SD06** («extend» nahlášení závady). Podle `v.maOtevreneVady()` jde vozidlo
  do *MIMO_PROVOZ* nebo *DOSTUPNE*, rezervace → *COMPLETED*.

## SD06 – Nahlášení a vyřešení vady vozidla
**Soubor:** [SD06_NahlaseniVady.puml](SD06_NahlaseniVady.puml) · **Use case:** Provoz vozidla – *Nahlásit závadu* («include» řešení škody / servisu)
**Účastníci:** Zaměstnanec, `v:Vozidlo`, `d:Vada`, `:Databaze`, `:NotifikacniSluzba`, Správce vozového parku

- **Nahlášení:** `v.nahlasVadu(popis, u)` → `«create» d:Vada` (*OPEN*), přidání k vozidlu, uložení,
  `loop` e-mail všem správcům.
- **Vyřešení:** správce načte otevřené vady, po opravě zavolá `d.vyresit()` (*RESOLVED*);
  pokud vozidlo nemá další otevřené vady (`opt`), vrací se do stavu *DOSTUPNE*.

## SD07 – Odvolání proti zákazu řízení
**Soubor:** [SD07_OdvolaniZakazRizeni.puml](SD07_OdvolaniZakazRizeni.puml) · **Use case:** Řidičský průkaz – *kontrola a schválení řidičského oprávnění*
**Účastníci:** Zaměstnanec, `u:Uzivatel`, `o:Odvolani`, `:Databaze`, `:NotifikacniSluzba`, Administrátor

- **Podání:** `u.podatOdvolani(text, priloha)` – příloha max. 2 MB (`break`), `«create» o:Odvolani` (*PENDING*),
  uložení (při chybě se odvolání vrátí do původního stavu – `break`), `loop` e-mail všem administrátorům.
- **Rozhodnutí:** administrátor si zobrazí odvolání a přílohu a zavolá `u.rozhodnoutOdvolani(schvaleno)`.
  `alt` schváleno → `o.schvalit()` a `canDrive := true`; zamítnuto → `o.zamitnout()`. Zaměstnanec dostane e-mail.

## SD08 – Správa uživatelských účtů
**Soubor:** [SD08_SpravaUctu.puml](SD08_SpravaUctu.puml) · **Use case:** Správa účtů – *Vytvořit účet, přiřadit roli, reset hesla*
**Účastníci:** Administrátor, `:Databaze`, `u:Uzivatel`, `:NotifikacniSluzba`, Zaměstnanec

- **Vytvoření účtu:** kontrola unikátního e-mailu (`break`), `«create» u:Uzivatel`, nastavení role
  (EMPLOYEE / MANAGER / ADMIN) a oprávnění k řízení, uložení a e-mail s odkazem pro nastavení hesla.
- **Reset hesla:** zaměstnanec zadá e-mail, neznámý e-mail → `break`; jinak `u.resetovatHeslo()`
  vygeneruje token a služba odešle odkaz pro obnovu hesla.

---

## Výstupy

| Složka | Obsah |
|---|---|
| `*.puml` | zdrojové PlantUML soubory |
| [png/](png/) | rastrové obrázky diagramů |
| [svg/](svg/) | vektorové obrázky diagramů |
| [pdf/](pdf/) | PDF každého diagramu zvlášť |
| [Sekvencni_diagramy.pdf](Sekvencni_diagramy.pdf) | všechny diagramy v jednom PDF včetně přehledu tříd |
