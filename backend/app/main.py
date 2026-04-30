from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from loguru import logger

from app import models  # noqa: F401  (ensure models are imported for metadata)
from app.core.config import settings
from app.core.db import Base, SessionLocal, engine
from app.routers import config, dashboard, persons, projects, sub_projects, submissions, teams
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        with SessionLocal() as db:
            seed_if_empty(db)
    logger.info("Book of Work API started ({} env)", settings.env)
    yield


app = FastAPI(
    title="Book of Work API",
    version="0.1.0",
    description="PoC backend for the Book of Work system.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exc_handler(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.status_code, "message": exc.detail}},
    )


API_PREFIX = "/api/v1"
app.include_router(teams.router, prefix=API_PREFIX)
app.include_router(persons.router, prefix=API_PREFIX)
app.include_router(projects.router, prefix=API_PREFIX)
app.include_router(sub_projects.router, prefix=API_PREFIX)
app.include_router(submissions.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(config.router, prefix=API_PREFIX)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
