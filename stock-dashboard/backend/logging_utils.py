"""Logging and lightweight rate limiting helpers."""

import json
import logging
import sys
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from config import ENV, LOG_JSON, LOG_LEVEL, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS


def setup_logging():
    """Configure application logging."""
    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level)


def log_event(logger: logging.Logger, level: int, event: str, **fields):
    """Log either JSON or compact plaintext depending on environment."""
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": logging.getLevelName(level),
        "logger": logger.name,
        "event": event,
        **fields,
    }

    if LOG_JSON or ENV == "production":
        logger.log(level, json.dumps(payload, ensure_ascii=False, default=str))
        return

    details = " ".join(f"{key}={value}" for key, value in fields.items())
    logger.log(level, f"{event} {details}".strip())


class SimpleRateLimiter:
    """Small in-memory fixed-window rate limiter per client IP."""

    def __init__(self, max_requests: int = RATE_LIMIT_REQUESTS, window_seconds: int = RATE_LIMIT_WINDOW_SECONDS):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(deque)

    def allow(self, key: str) -> bool:
        """Return True when the request should be allowed."""
        if self.max_requests <= 0 or self.window_seconds <= 0:
            return True

        now = time.monotonic()
        bucket = self.requests[key]
        cutoff = now - self.window_seconds

        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

        if len(bucket) >= self.max_requests:
            return False

        bucket.append(now)
        return True

    def retry_after(self, key: str) -> int:
        """Return a best-effort Retry-After value in seconds."""
        if self.max_requests <= 0 or self.window_seconds <= 0:
            return 0

        bucket = self.requests.get(key)
        if not bucket:
            return 0

        now = time.monotonic()
        oldest = bucket[0]
        wait_seconds = self.window_seconds - (now - oldest)
        return max(1, int(wait_seconds) + 1)
