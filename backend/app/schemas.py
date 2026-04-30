from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


EmploymentType = str


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Team ----------
class TeamBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    manager: str | None = Field(default=None, max_length=120)


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    manager: str | None = Field(default=None, max_length=120)
    active: bool | None = None


class TeamRead(ORMBase, TeamBase):
    id: str
    active: bool
    member_count: int = 0


class TeamMini(ORMBase):
    id: str
    name: str


# ---------- Person ----------
class PersonBase(BaseModel):
    employee_id: str | None = Field(default=None, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    location: str | None = Field(default=None, max_length=100)
    line_manager: str | None = Field(default=None, max_length=120)
    allocation: Decimal = Field(default=Decimal("100"), ge=0, le=100)
    employment_type: EmploymentType = "Permanent"
    funding: str | None = Field(default=None, max_length=120)
    team_id: str


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    employee_id: str | None = Field(default=None, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    location: str | None = Field(default=None, max_length=100)
    line_manager: str | None = Field(default=None, max_length=120)
    allocation: Decimal | None = Field(default=None, ge=0, le=100)
    employment_type: EmploymentType | None = None
    funding: str | None = Field(default=None, max_length=120)
    team_id: str | None = None
    active: bool | None = None


class PersonRead(ORMBase):
    id: str
    employee_id: str | None = None
    name: str
    email: str | None = None
    location: str | None = None
    line_manager: str | None = None
    allocation: Decimal
    employment_type: str
    funding: str | None = None
    team_id: str
    team: TeamMini | None = None
    active: bool


# ---------- Project ----------
class ProjectBase(BaseModel):
    code: str = Field(min_length=2, max_length=20, pattern=r"^[A-Z0-9\-]+$")
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    funding: str | None = Field(default=None, max_length=120)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=20, pattern=r"^[A-Z0-9\-]+$")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    funding: str | None = Field(default=None, max_length=120)
    active: bool | None = None


class ProjectRead(ORMBase):
    id: str
    code: str
    name: str
    description: str | None = None
    funding: str | None = None
    active: bool
    sub_project_count: int = 0


class ProjectMini(ORMBase):
    id: str
    code: str
    name: str


# ---------- Sub-project ----------
class SubProjectBase(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    funding: str | None = Field(default=None, max_length=120)


class SubProjectCreate(SubProjectBase):
    pass


class SubProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    funding: str | None = Field(default=None, max_length=120)
    active: bool | None = None


class SubProjectRead(ORMBase, SubProjectBase):
    id: str
    active: bool
    project_name: str | None = None


class SubProjectMini(ORMBase):
    id: str
    name: str
    description: str | None = None
    funding: str | None = None


class ProjectWithSubs(ORMBase):
    id: str
    code: str
    name: str
    description: str | None = None
    funding: str | None = None
    sub_projects: list[SubProjectMini] = Field(default_factory=list)


# ---------- Submission ----------
class SubmissionLineIn(BaseModel):
    project_id: str
    sub_project_id: str
    time_spent_pct: Decimal = Field(ge=0, le=100, decimal_places=2)
    comments: str | None = Field(default=None, max_length=500)


class SubmissionLineRead(ORMBase):
    id: str
    project_id: str
    sub_project_id: str
    time_spent_pct: Decimal
    comments: str | None
    project_name: str | None = None
    sub_project_name: str | None = None


class SubmissionUpsert(BaseModel):
    person_id: str
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    lines: list[SubmissionLineIn] = Field(min_length=1)

    @field_validator("lines")
    @classmethod
    def _check_lines(cls, v: list[SubmissionLineIn]) -> list[SubmissionLineIn]:
        if not v:
            raise ValueError("At least one line is required")
        return v


class SubmissionRead(ORMBase):
    id: str
    person_id: str
    team_id: str
    month: date
    status: str
    total_percent: Decimal
    person_name: str | None = None
    team_name: str | None = None
    lines: list[SubmissionLineRead] = []


# ---------- Dashboard ----------
class TeamProgress(BaseModel):
    team_id: str
    team_name: str
    total_active: int
    submitted_count: int
    completion_pct: float


class DashboardSubmissionRow(BaseModel):
    submission_id: str | None = None
    person_id: str
    person_name: str
    team_id: str
    team_name: str
    month: str
    status: str
    total_percent: Decimal | None = None
    updated_at: str | None = None