"""Async subprocess helpers for analysis stages (git clone, linters)."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass


@dataclass
class ProcResult:
    returncode: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.returncode == 0


async def run_command(
    argv: list[str],
    *,
    cwd: str | os.PathLike[str] | None = None,
    timeout_seconds: int = 60,
    env_extra: dict[str, str] | None = None,
    max_output_chars: int = 200_000,
) -> ProcResult:
    """Run ``argv`` asynchronously, capturing output with a hard cap."""
    env = dict(os.environ)
    if env_extra:
        env.update(env_extra)

    proc = await asyncio.create_subprocess_exec(
        *argv,
        cwd=str(cwd) if cwd else None,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
    except TimeoutError:
        proc.kill()
        await proc.communicate()
        raise TimeoutError(f"Command timed out after {timeout_seconds}s: {' '.join(argv)}") from None

    def clip(raw: bytes) -> str:
        text = raw.decode("utf-8", errors="replace")
        if len(text) > max_output_chars:
            text = text[:max_output_chars] + "\n...[truncated]"
        return text

    return ProcResult(returncode=proc.returncode or 0, stdout=clip(stdout_b), stderr=clip(stderr_b))
