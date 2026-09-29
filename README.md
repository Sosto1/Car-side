# Car-side
Aplikace pro firemní sdílení vozidel
```plaintext
README.md
docs/
  intent-and-change.md 
  evidence-and-evolution.md
src/ 
```
## CP1 walking skeleton
POST /reservations
-> validate (ověření, zda se čas rezervace nepřekrývá s jinou a zda je vozidlo dostupné)
-> persist (uložení vytvořené rezervace do databáze/paměti ve stavu PENDING)
-> return reservation ID (vrácení vygenerovaného ID rezervace klientovi)
-> automated check (automatizovaný test, který endpoint zavolá a ověří, že vrátil správné ID a HTTP status)

## CP 3 -> 4/5

### ADD
* Udělat timetable pro jednotlivé auta pro přehlednější a snazší rezervaci
* Upravit profil správce a admina, aby editování/přidávání vozidel/rezervací/zaměstnanců mělo vlastní formulář a bylo to více interaktivní než pouhý textbox bez potvrzovacího tlačítka
* Udělat profily jednotlivých zaměstnanců a vozidel obsáhlejší (např. datum STK)
* Logo/tlačítko "Car side" přesměruje na hlavní stránku

### FIX
* Ošetřit, aby si každý zaměstnanec mohl zarezervovat max 1 auto v určitém čase
* Opravit tlačítko "tento víkend", jelikož tlačítko je schopno nabídnout minulý čas, což je v rozporu s aktuálním nastavením
* Pokud zůstane formulář pro zadání data půjčení/vrácení, tak zašednout data v minulosti pro lepší přehlednost

---

## FOLLOWING
* Zprovoznit posílání emailů/sms pro potvrzení rezervace (půjčení a vrácení auta)
* Zprovoznit posílání emailů/sms pro obnovení hesla
* Navrhnout a implementovat plnohodnotnou databázi (vozidel, zaměstnanců, správců + adminů)
* Implementovat systém sledování vozidla (GPS)
* Ošetřit stav/následky, pokud se vozidlo nevrátí v požadovaný čas (např. pokud čas přesáhne hodinu, bude sankce pro zaměstnance zákaz půjčovat firemní vozidla po dobu jednoho týdne -> umožnit zaměstnanci možnost rezervaci prodloužit, pokud to je možné a není už vozidlo rezervováno někým jiným, popř. přidat, aby mezi jednotlivými rezervacemi byla hodina volná, aby se vozidlo stihlo vrátit, případně aby byl čas ho nahradit jiným vozidlem a jiný zaměstnanec měl tak vozidlo včas)
* Udělat systém intuitivní a jednoduchý
* Zlepšit grafické rozhraní
* Ošetřit všechny potenciální chyby
* (Udělat mobilní aplikaci?)
