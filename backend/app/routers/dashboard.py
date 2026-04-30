from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.db import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _parse_month(month: str) -> date:
    try:
        year, m = month.split("-")
        return date(int(year), int(m), 1)
    except Exception as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid month '{month}'"
        ) from exc


@router.get("/team-progress", response_model=list[schemas.TeamProgress])
def team_progress(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    """For each active team, return active person-row count and the number of
    rows that have submitted for the given month."""
    month_date = _parse_month(month)

    teams = list(
        db.scalars(
            select(models.Team).where(models.Team.active.is_(True)).order_by(models.Team.name)
        ).all()
    )

    result: list[schemas.TeamProgress] = []
    for team in teams:
        member_ids = list(
            db.scalars(
                select(models.Person.id).where(
                    models.Person.team_id == team.id,
                    models.Person.active.is_(True),
                )
            ).all()
        )
        total_active = len(member_ids)

        if total_active == 0:
            submitted = 0
        else:
            submitted = (
                db.scalar(
                    select(func.count(func.distinct(models.Submission.person_id))).where(
                        models.Submission.month == month_date,
                        models.Submission.status == "submitted",
                        models.Submission.person_id.in_(member_ids),
                    )
                )
                or 0
            )

        completion = (submitted / total_active * 100) if total_active else 0.0
        result.append(
            schemas.TeamProgress(
                team_id=team.id,
                team_name=team.name,
                total_active=total_active,
                submitted_count=submitted,
                completion_pct=round(completion, 2),
            )
        )

    return result


@router.get("/submissions", response_model=list[schemas.DashboardSubmissionRow])
def list_dashboard_submissions(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    team_id: str | None = None,
    project_id: str | None = None,
    completion: str | None = Query(
        default=None,
        pattern=r"^(submitted|missing|all)$",
    ),
    db: Session = Depends(get_db),
):
    """Return one row per active Person row for the month. Each Person row is
    already team-scoped, so we don't need to join an association table."""
    month_date = _parse_month(month)

    pair_stmt = (
        select(
            models.Person.id,
            models.Person.name,
            models.Team.id,
            models.Team.name,
        )
        .join(models.Team, models.Team.id == models.Person.team_id)
        .where(models.Person.active.is_(True), models.Team.active.is_(True))
    )
    if team_id:
        pair_stmt = pair_stmt.where(models.Team.id == team_id)

    pairs = list(db.execute(pair_stmt).all())

    sub_stmt = select(models.Submission).where(models.Submission.month == month_date)
    submissions = {s.person_id: s for s in db.scalars(sub_stmt).all()}

    project_match: set[str] | None = None
    if project_id:
        project_match = set(
            db.scalars(
                select(models.SubmissionLine.submission_id).where(
                    models.SubmissionLine.project_id == project_id
                )
            ).all()
        )

    rows: list[schemas.DashboardSubmissionRow] = []
    for person_id, person_name, t_id, t_name in pairs:
        sub = submissions.get(person_id)
        if sub is not None:
            if project_match is not None and sub.id not in project_match:
                continue
            row = schemas.DashboardSubmissionRow(
                submission_id=sub.id,
                person_id=person_id,
                person_name=person_name,
                team_id=t_id,
                team_name=t_name,
                month=month,
                status="submitted",
                total_percent=sub.total_percent,
                updated_at=sub.updated_at.isoformat() if sub.updated_at else None,
            )
        else:
            if project_id:
                continue
            row = schemas.DashboardSubmissionRow(
                submission_id=None,
                person_id=person_id,
                person_name=person_name,
                team_id=t_id,
                team_name=t_name,
                month=month,
                status="missing",
                total_percent=None,
                updated_at=None,
            )
        if completion and completion != "all" and row.status != completion:
            continue
        rows.append(row)

    rows.sort(key=lambda r: (r.team_name, r.person_name))
    return rows