from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.core.db import get_db

router = APIRouter(prefix="/persons", tags=["persons"])


def _to_read(p: models.Person) -> schemas.PersonRead:
    return schemas.PersonRead(
        id=p.id,
        name=p.name,
        email=p.email,
        team_id=p.team_id,
        active=p.active,
        team_name=p.team.name if p.team else None,
    )


@router.get("", response_model=list[schemas.PersonRead])
def list_persons(
    active: bool | None = None,
    team_id: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(models.Person).options(joinedload(models.Person.team))
    if active is not None:
        stmt = stmt.where(models.Person.active.is_(active))
    if team_id:
        stmt = stmt.where(models.Person.team_id == team_id)
    stmt = stmt.order_by(models.Person.name)
    return [_to_read(p) for p in db.scalars(stmt).all()]


@router.post("", response_model=schemas.PersonRead, status_code=status.HTTP_201_CREATED)
def create_person(payload: schemas.PersonCreate, db: Session = Depends(get_db)):
    if payload.email and db.scalar(select(models.Person).where(models.Person.email == payload.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already exists")
    if payload.team_id and not db.get(models.Team, payload.team_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Team not found")
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
    if "email" in data and data["email"] and data["email"] != p.email:
        if db.scalar(select(models.Person).where(models.Person.email == data["email"])):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already exists")
    if "team_id" in data and data["team_id"] and not db.get(models.Team, data["team_id"]):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Team not found")
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
