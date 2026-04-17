"""Compatibility wrapper for importing pykrx without noisy third-party warnings."""

from contextlib import contextmanager
import logging
import warnings

with warnings.catch_warnings():
    warnings.filterwarnings(
        "ignore",
        message=r"pkg_resources is deprecated as an API\..*",
        category=UserWarning,
    )
    from pykrx import stock as krx_stock

__all__ = ["krx_stock"]


@contextmanager
def quiet_pykrx_logging():
    original_info = logging.info
    logging.info = lambda *args, **kwargs: None
    try:
        yield
    finally:
        logging.info = original_info


def call_quietly(func, *args, **kwargs):
    with quiet_pykrx_logging():
        return func(*args, **kwargs)


__all__ = ["krx_stock", "call_quietly", "quiet_pykrx_logging"]
