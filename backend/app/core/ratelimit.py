"""Limiteur de débit en mémoire (fenêtre glissante) par IP et par clé optionnelle.

Suffisant pour une instance unique ; derrière plusieurs workers, chaque processus
applique sa propre limite (à remplacer par Redis si besoin).
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

_hits = defaultdict(deque)
_lock = Lock()


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, max_calls: int, window_seconds: int):
    """FastAPI dependency: `Depends(rate_limit("quick-login", 10, 60))`."""
    def _dep(request: Request):
        key = (name, _client_ip(request))
        now = time.monotonic()
        with _lock:
            q = _hits[key]
            while q and now - q[0] > window_seconds:
                q.popleft()
            if len(q) >= max_calls:
                raise HTTPException(status_code=429, detail="Trop de tentatives. Réessayez plus tard.")
            q.append(now)
    return _dep


def reset_rate_limits():
    with _lock:
        _hits.clear()
