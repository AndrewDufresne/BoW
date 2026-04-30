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

    team = db.get(models.Team, payload.team_id)
    if not team or not team.active:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Team not found or inactive")

    person_team_ids = {t.id for t in person.teams}
    if team.id not in person_team_ids:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Person '{person.name}' is not a member of team '{team.name}'",
        )

    month_date = _parse_month(payload.month)
    team_project_ids = {p.id for p in team.projects}

    seen: set[tuple[str, str]] = set()
    total = Decimal("0")
    for line in payload.lines:
        key = (line.project_id, line.sub_project_id)
        if key in seen:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Duplicate Project + Sub-project combination: {key}",
            )
        seen.add(key)

        sub = db.get(models.SubProject, line.sub_project_id)
        if not sub or not sub.active:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Sub-project {line.sub_project_id} not found",
            )
        if sub.project_id != line.project_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Sub-project '{sub.name}' does not belong to project {line.project_id}",
            )
        project = db.get(models.Project, line.project_id)
        if not project or not project.active:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"Project {line.project_id} not found"
            )
        if project.id not in team_project_ids:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Project '{project.name}' is not assigned to team '{team.name}'",
            )
        total += Decimal(str(line.time_spent_pct))

    if abs(total - TARGET_TOTAL) > PCT_TOLERANCE:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Total time spent must equal 100%. Current total: {total}",
        )

    submission = db.scalar(
        select(models.Submission).where(
            models.Submission.person_id == person.id,
            models.Submission.team_id == team.id,
            models.Submission.month == month_date,
        )
    )
    if submission is None:
        submission = models.Submission(
            person_id=person.id,
            team_id=team.id,
            month=month_date,
            status="submitted",
            total_percent=total,
        )
        db.add(submission)
        db.flush()
    else:
        submission.total_percent = total
        submission.status = "submitted"
        for old in list(submission.lines):
            db.delete(old)
        db.flush()

    for line in payload.lines:
        db.add(
            models.SubmissionLine(
                submission_id=submission.id,
                project_id=line.project_id,
                sub_project_id=line.sub_project_id,
                time_spent_pct=Decimal(str(line.time_spent_pct)),
                comments=line.comments,
            )
        )

    db.commit()
    db.refresh(submission)
    submission = db.scalar(
        select(models.Submission)
        .options(selectinload(models.Submission.lines))
        .where(models.Submission.id == submission.id)
    )
    return submission


def get_submission_by_person_team_month(
    db: Session, person_id: str, team_id: str, month: str
) -> models.Submission | None:
    month_date = _parse_month(month)
    return db.scalar(
        select(models.Submission)
        .options(selectinload(models.Submission.lines))
        .where(
            models.Submission.person_id == person_id,
            models.Submission.team_id == team_id,
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
