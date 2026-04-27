from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.core.db import get_db

router = APIRouter(prefix="/activities", tags=["activities"])


def _to_read(a: models.Activity) -> schemas.ActivityRead:
    return schemas.ActivityRead(
        id=a.id,
        project_id=a.project_id,
        name=a.name,
        active=a.active,
        project_name=a.project.name if a.project else None,
    )


@router.get("", response_model=list[schemas.ActivityRead])
def list_activities(
    active: bool | None = None,
    project_id: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(models.Activity).options(joinedload(models.Activity.project))
    if active is not None:
        stmt = stmt.where(models.Activity.active.is_(active))
    if project_id:
        stmt = stmt.where(models.Activity.project_id == project_id)
    stmt = stmt.order_by(models.Activity.name)
    return [_to_read(a) for a in db.scalars(stmt).all()]


@router.post("", response_model=schemas.ActivityRead, status_code=status.HTTP_201_CREATED)
def create_activity(payload: schemas.ActivityCreate, db: Session = Depends(get_db)):
    project = db.get(models.Project, payload.project_id)
    if not project:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Project not found")
    if db.scalar(
        select(models.Activity).where(
            models.Activity.project_id == payload.project_id,
            models.Activity.name == payload.name,
        )
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Activity name already exists in this project"
        )
    a = models.Activity(**payload.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return _to_read(a)


@router.patch("/{activity_id}", response_model=schemas.ActivityRead)
def update_activity(
    activity_id: str, payload: schemas.ActivityUpdate, db: Session = Depends(get_db)
):
    a = db.get(models.Activity, activity_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != a.name:
        if db.scalar(
            select(models.Activity).where(
                models.Activity.project_id == a.project_id,
                models.Activity.name == data["name"],
            )
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Activity name already exists in this project"
            )
    for k, v in data.items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return _to_read(a)


@router.delete("/{activity_id}", response_model=schemas.ActivityRead)
def deactivate_activity(activity_id: str, db: Session = Depends(get_db)):
    a = db.get(models.Activity, activity_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found")
    a.active = False
    db.commit()
    db.refresh(a)
    return _to_read(a)
