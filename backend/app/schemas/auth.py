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
    # ``False`` when the password account still needs email verification —
    # clients use it to show the verification banner. OAuth sign-ins are
    # always verified; the field stays ``None`` only for legacy callers.
    email_verified: bool | None = None
    # Dev-only: the verification link itself, populated exclusively when the
    # mail backend is the console logger (no real delivery to intercept).
    # Always None when SMTP is configured — the link travels by email only.
    dev_verification_url: str | None = None


class UserRead(TimestampedORMModel):
    email: EmailStr
    full_name: str
    is_active: bool
    plan: PlanName
    email_verified: bool = True


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)

    @field_validator("full_name")
    @classmethod
    def _full_name_strip(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("must not be empty or whitespace-only")
        return stripped


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    uid: str = Field(min_length=32, max_length=64)
    token: str = Field(min_length=16, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    uid: str = Field(min_length=32, max_length=64)
    token: str = Field(min_length=16, max_length=128)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
