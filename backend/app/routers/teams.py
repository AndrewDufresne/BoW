from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.db import get_db

router = APIRouter(prefix="/teams", tags=["teams"])


def _active_member_count(db: Session, team_id: str) -> int:
    return (
        db.scalar(
            select(func.count(models.Person.id))
            .join(models.person_team, models.person_team.c.person_id == models.Person.id)
            .where(
                models.person_team.c.team_id == team_id,
                models.Person.active.is_(True),
            )
        )
        or 0
    )


def _to_read(team: models.Team, member_count: int) -> schemas.TeamRead:
    return schemas.TeamRead(
        id=team.id,
        name=team.name,
        description=team.description,
        active=team.active,
        member_count=member_count,
    )


@router.get("", response_model=list[schemas.TeamRead])
def list_teams(active: bool | None = None, db: Session = Depends(get_db)):
    stmt = (
        select(models.Team, func.count(models.Person.id))
        .outerjoin(models.person_team, models.person_team.c.team_id == models.Team.id)
        .outerjoin(
            models.Person,
            (models.Person.id == models.person_team.c.person_id)
            & (models.Person.active.is_(True)),
        )
    )
    if active is not None:
        stmt = stmt.where(models.Team.active.is_(active))
    stmt = stmt.group_by(models.Team.id).order_by(models.Team.name)
    rows = db.execute(stmt).all()
    return [_to_read(t, c) for t, c in rows]


@router.post("", response_model=schemas.TeamRead, status_code=status.HTTP_201_CREATED)
def create_team(payload: schemas.TeamCreate, db: Session = Depends(get_db)):
    if db.scalar(select(models.Team).where(models.Team.name == payload.name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Team name already exists")
    team = models.Team(**payload.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    return _to_read(team, 0)


@router.get("/{team_id}", response_model=schemas.TeamRead)
def get_team(team_id: str, db: Session = Depends(get_db)):
    team = db.get(models.Team, team_id)
    if not team:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    return _to_read(team, _active_member_count(db, team.id))


@router.patch("/{team_id}", response_model=schemas.TeamRead)
def update_team(team_id: str, payload: schemas.TeamUpdate, db: Session = Depends(get_db)):
    team = db.get(models.Team, team_id)
    if not team:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != team.name:
        if db.scalar(select(models.Team).where(models.Team.name == data["name"])):
            raise HTTPException(status.HTTP_409_CONFLICT, "Team name already exists")
    for k, v in data.items():
        setattr(team, k, v)
    db.commit()
    db.refresh(team)
    return _to_read(team, _active_member_count(db, team.id))


@router.delete("/{team_id}", response_model=schemas.TeamRead)
def deactivate_team(team_id: str, db: Session = Depends(get_db)):
    team = db.get(models.Team, team_id)
    if not team:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    team.active = False
    db.commit()
    db.refresh(team)
    return _to_read(team, 0)
