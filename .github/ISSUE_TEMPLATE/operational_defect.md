---
name: Operational Defect / Production Issue
about: Report a production operational defect, performance anomaly, or security incident
title: '[OPS]: '
labels: 'operational-defect, production'
assignees: ''
---

## Incident Summary
A clear and concise description of the production behavior or operational defect observed.

## Affected Components
- [ ] API Gateway / Endpoint
- [ ] Celery Worker / Background Scanning
- [ ] Database (PostgreSQL / AsyncPG)
- [ ] Redis Queue / Cache
- [ ] Frontend Proxy (`frontend-2`)
- [ ] Docker Scanner Sandbox

## Observed vs Expected Behavior
- **Observed**: 
- **Expected**: 

## Telemetry & Evidence
- **Request ID (`X-Request-ID`)**:
- **Log Snippet (redacted)**:
- **Environment**: Production (`v0.3.0`)

## Severity & Impact
- [ ] Critical (P0) - Service Outage / Multi-tenant Breach / Data Loss
- [ ] High (P1) - Feature Impairment / High Latency / Worker Stall
- [ ] Medium (P2) - Non-blocking Operational Defect
