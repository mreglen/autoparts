from typing import Optional

from pydantic import BaseModel, ConfigDict


class TecdocManufacturerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: Optional[str] = None
    matchcode: Optional[str] = None


class TecdocModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: Optional[str] = None
    from_year: Optional[str] = None
    to_year: Optional[str] = None

    @classmethod
    def from_row(cls, row):
        return cls(
            id=row.id,
            description=row.Description,
            from_year=row.From,
            to_year=row.To,
        )


class TecdocPassengercarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: Optional[str] = None
    full_description: Optional[str] = None
    from_year: Optional[str] = None
    to_year: Optional[str] = None

    @classmethod
    def from_row(cls, row):
        return cls(
            id=row.id,
            description=row.Description,
            full_description=row.FullDescription,
            from_year=row.From,
            to_year=row.To,
        )


class TecdocEngineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: Optional[str] = None
    sales_description: Optional[str] = None

    @classmethod
    def from_row(cls, row):
        return cls(
            id=row.id,
            description=row.Description,
            sales_description=row.SalesDescription,
        )


class TecdocTransmissionOut(BaseModel):
    title: Optional[str] = None
    value: str
