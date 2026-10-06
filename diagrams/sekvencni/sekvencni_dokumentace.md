# Dokumentace k sekvenčním diagramům

## 1. Historie a audit
**Účel:** Zobrazení historie jízd a auditních záznamů s možností filtrování.
**Aktéři:** Správce vozového parku, Systém
**Hlavní tok:**
1. **Správce vozového parku** odešle požadavek na prohlížení historie jízd.
2. Správce může volitelně zadat filtry (řidič, vozidlo, období) `<<extend>>`.
3. **Systém** aplikuje filtry na uložená data.
4. Systém zpracuje a vypočítá najeté kilometry `<<extend>>`.
5. Systém zobrazí výslednou filtrovanou historii a kilometry Správci.

---

## 2. Digitální přístup k vozidlu
**Účel:** Nahlášení ztráty přístupového zařízení a správa blokace vozidla.
**Aktéři:** Zaměstnanec, Systém, Správce vozového parku
**Hlavní tok:**
1. **Zaměstnanec** nahlásí ztrátu zařízení nebo klíče.
2. **Systém** automaticky zašle notifikaci a požadavek na blokaci **Správci vozového parku** `<<include>>`.
3. Správce provede blokaci přístupu k vozidlu v Systému.
4. Systém potvrdí Zaměstnanci přijetí hlášení a úspěšnou blokaci.
5. *(Pozdější akce)* Správce může v Systému přístup k vozidlu opět obnovit.
6. Systém informuje Zaměstnance o obnovení přístupu.

---

## 3. Provoz a stav vozidla
**Účel:** Zaznamenání stavu vozidla při jeho vrácení, včetně automatického odečtu dat z vozidla.
**Aktéři:** Zaměstnanec, Systém, Připojené vozidlo, Správce vozového parku
**Hlavní tok:**
1. **Zaměstnanec** zahájí kontrolu stavu při vrácení vozidla.
2. **Připojené vozidlo** automaticky přenese do Systému aktuální stav tachometru a paliva.
3. Pokud zaměstnanec zjistí poškození `<<extend>>`:
   - Zaměstnanec nahlásí závadu nebo poškození.
   - Systém upozorní **Správce vozového parku** na novou škodu.
   - Správce zahájí řešení škody nebo servisu `<<include>>`.
4. Systém potvrdí Zaměstnanci úspěšné ukončení kontroly.

---

## 4. Rezervační systém sdílených vozidel (Obecný)
**Účel:** Základní proces vytvoření a schválení rezervace vozidla.
**Aktéři:** Zaměstnanec, Systém, Správce vozového parku
**Hlavní tok:**
1. **Zaměstnanec** vytvoří požadavek na rezervaci vozidla.
2. **Systém** provede kontrolu dostupnosti vybraného vozidla `<<include>>`.
3. Systém předá požadavek **Správci vozového parku** ke schválení.
4. Správce rezervaci buď schválí, nebo zamítne.
5. Systém informuje Zaměstnance o výsledku schvalovacího procesu.

---

## 5. Správa rezervací (Detailní flow s notifikacemi)
**Účel:** Detailní rezervační proces zahrnující stavy rezervace a emailové notifikace.
**Aktéři:** Zaměstnanec, Systém, Notifikační služba, Správce vozového parku
**Hlavní tok:**
1. **Zaměstnanec** vytvoří rezervaci (výchozí stav: *DRAFT*).
2. **Systém** zkontroluje dostupnost vozidla `<<include>>`.
3. Systém ověří způsobilost uživatele (např. 1 rok bez nehody) `<<include>>`.
4. Systém změní stav rezervace na *PENDING*.
5. Volitelně `<<extend>>` Systém přes **Notifikační službu** odešle emailové upozornění na novou rezervaci **Správci vozového parku**.
6. Správce rezervaci schválí.
7. Systém změní stav rezervace na *APPROVED*.
8. Volitelně `<<extend>>` Systém odešle přes Notifikační službu informační email Zaměstnanci o schválení rezervace.

---

## 6. Správa řidičských oprávnění
**Účel:** Evidence a kontrola platnosti řidičských průkazů zaměstnanců.
**Aktéři:** Zaměstnanec, Systém, Správce vozového parku
**Hlavní tok:**
1. **Zaměstnanec** nahraje do systému svůj řidičský průkaz.
2. **Systém** provede prvotní kontrolu platnosti oprávnění `<<include>>`.
3. Systém upozorní **Správce vozového parku** na nový průkaz čekající na schválení.
4. Správce průkaz schválí (proces obsahuje opětovnou kontrolu `<<include>>`).
5. Systém informuje Zaměstnance o úspěšném schválení.
6. *(Automatická kontrola)* Systém průběžně detekuje blížící se konec platnosti průkazů.
7. Při zjištění končící platnosti Systém automaticky upozorní Zaměstnance `<<include>>` (společně s kontrolou).

---

## 7. Správa uživatelů a přístupů
**Účel:** Proces vytvoření nového uživatelského účtu a přiřazení rolí administrátorem.
**Aktéři:** Administrátor, Systém
**Hlavní tok:**
1. **Administrátor** iniciuje vytvoření nového uživatelského účtu.
2. **Systém** požádá o ověření identity administrátora `<<include>>`.
3. Administrátor ověří svou identitu (např. přihlášení nebo token).
4. Systém zpřístupní možnosti nastavení nového účtu.
5. Administrátor přiřadí uživateli příslušnou roli (Zaměstnanec / Manažer).
6. Systém potvrdí úspěšné vytvoření účtu a uložení přidělené role.