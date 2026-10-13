"""
Car-side — CP1 Walking Skeleton
End-to-End spustitelná demonstrace doménového jádra rezervačního systému.
Tento skript propojuje všechny klíčové architektonické komponenty:
Request -> Domain Validation -> Persistence -> State Change -> Notification Service -> Response.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
import sys

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


# ==============================================================================
# 1. Domain Entities & Value Objects
# ==============================================================================

class ReservationStatus:
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


@dataclass
class User:
    id: int
    name: str
    email: str
    role: str  # 'employee', 'manager', 'admin'
    can_drive: bool = True


@dataclass
class Vehicle:
    id: int
    name: str
    plate: str
    stk_valid_until: datetime
    is_active: bool = True


@dataclass
class Reservation:
    id: Optional[int]
    vehicle_id: int
    user_id: int
    user_email: str
    start_time: datetime
    end_time: datetime
    status: str = ReservationStatus.DRAFT
    created_at: datetime = field(default_factory=datetime.now)


# ==============================================================================
# 2. External / System Boundary: Notification Service Mock
# ==============================================================================

class NotificationService:
    def __init__(self):
        self.sent_notifications: List[Dict[str, str]] = []

    def send(self, recipient: str, message: str) -> None:
        record = {"recipient": recipient, "message": message, "timestamp": datetime.now().isoformat()}
        self.sent_notifications.append(record)
        print(f"  [NOTIFIKACE -> {recipient}]: {message}")


# ==============================================================================
# 3. Persistence: In-Memory Repository
# ==============================================================================

class InMemoryReservationRepository:
    def __init__(self):
        self._reservations: Dict[int, Reservation] = {}
        self._next_id: int = 1

    def save(self, reservation: Reservation) -> Reservation:
        if reservation.id is None:
            reservation.id = self._next_id
            self._next_id += 1
        self._reservations[reservation.id] = reservation
        return reservation

    def get_by_id(self, res_id: int) -> Optional[Reservation]:
        return self._reservations.get(res_id)

    def find_active_for_vehicle(self, vehicle_id: int) -> List[Reservation]:
        active_statuses = {ReservationStatus.CONFIRMED, ReservationStatus.PENDING, ReservationStatus.IN_PROGRESS}
        return [
            r for r in self._reservations.values()
            if r.vehicle_id == vehicle_id and r.status in active_statuses
        ]

    def find_active_for_user(self, user_id: int) -> List[Reservation]:
        active_statuses = {ReservationStatus.CONFIRMED, ReservationStatus.PENDING, ReservationStatus.IN_PROGRESS}
        return [
            r for r in self._reservations.values()
            if r.user_id == user_id and r.status in active_statuses
        ]


# ==============================================================================
# 4. Domain Service & Business Logic
# ==============================================================================

class ReservationService:
    STANDARD_MAX_DAYS = 3

    def __init__(self, repo: InMemoryReservationRepository, notif_service: NotificationService):
        self.repo = repo
        self.notif_service = notif_service

    @staticmethod
    def _is_overlapping(start1: datetime, end1: datetime, start2: datetime, end2: datetime) -> bool:
        """Confirmed/active reservations for the same resource must not overlap."""
        return start1 < end2 and start2 < end1

    def check_availability(self, vehicle: Vehicle, start: datetime, end: datetime) -> bool:
        """Ověří, zda je vozidlo dostupné a má platnou STK."""
        if vehicle.stk_valid_until < datetime.now():
            return False
        existing = self.repo.find_active_for_vehicle(vehicle.id)
        for res in existing:
            if self._is_overlapping(start, end, res.start_time, res.end_time):
                return False
        return True

    def create_reservation(self, user: User, vehicle: Vehicle, start: datetime, end: datetime) -> Reservation:
        """
        End-to-End operace vytvoření rezervace:
        1. Ověření platnosti časového intervalu
        2. Ověření způsobilosti řidiče
        3. Ověření STK vozidla
        4. Omezení: max 1 vozidlo pro zaměstnance ve stejném čase
        5. Ověření překryvu s jinou rezervací (Common business rule)
        6. Nastavení stavu (<= 3 dny CONFIRMED, > 3 dny PENDING)
        7. Perzistence
        8. Odeslání notifikace
        """
        now = datetime.now()
        if start >= end:
            raise ValueError("Čas začátku rezervace musí předcházet času ukončení.")
        if start < now:
            raise ValueError("Nelze vytvořit rezervaci v minulosti.")
        if (end - start).total_seconds() < 1800:
            raise ValueError("Minimální délka rezervace je 30 minut.")

        # Domain-specific rule: Oprávnění k řízení
        if not user.can_drive:
            raise PermissionError(f"Uživatel {user.name} má pozastavené oprávnění k řízení.")

        # Kontrola STK
        if vehicle.stk_valid_until < now:
            raise ValueError(f"Vozidlo {vehicle.name} má neplatnou STK a nelze jej rezervovat.")

        # Pravidlo: 1 uživatel = max 1 rezervované vozidlo v daném čase
        user_res = self.repo.find_active_for_user(user.id)
        for r in user_res:
            if self._is_overlapping(start, end, r.start_time, r.end_time):
                raise ValueError("Uživatel již má v tomto čase aktivní rezervaci jiného vozidla.")

        # Common business rule: Žádný překryv pro stejné vozidlo
        if not self.check_availability(vehicle, start, end):
            raise ValueError(f"Vozidlo {vehicle.name} je ve zvoleném termínu již rezervováno.")

        # Určení výchozího stavu podle délky
        duration_days = (end - start).total_seconds() / 86400
        if duration_days <= self.STANDARD_MAX_DAYS:
            initial_status = ReservationStatus.CONFIRMED
        else:
            initial_status = ReservationStatus.PENDING

        reservation = Reservation(
            id=None,
            vehicle_id=vehicle.id,
            user_id=user.id,
            user_email=user.email,
            start_time=start,
            end_time=end,
            status=initial_status
        )

        saved = self.repo.save(reservation)

        # External boundary: notifikace
        if saved.status == ReservationStatus.CONFIRMED:
            self.notif_service.send(
                user.email,
                f"Vaše rezervace vozidla {vehicle.name} (č. {saved.id}) byla automaticky potvrzena."
            )
        else:
            self.notif_service.send(
                user.email,
                f"Rezervace č. {saved.id} na vozidlo {vehicle.name} přesahuje 3 dny a čeká na schválení správce."
            )

        return saved

    def approve_reservation(self, manager: User, res_id: int) -> Reservation:
        """Schválení rezervace manažerem (PENDING -> CONFIRMED)."""
        if manager.role not in ("manager", "admin"):
            raise PermissionError("Pouze správce flotily nebo admin může schvalovat rezervace.")

        res = self.repo.get_by_id(res_id)
        if not res:
            raise KeyError(f"Rezervace ID {res_id} nenalezena.")
        if res.status != ReservationStatus.PENDING:
            raise ValueError(f"Rezervaci ve stavu {res.status} nelze schválit.")

        res.status = ReservationStatus.CONFIRMED
        self.repo.save(res)

        self.notif_service.send(
            res.user_email,
            f"Vaše rezervace č. {res.id} byla správcem {manager.name} schválena."
        )
        return res

    def cancel_reservation(self, user: User, res_id: int) -> Reservation:
        """Zrušení rezervace uživatelem nebo manažerem -> CANCELLED."""
        res = self.repo.get_by_id(res_id)
        if not res:
            raise KeyError(f"Rezervace ID {res_id} nenalezena.")
        if user.role not in ("manager", "admin") and user.id != res.user_id:
            raise PermissionError("Nemáte oprávnění zrušit cizí rezervaci.")

        res.status = ReservationStatus.CANCELLED
        self.repo.save(res)

        self.notif_service.send(
            res.user_email,
            f"Rezervace č. {res.id} byla zrušena. Vozidlo bylo uvolněno pro další zájemce."
        )
        return res


# ==============================================================================
# 5. Runnable End-to-End Walking Skeleton Scenario
# ==============================================================================

def run_walking_skeleton() -> bool:
    print("=" * 70)
    print(" CAR-SIDE — CP1 WALKING SKELETON (END-TO-END VERIFIKACE)")
    print("=" * 70)

    # 1. Inicializace závislostí a perzistence
    print("\n[KROK 1] Inicializace repozitáře a notifikační služby...")
    repo = InMemoryReservationRepository()
    notif_service = NotificationService()
    service = ReservationService(repo, notif_service)

    # Seed data
    jana = User(id=1, name="Jana Nováková", email="jana.novakova@carside.cz", role="employee", can_drive=True)
    petr = User(id=2, name="Petr Dvořák", email="petr.dvorak@carside.cz", role="employee", can_drive=False)
    martin = User(id=4, name="Martin Kučera", email="martin.kucera@carside.cz", role="manager", can_drive=True)

    octavia = Vehicle(id=1, name="Škoda Octavia Combi", plate="4AB 1234", stk_valid_until=datetime(2027, 12, 31))
    superb_bad_stk = Vehicle(id=3, name="Škoda Superb", plate="1HI 9988", stk_valid_until=datetime(2025, 1, 1))

    print("  Data připravena: Uživatelé (Jana, Petr, manažer Martin), Vozidla (Octavia - platná STK, Superb - prošlá STK).")

    # 2. Úspěšné vytvoření krátké rezervace (<= 3 dny) -> automaticky CONFIRMED
    print("\n[KROK 2] End-to-end průchod: Vytvoření standardní rezervace (Jana -> Octavia, 2 dny)...")
    start1 = datetime(2026, 11, 2, 8, 0)
    end1 = datetime(2026, 11, 4, 17, 0)
    res1 = service.create_reservation(jana, octavia, start1, end1)

    print(f"  -> Výsledek: Vytvořena rezervace ID={res1.id}, Stav={res1.status}, Uživatel={res1.user_email}")
    assert res1.id == 1, "Rezervace musí mít přiděleno unikátní ID"
    assert res1.status == ReservationStatus.CONFIRMED, "Rezervace <= 3 dny musí být automaticky CONFIRMED"
    assert len(notif_service.sent_notifications) == 1, "Musí být odeslána 1 notifikace"
    print("  [OK] Ověření úspěšné: Uloženo, potvrzeno, notifikace odeslána.")

    # 3. Kontrola kolize: Pokus o překrývající se rezervaci na stejné vozidlo (Common business rule)
    print("\n[KROK 3] Business rule check: Pokus o překrývající se rezervaci stejného vozu...")
    overlap_start = datetime(2026, 11, 3, 10, 0)
    overlap_end = datetime(2026, 11, 5, 12, 0)
    try:
        service.create_reservation(martin, octavia, overlap_start, overlap_end)
        print("  [CHYBA] Překryv nebyl zachycen!")
        return False
    except ValueError as e:
        print(f"  [OK] Správně zachycena kolize: '{e}'")

    # 4. Domain-specific rule: Pokus uživatele se zákazem řízení
    print("\n[KROK 4] Domain rule check: Pokus uživatele s pozastaveným oprávněním (Petr Dvořák)...")
    try:
        service.create_reservation(petr, octavia, datetime(2026, 11, 10, 8, 0), datetime(2026, 11, 11, 17, 0))
        print("  [CHYBA] Zákaz řízení nebyl respektován!")
        return False
    except PermissionError as e:
        print(f"  [OK] Správně zamítnuto: '{e}'")

    # 5. Domain-specific rule: Pokus o rezervaci vozu s neplatnou STK
    print("\n[KROK 5] Domain rule check: Pokus o rezervaci vozu s prošlou STK...")
    try:
        service.create_reservation(jana, superb_bad_stk, datetime(2026, 11, 10, 8, 0), datetime(2026, 11, 11, 17, 0))
        print("  [CHYBA] Prošlá STK nebyla zachycena!")
        return False
    except ValueError as e:
        print(f"  [OK] Správně zamítnuto: '{e}'")

    # 6. Dlouhá rezervace (> 3 dny) -> PENDING -> Schválení manažerem -> CONFIRMED
    print("\n[KROK 6] Workflow schvalování: Dlouhá rezervace (> 3 dny) vyžaduje schválení správcem...")
    start_long = datetime(2026, 11, 15, 8, 0)
    end_long = datetime(2026, 11, 20, 17, 0)
    res_long = service.create_reservation(jana, octavia, start_long, end_long)
    print(f"  -> Vytvořena rezervace ID={res_long.id}, Stav={res_long.status} (čeká na manažera)")
    assert res_long.status == ReservationStatus.PENDING

    # Schválení manažerem
    service.approve_reservation(martin, res_long.id)
    assert res_long.status == ReservationStatus.CONFIRMED
    print(f"  -> Po schválení manažerem Martinem: Stav={res_long.status}")

    # 7. Zrušení rezervace -> CANCELLED a uvolnění termínu
    print("\n[KROK 7] Storno rezervace: Uživatel zruší rezervaci -> uvolnění termínu...")
    service.cancel_reservation(jana, res1.id)
    assert res1.status == ReservationStatus.CANCELLED
    print(f"  -> Stav rezervace ID={res1.id}: {res1.status}")

    # Nyní by měl původní termín projít bez kolize
    avail = service.check_availability(octavia, start1, end1)
    assert avail is True, "Termín po zrušení rezervace musí být opět volný"
    print("  [OK] Termín vozu byl úspěšně uvolněn pro další zájemce.")

    print("\n" + "=" * 70)
    print(" VŠECHNY KONTROLY CP1 WALKING SKELETON ÚSPĚŠNĚ PROBĚHLY (PASS)")
    print(" Celkem odesláno notifikací:", len(notif_service.sent_notifications))
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = run_walking_skeleton()
    sys.exit(0 if success else 1)

