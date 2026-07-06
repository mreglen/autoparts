from pydantic import BaseModel
from typing import Literal


OnboardingStepStatus = Literal["pending", "done"]


class OnboardingStepOut(BaseModel):
    id: str
    title: str
    hint: str | None = None
    url: str
    status: OnboardingStepStatus
    required: bool


class OnboardingProgressOut(BaseModel):
    done: int
    total: int


class SellerOnboardingResponse(BaseModel):
    steps: list[OnboardingStepOut]
    core_completed: bool
    core_progress: OnboardingProgressOut
    optional_pending: int
