# Project Frame

## Reservation domain
Vozový park firemních sdílených vozidel (osobní automobily, vozy kombi, SUV, dodávky) určených pro služební cesty zaměstnanců společnosti.

## Purpose
Systém Car-side slouží firmám a jejich zaměstnancům pro efektivní plánování a sdílení firemních vozidel při pracovních cestách. Předchází kolizím a překryvům při rezervacích, zkracuje proces schvalování a dává správcům vozového parku transparentní přehled o dostupnosti, technickém stavu (STK, servis, hlášené vady) i oprávněních jednotlivých řidičů.

## Users / Stakeholders
1. **Zaměstnanec (Employee / Řidič)** – vytváří rezervace vozidel na požadovaný termín, provádí převzetí a vrácení vozu, hlásí případné závady a v případě pozastavení řidičského oprávnění podává odvolání.
2. **Správce vozového parku (Fleet Manager)** – schvaluje či zamítá nadlimitní rezervace, spravuje flotilu vozidel (termíny STK, servisní záznamy, přidávání nových aut) a řeší nahlášené vady.
3. **Administrátor (Admin)** – spravuje uživatelské účty a jejich role, uděluje či odebírá oprávnění k řízení a posuzuje odvolání řidičů.

## Core concepts
- **Reservation (Rezervace)** – časově ohraničený záznam o zapůjčení konkrétního vozidla konkrétním zaměstnancem, procházející životním cyklem stavů (`PENDING`, `CONFIRMED`, `CANCELLED`, `REJECTED`, `IN_PROGRESS`, `COMPLETED`).
- **Resource / Vehicle (Vozidlo / Zdroj)** – fyzický firemní vůz identifikovaný SPZ, modelem, typem, lokalitou a technickým stavem (platnost STK, stav tachometru, hlášené vady).
- **User (Uživatel)** – aktér systému s přiřazenou rolí (`employee`, `manager`, `admin`), kontaktními údaji a příznakem platnosti řidičského oprávnění (`canDrive`).
- **Defect (Závada / Hlášení vady)** – provozní, technická či vizuální vada evidovaná u konkrétního vozidla se stavem řešení (`OPEN`, `RESOLVED`).
- **Driver License Appeal (Odvolání)** – oficiální žádost řidiče o přezkoumání a obnovení pozastaveného oprávnění k řízení.

## Core operations
- **Create reservation** – zadání termínu (od–do) a výběr vozidla zaměstnancem; systém validuje oprávnění řidiče, termín a dostupnost vozu a vytvoří záznam rezervace.
- **Confirm / approve reservation** – potvrzení rezervace; standardní rezervace ($\le$ 3 dny) jsou potvrzeny automaticky do stavu `CONFIRMED`, nadlimitní rezervace (> 3 dny) schvaluje správce flotily ze stavu `PENDING`.
- **Cancel reservation** – zrušení plánované rezervace zaměstnancem nebo zamítnutí/storno správcem flotily; uvolňuje časové okno vozidla pro další rezervace (`CANCELLED` / `REJECTED`).
- **Check availability** – vyhledání a kontrola dostupnosti vozidel v zadaném časovém okně s vyloučením termínů s překrývající se aktivní rezervací a vozidel s neplatnou STK.

## Persistent state
- **Reservation**:
  - `id`: unikátní identifikátor rezervace (int / UUID)
  - `vehicleId`: reference na rezervované vozidlo
  - `employeeEmail` / `userId`: reference na zaměstnance
  - `employeeName`: celé jméno řidiče
  - `start`: datum a čas začátku rezervace (ISO 8601)
  - `end`: datum a čas konce rezervace (ISO 8601)
  - `status`: aktuální stav rezervace (`PENDING` | `CONFIRMED` | `REJECTED` | `CANCELLED` | `IN_PROGRESS` | `COMPLETED`)
  - `createdAt`: čas vytvoření záznamu
- **Resource (Vehicle)**:
  - `id`: unikátní identifikátor vozidla
  - `name`: značka a model vozu (např. *Škoda Octavia Combi*)
  - `plate`: státní poznávací značka (SPZ)
  - `type`: kategorie vozidla (Kombi, Sedan, SUV, Dodávka)
  - `location`: výchozí lokalita / pobočka (např. *Ostrava — centrála*)
  - `stkDate`: datum platnosti technické kontroly (STK)
  - `greenCardDate`: datum platnosti zelené karty / pojištění
  - `mileage`: stav tachometru (v km)
  - `notes`: výbava a poznámky k vozidlu
  - `defects`: kolekce hlášených vad (`id`, `reporterEmail`, `text`, `date`, `status`)

## State-changing operation
Životní cyklus rezervace a přechody mezi stavy:
- Standardní rezervace ($\le$ 3 dny): `DRAFT` $\rightarrow$ `CONFIRMED`
- Nadlimitní rezervace (> 3 dny): `DRAFT` $\rightarrow$ `PENDING` $\rightarrow$ `CONFIRMED` (schválení manažerem)
- Zamítnutí žádosti manažerem: `PENDING` $\rightarrow$ `REJECTED`
- Zrušení zaměstnancem / storno: `CONFIRMED` / `PENDING` $\rightarrow$ `CANCELLED`
- Realizace jízdy: `CONFIRMED` $\rightarrow$ `IN_PROGRESS` (převzetí vozidla) $\rightarrow$ `COMPLETED` (vrácení a zaznamenání km)

## Common business rule
**Confirmed reservations for the same resource must not overlap.**  
Žádné dvě potvrzené či aktivní rezervace téhož vozidla se nesmí v čase překrývat:
$$\text{start}_A < \text{end}_B \land \text{start}_B < \text{end}_A$$

## Domain-specific business rule
1. **Délkový limit schvalování:** Rezervace na dobu delší než 3 dny (72 hodin) vyžadují výslovné schválení správcem vozového parku (`PENDING` $\rightarrow$ `CONFIRMED`), zatímco kratší rezervace jsou potvrzovány okamžitě.
2. **Jedno auto na zaměstnance:** Zaměstnanec smí mít v daném časovém intervalu aktivní maximálně jednu rezervaci současně.
3. **Způsobilost řidiče a technický stav:** Rezervaci nelze vytvořit pro uživatele s pozastaveným řidičským oprávněním (`canDrive == false`) ani na vozidlo s prošlou STK.

## External / system boundary
**Notification Service** (Email / SMS / Push notifikační služba) – externí systém zajišťující transakční notifikace při změnách stavu rezervace (automatické potvrzení, žádost o schválení odeslaná manažerovi, potvrzení/zamítnutí rezervace zaměstnanci, blížící se konec platnosti STK).

## Assumption
Předpokládáme, že zaměstnanci vrací vozidla včas a na domovskou pobočku v provozuschopném stavu, takže je vozidlo bezprostředně po ukončení rezervace připraveno pro dalšího řidiče, pokud nebyla nahlášena závada.

## Unknown
Zda bude systém v cílové etapě napojen na hardwarové telemetrické jednotky ve vozidlech (IoT / OBD-II pro automatický odečet stavu tachometru, stavu nádrže/baterie a digitální odemykání mobilním telefonem), nebo zda proces předání klíčů a zápis kilometrů zůstane čistě manuální administrativní úkon.

---

# Intent and Change

## Selected Future Pressure
- **Kategorie:** C (Změna domény / nový typ zdroje)
- **Konkrétní tlak:** Rozšíření vozového parku o elektromobily (EV), které vyžadují zavedení specifických doménových pravidel. Systém bude muset sledovat aktuální kapacitu baterie, garantovat minimální úroveň nabití při předání ($\ge 20\ \%$) a automaticky započítávat technologický čas potřebný pro dobití vozu na nabíjecí stanici před zahájením další rezervace.
- **Relevance pro Car-side:** S dekarbonizací firemních flotil přibývají vozidla s odlišnými provozními nároky. Architektura rezervačního jádra musí umožnit rozšíření entit a validačních pravidel bez zásahu do obecného rezervačního mechanismu.