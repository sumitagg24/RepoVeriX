"""Onboarding schemas — typed request/response for the first-run checklist.

Step completion is computed from real repository data (OAuth connections,
repositories, scans), never from client-supplied booleans, so the checklist
cannot be "checked off" without the underlying evidence existing.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

OnboardingStepKey = Literal["connect_provider", "add_repository", "run_first_scan"]


class OnboardingStepStatus(BaseModel):
    done: bool
    detail: str | None = None


class OnboardingRepositoryHint(BaseModel):
    """The most recently added accessible repository, for deep links."""

    id: str
    name: str


class OnboardingStatusResponse(BaseModel):
    completed: bool
    completed_at: datetime | None = None
    steps: dict[OnboardingStepKey, OnboardingStepStatus]
    latest_repository: OnboardingRepositoryHint | None = None


class OnboardingCompleteResponse(BaseModel):
    completed: bool
    completed_at: datetime | None = None
