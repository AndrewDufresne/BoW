from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(models.Team).limit(1)):
        return

    risk = models.Team(name="Risk Tech", description="Risk platform engineering")
    markets = models.Team(name="Markets Tech", description="Wholesale markets engineering")
    ops = models.Team(name="Shared Services", description="Cross-cutting infra & ops")
    db.add_all([risk, markets, ops])
    db.flush()

    # Some people belong to more than one team to demonstrate the M:N model.
    alice = models.Person(name="Alice Chen", email="alice.chen@example.com", teams=[risk])
    bob = models.Person(name="Bob Liu", email="bob.liu@example.com", teams=[risk, ops])
    carol = models.Person(name="Carol Wang", email="carol.wang@example.com", teams=[markets])
    david = models.Person(name="David Zhang", email="david.zhang@example.com", teams=[markets, ops])
    eve = models.Person(name="Eve Patel", email="eve.patel@example.com", teams=[markets])
    db.add_all([alice, bob, carol, david, eve])

    p1 = models.Project(
        code="RSK-001", name="Credit Risk Platform", description="Core credit risk engine"
    )
    p2 = models.Project(code="MKT-010", name="FX Pricing Service", description="Real-time FX pricing")
    p3 = models.Project(code="OPS-100", name="BAU & Operations", description="Run-the-bank activities")
    db.add_all([p1, p2, p3])
    db.flush()

    sub_projects = [
        models.SubProject(project_id=p1.id, name="Engine Refactor"),
        models.SubProject(project_id=p1.id, name="Data Quality"),
        models.SubProject(project_id=p1.id, name="Reporting"),
        models.SubProject(project_id=p2.id, name="Pricing Core"),
        models.SubProject(project_id=p2.id, name="Latency Optimization"),
        models.SubProject(project_id=p2.id, name="Production Support"),
        models.SubProject(project_id=p3.id, name="Meetings"),
        models.SubProject(project_id=p3.id, name="Training"),
        models.SubProject(project_id=p3.id, name="Incident Response"),
    ]
    db.add_all(sub_projects)

    db.commit()
