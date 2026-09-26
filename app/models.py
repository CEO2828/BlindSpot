from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_CENTS = 100_000_000_000
Cents = Annotated[int, Field(strict=True, ge=0, le=MAX_CENTS)]


class Position(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ticker: str = Field(min_length=1, max_length=12, pattern=r'^[A-Za-z0-9.\-]+$')
    amount_cents: Cents

    @field_validator('ticker')
    @classmethod
    def uppercase(cls, value):
        return value.upper()


class AnalysisInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    positions: list[Position] = Field(max_length=30)
    unassessed_amount_cents: Cents = 0

    @model_validator(mode='after')
    def total_bound(self):
        if sum(p.amount_cents for p in self.positions) + self.unassessed_amount_cents > MAX_CENTS:
            raise ValueError('Total must be at most $1 billion.')
        return self
