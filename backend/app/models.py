from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


# Association table: a person can belong to many teams.
person_team = Table(
    "person_team",
    Base.metadata,
    Column("person_id", String(36), ForeignKey("person.id", ondelete="CASCADE"), primary_key=True),
    Column("team_id", String(36), ForeignKey("team.id", ondelete="CASCADE"), primary_key=True),
)


# Association table: a project can be worked on by many teams.
project_team = Table(
    "project_team",
    Base.metadata,
    Column("project_id", String(36), ForeignKey("project.id", ondelete="CASCADE"), primary_key=True),
    Column("team_id", String(36), ForeignKey("team.id", ondelete="CASCADE"), primary_key=True),
)


class Team(Base, TimestampMixin):
    __tablename__ = "team"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    manager: Mapped[str | None] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    members: Mapped[list[Person]] = relationship(
        secondary=person_team, back_populates="teams"
    )
    projects: Mapped[list[Project]] = relationship(
        secondary=project_team, back_populates="teams"
    )


class Person(Base, TimestampMixin):
    __tablename__ = "person"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    employee_id: Mapped[str | None] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    location: Mapped[str | None] = mapped_column(String(100))
    line_manager: Mapped[str | None] = mapped_column(String(120))
    allocation: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("100"), nullable=False
    )
    employment_type: Mapped[str] = mapped_column(String(20), default="Permanent", nullable=False)
    funding: Mapped[str | None] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    teams: Mapped[list[Team]] = relationship(
        secondary=person_team, back_populates="members"
    )


class Project(Base, TimestampMixin):
    __tablename__ = "project"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    funding: Mapped[str | None] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    sub_projects: Mapped[list[SubProject]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    teams: Mapped[list[Team]] = relationship(
        secondary=project_team, back_populates="projects"
    )


class SubProject(Base, TimestampMixin):
    __tablename__ = "sub_project"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_subproject_project_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("project.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    funding: Mapped[str | None] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    project: Mapped[Project] = relationship(back_populates="sub_projects")


class Submission(Base, TimestampMixin):
    __tablename__ = "submission"
    __table_args__ = (
        UniqueConstraint("person_id", "team_id", "month", name="uq_submission_person_team_month"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    person_id: Mapped[str] = mapped_column(String(36), ForeignKey("person.id"), nullable=False)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("team.id"), nullable=False)
    month: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="submitted", nullable=False)
    total_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0"), nullable=False
    )

    person: Mapped[Person] = relationship()
    team: Mapped[Team] = relationship()
    lines: Mapped[list[SubmissionLine]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
    )


class SubmissionLine(Base):
    __tablename__ = "submission_line"
    __table_args__ = (
        CheckConstraint("time_spent_pct >= 0 AND time_spent_pct <= 100", name="ck_pct_range"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    submission_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("submission.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("project.id"), nullable=False)
    sub_project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sub_project.id"), nullable=False
    )
    time_spent_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    comments: Mapped[str | None] = mapped_column(Text)

    submission: Mapped[Submission] = relationship(back_populates="lines")
    project: Mapped[Project] = relationship()
    sub_project: Mapped[SubProject] = relationship()
