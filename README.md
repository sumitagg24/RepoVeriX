# RepoVeriX

**Evidence-grounded repository auditing and verified automated repair platform**

RepoVeriX is a comprehensive platform that combines static analysis, LLM reasoning, and automated verification to find and fix bugs with mathematical certainty.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Nginx Gateway │────▶│  Next.js Frontend │    │  FastAPI Backend │
│    (Port 80)    │     │   (Port 3000)   │     │   (Port 8000)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                ┌────────┴────────┐
                                                │  PostgreSQL 16  │
                                                │   (Port 5432)   │
                                                └─────────────────┘
```

## Features

- 🔐 **Authentication**: JWT-based auth with bcrypt password hashing
- 📦 **Repository Management**: GitHub and ZIP upload support
- 🔍 **Multi-Configuration Scans**: Static-only, LLM-only, Hybrid, Full RepoVeriX
- 🐛 **Finding Management**: Evidence graphs, severity classification, status tracking
- 🔧 **Automated Repair**: Patch generation with sandboxed verification
- 📊 **Dashboard**: Real-time metrics and aggregated summaries
- 🐳 **Docker Orchestration**: Complete stack with docker-compose

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.12+ (for local backend development)

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd repoverix-main

# Copy environment template
cp .env.example .env
# Edit .env with your values (especially JWT_SECRET)

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access the application
# Frontend: http://localhost
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Local Development

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Set up environment
cp .env.example .env
# Edit .env with your values

# Run migrations
python -m alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Start development server
npm run dev
```

## API Documentation

Once the backend is running, access:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Project Structure

```
repoverix-main/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Config, security
│   │   ├── db/             # Database models, migrations
│   │   ├── schemas/        # Pydantic schemas
│   │   └── main.py         # FastAPI app entry
│   ├── alembic/            # Database migrations
│   ├── tests/              # Test suite
│   ├── pyproject.toml      # Python dependencies
│   └── Dockerfile
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # React components
│   │   ├── context/        # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript types
│   ├── package.json
│   └── Dockerfile
├── nginx/                  # Nginx gateway config
│   └── nginx.conf
├── docker-compose.yml      # Full stack orchestration
└── .env.example           # Environment template
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Repositories
- `GET /api/v1/repositories` - List repositories
- `POST /api/v1/repositories` - Create repository
- `GET /api/v1/repositories/{id}` - Get repository
- `DELETE /api/v1/repositories/{id}` - Delete repository

### Scans
- `GET /api/v1/scans` - List scans
- `POST /api/v1/scans` - Create scan
- `GET /api/v1/scans/{id}` - Get scan with analysis runs
- `POST /api/v1/scans/{id}/cancel` - Cancel scan

### Findings
- `GET /api/v1/findings` - List findings (with filters)
- `GET /api/v1/findings/{id}` - Get finding with evidence/patches
- `GET /api/v1/findings/scan/{scan_id}/summary` - Aggregated summary

### Patches & Verification
- `GET /api/v1/patches` - List patches
- `GET /api/v1/patches/{id}` - Get patch
- `GET /api/v1/patches/{id}/verifications` - List verifications
- `GET /api/v1/patches/verification/{id}` - Get verification with test results

### Dashboard
- `GET /api/v1/dashboard/summary` - Aggregated dashboard stats

## Testing

```bash
# Backend tests
cd backend
python -m pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | Yes |
| `POSTGRES_USER` | PostgreSQL username | Yes |
| `POSTGRES_PASSWORD` | PostgreSQL password | Yes |
| `POSTGRES_DB` | PostgreSQL database name | Yes |
| `OPENAI_API_KEY` | OpenAI API key for LLM features | No |
| `ANTHROPIC_API_KEY` | Anthropic API key for LLM features | No |
| `NEXT_PUBLIC_API_URL` | Backend API URL for frontend | Yes |

## License

MIT License - see LICENSE file for details.