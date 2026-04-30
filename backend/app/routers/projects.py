from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.core.db import get_db

router = APIRouter(prefix="/projects", tags=["projects"])


def _resolve_teams(db: Session, team_ids: list[str]) -> list[models.Team]:
    if not team_ids:
        return []
    teams = db.scalars(select(models.Team).where(models.Team.id.in_(team_ids))).all()
    found = {t.id for t in teams}
    missing = [tid for tid in team_ids if tid not in found]
    if missing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Team(s) not found: {', '.join(missing)}",
        )
    return list(teams)


def _to_read(p: models.Project, count: int) -> schemas.ProjectRead:
    teams = sorted(p.teams, key=lambda t: t.name)
    return schemas.ProjectRead(
        id=p.id,
        code=p.code,
        name=p.name,
        description=p.description,
        funding=p.funding,
        active=p.active,
        sub_project_count=count,
        team_ids=[t.id for t in teams],
        teams=[schemas.TeamMini(id=t.id, name=t.name) for t in teams],
    )


@router.get("", response_model=list[schemas.ProjectRead])
def list_projects(active: bool | None = None, db: Session = Depends(get_db)):
    stmt = (
        select(models.Project, func.count(models.SubProject.id))
        .outerjoin(
            models.SubProject,
            (models.SubProject.project_id == models.Project.id)
            & (models.SubProject.active.is_(True)),
        )
        .options(selectinload(models.Project.teams))
    )
    if active is not None:
        stmt = stmt.where(models.Project.active.is_(active))
    stmt = stmt.group_by(models.Project.id).order_by(models.Project.code)
    return [_to_read(p, c) for p, c in db.execute(stmt).all()]


@router.post("", response_model=schemas.ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    if db.scalar(select(models.Project).where(models.Project.code == payload.code)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Project code already exists")
    teams = _resolve_teams(db, payload.team_ids)
    data = payload.model_dump(exclude={"team_ids"})
    p = models.Project(**data)
    p.teams = teams
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
    if "team_ids" in data:
        p.teams = _resolve_teams(db, data.pop("team_ids") or [])
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
            description=s.description,
            funding=s.funding,
            active=s.active,
            project_name=project.name,
        )
        for s in db.scalars(stmt).all()
    ]
