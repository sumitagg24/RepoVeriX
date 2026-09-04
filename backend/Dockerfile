# RepoVeriX backend — production image.
#
# The application never executes untrusted repository code in this container.
# Patch verification runs the patched repo inside a *fresh* Docker container
# (see app/analysis/verify.py). To enable that on a host, mount the Docker
# socket (docker-compose.prod.yml) and run the container as root or with the
# host's docker group gid, since the image itself runs as a non-root user.
#
# Build with: docker build -t repoverix-backend .
ARG DOCKER_CLI_VERSION=27.1.1

FROM python:3.12-slim

ARG DOCKER_CLI_VERSION

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/data \
    REPOVERIX_REPOSITORY_STORAGE_DIR=/data/repositories

# git: GitHub cloning + verification bookkeeping.
# ca-certificates/curl: fetch the standalone docker CLI (optional, used only
# when the Docker socket is mounted for in-Docker verification).
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && arch="$(uname -m)"; case "$arch" in \
         x86_64) dlarch="x86_64" ;; \
         aarch64) dlarch="aarch64" ;; \
         *) dlarch="x86_64" ;; \
       esac \
    && curl -fsSL "https://download.docker.com/linux/static/stable/${dlarch}/docker-${DOCKER_CLI_VERSION}.tgz" -o /tmp/docker.tgz \
    && tar -xzf /tmp/docker.tgz -C /tmp docker/docker \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && chmod +x /usr/local/bin/docker \
    && rm -rf /tmp/docker /tmp/docker.tgz

WORKDIR /app

# Install the package first so dependency layers are cached independently.
COPY pyproject.toml alembic.ini ./
COPY app ./app
# ruff is used for baseline static checks during patch verification.
RUN pip install --no-cache-dir . ruff

# Runtime assets that are not part of the Python package.
COPY alembic ./alembic
COPY prompts ./prompts
COPY scripts ./scripts

# Non-root runtime user (matches the repo's deployment convention).
RUN groupadd -r repoverix && useradd -r -g repoverix repoverix \
    && mkdir -p /data/repositories \
    && chown -R repoverix:repoverix /data /app

USER repoverix

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
