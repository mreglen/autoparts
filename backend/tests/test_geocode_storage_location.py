import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch

from app.db.database import Base
from app.models.organization import Organization
from app.models.storage_location import StorageLocation
from app.services.geocode_storage_location import (
    apply_geocode_to_location,
    reset_geocode_fields,
)
from app.schemas.storage_location import StorageLocation as StorageLocationSchema
from app.schemas.product import Product as ProductSchema


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Organization.__table__,
            StorageLocation.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()
    org = Organization(id="org-map", name="Map Org")
    session.add(org)
    session.flush()
    location = StorageLocation(
        organization_id=org.id,
        address="г Москва, ул Тверская, д 1",
    )
    session.add(location)
    session.commit()
    session._test_location = location
    yield session
    session.close()


@patch("app.services.geocode_storage_location.geocode_address_sync")
@patch("app.services.geocode_storage_location.invalidate_public_products_for_storage_location")
def test_apply_geocode_to_location_saves_coords(mock_invalidate, mock_geocode, db):
    location = db._test_location
    mock_geocode.return_value = {"lat": 55.757, "lon": 37.615, "qc_geo": 0}

    result = apply_geocode_to_location(db, location.id)

    assert result is True
    db.refresh(location)
    assert location.latitude == 55.757
    assert location.longitude == 37.615
    assert location.geocode_qc == 0
    assert location.geocoded_at is not None
    mock_invalidate.assert_called_once_with(db, location.id)


def test_reset_geocode_fields_clears_coordinates(db):
    location = db._test_location
    location.latitude = 55.0
    location.longitude = 37.0
    location.geocode_qc = 1
    location.geocoded_at = db.query(StorageLocation).first().geocoded_at

    reset_geocode_fields(location)

    assert location.latitude is None
    assert location.longitude is None
    assert location.geocode_qc is None
    assert location.geocoded_at is None


def test_storage_location_schema_exposes_coordinates():
    payload = StorageLocationSchema(
        id=1,
        organization_id="org-map",
        address="г Москва, ул Тверская, д 1",
        latitude=55.757,
        longitude=37.615,
    )
    dumped = payload.model_dump()
    assert dumped["latitude"] == 55.757
    assert dumped["longitude"] == 37.615


def test_product_schema_includes_storage_location_coordinates():
    payload = ProductSchema(
        id=10,
        article="ABC",
        name="Filter",
        brand="Bosch",
        price=1000.0,
        quantity=1,
        is_new=False,
        storage_location_id=1,
        part_type_id=1,
        organization_id="org-map",
        created_by=1,
        storage_location=StorageLocationSchema(
            id=1,
            organization_id="org-map",
            address="г Москва, ул Тверская, д 1",
            latitude=55.757,
            longitude=37.615,
        ),
    )
    dumped = payload.model_dump()
    assert dumped["storage_location"]["latitude"] == 55.757
    assert dumped["storage_location"]["longitude"] == 37.615
