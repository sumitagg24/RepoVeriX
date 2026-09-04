"""Authentication schemas."""

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import TimestampedORMModel


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)


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
