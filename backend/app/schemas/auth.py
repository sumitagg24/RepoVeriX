"""Authentication schemas."""

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.db.models import PlanName
from app.schemas.common import TimestampedORMModel


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)

    @field_validator("full_name")
    @classmethod
    def _full_name_strip(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("must not be empty or whitespace-only")
        return stripped


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(TimestampedORMModel):
    email: EmailStr
    full_name: str
    is_active: bool
    plan: PlanName
