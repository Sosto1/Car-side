# Evidence and Evolution

Tento dokument zachycuje empirické poznatky (evidence), architektonická rozhodnutí (decisions), definici prvního spustitelného řezu (**CP1 Walking Skeleton**) a plán evolučního vývoje systému **Car-side**.

---

## 1. Engineering Spike & Evidence (C01)

### Otázka / Neznámá (Question / Unknown)
Jakým způsobem strukturovat jádro naší aplikace a jak připravit ověřitelnou kostru rezervačního systému (Walking Skeleton), abychom spolehlivě validovali doménová pravidla (kolize rezervací, způsobilost řidiče, STK) a externí hranice (notifikace) bez závislosti na složité infrastruktuře?

### Provedený experiment (What we did / Evidence)
1. Vytvořili jsme doménový model a spustitelný testovací scénář v souboru `src/walking_skeleton.py`, který implementuje:
   - In-memory perzistentní repozitář (`InMemoryReservationRepository`).
   - Mock externí notifikační služby (`NotificationService`).
   - Doménovou službu `ReservationService` s plnou validací časových překryvů, kontroly STK a oprávnění řidiče.
   - Kompletní end-to-end průchod všemi klíčovými operacemi (vytvoření, detekce kolize, schválení manažerem, storno).
2. Připravili jsme lehký HTTP server `src/app.py`, který umožňuje jak spuštění webového grafického rozhraní, tak okamžité spuštění doménového testu pomocí přepínače `--test`.

### Pozorovaný výsledek (Observed Result)
- Skript `src/walking_skeleton.py` běží v čistém prostředí Python 3 bez externích závislostí a vykoná se za méně než 0.1 s.
- Všechny doménové invarianty (zejména kolizní pravidlo překryvu a zákaz rezervace při propadlé STK či pozastaveném řidičském oprávnění) jsou spolehlivě detekovány a vyvolávají očekávané výjimky.
- Notifikační brána spolehlivě zaznamenává odeslané zprávy jako vedlejší efekt úspěšných stavových změn.

### Rozhodnutí (Decision & What changes)
Rozhodli jsme se ponechat `src/walking_skeleton.py` jako referenční spustitelný **CP1 Walking Skeleton**. Doménová pravidla v něm definovaná jsou závazná pro všechny další vrstvy projektu (včetně webového klientského rozhraní a budoucího REST API).

---

## 2. Definice CP1 Walking Skeleton

Podle definice (*Alistair Cockburn / GOOS*) je **Walking Skeleton** nejtenčí možný vertikální řez systémem, který propojuje všechny hlavní architektonické vrstvy end-to-end.

```
[Klient / Test] 
       │ 1. Požadavek na rezervaci (User, Vehicle, Start, End)
       ▼
[Domain Validation & Invariants]
       │ - Kontrola platnosti časového intervalu
       │ - Kontrola oprávnění řidiče (canDrive)
       │ - Kontrola platnosti STK vozidla
       │ - Kontrola pravidla: Max 1 auto pro řidiče v daném čase
       │ - Kontrola kolize překryvu: start_A < end_B && start_B < end_A
       ▼
[State Transition]
       │ - Určení stavu: <= 3 dny -> CONFIRMED, > 3 dny -> PENDING
       ▼
[Persistence Layer]
       │ - Uložení entity Reservation do úložiště
       │ - Přidělení unikátního ID
       ▼
[External Boundary]
       │ - Odeslání potvrzovací zprávy do Notification Service
       ▼
[Klient / Test]
         Odpověď: ID rezervace + stavový kód + detail
```

### Pokryté operace ve Walking Skeletonu:
1. **Check availability**: Ověření dostupnosti vozidla v čase s vyhodnocením překryvů a technického stavu.
2. **Create reservation**: Validace, zaevidování a perzistence rezervace s přiřazením počátečního stavu (`CONFIRMED` nebo `PENDING`).
3. **External notification**: Odeslání zprávy uživateli / manažerovi.
4. **Collision detection (Negative test)**: Zachycení pokusu o kolizní rezervaci v obsazeném čase.
5. **Approve reservation**: Přechod ze stavu `PENDING` do `CONFIRMED` vyvolaný správcem flotily.
6. **Cancel reservation**: Zrušení rezervace (`CANCELLED`) a okamžité uvolnění časového okna pro další zájemce.

---

## 3. Evoluce systému (Evolution Roadmap)

| Fáze / Milník | Hlavní cíl a rozsah | Stav v projektu |
|---|---|---|
| **CP1: Walking Skeleton** | Implementace minimálního vertikálního řezu, doménová pravidla, overlap invariant, notifikační mock, spustitelný testovací scénář. | **Hotovo** (`src/walking_skeleton.py`) |
| **CP2: Rozšíření domény** | Role uživatelů (Zaměstnanec, Správce flotily, Administrátor), správa platnosti STK, zelených karet a řidičských průkazů. | **Hotovo** |
| **CP3 / CP4: Interaktivní UI a správa** | Webová aplikace (`src/index.html`, `src/app.js`), kalendář obsazenosti (Timetable), formuláře pro správu flotily, hlášení závad a proces odvolání při zákazu řízení. | **Hotovo** |
| **CP5: Produkční architektura** | Relační databáze (PostgreSQL), REST API, zabezpečená autentizace, napojení reálného SMTP serveru. | Plánováno |
| **Cílový stav (Future Pressure)** | Podpora elektromobilů (kapacita baterie, automatické bloky na dobíjení) a IoT telemetrie (GPS, odečet tachometru, odemykání mobilem). | Navrženo v dokumentaci |