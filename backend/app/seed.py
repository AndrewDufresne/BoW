from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(models.Team).limit(1)):
        return

    risk = models.Team(
        name="Risk Tech",
        description="Risk platform engineering",
        manager="Grace Hopper",
    )
    markets = models.Team(
        name="Markets Tech",
        description="Wholesale markets engineering",
        manager="Linus Torvalds",
    )
    ops = models.Team(
        name="Shared Services",
        description="Cross-cutting infra & ops",
        manager="Ada Lovelace",
    )
    db.add_all([risk, markets, ops])
    db.flush()

    # Projects no longer have team links — every team can pick any project.
    p1 = models.Project(
        code="RSK-001",
        name="Credit Risk Platform",
        description="Core credit risk engine",
        funding="CC-10001",
    )
    p2 = models.Project(
        code="MKT-010",
        name="FX Pricing Service",
        description="Real-time FX pricing",
        funding="CC-10002",
    )
    p3 = models.Project(
        code="OPS-100",
        name="BAU & Operations",
        description="Run-the-bank activities",
        funding="CC-99000",
    )
    db.add_all([p1, p2, p3])
    db.flush()

    sub_projects = [
        models.SubProject(project_id=p1.id, name="Engine Refactor", description="Refactor pricing core", funding="CC-10001"),
        models.SubProject(project_id=p1.id, name="Data Quality", description="DQ rules & remediation", funding="CC-10001"),
        models.SubProject(project_id=p1.id, name="Reporting", description="Regulatory reporting", funding="CC-10001"),
        models.SubProject(project_id=p2.id, name="Pricing Core", description="Quote engine", funding="CC-10002"),
        models.SubProject(project_id=p2.id, name="Latency Optimization", description="Sub-millisecond tuning", funding="CC-10002"),
        models.SubProject(project_id=p2.id, name="Production Support", description="L3 support", funding="CC-10002"),
        models.SubProject(project_id=p3.id, name="Meetings", description="Standups & syncs", funding="CC-99000"),
        models.SubProject(project_id=p3.id, name="Training", description="L&D activities", funding="CC-99000"),
        models.SubProject(project_id=p3.id, name="Incident Response", description="On-call & incidents", funding="CC-99000"),
    ]
    db.add_all(sub_projects)

    # One Person row per (employee, team) assignment. Bob & David have 2 rows.
    persons = [
        models.Person(
            employee_id="E0001", name="Alice Chen", email="alice.chen@example.com",
            location="Hong Kong", line_manager="Grace Hopper",
            allocation=Decimal("100"), employment_type="Permanent",
            funding="CC-10001", team_id=risk.id,
        ),
        models.Person(
            employee_id="E0002", name="Bob Liu", email="bob.liu@example.com",
            location="Hong Kong", line_manager="Grace Hopper",
            allocation=Decimal("60"), employment_type="Permanent",
            funding="CC-10001", team_id=risk.id,
        ),
        models.Person(
            employee_id="E0002", name="Bob Liu", email="bob.liu@example.com",
            location="Hong Kong", line_manager="Ada Lovelace",
            allocation=Decimal("40"), employment_type="Permanent",
            funding="CC-99000", team_id=ops.id,
        ),
        models.Person(
            employee_id="E0003", name="Carol Wang", email="carol.wang@example.com",
            location="Singapore", line_manager="Linus Torvalds",
            allocation=Decimal("100"), employment_type="Permanent",
            funding="CC-10002", team_id=markets.id,
        ),
        models.Person(
            employee_id="E0004", name="David Zhang", email="david.zhang@example.com",
            location="London", line_manager="Linus Torvalds",
            allocation=Decimal("50"), employment_type="Contractor",
            funding="CC-10002", team_id=markets.id,
        ),
        models.Person(
            employee_id="E0004", name="David Zhang", email="david.zhang@example.com",
            location="London", line_manager="Ada Lovelace",
            allocation=Decimal("30"), employment_type="Contractor",
            funding="CC-99000", team_id=ops.id,
        ),
        models.Person(
            employee_id="E0005", name="Eve Patel", email="eve.patel@example.com",
            location="London", line_manager="Linus Torvalds",
            allocation=Decimal("100"), employment_type="Intern",
            funding="CC-10002", team_id=markets.id,
        ),
    ]
    db.add_all(persons)

    db.commit()