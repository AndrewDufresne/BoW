from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.core.db import get_db

router = APIRouter(prefix="/persons", tags=["persons"])


def _to_read(p: models.Person) -> schemas.PersonRead:
    teams = sorted(p.teams, key=lambda t: t.name)
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
        team_ids=[t.id for t in teams],
        teams=[schemas.TeamMini(id=t.id, name=t.name) for t in teams],
    )


def _resolve_teams(db: Session, team_ids: list[str]) -> list[models.Team]:
    if not team_ids:
        return []
    teams = db.scalars(select(models.Team).where(models.Team.id.in_(team_ids))).all()
    found_ids = {t.id for t in teams}
    missing = [tid for tid in team_ids if tid not in found_ids]
    if missing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Team(s) not found: {', '.join(missing)}",
        )
    return list(teams)


@router.get("", response_model=list[schemas.PersonRead])
def list_persons(
    active: bool | None = None,
    team_id: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(models.Person).options(selectinload(models.Person.teams))
    if active is not None:
        stmt = stmt.where(models.Person.active.is_(active))
    if team_id:
        stmt = stmt.where(models.Person.teams.any(models.Team.id == team_id))
    stmt = stmt.order_by(models.Person.name)
    return [_to_read(p) for p in db.scalars(stmt).unique().all()]


@router.post("", response_model=schemas.PersonRead, status_code=status.HTTP_201_CREATED)
def create_person(payload: schemas.PersonCreate, db: Session = Depends(get_db)):
    if payload.email and db.scalar(select(models.Person).where(models.Person.email == payload.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already exists")
    if payload.employee_id and db.scalar(
        select(models.Person).where(models.Person.employee_id == payload.employee_id)
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "Employee ID already exists")
    teams = _resolve_teams(db, payload.team_ids)
    data = payload.model_dump(exclude={"team_ids"})
    p = models.Person(**data)
    p.teams = teams
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
    if (
        "employee_id" in data
        and data["employee_id"]
        and data["employee_id"] != p.employee_id
    ):
        if db.scalar(
            select(models.Person).where(models.Person.employee_id == data["employee_id"])
        ):
            raise HTTPException(status.HTTP_409_CONFLICT, "Employee ID already exists")
    if "team_ids" in data:
        p.teams = _resolve_teams(db, data.pop("team_ids") or [])
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


@router.get("/{person_id}/teams-with-projects", response_model=list[schemas.TeamWithProjects])
def get_person_teams_with_projects(person_id: str, db: Session = Depends(get_db)):
    person = db.scalar(
        select(models.Person)
        .options(
            selectinload(models.Person.teams)
            .selectinload(models.Team.projects)
            .selectinload(models.Project.sub_projects)
        )
        .where(models.Person.id == person_id)
    )
    if not person:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Person not found")
    result: list[schemas.TeamWithProjects] = []
    for team in sorted(person.teams, key=lambda t: t.name):
        if not team.active:
            continue
        projects: list[schemas.TeamProjectsProject] = []
        for project in sorted(team.projects, key=lambda p: p.code):
            if not project.active:
                continue
            subs = [
                schemas.SubProjectMini(
                    id=s.id,
                    name=s.name,
                    description=s.description,
                    funding=s.funding,
                )
                for s in sorted(project.sub_projects, key=lambda s: s.name)
                if s.active
            ]
            projects.append(
                schemas.TeamProjectsProject(
                    id=project.id,
                    code=project.code,
                    name=project.name,
                    description=project.description,
                    funding=project.funding,
                    sub_projects=subs,
                )
            )
        result.append(
            schemas.TeamWithProjects(
                id=team.id,
                name=team.name,
                description=team.description,
                manager=team.manager,
                projects=projects,
            )
        )
    return result
