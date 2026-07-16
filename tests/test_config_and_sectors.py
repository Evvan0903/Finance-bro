from __future__ import annotations

from app import is_generic_template_warning
from src.config_loader import load_all_configs


def test_all_required_configs_load():
    configs = load_all_configs()
    assert set(configs) == {"schema", "style", "qa", "sources", "sectors"}
    assert len(configs["schema"]["sections"]) == 10


def test_aapl_general_company_does_not_trigger_bank_warning(submissions_aapl):
    assert not is_generic_template_warning(submissions_aapl)


def test_nvda_semiconductor_does_not_trigger_financial_warning(submissions_nvda):
    assert not is_generic_template_warning(submissions_nvda)


def test_jpm_bank_keeps_limited_support_warning(submissions_jpm):
    assert is_generic_template_warning(submissions_jpm)
