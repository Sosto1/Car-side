# Architecture and Decisions

Tento dokument popisuje architektonický návrh systému **Car-side**, systémové hranice, rozpad do komponent a klíčová architektonická rozhodnutí (Architecture Decision Records – ADR).

---

## 1. Architektonický styl a přehled

Systém je navržen podle principů **Clean / Hexagonal Architecture (Ports & Adapters)** s důrazem na oddělení doménových pravidel od vnějších detailů (databáze, webový framework, externí notifikační služby).

```
                      +-----------------------------+
                      |       Uživatelské UI        |
                      |   (HTML5 / CSS3 / ES6 JS)   |
                      +--------------+--------------+
                                     |  HTTP / REST
                                     v
                      +-----------------------------+
                      |       API / Controller      |
                      |    (Endpointy & Validace)   |
                      +--------------+--------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                              Doménové jádro                             |
|                                                                         |
|  +------------------------+             +----------------------------+  |
|  |     Domain Entities    |             |       Domain Services      |  |
|  | - Reservation          | <---------> | - ReservationService       |  |
|  | - Vehicle (Resource)   |             |   (overlap check, limits)  |  |
|  | - User / Driver        |             | - FleetService             |  |
|  | - Defect               |             |   (STK, stav vozidel)      |  |
|  +------------------------+             +----------------------------+  |
|                                                        ^                |
+--------------------------------------------------------|----------------+
                                                         |
                      +----------------------------------+
                      | Ports (Interfaces)
         +------------+------------+
         |                         |
         v                         v
+------------------+     +--------------------+
|  Persistence Port|     |  Notification Port |
+--------+---------+     +---------+----------+
         |                         |
         v                         v
+------------------+     +--------------------+
| In-Memory / SQL  |     | Email / SMS        |
| Repository       |     | External Gateway   |
+------------------+     +--------------------+
```

---

## 2. Systémové hranice a externí závislosti

| Komponenta / Hranice | Typ | Popis a odpovědnost |
|---|---|---|
| **Web Client (UI)** | Interní | Jednostránková aplikace poskytující rozhraní pro zaměstnance (výběr vozidla, kalendář), správce vozového parku (schvalování, stav STK) a administrátory. |
| **API Layer** | Interní | Zpracovává příchozí HTTP požadavky, serializuje/deserializuje JSON data a deleguje operace do aplikačních a doménových služeb. |
| **Domain Layer** | Interní | Čistá doménová logika bez vnějších závislostí. Garantuje integritu dat (nekoliznost rezervací, způsobilost řidiče, platnost STK). |
| **Notification Service** | **Externí hranice** | Služba pro asynchronní rozesílání emailových a SMS zpráv o schválení/zamítnutí rezervací a servisních varováních. |
| **Telemetry / Connected Car** | *Budoucí hranice* | Palubní jednotka (OBD-II/GPS) pro automatický odečet stavu tachometru, stavu baterie/paliva a odemykání vozidla. |

---

## 3. Komponentní model a datové toky

### 3.1 Doménové entity
- **`Reservation`**: Reprezentuje vazbu mezi řidičem a vozidlem v čase. Řídí stavový automat (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `IN_PROGRESS`, `COMPLETED`).
- **`Vehicle`**: Reprezentuje sdílený zdroj. Uchovává SPZ, model, stav STK, stav tachometru a evidované vady.
- **`User`**: Aktér se jménem, emailem, rolí (`employee`, `manager`, `admin`) a stavem řidičského oprávnění (`canDrive`).

### 3.2 Aplikační služby
- **`ReservationService`**:
  - `check_availability(vehicle, start, end)`: Ověřuje dostupnost vozu a kolize.
  - `create_reservation(user, vehicle, start, end)`: Řídí celý proces vytvoření rezervace včetně invariantů.
  - `approve_reservation(manager, res_id)`: Schvaluje nadlimitní žádosti ze stavu `PENDING` do `CONFIRMED`.
  - `cancel_reservation(user, res_id)`: Uvolňuje termín a převádí stav do `CANCELLED`.

---

## 4. Architektonická rozhodnutí (ADR)

### ADR-01: Oddělení doménové logiky od prezentační a perzistentní vrstvy
- **Kontext:** Potřebujeme zajistit, aby stejná business pravidla (detekce překryvů, STK, zákaz řízení) platila pro webové UI, automatizované testy i budoucí mobilní aplikaci.
- **Rozhodnutí:** Logika rezervací je zapouzdřena v samostatném doménovém modulu (`ReservationService`). UI ani perzistence do této logiky nezasahují.
- **Důsledek:** Snadná testovatelnost (unit/integration testy bez nutnosti spouštět webový server), znovupoužitelnost logiky.

### ADR-02: Garantování nekoliznosti (Overlap Invariant) v doménové službě
- **Kontext:** Pravidlo *Confirmed reservations for the same resource must not overlap* nesmí být porušeno ani při souběžných požadavcích.
- **Rozhodnutí:** Kontrola překryvu probíhá v doménové službě před zápisem rezervace pomocí časového predikátu $start_1 < end_2 \land start_2 < end_1$. V budoucí SQL perzistenci bude doplněna databázovým zámkem / constraintem.
- **Důsledek:** Eliminace rizika race conditions a dvojí rezervace téhož vozu.

### ADR-03: Dvoustupňový schvalovací proces rezervací ($\le 3$ dny vs. $> 3$ dny)
- **Kontext:** Plné manuální schvalování všech jízd přetěžuje správce flotily. Plná automatizace by naopak umožnila neomezené blokování vozů jednotlivci na týdny dopředu.
- **Rozhodnutí:** Standardní rezervace ($\le 3$ dny) jsou potvrzeny okamžitě (`CONFIRMED`). Rezervace delší než 3 dny vstupují do stavu `PENDING` a vyžadují potvrzení správcem.
- **Důsledek:** Optimální vyvážení flexibility zaměstnanců a dohledu nad firemními zdroji.

### ADR-04: Asynchronní integrace Notification Service
- **Kontext:** Externí notifikační služba (SMTP/SMS brána) může mít latenci nebo výpadek.
- **Rozhodnutí:** Rezervační jádro komunikuje s notifikační službou přes izolované rozhraní ve stylu fire-and-forget. Selhání odeslání zprávy neblokuje uložení platné rezervace.
- **Důsledek:** Vysoká dostupnost a odolnost rezervačního procesu vůči selhání sítě.

### ADR-05: Rozšiřitelnost pro nové typy zdrojů (Elektromobily – Future Pressure C)
- **Kontext:** Plánovaný přechod na elektromobily vyžaduje zohlednění stavu baterie a nabíjecích časů.
- **Rozhodnutí:** Entita `Vehicle` a rozhraní dostupnosti jsou připraveny pro polymorfní rozšíření (`ElectricVehicle`), které do výpočtu dostupnosti vkládá minimální úroveň nabití ($\ge 20\ \%$) a automatický technologický blok na dobití.
- **Důsledek:** Budoucí tlak z `future-pressure.txt` lze implementovat bez refaktoringu obecného rezervačního stavového automatu.

