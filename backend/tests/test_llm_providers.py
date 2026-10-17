"""Tests for the LLM provider factory, including OpenAI-compatible gateways.

OpenRouter and NVIDIA NIM expose the OpenAI chat-completions contract; the
factory must route them with their own key/endpoint and report the real
provider name (scan logs and reports show it verbatim).
"""

import pytest

from app.analysis.llm import (
    AnthropicProvider,
    FallbackProvider,
    GeminiProvider,
    MockProvider,
    OpenAIProvider,
    build_llm_provider,
)
from app.analysis.models import AnalysisError, LLMResult, LLMUsage
from app.core.config import Settings


def _settings(**overrides) -> Settings:
    """Hermetic settings: no .env file, kwargs override any ambient env vars."""
    return Settings(_env_file=None, **overrides)


class TestOpenRouter:
    def test_builds_openai_compatible_provider(self):
        provider = build_llm_provider(
            _settings(llm_provider="openrouter", openrouter_api_key="sk-or-test")
        )
        assert isinstance(provider, OpenAIProvider)
        assert provider.name == "openrouter"
        assert provider._url == "https://openrouter.ai/api/v1/chat/completions"
        assert provider.model == "openai/gpt-4o-mini"

    def test_explicit_llm_model_overrides_gateway_default(self):
        provider = build_llm_provider(
            _settings(
                llm_provider="openrouter",
                openrouter_api_key="sk-or-test",
                llm_model="deepseek/deepseek-chat-v3",
            )
        )
        assert provider.model == "deepseek/deepseek-chat-v3"
        assert provider._url == "https://openrouter.ai/api/v1/chat/completions"

    def test_provider_name_is_case_insensitive(self):
        provider = build_llm_provider(
            _settings(llm_provider="OpenRouter", openrouter_api_key="sk-or-test")
        )
        assert provider.name == "openrouter"

    def test_base_url_is_configurable(self):
        provider = build_llm_provider(
            _settings(
                llm_provider="openrouter",
                openrouter_api_key="sk-or-test",
                openrouter_base_url="https://openrouter-proxy.internal/v1",
            )
        )
        assert provider._url == "https://openrouter-proxy.internal/v1/chat/completions"

    def test_missing_key_returns_none(self):
        assert build_llm_provider(_settings(llm_provider="openrouter")) is None


class TestNvidiaNim:
    def test_builds_openai_compatible_provider(self):
        provider = build_llm_provider(
            _settings(llm_provider="nvidia", nvidia_api_key="nvapi-test")
        )
        assert isinstance(provider, OpenAIProvider)
        assert provider.name == "nvidia"
        assert provider._url == "https://integrate.api.nvidia.com/v1/chat/completions"
        assert provider.model == "openai/gpt-oss-20b"

    def test_explicit_llm_model_overrides_gateway_default(self):
        provider = build_llm_provider(
            _settings(
                llm_provider="nvidia",
                nvidia_api_key="nvapi-test",
                llm_model="nvidia/llama-3.1-nemotron-ultra-253b-v1",
            )
        )
        assert provider.model == "nvidia/llama-3.1-nemotron-ultra-253b-v1"

    def test_missing_key_returns_none(self):
        assert build_llm_provider(_settings(llm_provider="nvidia")) is None


class TestExistingProvidersUnchanged:
    def test_plain_openai_uses_openai_endpoint(self):
        provider = build_llm_provider(_settings(openai_api_key="sk-test"))
        assert isinstance(provider, OpenAIProvider)
        assert provider.name == "openai"
        assert provider._url == "https://api.openai.com/v1/chat/completions"

    def test_custom_openai_base_url_still_honoured(self):
        provider = build_llm_provider(
            _settings(openai_api_key="sk-test", openai_base_url="http://localhost:11434/v1")
        )
        assert provider._url == "http://localhost:11434/v1/chat/completions"

    def test_gemini_keeps_its_own_endpoint(self):
        provider = build_llm_provider(_settings(llm_provider="gemini", gemini_api_key="g-test"))
        assert isinstance(provider, GeminiProvider)
        assert provider.name == "gemini"
        assert provider._url == (
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        )

    def test_anthropic_keeps_its_own_model_setting(self):
        provider = build_llm_provider(
            _settings(llm_provider="anthropic", anthropic_api_key="sk-ant-test")
        )
        assert isinstance(provider, AnthropicProvider)
        assert provider.model == "claude-3-5-haiku-latest"

    def test_unknown_provider_returns_none(self):
        assert build_llm_provider(_settings(llm_provider="made-up-vendor")) is None

    def test_gateway_settings_defaults(self):
        settings = _settings()
        assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"
        assert settings.nvidia_base_url == "https://integrate.api.nvidia.com/v1"
        assert settings.openrouter_api_key is None
        assert settings.nvidia_api_key is None


class _StubProvider:
    """Minimal offline provider stand-in for exercising the fallback chain."""

    def __init__(self, name: str, model: str = "stub-model", fail: bool = False):
        self.name = name
        self.model = model
        self.fail = fail
        self.calls = 0

    async def complete(self, system: str, user: str, temperature: float | None = None) -> LLMResult:
        self.calls += 1
        if self.fail:
            raise AnalysisError(f"{self.name} unreachable", code="llm_provider_error", retryable=True)
        return LLMResult(
            content='{"verdict": "confirmed"}',
            data={},
            usage=LLMUsage(input_tokens=1, output_tokens=1, estimated_cost_usd=0.0),
            model=self.model,
        )


class TestFallbackChain:
    def test_nvidia_with_openrouter_backup_builds_chain(self):
        provider = build_llm_provider(
            _settings(
                llm_provider="nvidia",
                nvidia_api_key="nvapi-test",
                openrouter_api_key="sk-or-test",
            )
        )
        assert isinstance(provider, FallbackProvider)
        assert [p.name for p in provider.providers] == ["nvidia", "openrouter"]
        assert provider.name == "nvidia"  # primary until a call says otherwise

    def test_single_key_returns_plain_provider(self):
        provider = build_llm_provider(_settings(llm_provider="nvidia", nvidia_api_key="nvapi-test"))
        assert isinstance(provider, OpenAIProvider)
        assert not isinstance(provider, FallbackProvider)
        assert provider.name == "nvidia"

    def test_primary_without_key_still_scans_via_fallback(self):
        provider = build_llm_provider(_settings(llm_provider="nvidia", openrouter_api_key="sk-or-test"))
        assert isinstance(provider, OpenAIProvider)
        assert provider.name == "openrouter"

    def test_explicit_fallback_list_overrides_auto(self):
        provider = build_llm_provider(
            _settings(
                llm_provider="nvidia",
                nvidia_api_key="nvapi-test",
                openai_api_key="sk-test",
                openrouter_api_key="sk-or-test",
                llm_fallback_providers="openai",
            )
        )
        assert isinstance(provider, FallbackProvider)
        assert [p.name for p in provider.providers] == ["nvidia", "openai"]

    def test_mock_is_never_auto_chained(self):
        provider = build_llm_provider(_settings(llm_provider="mock", openrouter_api_key="sk-or-test"))
        assert isinstance(provider, MockProvider)

    async def test_falls_through_to_second_provider(self):
        dead = _StubProvider("nvidia", fail=True)
        backup = _StubProvider("openrouter", model="openai/gpt-4o-mini")
        chain = FallbackProvider([dead, backup])
        result = await chain.complete("system", "user")
        assert dead.calls == 1
        assert backup.calls == 1
        assert result.model == "openai/gpt-4o-mini"
        assert chain.name == "openrouter"  # reports the provider that answered
        assert chain.model == "openai/gpt-4o-mini"

    async def test_primary_answers_without_touching_backup(self):
        primary = _StubProvider("nvidia", model="openai/gpt-oss-20b")
        backup = _StubProvider("openrouter")
        chain = FallbackProvider([primary, backup])
        result = await chain.complete("system", "user")
        assert result.model == "openai/gpt-oss-20b"
        assert backup.calls == 0
        assert chain.name == "nvidia"

    async def test_all_providers_fail_raises(self):
        chain = FallbackProvider(
            [_StubProvider("nvidia", fail=True), _StubProvider("openrouter", fail=True)]
        )
        with pytest.raises(AnalysisError) as excinfo:
            await chain.complete("system", "user")
        assert excinfo.value.code == "llm_providers_exhausted"
