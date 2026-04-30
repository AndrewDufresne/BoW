"""Excel-based bulk import/export for Configuration data.

Sheets:
- Teams: id, name, description, active
- Persons: id, name, email, teams (semicolon-separated team names), active
- Projects: id, code, name, description, active
- SubProjects: id, project_code, name, active

For all sheets, leave `id` blank to create a new row. Existing rows are matched
by `id` and updated. Rows are never deleted by import — to retire something,
set its `active` to FALSE.
"""

from __future__ import annotations

import io
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.core.db import get_db

router = APIRouter(prefix="/config", tags=["config"])


# ---------- export ----------

SHEETS: dict[str, list[str]] = {
    "Teams": ["id", "name", "description", "active"],
    "Persons": ["id", "name", "email", "teams", "active"],
    "Projects": ["id", "code", "name", "description", "active"],
    "SubProjects": ["id", "project_code", "name", "active"],
}

HEADER_FONT = Font(bold=True, color="FFFFFF")
HEADER_FILL = PatternFill("solid", fgColor="DB0011")  # HSBC red


def _write_header(ws, headers: list[str]) -> None:
    for col, h in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        ws.column_dimensions[get_column_letter(col)].width = max(14, len(h) + 4)
    ws.freeze_panes = "A2"


def _build_workbook(db: Session, *, with_data: bool) -> Workbook:
    wb = Workbook()
    # Remove default sheet
    default = wb.active
    if default is not None:
        wb.remove(default)

    # Teams
    ws = wb.create_sheet("Teams")
    _write_header(ws, SHEETS["Teams"])
    if with_data:
        for t in db.query(models.Team).order_by(models.Team.name).all():
            ws.append([t.id, t.name, t.description or "", "TRUE" if t.active else "FALSE"])

    # Persons
    ws = wb.create_sheet("Persons")
    _write_header(ws, SHEETS["Persons"])
    if with_data:
        for p in db.query(models.Person).order_by(models.Person.name).all():
            teams = "; ".join(sorted(t.name for t in p.teams))
            ws.append([p.id, p.name, p.email or "", teams, "TRUE" if p.active else "FALSE"])

    # Projects
    ws = wb.create_sheet("Projects")
    _write_header(ws, SHEETS["Projects"])
    if with_data:
        for pr in db.query(models.Project).order_by(models.Project.code).all():
            ws.append(
                [pr.id, pr.code, pr.name, pr.description or "", "TRUE" if pr.active else "FALSE"]
            )

    # SubProjects
    ws = wb.create_sheet("SubProjects")
    _write_header(ws, SHEETS["SubProjects"])
    if with_data:
        rows = (
            db.query(models.SubProject, models.Project)
            .join(models.Project, models.SubProject.project_id == models.Project.id)
            .order_by(models.Project.code, models.SubProject.name)
            .all()
        )
        for sp, pr in rows:
            ws.append([sp.id, pr.code, sp.name, "TRUE" if sp.active else "FALSE"])

    # Add an Instructions sheet
    info = wb.create_sheet("Instructions", 0)
    info.append(["Book of Work — Configuration Template"])
    info["A1"].font = Font(bold=True, size=14)
    info.append([])
    info.append(["• Leave `id` blank to create a new row."])
    info.append(["• Existing rows are matched by `id` and updated."])
    info.append(["• Rows are never deleted by import — set `active` to FALSE to retire."])
    info.append(["• Persons.teams: semicolon-separated team names (must already exist)."])
    info.append(["• SubProjects.project_code: must reference an existing Projects.code."])
    info.append(["• Booleans accept TRUE/FALSE/1/0 (case-insensitive)."])
    info.column_dimensions["A"].width = 90

    return wb


@router.get("/template", summary="Download configuration data as Excel")
def download_template(db: Session = Depends(get_db)) -> StreamingResponse:
    wb = _build_workbook(db, with_data=True)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="bow-config.xlsx"'},
    )


# ---------- import ----------


def _parse_bool(v: Any) -> bool | None:
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("true", "1", "yes", "y"):
        return True
    if s in ("false", "0", "no", "n"):
        return False
    return None


class ImportError_(BaseModel):
    sheet: str
    row: int
    message: str


class ImportSummary(BaseModel):
    teams_created: int = 0
    teams_updated: int = 0
    persons_created: int = 0
    persons_updated: int = 0
    projects_created: int = 0
    projects_updated: int = 0
    sub_projects_created: int = 0
    sub_projects_updated: int = 0


class ImportResult(BaseModel):
    ok: bool
    errors: list[ImportError_] = []
    summary: ImportSummary = ImportSummary()


def _read_sheet(wb, name: str) -> list[dict[str, Any]]:
    if name not in wb.sheetnames:
        return []
    ws = wb[name]
    headers = [
        (c.value or "").strip() if isinstance(c.value, str) else c.value
        for c in next(ws.iter_rows(min_row=1, max_row=1))
    ]
    rows: list[dict[str, Any]] = []
    for r_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if all(v is None or (isinstance(v, str) and not v.strip()) for v in row):
            continue
        rec: dict[str, Any] = {"_row": r_idx}
        for h, v in zip(headers, row):
            if h is None:
                continue
            if isinstance(v, str):
                v = v.strip()
            rec[h] = v if v != "" else None
        rows.append(rec)
    return rows


@router.post("/import", response_model=ImportResult, summary="Import configuration from Excel")
async def import_template(
    file: UploadFile = File(...),
    dry_run: bool = False,
    db: Session = Depends(get_db),
) -> ImportResult:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Please upload a .xlsx file")

    content = await file.read()
    try:
        wb = load_workbook(io.BytesIO(content), data_only=True)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Could not open workbook: {exc}") from exc

    errors: list[ImportError_] = []
    summary = ImportSummary()

    # --- Teams (process first so persons can reference them) ---
    team_rows = _read_sheet(wb, "Teams")
    pending_teams: list[tuple[dict[str, Any], models.Team | None]] = []
    for rec in team_rows:
        row_no = rec["_row"]
        name = rec.get("name")
        if not name:
            errors.append(ImportError_(sheet="Teams", row=row_no, message="`name` is required"))
            continue
        existing: models.Team | None = None
        if rec.get("id"):
            existing = db.query(models.Team).filter_by(id=rec["id"]).first()
            if not existing:
                errors.append(
                    ImportError_(sheet="Teams", row=row_no, message=f"id {rec['id']!r} not found")
                )
                continue
        else:
            # Check name uniqueness for new
            if db.query(models.Team).filter_by(name=name).first():
                errors.append(
                    ImportError_(
                        sheet="Teams", row=row_no, message=f"team name {name!r} already exists"
                    )
                )
                continue
        pending_teams.append((rec, existing))

    # --- Projects ---
    project_rows = _read_sheet(wb, "Projects")
    pending_projects: list[tuple[dict[str, Any], models.Project | None]] = []
    seen_codes: set[str] = set()
    for rec in project_rows:
        row_no = rec["_row"]
        code = rec.get("code")
        name = rec.get("name")
        if not code or not name:
            errors.append(
                ImportError_(sheet="Projects", row=row_no, message="`code` and `name` are required")
            )
            continue
        if code in seen_codes:
            errors.append(
                ImportError_(sheet="Projects", row=row_no, message=f"duplicate code {code!r}")
            )
            continue
        seen_codes.add(code)
        existing: models.Project | None = None
        if rec.get("id"):
            existing = db.query(models.Project).filter_by(id=rec["id"]).first()
            if not existing:
                errors.append(
                    ImportError_(sheet="Projects", row=row_no, message=f"id {rec['id']!r} not found")
                )
                continue
        else:
            if db.query(models.Project).filter_by(code=code).first():
                errors.append(
                    ImportError_(
                        sheet="Projects", row=row_no, message=f"project code {code!r} already exists"
                    )
                )
                continue
        pending_projects.append((rec, existing))

    # --- Persons (validate team references) ---
    # Build a lookup of (lowercased team name) -> team object — including pending new teams
    team_by_name: dict[str, models.Team] = {
        t.name.lower(): t for t in db.query(models.Team).all()
    }
    pending_team_names = {(r.get("name") or "").lower() for r, ex in pending_teams if not ex}

    person_rows = _read_sheet(wb, "Persons")
    pending_persons: list[tuple[dict[str, Any], models.Person | None, list[str]]] = []
    for rec in person_rows:
        row_no = rec["_row"]
        name = rec.get("name")
        if not name:
            errors.append(ImportError_(sheet="Persons", row=row_no, message="`name` is required"))
            continue
        teams_raw = rec.get("teams") or ""
        team_names = [t.strip() for t in str(teams_raw).split(";") if t.strip()]
        bad = [
            t
            for t in team_names
            if t.lower() not in team_by_name and t.lower() not in pending_team_names
        ]
        if bad:
            errors.append(
                ImportError_(
                    sheet="Persons",
                    row=row_no,
                    message=f"unknown team(s): {', '.join(bad)}",
                )
            )
            continue
        existing: models.Person | None = None
        if rec.get("id"):
            existing = db.query(models.Person).filter_by(id=rec["id"]).first()
            if not existing:
                errors.append(
                    ImportError_(sheet="Persons", row=row_no, message=f"id {rec['id']!r} not found")
                )
                continue
        elif rec.get("email"):
            dup = db.query(models.Person).filter_by(email=rec["email"]).first()
            if dup:
                errors.append(
                    ImportError_(
                        sheet="Persons",
                        row=row_no,
                        message=f"email {rec['email']!r} already exists",
                    )
                )
                continue
        pending_persons.append((rec, existing, team_names))

    # --- SubProjects (validate project_code references) ---
    project_by_code: dict[str, models.Project] = {
        p.code: p for p in db.query(models.Project).all()
    }
    pending_project_codes = {(r.get("code") or "") for r, ex in pending_projects if not ex}

    sp_rows = _read_sheet(wb, "SubProjects")
    pending_sps: list[tuple[dict[str, Any], models.SubProject | None]] = []
    for rec in sp_rows:
        row_no = rec["_row"]
        name = rec.get("name")
        pcode = rec.get("project_code")
        if not name or not pcode:
            errors.append(
                ImportError_(
                    sheet="SubProjects",
                    row=row_no,
                    message="`name` and `project_code` are required",
                )
            )
            continue
        if pcode not in project_by_code and pcode not in pending_project_codes:
            errors.append(
                ImportError_(
                    sheet="SubProjects",
                    row=row_no,
                    message=f"unknown project_code {pcode!r}",
                )
            )
            continue
        existing: models.SubProject | None = None
        if rec.get("id"):
            existing = db.query(models.SubProject).filter_by(id=rec["id"]).first()
            if not existing:
                errors.append(
                    ImportError_(
                        sheet="SubProjects", row=row_no, message=f"id {rec['id']!r} not found"
                    )
                )
                continue
        pending_sps.append((rec, existing))

    if errors:
        return ImportResult(ok=False, errors=errors, summary=summary)

    if dry_run:
        return ImportResult(ok=True, errors=[], summary=summary)

    # ---- Apply ----
    # Teams first
    for rec, existing in pending_teams:
        active = _parse_bool(rec.get("active"))
        if existing:
            existing.name = rec["name"]
            existing.description = rec.get("description")
            if active is not None:
                existing.active = active
            summary.teams_updated += 1
        else:
            t = models.Team(
                name=rec["name"],
                description=rec.get("description"),
                active=active if active is not None else True,
            )
            db.add(t)
            team_by_name[t.name.lower()] = t
            summary.teams_created += 1
    db.flush()

    # Projects next
    for rec, existing in pending_projects:
        active = _parse_bool(rec.get("active"))
        if existing:
            existing.code = rec["code"]
            existing.name = rec["name"]
            existing.description = rec.get("description")
            if active is not None:
                existing.active = active
            summary.projects_updated += 1
        else:
            p = models.Project(
                code=rec["code"],
                name=rec["name"],
                description=rec.get("description"),
                active=active if active is not None else True,
            )
            db.add(p)
            project_by_code[p.code] = p
            summary.projects_created += 1
    db.flush()

    # Persons (with team mapping)
    for rec, existing, team_names in pending_persons:
        active = _parse_bool(rec.get("active"))
        teams = [team_by_name[t.lower()] for t in team_names]
        if existing:
            existing.name = rec["name"]
            existing.email = rec.get("email")
            existing.teams = teams
            if active is not None:
                existing.active = active
            summary.persons_updated += 1
        else:
            p = models.Person(
                name=rec["name"],
                email=rec.get("email"),
                active=active if active is not None else True,
                teams=teams,
            )
            db.add(p)
            summary.persons_created += 1

    # SubProjects last
    for rec, existing in pending_sps:
        active = _parse_bool(rec.get("active"))
        project = project_by_code[rec["project_code"]]
        if existing:
            existing.name = rec["name"]
            existing.project_id = project.id
            if active is not None:
                existing.active = active
            summary.sub_projects_updated += 1
        else:
            sp = models.SubProject(
                project_id=project.id,
                name=rec["name"],
                active=active if active is not None else True,
            )
            db.add(sp)
            summary.sub_projects_created += 1

    db.commit()
    return ImportResult(ok=True, errors=[], summary=summary)
