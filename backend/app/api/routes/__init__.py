"""API route modules."""

from app.api.routes.audit import router as audit_router
from app.api.routes.auth import router as auth_router
from app.api.routes.billing import router as billing_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.findings import router as findings_router
from app.api.routes.intelligence import router as intelligence_router
from app.api.routes.oauth import router as oauth_router
from app.api.routes.patches import router as patches_router
from app.api.routes.pullrequests import list_router as pr_list_router
from app.api.routes.pullrequests import router as pullrequests_router
from app.api.routes.repositories import router as repositories_router
from app.api.routes.research import learning_router
from app.api.routes.research import router as research_router
from app.api.routes.scans import router as scans_router

__all__ = [
    "audit_router",
    "auth_router",
    "billing_router",
    "repositories_router",
    "research_router",
    "learning_router",
    "scans_router",
    "findings_router",
    "patches_router",
    "pullrequests_router",
    "pr_list_router",
    "dashboard_router",
    "oauth_router",
    "intelligence_router",
]
