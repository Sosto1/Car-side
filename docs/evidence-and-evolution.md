# C01 Engineering Spike

Question / unknown:
Jakým způsobem strukturovat hlavní vstupní bod naší backendové aplikace a jak připravit kostru pro budoucí API rezervačního systému?

What we did:
Vytvořili jsme základní adresářovou strukturu projektu a inicializační soubor `main.py`. Zkoumali jsme, zda bude pro začátek stačit spustitelný Python skript pro simulaci doménové logiky, nebo zda aplikaci rovnou připravit pro nasazení s webovým frameworkem (např. Flask).

Observed result:
Použití čistého skriptu by nám ztížilo pozdější přechod na reálné API. Pro operace jako vytvoření rezervace nebo kontrolu stavu vozidla budeme brzy potřebovat přijímat HTTP požadavky od klientů (uživatelů). 

Decision / what changes because of the result:
Rozhodli jsme se založit `main.py` rovnou jako spouštěcí soubor (bootstrap) připravený pro lehký webový framework (např. Flask). Tento soubor bude mít na starosti start serveru a základní konfiguraci, na kterou v dalších fázích napojíme routy pro náš doménový model (např. endpoint `/reservations`).