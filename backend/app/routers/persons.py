from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.core.db import get_db

router = APIRouter(prefix="/persons", tags=["persons"])


def _to_read(p: models.Person) -> schemas.PersonRead:
    team = schemas.TeamMini(id=p.team.id, name=p.team.name) if p.team else None
    return schemas.PersonRead(
        id=p.id,
        employee_id=p.employee_id,
        name=p.name,
        email=p.email,
        location=p.location,
        line_manager=p.line_manager,
        allocation=p.allocation,
        employment_type=p.employment_type,
        funding=p.funding,
        active=p.active,
        team_id=p.team_id,
        team=team,
    )


def _check_team(db: Session, team_id: str) -> models.Team:
    team = db.get(models.Team, team_id)
    if not team:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Team {team_id} not found")
    return team


@router.get("", response_model=list[schemas.PersonRead])
def list_persons(
    active: bool | None = None,
    team_id: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(models.Person).options(selectinload(models.Person.team))
    if active is not None:
        stmt = stmt.where(models.Person.active.is_(active))
    if team_id:
        stmt = stmt.where(models.Person.team_id == team_id)
    stmt = stmt.order_by(models.Person.name)
    return [_to_read(p) for p in db.scalars(stmt).all()]


@router.post("", response_model=schemas.PersonRead, status_code=status.HTTP_201_CREATED)
def create_person(payload: schemas.PersonCreate, db: Session = Depends(get_db)):
    _check_team(db, payload.team_id)
    if payload.employee_id and db.scalar(
        select(models.Person).where(
            models.Person.employee_id == payload.employee_id,
            models.Person.team_id == payload.team_id,
        )
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This employee already has a row for this team",
        )
    p = models.Person(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_read(p)


@router.patch("/{person_id}", response_model=schemas.PersonRead)
def update_person(person_id: str, payload: schemas.PersonUpdate, db: Session = Depends(get_db)):
    p = db.get(models.Person, person_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Person not found")
    data = payload.model_dump(exclude_unset=True)
    if "team_id" in data and data["team_id"]:
        _check_team(db, data["team_id"])
    new_team_id = data.get("team_id", p.team_id)
    new_emp_id = data.get("employee_id", p.employee_id)
    if (new_team_id != p.team_id or new_emp_id != p.employee_id) and new_emp_id:
        if db.scalar(
            select(models.Person).where(
                models.Person.employee_id == new_emp_id,
                models.Person.team_id == new_team_id,
                models.Person.id != p.id,
            )
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This employee already has a row for this team",
            )
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _to_read(p)


@router.delete("/{person_id}", response_model=schemas.PersonRead)
def deactivate_person(person_id: str, db: Session = Depends(get_db)):
    p = db.get(models.Person, person_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Person not found")
    p.active = False
    db.commit()
    db.refresh(p)
    return _to_read(p)