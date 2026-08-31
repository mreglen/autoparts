from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.garage_vehicle import GarageVehicle
from app.models.garage_vehicle_mileage_history import GarageVehicleMileageHistory

MAX_MILEAGE_KM = 9_999_999


def _validate_mileage_km(mileage_km: int) -> int:
    if mileage_km < 0:
        raise ValueError("Пробег не может быть отрицательным")
    if mileage_km > MAX_MILEAGE_KM:
        raise ValueError(f"Пробег слишком большой (максимум {MAX_MILEAGE_KM:,} км)".replace(",", " "))
    return mileage_km


def latest_vehicle_mileage_km(db: Session, vehicle_id: int) -> int | None:
    row = (
        db.query(GarageVehicleMileageHistory.mileage_km)
        .filter(GarageVehicleMileageHistory.garage_vehicle_id == vehicle_id)
        .order_by(
            GarageVehicleMileageHistory.recorded_at.desc(),
            GarageVehicleMileageHistory.id.desc(),
        )
        .first()
    )
    return row[0] if row else None


def record_garage_vehicle_mileage(
    db: Session,
    *,
    vehicle: GarageVehicle,
    mileage_km: int,
    repair_order_id: int | None = None,
    user_id: int | None = None,
) -> GarageVehicleMileageHistory | None:
    """Persist mileage on the vehicle and append history when value changes."""
    mileage = _validate_mileage_km(int(mileage_km))
    current = vehicle.mileage_km
    if current is not None and current == mileage:
        return None

    latest = latest_vehicle_mileage_km(db, vehicle.id)
    if latest is not None and latest == mileage:
        vehicle.mileage_km = mileage
        return None

    vehicle.mileage_km = mileage
    entry = GarageVehicleMileageHistory(
        garage_vehicle_id=vehicle.id,
        mileage_km=mileage,
        repair_order_id=repair_order_id,
        recorded_by_user_id=user_id,
    )
    db.add(entry)
    return entry


def sync_repair_order_vehicle_mileage(
    db: Session,
    *,
    vehicle: GarageVehicle,
    mileage_km: int | None,
    repair_order_id: int,
    user_id: int | None,
) -> None:
    if mileage_km is None:
        return
    record_garage_vehicle_mileage(
        db,
        vehicle=vehicle,
        mileage_km=mileage_km,
        repair_order_id=repair_order_id,
        user_id=user_id,
    )
