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
ADD
-> udělat timetable pro jednotlivé auta pro přehlednější a snazší rezervaci
-> upravit profil správce a admina, aby editování/přidávání vozidel/rezervací/zaměstnanců mělo vlastní formulář a bylo to více interaktivní než pouhý textbox bez potvrzovacího tlačítka
-> udělat profily jednotlivých zaměstnanců a vozidel obsáhlejší (např. datum STK)
-> logo/tlačítko "Car side" přesměruje na hlavní stránku

FIX
-> ošetřit, aby si každý zaměstnanec mohl zarezervovat max 1 auto v určitém čase
-> opravit tlačítko "tento víkend", jelikož tlačítko je schopno nabídnou minulý čas, což je v rozporu s aktualním nastavením
-> pokud zůstane formulář pro zadání data půjčení/vrácení, tak zašednout data v minulosti pro lepší přehlednost



## FOLLOWING
-> zprovoznit posílání emailů/sms pro potvrzení rezervace (půjčení a vrácení auta)
-> zprovoznit posílání emailů/sms pro obnovení hesla
-> navrhnout a implementovat plnohodnotnou databázi (vozidel, zaměstananců, správců + adminů)
-> implementovat systém sledování vozidla (GPS)
-> ošetřit stav/následky, pokud se vozidlo nevrátí v požadovaný čas (např. pokud čas přesáhne hodinu, bude sankce pro zaměstnance zákaz půjčovat firemní vozidla po dobu jednoho týdne -> umožnit zaměstnancovi možnost rezervaci prodloužit, pokud to je možné a není už vozidlo rezervováno někým jiným, popř. přidat, aby mezi jednotlivými rezervacemi byla hodina volná, aby se vozidlo stihlo vrátit, případně aby byl čas ho nahradit jiným vozidlem a jiný zaměstnanec měl tak vozidlo včas

-> udělat systém intuitivní a jednoduchý
-> zlepšit grafické rozhraní
-> ošetřit všechny potenciální chyby
-> (udělat mobilní aplikaci?)
