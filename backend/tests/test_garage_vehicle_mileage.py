import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.autoservice_client import AutoserviceClient
from app.models.garage_vehicle import GarageVehicle
from app.models.garage_vehicle_mileage_history import GarageVehicleMileageHistory
from app.models.organization import Organization
from app.services.garage_vehicle_mileage import (
    latest_vehicle_mileage_km,
    record_garage_vehicle_mileage,
    sync_repair_order_vehicle_mileage,
)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Organization.__table__,
            AutoserviceClient.__table__,
            GarageVehicle.__table__,
            GarageVehicleMileageHistory.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()
    org = Organization(id="org1", name="Test Org")
    session.add(org)
    session.flush()
    client = AutoserviceClient(
        organization_id=org.id,
        name="Client",
        phone="+79990000000",
        status="active",
    )
    session.add(client)
    session.flush()
    vehicle = GarageVehicle(
        client_id=client.id,
        organization_id=org.id,
        make="VW",
        model="Golf",
        source="manual",
    )
    session.add(vehicle)
    session.flush()
    session._test_vehicle = vehicle
    yield session
    session.close()


def test_record_garage_vehicle_mileage_appends_history(db):
    vehicle = db._test_vehicle
    entry = record_garage_vehicle_mileage(
        db,
        vehicle=vehicle,
        mileage_km=85000,
        repair_order_id=None,
        user_id=None,
    )
    db.flush()

    assert entry is not None
    assert vehicle.mileage_km == 85000
    assert latest_vehicle_mileage_km(db, vehicle.id) == 85000

    duplicate = record_garage_vehicle_mileage(
        db,
        vehicle=vehicle,
        mileage_km=85000,
        repair_order_id=None,
        user_id=None,
    )
    db.flush()
    assert duplicate is None
    assert db.query(GarageVehicleMileageHistory).count() == 1


def test_record_garage_vehicle_mileage_updates_on_change(db):
    vehicle = db._test_vehicle
    record_garage_vehicle_mileage(db, vehicle=vehicle, mileage_km=85000)
    record_garage_vehicle_mileage(db, vehicle=vehicle, mileage_km=90100)
    db.flush()

    assert vehicle.mileage_km == 90100
    assert db.query(GarageVehicleMileageHistory).count() == 2
    latest = (
        db.query(GarageVehicleMileageHistory)
        .order_by(GarageVehicleMileageHistory.id.desc())
        .first()
    )
    assert latest.mileage_km == 90100
    assert latest.repair_order_id is None


def test_sync_repair_order_vehicle_mileage_skips_empty(db):
    vehicle = db._test_vehicle
    sync_repair_order_vehicle_mileage(
        db,
        vehicle=vehicle,
        mileage_km=None,
        repair_order_id=1,
        user_id=1,
    )
    assert vehicle.mileage_km is None
    assert db.query(GarageVehicleMileageHistory).count() == 0
