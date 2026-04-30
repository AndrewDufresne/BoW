from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.core.db import get_db

router = APIRouter(prefix="/sub-projects", tags=["sub-projects"])


def _to_read(s: models.SubProject) -> schemas.SubProjectRead:
    return schemas.SubProjectRead(
        id=s.id,
        project_id=s.project_id,
        name=s.name,
        description=s.description,
        funding=s.funding,
        active=s.active,
        project_name=s.project.name if s.project else None,
    )


@router.get("", response_model=list[schemas.SubProjectRead])
def list_sub_projects(
    active: bool | None = None,
    project_id: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(models.SubProject).options(joinedload(models.SubProject.project))
    if active is not None:
        stmt = stmt.where(models.SubProject.active.is_(active))
    if project_id:
        stmt = stmt.where(models.SubProject.project_id == project_id)
    stmt = stmt.order_by(models.SubProject.name)
    return [_to_read(s) for s in db.scalars(stmt).all()]


@router.post("", response_model=schemas.SubProjectRead, status_code=status.HTTP_201_CREATED)
def create_sub_project(payload: schemas.SubProjectCreate, db: Session = Depends(get_db)):
    project = db.get(models.Project, payload.project_id)
    if not project:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Project not found")
    if db.scalar(
        select(models.SubProject).where(
            models.SubProject.project_id == payload.project_id,
            models.SubProject.name == payload.name,
        )
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Sub-project name already exists in this project"
        )
    s = models.SubProject(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _to_read(s)


@router.patch("/{sub_project_id}", response_model=schemas.SubProjectRead)
def update_sub_project(
    sub_project_id: str, payload: schemas.SubProjectUpdate, db: Session = Depends(get_db)
):
    s = db.get(models.SubProject, sub_project_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sub-project not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != s.name:
        if db.scalar(
            select(models.SubProject).where(
                models.SubProject.project_id == s.project_id,
                models.SubProject.name == data["name"],
            )
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Sub-project name already exists in this project"
            )
    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _to_read(s)


@router.delete("/{sub_project_id}", response_model=schemas.SubProjectRead)
def deactivate_sub_project(sub_project_id: str, db: Session = Depends(get_db)):
    s = db.get(models.SubProject, sub_project_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sub-project not found")
    s.active = False
    db.commit()
    db.refresh(s)
    return _to_read(s)
