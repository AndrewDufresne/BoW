from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas

PCT_TOLERANCE = Decimal("0.01")
TARGET_TOTAL = Decimal("100")


def _parse_month(month: str) -> date:
    try:
        year, m = month.split("-")
        return date(int(year), int(m), 1)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid month '{month}'") from exc


def upsert_submission(db: Session, payload: schemas.SubmissionUpsert) -> models.Submission:
    person = db.get(models.Person, payload.person_id)
    if not person or not person.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Person not found or inactive")

    month_date = _parse_month(payload.month)

    # Validate activities belong to their projects, no duplicate (project, activity)
    seen: set[tuple[str, str]] = set()
    total = Decimal("0")
    for line in payload.lines:
        key = (line.project_id, line.activity_id)
        if key in seen:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Duplicate Project + Activity combination: {key}",
            )
        seen.add(key)

        activity = db.get(models.Activity, line.activity_id)
        if not activity or not activity.active:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"Activity {line.activity_id} not found"
            )
        if activity.project_id != line.project_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Activity '{activity.name}' does not belong to project {line.project_id}",
            )
        project = db.get(models.Project, line.project_id)
        if not project or not project.active:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"Project {line.project_id} not found"
            )
        total += Decimal(str(line.time_spent_pct))

    if abs(total - TARGET_TOTAL) > PCT_TOLERANCE:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Total time spent must equal 100%. Current total: {total}",
        )

    # Upsert: find existing
    submission = db.scalar(
        select(models.Submission).where(
            models.Submission.person_id == person.id,
            models.Submission.month == month_date,
        )
    )
    if submission is None:
        submission = models.Submission(
            person_id=person.id,
            team_id=person.team_id,
            month=month_date,
            status="submitted",
            total_percent=total,
        )
        db.add(submission)
        db.flush()
    else:
        submission.team_id = person.team_id
        submission.total_percent = total
        submission.status = "submitted"
        # Replace lines
        for old in list(submission.lines):
            db.delete(old)
        db.flush()

    for line in payload.lines:
        db.add(
            models.SubmissionLine(
                submission_id=submission.id,
                project_id=line.project_id,
                activity_id=line.activity_id,
                time_spent_pct=Decimal(str(line.time_spent_pct)),
                comments=line.comments,
            )
        )

    db.commit()
    db.refresh(submission)
    # eager load for response
    submission = db.scalar(
        select(models.Submission)
        .options(selectinload(models.Submission.lines))
        .where(models.Submission.id == submission.id)
    )
    return submission


def get_submission_by_person_month(
    db: Session, person_id: str, month: str
) -> models.Submission | None:
    month_date = _parse_month(month)
    return db.scalar(
        select(models.Submission)
        .options(selectinload(models.Submission.lines))
        .where(
            models.Submission.person_id == person_id,
            models.Submission.month == month_date,
        )
    )


def list_submissions(
    db: Session,
    *,
    team_id: str | None = None,
    person_id: str | None = None,
    month: str | None = None,
) -> list[models.Submission]:
    stmt = select(models.Submission).options(selectinload(models.Submission.lines))
    if team_id:
        stmt = stmt.where(models.Submission.team_id == team_id)
    if person_id:
        stmt = stmt.where(models.Submission.person_id == person_id)
    if month:
        stmt = stmt.where(models.Submission.month == _parse_month(month))
    stmt = stmt.order_by(models.Submission.month.desc())
    return list(db.scalars(stmt).all())
