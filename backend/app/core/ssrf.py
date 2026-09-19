"""Server-side request forgery (SSRF) guard for outbound fetches.

Every place RepoVeriX fetches attacker-influenced URLs (git clones, hosted
archive downloads) preflights the host here. Literal private/loopback/
link-local/metadata addresses are rejected outright; hostnames are resolved
once and rejected when *any* of their addresses lands in a blocked range.

A hostname that fails to resolve is allowed through — the fetch itself will
fail, and refusing it would make temporary DNS hiccups look like the guard.
This is a baseline defence (single preflight resolution); deployments behind
a strict egress allow-list should enforce there as well.
"""

from __future__ import annotations

import ipaddress
import logging
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

_logger = logging.getLogger("repoverix.http")

# RFC 1918 + loopback + link-local + CGNAT + reserved + cloud metadata +
# multicast + documentation + IPv4-mapped IPv6 ranges.
_BLOCKED_NETWORKS = tuple(
    ipaddress.ip_network(net)
    for net in (
        "127.0.0.0/8",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "169.254.0.0/16",
        "100.64.0.0/10",
        "0.0.0.0/8",
        "198.18.0.0/15",
        "192.0.2.0/24",
        "198.51.100.0/24",
        "203.0.113.0/24",
        "224.0.0.0/4",
        "240.0.0.0/4",
        "255.255.255.255/32",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
        "::/128",
        "::ffff:0:0/96",
        "ff00::/8",
        "2001:db8::/32",
        "2002::/16",
        "64:ff9b::/96",
    )
)


class SSRFBlocked(Exception):
    """The target URL resolves to a private/metadata address."""


@dataclass(frozen=True)
class SSRFDecision:
    allowed: bool
    reason: str = ""


def _host_of(url: str) -> str:
    parsed = urlparse(str(url))
    host = parsed.hostname or ""
    return host.rstrip(".")  # trailing-dot hostname trick resolves past the suffix


def _blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        if any(ip.ipv4_mapped in net for net in _BLOCKED_NETWORKS if isinstance(net, ipaddress.IPv4Network)):
            return True
    return any(ip in net for net in _BLOCKED_NETWORKS)


def _literal_ip(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    try:
        return ipaddress.ip_address(host)
    except ValueError:
        return None


def _resolve(host: str) -> list[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    """Resolve ``host`` to addresses; unknown failures are reported as empty
    so callers can decide (unresolvable hosts cannot be an SSRF target)."""
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except OSError as exc:
        _logger.warning("ssrf: resolution of %r failed: %s", host, exc)
        return []
    out = []
    for info in infos:
        try:
            out.append(ipaddress.ip_address(info[4][0]))
        except (ValueError, IndexError):
            continue
    return out


def _check_addresses(host: str, resolver=None) -> SSRFDecision:
    ip = _literal_ip(host)
    if ip is not None:
        if _blocked(ip):
            return SSRFDecision(False, f"literal address {host} is private/link-local")
        return SSRFDecision(True)

    addresses = resolver(host) if resolver else _resolve(host)
    for address in addresses:
        if _blocked(address):
            return SSRFDecision(False, f"host {host} resolves to blocked address {address}")
    return SSRFDecision(True)


def validate_url(url: str, *, allow_private: bool | None = None, resolver=None) -> SSRFDecision:
    """Decide whether RepoVeriX may fetch/clone ``url``.

    ``resolver`` is an injectable ``host -> [ipaddress,...]`` seam for tests
    (defaults to real DNS). ``allow_private`` overrides the settings default.
    """
    from app.core.config import get_settings

    parsed = urlparse(str(url))
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        return SSRFDecision(False, f"scheme {scheme!r} is not allowed (only http/https permitted)")
    host = _host_of(url)
    if not host:
        return SSRFDecision(False, "URL has no host")
    if allow_private is None:
        allow_private = get_settings().ssrf_allow_private_hosts
    if allow_private:
        return SSRFDecision(True, "private hosts allowed by configuration")
    return _check_addresses(host, resolver=resolver)


def assert_safe_url(url: str, *, allow_private: bool | None = None, resolver=None) -> None:
    """Raise :class:`SSRFBlocked` when ``url`` may target an internal address."""
    decision = validate_url(url, allow_private=allow_private, resolver=resolver)
    if not decision.allowed:
        raise SSRFBlocked(decision.reason)


# --------------------------------------------------------------------------- pinning


@dataclass(frozen=True)
class PinPlan:
    """Connection plan that pins a validated hostname to a validated IP.

    ``pinned_url`` connects to the literal IP; ``headers`` restores the original
    ``Host`` header so virtual-host routing keeps working; ``extensions`` carries
    ``sni_hostname`` so TLS still verifies the certificate against the real
    hostname (httpcore honours this extension for both SNI and hostname checks).
    """

    pinned_url: str
    headers: dict[str, str]
    extensions: dict[str, str]


def _format_ip_host(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> str:
    text = str(ip)
    return f"[{text}]" if isinstance(ip, ipaddress.IPv6Address) else text


def preflight_and_pin(url: str, *, resolver=None) -> PinPlan | None:
    """Resolve ``url`` once, validate the addresses, and pin the connection.

    Closes the classic DNS-rebinding TOCTOU: validating a hostname and then
    letting the HTTP client re-resolve it at connect time lets an attacker with
    a short-TTL record swap a public address for a private one between the two
    lookups. Here the *same* resolution that is validated also drives the
    connection, so no second lookup can happen.

    Returns ``None`` when there is nothing to pin (non-network scheme, literal
    IP host, or a host that does not resolve — the fetch then fails naturally).
    Raises :class:`SSRFBlocked` when any resolved address is blocked.
    """
    parsed = urlparse(str(url))
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        return None
    host = _host_of(url)
    if not host:
        raise SSRFBlocked("URL has no host")
    if _literal_ip(host) is not None:
        # Nothing to re-resolve; validate_url already covered literal hosts.
        return None

    addresses = resolver(host) if resolver else _resolve(host)
    if not addresses:
        return None  # unresolvable: the fetch itself will fail
    for address in addresses:
        if _blocked(address):
            raise SSRFBlocked(f"host {host} resolves to blocked address {address}")

    chosen = addresses[0]
    userinfo = ""
    if parsed.username:
        userinfo = parsed.username
        if parsed.password:
            userinfo += f":{parsed.password}"
        userinfo += "@"
    port = f":{parsed.port}" if parsed.port else ""
    pinned_netloc = f"{userinfo}{_format_ip_host(chosen)}{port}"
    pinned = parsed._replace(netloc=pinned_netloc)
    # Host header carries host[:port] only — never userinfo.
    host_header = f"{host}:{parsed.port}" if parsed.port else host
    return PinPlan(
        pinned_url=pinned.geturl(),
        headers={"Host": host_header},
        extensions={"sni_hostname": host},
    )
