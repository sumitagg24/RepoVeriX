"""Shared schema bases."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Schema that can be built directly from ORM instances."""

    model_config = ConfigDict(from_attributes=True)


class TimestampedORMModel(ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
