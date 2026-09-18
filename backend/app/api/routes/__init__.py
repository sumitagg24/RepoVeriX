"""API route modules."""

from app.api.routes.account_security import router as account_security_router
from app.api.routes.audit import router as audit_router
from app.api.routes.auth import router as auth_router
from app.api.routes.automation import router as automation_router
from app.api.routes.billing import router as billing_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.feedback import router as feedback_router
from app.api.routes.findings import router as findings_router
from app.api.routes.intelligence import router as intelligence_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.oauth import router as oauth_router
from app.api.routes.schedules import router as schedules_router
from app.api.routes.onboarding import router as onboarding_router
from app.api.routes.organizations import router as organizations_router
from app.api.routes.patches import router as patches_router
from app.api.routes.pullrequests import list_router as pr_list_router
from app.api.routes.pullrequests import router as pullrequests_router
from app.api.routes.repositories import router as repositories_router
from app.api.routes.research import learning_router
from app.api.routes.research import router as research_router
from app.api.routes.scans import router as scans_router
from app.api.routes.sharing import public_router as sharing_public_router
from app.api.routes.sharing import router as sharing_router
from app.api.routes.tokens import router as tokens_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.routes.websites import router as websites_router

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
    "onboarding_router",
    "intelligence_router",
    "feedback_router",
    "sharing_router",
    "sharing_public_router",
    "organizations_router",
    "tokens_router",
    "webhooks_router",
    "websites_router",
    "automation_router",
    "account_security_router",
    "notifications_router",
    "schedules_router",
]
