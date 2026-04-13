"""FastAPI main application — MedVault"""
import logging
import sys
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.settings import settings

# ── Structured Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger("medvault")
logger.info("Starting MedVault API v%s (env=%s)", settings.api_version, settings.environment)

# Core v1 routes
from api.v1 import auth as auth_routes
from api.v1.analytics_routes import router as analytics_routes
from api.v1.flow_routes import router as flow_routes
from api.v1.simulation_routes import router as simulation_routes
from api.v1.intelligence_routes import router as intelligence_routes
from api.v1.analytics.summary import router as analytics_summary_router

# Other routes
from api import endpoints
from api.public_availability import router as public_router
from api.ingestion_routes import router as ingestion_router
from api.admin_routes import router as admin_router

# Patient services
from api.patient_services_routes import router as patient_services_router
from patient_signup_route import router as patient_signup_router

# NEW: Recommendation engine
from hospital_recommendation_route import router as recommendations_router

app = FastAPI(title=settings.api_title, version=settings.api_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Exception Handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch ANY unhandled exception, log it, and return a clear 500 response."""
    tb = traceback.format_exc()
    logger.error(
        "Unhandled exception on %s %s:\n%s",
        request.method, request.url.path, tb,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal server error: {type(exc).__name__}: {exc}",
            "path": str(request.url.path),
        },
    )


# Versioned API
app.include_router(auth_routes.router,         prefix=settings.api_prefix)
app.include_router(analytics_routes,           prefix=settings.api_prefix)
app.include_router(flow_routes,                prefix=settings.api_prefix)
app.include_router(simulation_routes,          prefix=settings.api_prefix)
app.include_router(intelligence_routes,        prefix=settings.api_prefix)
app.include_router(analytics_summary_router,   prefix="/api/v1")

# System routes
app.include_router(endpoints.router,           prefix=settings.api_prefix)
app.include_router(public_router)
app.include_router(ingestion_router)
app.include_router(admin_router)

# Patient services
app.include_router(patient_services_router)
app.include_router(patient_signup_router)

# Recommendations (no prefix — router sets its own /api/v1/public prefix)
app.include_router(recommendations_router)


@app.get("/")
async def root():
    return {"name": "MedVault API", "version": settings.api_version, "status": "operational"}


@app.get("/health")
async def health():
    return {"status": "healthy"}