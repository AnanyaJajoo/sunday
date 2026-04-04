"""Thin FastAPI entrypoint for deployments and local API runs."""

from backend.server import app

__all__ = ["app"]
