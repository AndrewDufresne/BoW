from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(models.Team).limit(1)):
        return

    risk = models.Team(name="Risk Tech", description="Risk platform engineering")
    markets = models.Team(name="Markets Tech", description="Wholesale markets engineering")
    db.add_all([risk, markets])
    db.flush()

    persons = [
        models.Person(name="Alice Chen", email="alice.chen@example.com", team_id=risk.id),
        models.Person(name="Bob Liu", email="bob.liu@example.com", team_id=risk.id),
        models.Person(name="Carol Wang", email="carol.wang@example.com", team_id=markets.id),
        models.Person(name="David Zhang", email="david.zhang@example.com", team_id=markets.id),
        models.Person(name="Eve Patel", email="eve.patel@example.com", team_id=markets.id),
    ]
    db.add_all(persons)

    p1 = models.Project(code="RSK-001", name="Credit Risk Platform", description="Core credit risk engine")
    p2 = models.Project(code="MKT-010", name="FX Pricing Service", description="Real-time FX pricing")
    p3 = models.Project(code="OPS-100", name="BAU & Operations", description="Run-the-bank activities")
    db.add_all([p1, p2, p3])
    db.flush()

    activities = [
        models.Activity(project_id=p1.id, name="Development"),
        models.Activity(project_id=p1.id, name="Code Review"),
        models.Activity(project_id=p1.id, name="Testing"),
        models.Activity(project_id=p2.id, name="Development"),
        models.Activity(project_id=p2.id, name="Design"),
        models.Activity(project_id=p2.id, name="Production Support"),
        models.Activity(project_id=p3.id, name="Meetings"),
        models.Activity(project_id=p3.id, name="Training"),
        models.Activity(project_id=p3.id, name="Incident Response"),
    ]
    db.add_all(activities)

    db.commit()
