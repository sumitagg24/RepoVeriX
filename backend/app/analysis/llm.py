"""LLM provider abstraction.

``LLMProvider`` is the seam between the pipeline and any model vendor:

- ``OpenAIProvider``  — OpenAI chat completions (and any OpenAI-compatible endpoint)
- ``AnthropicProvider`` — Anthropic messages API
- ``GeminiProvider``   — Google Gemini via its OpenAI-compatible endpoint
- ``MockProvider``     — deterministic in-process provider used by tests

Prompts live in ``backend/prompts/*.txt`` (versioned). Structured JSON responses
are extracted defensively (code fences, trailing text) with bounded retries.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import httpx

from app.analysis.models import AnalysisError, LLMResult, LLMUsage

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"
PROMPT_VERSION = "v1"  # bump when prompts/*.txt change semantics

_PROMPT_CACHE: dict[str, str] = {}

# rough per-1M-token prices (USD) for cost *estimates* — labelled as estimates
_MODEL_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.6),
    "gpt-4o": (2.5, 10.0),
    "claude-3-5-haiku": (0.8, 4.0),
    "claude-3-5-sonnet": (3.0, 15.0),
    "gemini-1.5-flash": (0.075, 0.3),
    "gemini-2.0-flash": (0.1, 0.4),
}


def load_prompt(name: str) -> str:
    """Load a versioned prompt template (cached)."""
    if name in _PROMPT_CACHE:
        return _PROMPT_CACHE[name]
    path = PROMPTS_DIR / f"{name}_{PROMPT_VERSION}.txt"
    if not path.exists():
        raise AnalysisError(f"Prompt file missing: {path}", code="prompt_missing")
    _PROMPT_CACHE[name] = path.read_text(encoding="utf-8")
    return _PROMPT_CACHE[name]


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost. Approximation only — labelled as such in reports."""
    pricing = None
    for key, value in _MODEL_PRICING.items():
        if key in model:
            pricing = value
            break
    if pricing is None:
        return 0.0
    return (input_tokens / 1_000_000 * pricing[0]) + (output_tokens / 1_000_000 * pricing[1])


# --------------------------------------------------------------------------- protocol


@dataclass
class LLMConfig:
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    temperature: float = 0.0
    timeout_seconds: int = 120
    max_retries: int = 2
    base_url: str | None = None
    max_output_tokens: int = 4096


class LLMProvider(Protocol):
    name: str
    model: str

    async def complete(self, system: str, user: str, temperature: float | None = None) -> LLMResult: ...


# --------------------------------------------------------------------------- shared client helpers


def _extract_json(text: str) -> dict[str, Any]:
    """Pull the first balanced JSON object out of a model response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # find first { ... last }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            pass
    raise AnalysisError("LLM returned unparseable JSON", code="llm_invalid_json", retryable=True)


class _BaseHTTPProvider:
    """Shared plumbing for HTTP-based providers."""

    name = "base"
    model = ""
    _url = ""
    _headers: dict[str, str] = {}

    def __init__(self, config: LLMConfig, api_key: str):
        self.config = config
        self.api_key = api_key
        self.model = config.model

    async def complete(self, system: str, user: str, temperature: float | None = None) -> LLMResult:
        payload = self._build_payload(system, user, temperature)
        headers = {**self._headers, **self._auth_headers()}
        timeout = httpx.Timeout(self.config.timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(self._url, headers=headers, json=payload)
        if response.status_code != 200:
            raise AnalysisError(
                f"LLM provider error {response.status_code}: {response.text[:500]}",
                code="llm_provider_error",
                retryable=response.status_code >= 500,
            )
        return self._parse_response(response.json(), system, user, temperature)

    def _auth_headers(self) -> dict[str, str]:
        return {}

    def _build_payload(self, system: str, user: str, temperature: float | None) -> dict[str, Any]:
        raise NotImplementedError

    def _parse_response(
        self, data: dict[str, Any], system: str, user: str, temperature: float | None
    ) -> LLMResult:
        raise NotImplementedError


class OpenAIProvider(_BaseHTTPProvider):
    """OpenAI chat completions (works against any OpenAI-compatible endpoint)."""

    name = "openai"

    def __init__(self, config: LLMConfig, api_key: str):
        super().__init__(config, api_key)
        base = (config.base_url or "https://api.openai.com/v1").rstrip("/")
        self._url = f"{base}/chat/completions"

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    def _build_payload(self, system: str, user: str, temperature: float | None) -> dict[str, Any]:
        return {
            "model": self.model,
            "temperature": self.config.temperature if temperature is None else temperature,
            "max_tokens": self.config.max_output_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }

    def _parse_response(
        self, data: dict[str, Any], system: str, user: str, temperature: float | None
    ) -> LLMResult:
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        model = data.get("model", self.model)
        return LLMResult(
            content=content,
            data={},
            usage=LLMUsage(
                input_tokens=int(usage.get("prompt_tokens", 0)),
                output_tokens=int(usage.get("completion_tokens", 0)),
                estimated_cost_usd=estimate_cost(
                    model,
                    int(usage.get("prompt_tokens", 0)),
                    int(usage.get("completion_tokens", 0)),
                ),
            ),
            model=model,
        )


class AnthropicProvider(_BaseHTTPProvider):
    """Anthropic messages API."""

    name = "anthropic"

    def __init__(self, config: LLMConfig, api_key: str):
        super().__init__(config, api_key)
        self._url = "https://api.anthropic.com/v1/messages"

    def _auth_headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

    def _build_payload(self, system: str, user: str, temperature: float | None) -> dict[str, Any]:
        return {
            "model": self.model,
            "max_tokens": self.config.max_output_tokens,
            "temperature": self.config.temperature if temperature is None else temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }

    def _parse_response(
        self, data: dict[str, Any], system: str, user: str, temperature: float | None
    ) -> LLMResult:
        content = "".join(
            block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"
        )
        usage = data.get("usage", {})
        model = data.get("model", self.model)
        return LLMResult(
            content=content,
            data={},
            usage=LLMUsage(
                input_tokens=int(usage.get("input_tokens", 0)),
                output_tokens=int(usage.get("output_tokens", 0)),
                estimated_cost_usd=estimate_cost(
                    model, int(usage.get("input_tokens", 0)), int(usage.get("output_tokens", 0))
                ),
            ),
            model=model,
        )


class GeminiProvider(OpenAIProvider):
    """Google Gemini via its OpenAI-compatible endpoint."""

    name = "gemini"

    def __init__(self, config: LLMConfig, api_key: str):
        base = "https://generativelanguage.googleapis.com/v1beta/openai"
        config_with_base = LLMConfig(
            provider=config.provider,
            model=config.model,
            temperature=config.temperature,
            timeout_seconds=config.timeout_seconds,
            max_retries=config.max_retries,
            base_url=base,
            max_output_tokens=config.max_output_tokens,
        )
        super().__init__(config_with_base, api_key)


class MockProvider:
    """Deterministic provider used in tests and demos without network access.

    ``script`` maps substrings of the user prompt to canned response dicts. Any
    unmatched prompt returns ``{"verdict": "probable"}`` style defaults so the
    pipeline is fully exercisable offline.
    """

    name = "mock"
    model = "mock-1"

    def __init__(self, script: dict[str, dict[str, Any]] | None = None, model: str = "mock-1"):
        self._script = script or {}
        self.model = model
        self.last_prompt: str | None = None

    async def complete(self, system: str, user: str, temperature: float | None = None) -> LLMResult:
        self.last_prompt = user
        body: dict[str, Any] | None = None
        for needle, canned in self._script.items():
            if needle in user:
                body = canned
                break
        if body is None:
            body = {
                "verdict": "probable",
                "confidence": 0.5,
                "reasoning": "Mock fallback: no evidence assessed.",
            }
        return LLMResult(
            content=json.dumps(body),
            data=body,
            usage=LLMUsage(
                input_tokens=max(1, len(user) // 4),
                output_tokens=len(json.dumps(body)) // 4,
                estimated_cost_usd=0.0,
            ),
            model=self.model,
        )


# --------------------------------------------------------------------------- factory


def build_llm_provider(settings: Any) -> LLMProvider | None:
    """Construct the configured provider, or ``None`` when no key is available."""
    provider_name = (settings.llm_provider or "openai").lower()
    config = LLMConfig(
        provider=provider_name,
        model=settings.llm_model or "gpt-4o-mini",
        temperature=settings.llm_temperature,
        timeout_seconds=settings.llm_timeout_seconds,
        max_retries=settings.llm_max_retries,
        base_url=settings.openai_base_url,
    )
    if provider_name == "mock":
        return MockProvider()
    if provider_name in ("openai", "gemini"):
        key = settings.gemini_api_key if provider_name == "gemini" else settings.openai_api_key
        if not key:
            return None
        if provider_name == "gemini":
            return GeminiProvider(config, key)
        return OpenAIProvider(config, key)
    if provider_name == "anthropic":
        if not settings.anthropic_api_key:
            return None
        config.model = settings.anthropic_model
        return AnthropicProvider(config, settings.anthropic_api_key)
    return None


def provider_label(provider: LLMProvider | None) -> str:
    if provider is None:
        return "unconfigured"
    return f"{provider.name}/{provider.model}"


async def complete_json(
    provider: LLMProvider,
    system: str,
    user: str,
    usage: LLMUsage,
    temperature: float | None = None,
) -> dict[str, Any]:
    """Call ``provider`` and return validated JSON, retrying on parse errors."""
    max_retries = getattr(provider, "config", None).max_retries if hasattr(provider, "config") else 1
    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            result = await provider.complete(system, user, temperature=temperature)
        except AnalysisError as exc:
            last_error = exc
            if not exc.retryable or attempt == max_retries:
                raise
            continue
        except httpx.HTTPError as exc:
            last_error = exc
            if attempt == max_retries:
                raise AnalysisError(
                    f"LLM request failed: {exc}", code="llm_network_error", retryable=True
                ) from exc
            continue
        usage.calls += 1
        usage.input_tokens += result.usage.input_tokens
        usage.output_tokens += result.usage.output_tokens
        usage.estimated_cost_usd += result.usage.estimated_cost_usd
        try:
            data = _extract_json(result.content)
        except AnalysisError as exc:
            last_error = exc
            if attempt == max_retries:
                raise
            continue
        return data
    raise AnalysisError(f"LLM failed after retries: {last_error}", code="llm_failure")


def format_llm_result_for_run(data: dict[str, Any], model: str | None) -> dict[str, Any]:
    """Shape an LLM JSON response for storage in an AnalysisRun output."""
    return {
        "model": model,
        "response": data,
    }
