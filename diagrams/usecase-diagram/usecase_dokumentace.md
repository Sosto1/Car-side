# Dokumentace Use Case diagramů

## Digitální klíč
- **Účel systému:** Správa digitálního přístupu ke služebním vozidlům.
- **Zaměstnanec:** Digitálně odemyká/zamyká vozidlo a hlásí ztrátu přístupového zařízení.
- **Správce vozového parku:** Blokuje přístup (např. po ztrátě klíče) nebo jej opětně obnovuje.
- **Vazba (Include):** Nahlášení ztráty zařízení automaticky vyvolává nutnost blokace přístupu do systému.

## Historie Jízd
- **Účel systému:** Sledování historie jízd, najetých kilometrů a auditních logů ve vozovém parku.
- **Správce vozového parku:** Prohlíží historii jízd a auditní logy.
- **Administrátor:** Prohlíží auditní logy systému.
- **Vazby (Extend):**
  - Zobrazení najetých kilometrů volitelně rozšiřuje prohlížení historie jízd.
  - Filtrování (dle řidiče, vozidla a období) může rozšiřovat jak historii jízd, tak prohlížení auditních logů pro přesnější dohledání dat.

## Provoz Vozidla
- **Účel systému:** Správa provozu, stavu vozidla a hlášení závad.
- **Zaměstnanec:** Kontroluje stav při převzetí/vrácení auta a hlásí jeho poškození nebo závady.
- **Správce vozového parku:** Řeší nahlášené škody a servis vozidel.
- **Vazby (Include / Extend):**
  - Zadání tachometru a paliva je povinnou součástí (include) kontroly stavu vozidla.
  - Hlášení závady může volitelně rozšířit (extend) kontrolu stavu.
  - Řešení škody/servisu je povinně vyvoláno (include) nahlášením závady nebo poškození.

## Rezervace
- **Účel systému:** Rezervace a kompletní správa sdílených vozidel (car-sharing).
- **Zaměstnanec:** Vytváří, upravuje nebo ruší vlastní rezervace a provádí převzetí či vrácení vozidla.
- **Správce vozového parku:** Schvaluje či zamítá rezervace, spravuje auta (STK, servis, přidávání) a může upravit nebo zrušit rezervaci komukoliv.
- **Administrátor:** Spravuje uživatele a jejich přístupová práva do systému.
- **Vazba (Include):** Vytvoření rezervace automaticky vyžaduje kontrolu dostupnosti vozidla.

## Řidičský průkaz
- **Účel systému:** Správa a ověřování platnosti řidičských oprávnění.
- **Zaměstnanec / Správce:** Nahrávají řidičský průkaz do systému.
- **Správce vozového parku:** Schvaluje nebo zamítá nahraná řidičská oprávnění.
- **Systém:** Automaticky generuje upozornění na blížící se konec platnosti.
- **Vazby (Include):** Nahrání průkazu, jeho schválení i upozornění na konec platnosti jsou pevně spjaty s kontrolou platnosti řidičského oprávnění.

## Správa Rezervací
- **Účel systému:** Pokročilá správa rezervací, včetně kontroly způsobilosti řidiče a notifikací.
- **Zaměstnanec:** Vytváří, upravuje, ruší rezervace a provádí převzetí či vrácení vozidla.
- **Správce vozového parku:** Schvaluje/zamítá rezervace a může upravit nebo zrušit rezervaci komukoliv.
- **Emailová notifikační služba:** Přijímá požadavky na odesílání emailů o změně stavu.
- **Vazby (Include / Extend):**
  - Vytvoření rezervace vyžaduje kontrolu dostupnosti a ověření způsobilosti (1 rok bez nehody); úprava rezervace rovněž kontroluje dostupnost.
  - Vytvoření rezervace a její schválení mohou volitelně rozšířit (extend) proces o odeslání emailové notifikace.

## Správa účtů
- **Účel systému:** Správa uživatelských účtů, přístupových rolí a zabezpečení v systému.
- **Administrátor:** Vytváří uživatelské účty, přiřazuje role (Zaměstnanec / Manažer) a provádí deaktivaci nebo smazání účtů.
- **Zaměstnanec:** Může si sám požádat o reset hesla.
- **Vazby (Include):** Vytvoření uživatelského účtu i reset hesla jsou pevně spjaty s ověřením identity při přihlášení.