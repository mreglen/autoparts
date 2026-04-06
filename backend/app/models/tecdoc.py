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


class TecdocArticle(Base):
    __tablename__ = "tecdoc_articles"

    id = Column(Integer, primary_key=True)
    # NOTE: In Postgres, unquoted identifiers are folded to lowercase.
    DataSupplierArticleNumber = Column("datasupplierarticlenumber", String(255))
    Supplier = Column("supplier", Integer)
    CurrentProduct = Column("currentproduct", Integer)
    NormalizedDescription = Column("normalizeddescription", Text)
    HasLinkitems = Column("haslinkitems", Integer)
    HasPassengerCar = Column("haspassengercar", Integer)
    HasCommercialVehicle = Column("hascommercialvehicle", Integer)
    HasMotorbike = Column("hasmotorbike", Integer)
    HasEngine = Column("hasengine", Integer)
    HasAxle = Column("hasaxle", Integer)
    HasCVManuID = Column("hascvmanuid", Integer)
    LotSize1 = Column("lotsize1", Integer)
    LotSize2 = Column("lotsize2", Integer)
    FlagMaterialCertification = Column("flagmaterialcertification", Integer)
    FlagSelfServicePacking = Column("flagselfservicepacking", Integer)
    FlagRemanufactured = Column("flagremanufactured", Integer)
    FlagAccessory = Column("flagaccessory", Integer)
    IsPseudoArticle = Column("ispseudoarticle", Integer)
    IsValid = Column("isvalid", Integer)
    Description = Column("description", Text)
    ArticleStateAttributeGroup = Column("articlestateattributegroup", String(255))
    ArticleStateAttributeType = Column("articlestateattributetype", String(255))
    ArticleStateDisplayTitle = Column("articlestatedisplaytitle", String(255))
    ArticleStateDisplayValue = Column("articlestatedisplayvalue", String(255))
    PackingUnit = Column("packingunit", Integer)
    QuantityPerPackingUnit = Column("quantityperpackingunit", Integer)


class TecdocSupplier(Base):
    __tablename__ = "tecdoc_suppliers"

    __table_args__ = (PrimaryKeyConstraint("id", "internalid"),)

    DataVersion = Column("dataversion", Integer)
    id = Column("id", Integer, primary_key=True)
    internalID = Column("internalid", Integer, primary_key=True)
    MatchCode = Column("matchcode", String(255))
    NbrOfArticles = Column("nbrofarticles", Integer)
    HasNewVersionArticles = Column("hasnewversionarticles", Integer)
    Description = Column("description", Text)


class TecdocArticleCrossList(Base):
    __tablename__ = "tecdoc_article_cross_list"

    __table_args__ = (PrimaryKeyConstraint("article_id", "supplier", "article"),)

    article_id = Column("article_id", Integer, primary_key=True)
    supplier = Column("supplier", Integer, primary_key=True)
    Article = Column("article", String(255), primary_key=True)


class TecdocArticleOeNumber(Base):
    __tablename__ = "tecdoc_article_oe_numbers"

    __table_args__ = (PrimaryKeyConstraint("article_id", "manufacturer", "oenbr"),)

    article_id = Column("article_id", Integer, primary_key=True)
    OENbr = Column("oenbr", String(255), primary_key=True)
    IsAdditive = Column("isadditive", Integer)
    Manufacturer = Column("manufacturer", Integer, primary_key=True)
    ReferenceInformation = Column("referenceinformation", Text)


class TecdocArticleReplaceNumber(Base):
    __tablename__ = "tecdoc_article_replace_numbers"

    __table_args__ = (PrimaryKeyConstraint("article_id", "supplier", "replacenbr"),)

    article_id = Column("article_id", Integer, primary_key=True)
    ReplaceNbr = Column("replacenbr", String(255), primary_key=True)
    Supplier = Column("supplier", Integer, primary_key=True)
