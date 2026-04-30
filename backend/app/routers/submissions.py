from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.db import get_db
from app.services import submission as svc

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _to_read(s: models.Submission) -> schemas.SubmissionRead:
    return schemas.SubmissionRead(
        id=s.id,
        person_id=s.person_id,
        team_id=s.team_id,
        month=s.month,
        status=s.status,
        total_percent=s.total_percent,
        person_name=s.person.name if s.person else None,
        team_name=s.team.name if s.team else None,
        lines=[
            schemas.SubmissionLineRead(
                id=line.id,
                project_id=line.project_id,
                sub_project_id=line.sub_project_id,
                time_spent_pct=line.time_spent_pct,
                comments=line.comments,
                project_name=line.project.name if line.project else None,
                sub_project_name=line.sub_project.name if line.sub_project else None,
            )
            for line in s.lines
        ],
    )


@router.get("", response_model=list[schemas.SubmissionRead])
def list_submissions(
    person_id: str | None = None,
    team_id: str | None = None,
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    return [
        _to_read(s)
        for s in svc.list_submissions(db, person_id=person_id, team_id=team_id, month=month)
    ]


@router.get("/by-person-team-month", response_model=schemas.SubmissionRead | None)
def get_by_person_team_month(
    person_id: str,
    team_id: str,
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    s = svc.get_submission_by_person_team_month(db, person_id, team_id, month)
    return _to_read(s) if s else None


@router.post("", response_model=schemas.SubmissionRead)
def upsert_submission(payload: schemas.SubmissionUpsert, db: Session = Depends(get_db)):
    s = svc.upsert_submission(db, payload)
    return _to_read(s)


@router.delete("/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_submission(submission_id: str, db: Session = Depends(get_db)):
    s = db.get(models.Submission, submission_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    db.delete(s)
    db.commit()
