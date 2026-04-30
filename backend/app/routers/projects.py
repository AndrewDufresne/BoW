from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.db import get_db

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_read(p: models.Project, count: int) -> schemas.ProjectRead:
    return schemas.ProjectRead(
        id=p.id,
        code=p.code,
        name=p.name,
        description=p.description,
        active=p.active,
        sub_project_count=count,
    )


@router.get("", response_model=list[schemas.ProjectRead])
def list_projects(active: bool | None = None, db: Session = Depends(get_db)):
    stmt = select(models.Project, func.count(models.SubProject.id)).outerjoin(
        models.SubProject,
        (models.SubProject.project_id == models.Project.id)
        & (models.SubProject.active.is_(True)),
    )
    if active is not None:
        stmt = stmt.where(models.Project.active.is_(active))
    stmt = stmt.group_by(models.Project.id).order_by(models.Project.code)
    return [_to_read(p, c) for p, c in db.execute(stmt).all()]


@router.post("", response_model=schemas.ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    if db.scalar(select(models.Project).where(models.Project.code == payload.code)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Project code already exists")
    p = models.Project(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_read(p, 0)


@router.patch("/{project_id}", response_model=schemas.ProjectRead)
def update_project(project_id: str, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    p = db.get(models.Project, project_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"] != p.code:
        if db.scalar(select(models.Project).where(models.Project.code == data["code"])):
            raise HTTPException(status.HTTP_409_CONFLICT, "Project code already exists")
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    count = db.scalar(
        select(func.count(models.SubProject.id)).where(
            models.SubProject.project_id == p.id, models.SubProject.active.is_(True)
        )
    ) or 0
    return _to_read(p, count)


@router.delete("/{project_id}", response_model=schemas.ProjectRead)
def deactivate_project(project_id: str, db: Session = Depends(get_db)):
    p = db.get(models.Project, project_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    p.active = False
    db.commit()
    db.refresh(p)
    return _to_read(p, 0)


@router.get("/{project_id}/sub-projects", response_model=list[schemas.SubProjectRead])
def list_project_sub_projects(
    project_id: str, active: bool | None = True, db: Session = Depends(get_db)
):
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    stmt = select(models.SubProject).where(models.SubProject.project_id == project_id)
    if active is not None:
        stmt = stmt.where(models.SubProject.active.is_(active))
    stmt = stmt.order_by(models.SubProject.name)
    return [
        schemas.SubProjectRead(
            id=s.id,
            project_id=s.project_id,
            name=s.name,
            active=s.active,
            project_name=project.name,
        )
        for s in db.scalars(stmt).all()
    ]
