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
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid month '{month}'"
        ) from exc


@router.get("/team-progress", response_model=list[schemas.TeamProgress])
def team_progress(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    """For each active team, return active member count and the number of
    members who have submitted a Book of Work for the given month against that
    team. A person submitted under team A doesn't count toward team B."""
    month_date = _parse_month(month)

    teams = list(
        db.scalars(
            select(models.Team).where(models.Team.active.is_(True)).order_by(models.Team.name)
        ).all()
    )

    result: list[schemas.TeamProgress] = []
    for team in teams:
        # active members of this team
        member_ids_stmt = (
            select(models.Person.id)
            .join(models.person_team, models.person_team.c.person_id == models.Person.id)
            .where(
                models.person_team.c.team_id == team.id,
                models.Person.active.is_(True),
            )
        )
        member_ids = list(db.scalars(member_ids_stmt).all())
        total_active = len(member_ids)

        if total_active == 0:
            submitted = 0
        else:
            submitted = (
                db.scalar(
                    select(func.count(func.distinct(models.Submission.person_id))).where(
                        models.Submission.team_id == team.id,
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
        description="Filter by completion status",
    ),
    db: Session = Depends(get_db),
):
    """Return one row per (active person, team) pair for the month, including
    'missing' rows for members who haven't submitted yet (under that team).
    Optionally filtered by team, project, or completion status."""
    month_date = _parse_month(month)

    # Build (person, team) pairs from membership
    pair_stmt = (
        select(
            models.Person.id,
            models.Person.name,
            models.Team.id,
            models.Team.name,
        )
        .join(models.person_team, models.person_team.c.person_id == models.Person.id)
        .join(models.Team, models.Team.id == models.person_team.c.team_id)
        .where(models.Person.active.is_(True), models.Team.active.is_(True))
    )
    if team_id:
        pair_stmt = pair_stmt.where(models.Team.id == team_id)

    pairs = list(db.execute(pair_stmt).all())

    # Existing submissions for the month
    sub_stmt = select(models.Submission).where(models.Submission.month == month_date)
    if team_id:
        sub_stmt = sub_stmt.where(models.Submission.team_id == team_id)
    submissions = {(s.person_id, s.team_id): s for s in db.scalars(sub_stmt).all()}

    # Project filter (only keep submissions that have at least one line for project)
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
        sub = submissions.get((person_id, t_id))
        if sub is not None:
            if project_match is not None and sub.id not in project_match:
                # When filtering by project, exclude submissions that don't include it
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
                # project filter: skip missing rows
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
