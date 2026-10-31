# Návrhové vzory – Car-side

Přednáška *Software Engineering* definuje návrhový vzor jako popis spolupracujících objektů a tříd, který řeší
obecný návrhový problém v konkrétním kontextu. V návrhu systému Car-side jsou použité čtyři vzory z přednášky.
Každý řeší problém, který je vidět v současném kódu nebo v plánovaném rozšíření.

| Vzor | Skupina | Problém v Car-side | Diagram |
|---|---|---|---|
| **State** | chování | Rezervace se v každém stavu chová jinak | [NV01](NV01_State.puml) |
| **Chain of Responsibility** | chování | Nová rezervace musí projít několika kontrolami a budou přibývat další | [NV02](NV02_ChainOfResponsibility.puml) |
| **Observer** | chování | Po každé změně stavu se musí poslat upozornění a zapsat protokol | [NV03](NV03_Observer.puml) |
| **Adapter** | strukturální | Doména nemá záviset na konkrétní databázi a e-mailové službě | [NV04](NV04_Adapter.puml) |

Sekvenční diagramy ukazují vzory za běhu: [NV05](NV05_Sekvence_VytvoreniRezervace.puml) je odeslání rezervace,
[NV06](NV06_Sekvence_SchvaleniRezervace.puml) její schválení.

> **Stav implementace:** jde o návrh. Současný kód v [app.js](../../src/app.js) a [server.js](../../server/server.js)
> tyto třídy zatím neobsahuje, používá textové stavy a přímá volání.

---

## State – stavy rezervace

**Problém:** rezervace má sedm stavů a v každém smí dělat něco jiného. Bez vzoru by každá operace obsahovala
podmínky typu `if (status === "PENDING") ... else if (status === "CONFIRMED") ...`. Nový stav by znamenal změnu všech těchto míst.

**Řešení:** každý stav je samostatná třída. `Rezervace` si drží aktuální stav a každou operaci mu jen předá.
Třída stavu sama rozhodne, co se stane, a případně nastaví další stav. Objekt se navenek chová, jako by změnil svou třídu.

| Přednáška | Car-side | Role |
|---|---|---|
| `TCPConnection` | `Rezervace` | Context, objekt, jehož chování se mění |
| `State` | `StavRezervace` | společné rozhraní stavů |
| `Listening`, `Established`, `Closed` | `Koncept`, `CekaNaSchvaleni`, `Potvrzena`, `Probiha`, `Dokoncena`, `Zamitnuta`, `Zrusena` | konkrétní stavy |
| `open()`, `close()`, `acknowledge()` | `odeslat()`, `schvalit()`, `zamitnout()`, `zmenitTermin()`, `zrusit()`, `prevzit()`, `vratit()` | operace závislé na stavu |
| `setState(state)` | `nastavStav(s)` | přepnutí stavu |

Povolené operace přesně odpovídají [stavovému diagramu STD01](../stavove/STD01_Rezervace.puml):

| Stav | Operace | Nový stav |
|---|---|---|
| Koncept | `odeslat()` | Potvrzena (≤ 3 dny), CekaNaSchvaleni (> 3 dny), při chybě beze změny |
| CekaNaSchvaleni | `schvalit()` | Potvrzena |
| CekaNaSchvaleni | `zamitnout()` | Zamitnuta |
| CekaNaSchvaleni | `zrusit()` | Zrusena |
| Potvrzena | `zmenitTermin()` | Potvrzena (≤ 3 dny), CekaNaSchvaleni (> 3 dny), při kolizi beze změny |
| Potvrzena | `zrusit()` | Zrusena |
| Potvrzena | `prevzit()` | Probiha, mimo termín chyba |
| Probiha | `vratit()` | Dokoncena |
| Dokoncena, Zamitnuta, Zrusena | žádná | koncové stavy |

Rozdíl proti přednášce: u `TCPConnection` jsou nepovolené operace prázdné. U rezervace by tiché ignorování bylo chybou,
protože uživatel musí vědět, že se operace neprovedla. Proto `StavRezervace` má jako výchozí chování chybu a podtřídy
přepisují jen povolené operace.

## Chain of Responsibility – ověření rezervace

**Problém:** před uložením rezervace je potřeba postupně ověřit termín, řidiče, STK a dostupnost (SD01). Kdyby to byla
jedna dlouhá metoda, každá nová kontrola by ji rozšiřovala.

**Řešení:** každá kontrola je samostatný článek řetězu. Článek buď najde problém a vrátí text chyby, nebo předá rezervaci dalšímu.
Pořadí článků je stejné jako pořadí kontrol v SD01.

| Přednáška | Car-side | Role |
|---|---|---|
| `HelpHandler` | `KontrolaRezervace` | společný předek článků, zná další článek |
| `Application`, `Dialog`, `Button` | `KontrolaTerminu`, `KontrolaRidice`, `KontrolaSTK`, `KontrolaDostupnosti` | konkrétní články |
| `handleHelp()` | `over(r)` | zpracování požadavku |
| `Client` | `Koncept` | spouští řetěz |

**Přínos pro Future Pressure C:** kontrola nabití elektromobilu (min. 20 %) se přidá jako nový článek `KontrolaNabiti`,
ostatní kontroly ani třída `Rezervace` se nemění. To odpovídá požadavku přidat nový typ zdroje bez přepisování jádra.

Rozdíl proti přednášce: v přednášce požadavek vyřídí první článek, který to umí, a ostatní se nevolají. Zde řetěz projde
všemi články, pokud je vše v pořádku, a končí prvním článkem, který najde chybu.

## Observer – reakce na změnu stavu

**Problém:** v `app.js` se po změnách ručně volají `pushNotif()` a `pushLog()` na mnoha místech. Když se na některé
zapomene, zaměstnanec se o změně nedozví nebo chybí záznam v protokolu.

**Řešení:** `Rezervace` je pozorovaný objekt. Metoda `nastavStav()` změnu uloží a zavolá `notify()`, které upozorní
všechny přihlášené pozorovatele. Protože každý přechod ze vzoru State vede přes `nastavStav()`, nelze na upozornění zapomenout.

| Přednáška | Car-side | Role |
|---|---|---|
| `Subject` | `Subjekt` | správa pozorovatelů, `attach()`, `detach()`, `notify()` |
| `StockMarket` | `Rezervace` | konkrétní pozorovaný objekt |
| `changeData()` | `nastavStav()` | změna, která spouští upozornění |
| `Observer` | `PozorovatelRezervace` | rozhraní s `update()` |
| `TextView`, `BarChart` | `EmailovyPozorovatel`, `AuditniLog` | konkrétní pozorovatelé |

Rozdíl proti přednášce: `update(r)` dostává rezervaci jako parametr, protože jeden pozorovatel může sledovat více rezervací.

## Adapter – databáze a e-mailová služba

**Problém:** knihovna `sqlite3` pracuje s SQL a callbacky, e-mailová služba má vlastní rozhraní. Kdyby je doména volala přímo,
změna databáze nebo e-mailové služby by zasáhla doménovou logiku a testy by potřebovaly skutečnou databázi.

**Řešení:** doména používá vlastní rozhraní `Databaze` a `NotifikacniSluzba`. Adaptér je implementuje a volání překládá
na cizí knihovnu. Tím je naplněné oddělení domény od okolí z [ADR-01](../../docs/architecture-and-decisions.md) a izolace notifikací z ADR-04.

| Přednáška | Car-side: databáze | Car-side: e-mail | Role |
|---|---|---|---|
| `GraphicEditor` | `Rezervace` | `EmailovyPozorovatel` | klient |
| `Shape` | `Databaze` | `NotifikacniSluzba` | rozhraní, které klient očekává |
| `TextShape` | `SqlDatabaze` | `EmailNotifikace` | adaptér |
| `TextView` | `sqlite3.Database` | `SmtpKlient` | cizí třída s nekompatibilním rozhraním |
| `LineShape` | `InMemoryDatabaze` | `MockNotifikace` | běžná implementace bez adaptace |

## Jak vzory spolupracují

**Odeslání rezervace (NV05):** `Rezervace` předá `odeslat()` stavu `Koncept` (State). Ten spustí řetěz kontrol
(Chain of Responsibility). Když projdou, podle délky vytvoří nový stav a zavolá `nastavStav()`.

**Schválení rezervace (NV06):** `Rezervace` předá `schvalit()` stavu `CekaNaSchvaleni` (State), který nastaví stav `Potvrzena`.
`nastavStav()` uloží změnu přes `SqlDatabaze` a zavolá `notify()` (Observer). `EmailovyPozorovatel` pošle zprávu přes `EmailNotifikace` (Adapter).
Druhá část diagramu ukazuje, že `zamitnout()` ve stavu `Potvrzena` skončí chybou bez jediné podmínky navíc.

## Změny proti analytickému modelu

Sekvenční diagramy SD01–SD08 a třídní diagram TD01 zůstávají analytickým pohledem. Návrh je zpřesňuje takto:

| Analýza (TD01, SD01, SD03) | Návrh (NV01–NV06) |
|---|---|
| `StavRezervace` je výčtový typ | `StavRezervace` je abstraktní třída s podtřídami; do databáze se ukládá `getNazev()` a zpět se načte přes `zNazvu()` |
| `potvrdit()`, `cekatNaSchvaleni()` jsou metody `Rezervace` | přechod provede třída stavu voláním `nastavStav()` |
| `jeTerminPlatny()`, `muzeRidit()`, `maPlatnouSTK()`, `jeDostupne()` volá přímo `Rezervace` | volají je články řetězu kontrol |
| `Rezervace` sama volá `NotifikacniSluzba` | volá ji `EmailovyPozorovatel` |
| kontrola `stav <> PENDING` je fragment `break` v SD03 | zajišťuje ji výchozí chyba ve `StavRezervace` |

## Proč ne další vzory

Ostatní vzory z přednášky nejsou použité, protože v Car-side neřeší žádný aktuální problém. Například **Strategy** pro
elektromobily by jen duplikoval řešení přes nový článek řetězu a **Factory** by neměl rodiny souvisejících objektů, které by vytvářel.

## Výstupy

| Složka | Obsah |
|---|---|
| `*.puml` | zdrojové PlantUML soubory |
| [png/](png/) | rastrové obrázky |
| [svg/](svg/) | vektorové obrázky |
| [pdf/](pdf/) | PDF každého diagramu zvlášť |
| [Navrhove_vzory.pdf](Navrhove_vzory.pdf) | všechny diagramy v jednom PDF |
