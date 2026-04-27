from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------- Base ----------
class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Team ----------
class TeamBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    active: bool | None = None


class TeamRead(ORMBase, TeamBase):
    id: str
    active: bool
    member_count: int = 0


# ---------- Person ----------
class PersonBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    team_id: str | None = None


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    team_id: str | None = None
    active: bool | None = None


class PersonRead(ORMBase, PersonBase):
    id: str
    active: bool
    team_name: str | None = None


# ---------- Project ----------
class ProjectBase(BaseModel):
    code: str = Field(min_length=2, max_length=20, pattern=r"^[A-Z0-9\-]+$")
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=20, pattern=r"^[A-Z0-9\-]+$")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    active: bool | None = None


class ProjectRead(ORMBase, ProjectBase):
    id: str
    active: bool
    activity_count: int = 0


# ---------- Activity ----------
class ActivityBase(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=200)


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    active: bool | None = None


class ActivityRead(ORMBase, ActivityBase):
    id: str
    active: bool
    project_name: str | None = None


# ---------- Submission ----------
class SubmissionLineIn(BaseModel):
    project_id: str
    activity_id: str
    time_spent_pct: Decimal = Field(ge=0, le=100, decimal_places=2)
    comments: str | None = Field(default=None, max_length=500)


class SubmissionLineRead(ORMBase):
    id: str
    project_id: str
    activity_id: str
    time_spent_pct: Decimal
    comments: str | None
    project_name: str | None = None
    activity_name: str | None = None


class SubmissionUpsert(BaseModel):
    person_id: str
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    lines: list[SubmissionLineIn] = Field(min_length=1)

    @field_validator("lines")
    @classmethod
    def _check_lines(cls, v: list[SubmissionLineIn]) -> list[SubmissionLineIn]:
        # Duplicate (project, activity) pairs are caught in the service for clearer errors,
        # but we sanity-check basic non-empty here.
        if not v:
            raise ValueError("At least one line is required")
        return v


class SubmissionRead(ORMBase):
    id: str
    person_id: str
    team_id: str | None
    month: date
    status: str
    total_percent: Decimal
    person_name: str | None = None
    team_name: str | None = None
    lines: list[SubmissionLineRead] = []
