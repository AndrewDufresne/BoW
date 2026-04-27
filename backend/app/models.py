from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
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


class Team(Base, TimestampMixin):
    __tablename__ = "team"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    members: Mapped[list[Person]] = relationship(back_populates="team")


class Person(Base, TimestampMixin):
    __tablename__ = "person"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    team_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("team.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    team: Mapped[Team | None] = relationship(back_populates="members")


class Project(Base, TimestampMixin):
    __tablename__ = "project"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    activities: Mapped[list[Activity]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Activity(Base, TimestampMixin):
    __tablename__ = "activity"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_activity_project_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("project.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    project: Mapped[Project] = relationship(back_populates="activities")


class Submission(Base, TimestampMixin):
    __tablename__ = "submission"
    __table_args__ = (UniqueConstraint("person_id", "month", name="uq_submission_person_month"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    person_id: Mapped[str] = mapped_column(String(36), ForeignKey("person.id"), nullable=False)
    team_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("team.id"))
    month: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="submitted", nullable=False)
    total_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"), nullable=False)

    person: Mapped[Person] = relationship()
    team: Mapped[Team | None] = relationship()
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
    activity_id: Mapped[str] = mapped_column(String(36), ForeignKey("activity.id"), nullable=False)
    time_spent_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    comments: Mapped[str | None] = mapped_column(Text)

    submission: Mapped[Submission] = relationship(back_populates="lines")
    project: Mapped[Project] = relationship()
    activity: Mapped[Activity] = relationship()
