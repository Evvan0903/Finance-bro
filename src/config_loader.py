"""Load the repository's machine-enforceable report configuration."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = PROJECT_ROOT / "config"
CONFIG_FILES = {
    "schema": "institutional_report_schema.yaml",
    "style": "report_style.yaml",
    "qa": "report_qa_rules.yaml",
    "sources": "source_policy.yaml",
    "sectors": "sector_kpis.yaml",
}


class ConfigurationError(RuntimeError):
    """Raised when a required configuration file is missing or invalid."""


@lru_cache(maxsize=None)
def load_config(name: str) -> dict[str, Any]:
    """Load one named YAML configuration document."""
    filename = CONFIG_FILES.get(name)
    if filename is None:
        raise ConfigurationError(f"Unknown configuration name: {name}")
    path = CONFIG_DIR / filename
    try:
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ConfigurationError(f"Required configuration file is missing: {path}") from exc
    except yaml.YAMLError as exc:
        raise ConfigurationError(f"Invalid YAML in {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise ConfigurationError(f"Configuration must contain a mapping: {path}")
    return payload


def load_all_configs() -> dict[str, dict[str, Any]]:
    """Load all report configurations using stable logical names."""
    return {name: load_config(name) for name in CONFIG_FILES}


def clear_config_cache() -> None:
    """Clear cached configuration values, primarily for tests and local development."""
    load_config.cache_clear()
