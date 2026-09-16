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