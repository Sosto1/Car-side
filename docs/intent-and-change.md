# Project Frame

## Reservation domain
Rezervace sdíleného vozidla

## Purpose
Systém slouží firmám k efektivnímu manažování a sdílení firemních vozů napříč zaměstnanci. Součástí je kalendář rezervací a přehled aktuálního stavu vozového parku (dostupnost, klíče, stav tachometru).

## Users / Stakeholders
1–3 role.

## Core concepts
Reservation, Resource, User + případně 0–3 další pojmy.

## Core operations
Reservation
Vehicle
User
Vehicle State
Location and time


## Persistent state
Reservation: id, vehicle_id, user_id, start_time, end_time, status
User: id, contact info, name
Vehicle: id, vin, spz, model, status
Manger: id, contact info, name 

## State-changing operation
DRAFT  → PENDING → CONFIRMED → IN_PROGRESS → COMPLETED

## Common business rule
Confirmed reservations for the same resource must not overlap

## Domain-specific business rule
Uživatel musí být 1 rok bez nehody

## External / system boundary
Služba pro odesílání e-mailových oznámení uživatelům o změně stavu rezervace (např. Rezervace byla schválena, Blíží se čas vrácení vozu).

## Assumption
Vozidlo bude bez poruchy.

## Unknown
Zatím nevíme, zda má schvalování rezervací probíhat výhradně ručně, nebo zda má existovat pravidlo pro automatické schvalování.