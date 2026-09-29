from __future__ import annotations

from datetime import datetime, time

from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
from app.models.repair_order import RepairOrder
from app.schemas.autoservice_planner import PlannerRepairOrder
from app.utils.autoservice_access import display_client_phone


def planner_vehicle_label(vehicle: GarageVehicle | None) -> str:
    if not vehicle:
        return "—"
    parts = [vehicle.make, vehicle.model]
    label = " ".join(p for p in parts if p).strip()
    if vehicle.plate:
        label = f"{label} ({vehicle.plate})" if label else vehicle.plate
    return label or "—"


def planner_order_item(row: RepairOrder) -> PlannerRepairOrder:
    return PlannerRepairOrder(
        id=row.id,
        kind="order",
        order_number=row.order_number,
        client_id=row.client_id,
        client_name=row.client.name if row.client else "—",
        client_phone=display_client_phone(row.client.phone) if row.client else "",
        vehicle=planner_vehicle_label(row.vehicle),
        status=row.status,
        scheduled_at=row.scheduled_at,
        scheduled_end_at=row.scheduled_end_at,
        vehicle_make=row.vehicle.make if row.vehicle else None,
        vehicle_model=row.vehicle.model if row.vehicle else None,
        work_zone_id=row.work_zone_id,
        work_zone_name=row.work_zone.name if row.work_zone else None,
    )


def planner_inspection_item(row: InspectionBooking) -> PlannerRepairOrder:
    return PlannerRepairOrder(
        id=row.id,
        kind="inspection",
        order_number="Осмотр",
        client_id=row.client_id,
        garage_vehicle_id=row.garage_vehicle_id,
        client_name=row.name or "—",
        client_phone=row.phone or "",
        vehicle=planner_vehicle_label(row.vehicle),
        status=row.status,
        scheduled_at=datetime.combine(row.preferred_date, row.preferred_time or time.min),
        scheduled_end_at=None,
        preferred_time=row.preferred_time,
        vehicle_make=row.vehicle_make or (row.vehicle.make if row.vehicle else None),
        vehicle_model=row.vehicle_model or (row.vehicle.model if row.vehicle else None),
        work_zone_id=row.work_zone_id,
        work_zone_name=row.work_zone.name if row.work_zone else None,
        notes=row.notes,
    )
