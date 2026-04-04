"""Read-only TecDoc reference tables (column names match PostgreSQL quoted identifiers)."""
from sqlalchemy import Boolean, Column, Integer, PrimaryKeyConstraint, String, Text
from ..db.database import Base


class TecdocManufacturer(Base):
    __tablename__ = "tecdoc_manufacturers"

    id = Column(Integer, primary_key=True)
    Matchcode = Column("Matchcode", String(255))
    IsVGL = Column("IsVGL", Boolean)
    Description = Column("Description", String(255))
    IsPassengerCar = Column("IsPassengerCar", Boolean)
    IsCommercialVehicle = Column("IsCommercialVehicle", Boolean)
    IsEngine = Column("IsEngine", Boolean)
    IsMotorbike = Column("IsMotorbike", Boolean)
    IsAxle = Column("IsAxle", Boolean)
    IsTransporter = Column("IsTransporter", Boolean)
    IsCVManufacturerID = Column("IsCVManufacturerID", Boolean)
    CanBeDisplayed = Column("CanBeDisplayed", Boolean)


class TecdocModel(Base):
    __tablename__ = "tecdoc_models"

    id = Column(Integer, primary_key=True)
    ManufacturerId = Column("ManufacturerId", Integer)
    From = Column("From", Text)
    To = Column("To", Text)
    Description = Column("Description", Text)
    CanBeDisplayed = Column("CanBeDisplayed", Boolean)
    IsPassengerCar = Column("IsPassengerCar", Boolean)
    IsCommercialVehicle = Column("IsCommercialVehicle", Boolean)
    IsEngine = Column("IsEngine", Boolean)
    IsMotorbike = Column("IsMotorbike", Boolean)
    IsAxle = Column("IsAxle", Boolean)
    IsTransporter = Column("IsTransporter", Boolean)
    IsCVManufacturerID = Column("IsCVManufacturerID", Boolean)
    HasLink = Column("HasLink", Boolean)
    IsValidForCurrentCountry = Column("IsValidForCurrentCountry", Boolean)


class TecdocEngine(Base):
    __tablename__ = "tecdoc_engines"

    id = Column(Integer, primary_key=True)
    InternalID = Column("InternalID", Integer)
    manufacturer = Column("manufacturer", Integer)
    SalesDescription = Column("SalesDescription", Text)
    HasLinkitem = Column("HasLinkitem", Boolean)
    Description = Column("Description", Text)
    From = Column("From", Text)
    To = Column("To", Text)
    CanBeDisplayed = Column("CanBeDisplayed", Boolean)


class TecdocPassengercar(Base):
    __tablename__ = "tecdoc_passengercars"

    id = Column(Integer, primary_key=True)
    InternalID = Column("InternalID", Integer)
    Model = Column("Model", Integer)
    ManufacturerMatchcode = Column("ManufacturerMatchcode", String(255))
    ManufacturerId = Column("ManufacturerId", Integer)
    From = Column("From", Text)
    To = Column("To", Text)
    Description = Column("Description", Text)
    FullDescription = Column("FullDescription", String(255))
    CanBeDisplayed = Column("CanBeDisplayed", Boolean)


class TecdocPassengercarLinkEngine(Base):
    __tablename__ = "tecdoc_passengercars_link_engines"

    __table_args__ = (PrimaryKeyConstraint("car_id", "engine_id"),)

    car_id = Column("car_id", Integer, primary_key=True)
    engine_id = Column("engine_id", Integer, primary_key=True)
