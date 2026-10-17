# Car-side 🚗
> Webový systém pro firemní car-sharing a správu vozového parku.

Projekt vzniká v rámci předmětu Softwarové inženýrství (SWI) na VŠB-TUO. Poskytuje komplexní řešení pro rezervaci firemních vozidel zaměstnanci, schvalovací procesy správců vozového parku, kontrolu technického stavu (STK, servis, hlášení závad) a administraci uživatelských účtů a řidičských oprávnění.

---

## 📚 Přehled dokumentace projektu

Dokumentace projektu je rozdělena do strukturovaných souborů podle standardů softwarového inženýrství:

- **[Project Frame & Intent and Change](docs/intent-and-change.md)**
  - Doménový rámec projektu, vymezení rezervovaného zdroje, účel systému a stakeholderi.
  - Základní koncepty, klíčové operace, perzistentní stav a stavový automat rezervace.
  - Všeobecné pravidlo (*Confirmed reservations must not overlap*) a doménová pravidla.
  - Systémové hranice (Notification Service), předpoklady (Assumptions) a neznámé (Unknowns).
  - Vybraný budoucí tlak (*Future Pressure C* – rozšíření o elektromobily).
- **[Architecture & Decisions](docs/architecture-and-decisions.md)**
  - Architektonický styl (Clean / Hexagonal Architecture), rozpad do vrstev a komponent.
  - Systémové rozhraní a externí hranice.
  - Architektonická rozhodnutí (ADR-01 až ADR-05): nekoliznost rezervací, pravidla schvalování, asynchronní notifikace.
- **[Evidence & Evolution](docs/evidence-and-evolution.md)**
  - Záznam inženýrského experimentu (C01 Engineering Spike) s hypotézou, pozorováním a rozhodnutím.
  - **Definice CP1 Walking Skeleton** – specifikace nejtenčího vertikálního řezu systémem.
  - Evoluční roadmapa projektu (CP1 $\rightarrow$ CP2 $\rightarrow$ CP3/CP4 $\rightarrow$ CP5).
- **[Future Pressure](docs/future-pressure.txt)**
  - Detailní analýza zavedení elektromobilů s ohledem na kapacitu baterie a čas na dobíjení.
- **UML Diagramy**:
  - [Dokumentace Use Case diagramů](diagrams/usecase-diagram/usecase_dokumentace.md)
  - [Dokumentace Sekvenčních diagramů](diagrams/sekvencni_tridy/sekvencni_dokumentace.md) – zpřesněné sekvenční diagramy s objekty tříd (SD01–SD08, [PDF](diagrams/sekvencni_tridy/Sekvencni_diagramy.pdf))
  - [Původní sekvenční diagramy](diagrams/sekvencni/sekvencni_dokumentace.md) (bez tříd, obecný „Systém“)
  - [Aktivitní diagramy](diagrams/aktivitni/) (Schvalování, převzetí vozu, správa účtů a vozidel)
  - [Třídní diagram](diagrams/tridni/pokus.puml)

---

## 🦴 CP1 Walking Skeleton — Skutečně runnable cesta

Jako **CP1 Walking Skeleton** jsme vytvořili tenký, plně spustitelný vertikální řez systémem propojující všechny klíčové architektonické komponenty:  
**Požadavek klienta $\rightarrow$ Doménová validace a invarianty $\rightarrow$ Změna stavu $\rightarrow$ Perzistence $\rightarrow$ Externí notifikační služba $\rightarrow$ Odpověď**.

### Jak walking skeleton spustit (1 příkaz)

Ke spuštění není potřeba instalovat žádné externí knihovny, stačí standardní **Python 3**:

```bash
python src/walking_skeleton.py
```
*(Alternativně lze spustit také přes: `python src/app.py --test`)*

### Průběh spustitelného scénáře krok za krokem:

1. **Inicializace repozitáře a notifikační služby:** Vytvoří se in-memory úložiště, mock notifikační brány a načtou se výchozí data (zaměstnankyně Jana, zaměstnanec Petr se zákazem řízení, správce flotily Martin, vozy Škoda Octavia a Škoda Superb).
2. **Standardní rezervace ($\le 3$ dny):** Jana vytvoří rezervaci vozu Škoda Octavia na 2 dny. Systém ověří platnost STK i její řidičské oprávnění, uloží rezervaci přímo ve stavu `CONFIRMED` a odešle potvrzovací notifikaci na její e-mail.
3. **Detekce kolize (Common business rule):** Manažer Martin se pokusí rezervovat stejnou Octavii v čase, který se překrývá s Janinou rezervací. Systém operaci odmítne a vyhodí kolizní chybu `ValueError`.
4. **Kontrola způsobilosti řidiče (Domain rule):** Uživatel Petr s pozastaveným oprávněním se pokusí vytvořit rezervaci. Systém požadavek odmítne s výjimkou `PermissionError`.
5. **Kontrola technické způsobilosti (STK rule):** Pokus o rezervaci vozu Škoda Superb s propadlou STK je systémem zamítnut.
6. **Nadlimitní rezervace a schvalovací workflow (> 3 dny):** Jana zažádá o 5denní rezervaci. Systém ji uloží ve stavu `PENDING` a zašle notifikaci správci. Následně správce Martin rezervaci schválí $\rightarrow$ přechod do stavu `CONFIRMED` a notifikace Janě.
7. **Storno rezervace a uvolnění termínu:** Jana zruší svou původní rezervaci č. 1. Stav se změní na `CANCELLED` a uvolněný termín je okamžitě opět k dispozici pro ostatní.

### Ukázka výstupu z konzole:

```text
======================================================================
 CAR-SIDE — CP1 WALKING SKELETON (END-TO-END VERIFIKACE)
======================================================================

[KROK 1] Inicializace repozitáře a notifikační služby...
  Data připravena: Uživatelé (Jana, Petr, manažer Martin), Vozidla (Octavia - platná STK, Superb - prošlá STK).

[KROK 2] End-to-end průchod: Vytvoření standardní rezervace (Jana -> Octavia, 2 dny)...
  [NOTIFIKACE -> jana.novakova@carside.cz]: Vaše rezervace vozidla Škoda Octavia Combi (č. 1) byla automaticky potvrzena.
  -> Výsledek: Vytvořena rezervace ID=1, Stav=CONFIRMED, Uživatel=jana.novakova@carside.cz
  [OK] Ověření úspěšné: Uloženo, potvrzeno, notifikace odeslána.

[KROK 3] Business rule check: Pokus o překrývající se rezervaci stejného vozu...
  [OK] Správně zachycena kolize: 'Vozidlo Škoda Octavia Combi je ve zvoleném termínu již rezervováno.'

[KROK 4] Domain rule check: Pokus uživatele s pozastaveným oprávněním (Petr Dvořák)...
  [OK] Správně zamítnuto: 'Uživatel Petr Dvořák má pozastavené oprávnění k řízení.'

[KROK 5] Domain rule check: Pokus o rezervaci vozu s prošlou STK...
  [OK] Správně zamítnuto: 'Vozidlo Škoda Superb má neplatnou STK a nelze jej rezervovat.'

[KROK 6] Workflow schvalování: Dlouhá rezervace (> 3 dny) vyžaduje schválení správcem...
  [NOTIFIKACE -> jana.novakova@carside.cz]: Rezervace č. 2 na vozidlo Škoda Octavia Combi přesahuje 3 dny a čeká na schválení správce.
  -> Vytvořena rezervace ID=2, Stav=PENDING (čeká na manažera)
  [NOTIFIKACE -> jana.novakova@carside.cz]: Vaše rezervace č. 2 byla správcem Martin Kučera schválena.
  -> Po schválení manažerem Martinem: Stav=CONFIRMED

[KROK 7] Storno rezervace: Uživatel zruší rezervaci -> uvolnění termínu...
  [NOTIFIKACE -> jana.novakova@carside.cz]: Rezervace č. 1 byla zrušena. Vozidlo bylo uvolněno pro další zájemce.
  -> Stav rezervace ID=1: CANCELLED
  [OK] Termín vozu byl úspěšně uvolněn pro další zájemce.

======================================================================
 VŠECHNY KONTROLY CP1 WALKING SKELETON ÚSPĚŠNĚ PROBĚHLY (PASS)
 Celkem odesláno notifikací: 4
======================================================================
```

---

## 🖥️ Spuštění interaktivní webové aplikace

Aplikace obsahuje plně funkční klientské rozhraní s kalendářem, interaktivním formulářem, schvalovací konzolí i správou vozového parku.

### Spuštění lokálního serveru:
```bash
python src/app.py
```
Skript automaticky spustí HTTP server a otevře aplikaci v prohlížeči na adrese **`http://localhost:8000`**.

### Interaktivní průchod aplikací:
1. **Přihlášení:** V pravém horním rohu klikněte na *Přihlásit se* a využijte demo účet:
   - **Zaměstnanec:** `jana.novakova@carside.cz` (heslo: `heslo`) – tvorba běžných rezervací, hlášení vad.
   - **Správce flotily:** `martin.kucera@carside.cz` (heslo: `heslo`) – schvalování rezervací, správa STK a aut.
   - **Administrátor:** `admin@carside.cz` (heslo: `heslo`) – správa uživatelů a řešení odvolání.
2. **Vytvoření rezervace:** Vyberte termín výpůjčky a vozidlo z nabídky. Při volbě termínu delšího než 3 dny aplikace upozorní na nutnost schválení manažerem.
3. **Ověření pravidel v reálném čase:** Systém v rozhraní vizuálně indikuje obsazenost v kalendáři, odpočítává zbývající čas výpůjčky a blokuje výběr aut s neplatnou STK.
4. **Auditní log:** V dolní liště aplikace lze rozbalit živý protokol systémových událostí (*Systémový protokol*).

---

## 📁 Struktura projektu

```plaintext
Car-side/
├── README.md                           # Hlavní přehled projektu, CP1 walking skeleton a návod
├── docs/                               # Strukturovaná projektová dokumentace
│   ├── intent-and-change.md            # Project Frame, doména, pravidla a plánované změny
│   ├── architecture-and-decisions.md   # Architektonický návrh, komponenty a ADR záznamy
│   ├── evidence-and-evolution.md       # C01 Engineering Spike, definice CP1 a roadmapa
│   └── future-pressure.txt             # Detailní rozbor budoucího tlaku (elektromobily)
├── diagrams/                           # UML diagramy a jejich dokumentace
│   ├── usecase-diagram/                # Případy užití (Use Case diagramy a dokumentace)
│   ├── sekvencni/                      # Původní sekvenční diagramy (bez tříd)
│   ├── sekvencni_tridy/                # Sekvenční diagramy s objekty tříd (puml, png, svg, pdf)
│   ├── aktivitni/                      # Aktivitní diagramy schvalování, převzetí a správy
│   └── tridni/                         # Diagram tříd doménového modelu
├── src/                                # Zdrojový kód aplikace
│   ├── walking_skeleton.py             # Spustitelný CP1 Walking Skeleton s automatizovanými testy
│   ├── app.py                          # Spouštěcí server webové aplikace
│   ├── app.js                          # Klientská doménová logika, kalendář a správa stavu
│   ├── mock-data.js                    # Výchozí datová sada (uživatelé, auta, rezervace)
│   ├── index.html                      # Uživatelské rozhraní aplikace
│   └── style.css                       # Vizuální styly rozhraní
└── Todo                                # Seznam úkolů pro navazující fáze
```

---

## 🚀 Další plánovaný vývoj (Roadmap)

- [x] **CP1:** Walking Skeleton – ověření doménových invariantů, překryvů a notifikací.
- [x] **CP2:** Model rolí a autorizace (Employee / Manager / Admin).
- [x] **CP3 / CP4:** Webové rozhraní, interaktivní kalendář obsazenosti (Timetable), evidence STK a vad.
- [ ] **CP5:** Přechod na trvalou SQL databázi (PostgreSQL), REST API a autentizace tokeny.
- [ ] **Budoucí rozšíření:** Integrace IoT telemetrie (GPS, odečet tachometru) a správa dobíjení elektromobilů dle *Future Pressure C*.
