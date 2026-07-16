from __future__ import annotations

import json
from pathlib import Path

import pytest


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def submissions_aapl() -> dict:
    return json.loads((FIXTURES / "submissions_aapl.json").read_text())


@pytest.fixture
def submissions_nvda() -> dict:
    return json.loads((FIXTURES / "submissions_nvda.json").read_text())


@pytest.fixture
def submissions_jpm() -> dict:
    return json.loads((FIXTURES / "submissions_jpm.json").read_text())


def fact(
    value: float,
    *,
    start: str | None,
    end: str,
    fy: int,
    fp: str,
    form: str,
    filed: str,
    accn: str,
    frame: str | None = None,
) -> dict:
    payload = {
        "end": end,
        "val": value,
        "fy": fy,
        "fp": fp,
        "form": form,
        "filed": filed,
        "accn": accn,
    }
    if start is not None:
        payload["start"] = start
    if frame is not None:
        payload["frame"] = frame
    return payload


@pytest.fixture
def company_facts_fixture() -> dict:
    revenue = [
        fact(80, start="2022-01-01", end="2022-12-31", fy=2024, fp="FY", form="10-K", filed="2025-02-15", accn="0000000000-25-000001"),
        fact(100, start="2023-01-01", end="2023-12-31", fy=2024, fp="FY", form="10-K", filed="2025-02-15", accn="0000000000-25-000001"),
        fact(120, start="2024-01-01", end="2024-12-31", fy=2024, fp="FY", form="10-K", filed="2025-02-15", accn="0000000000-25-000001"),
        fact(30, start="2025-01-01", end="2025-03-31", fy=2025, fp="Q1", form="10-Q", filed="2025-05-01", accn="0000000000-25-000002"),
        fact(70, start="2025-01-01", end="2025-06-30", fy=2025, fp="Q2", form="10-Q", filed="2025-08-01", accn="0000000000-25-000003"),
        fact(40, start="2025-04-01", end="2025-06-30", fy=2025, fp="Q2", form="10-Q", filed="2025-08-01", accn="0000000000-25-000003", frame="CY2025Q2"),
    ]
    return {
        "cik": 1,
        "entityName": "Fixture Corp",
        "facts": {
            "us-gaap": {
                "RevenueFromContractWithCustomerExcludingAssessedTax": {
                    "label": "Revenue",
                    "units": {"USD": revenue},
                },
                "Assets": {
                    "label": "Assets",
                    "units": {
                        "USD": [
                            fact(200, start=None, end="2024-12-31", fy=2024, fp="FY", form="10-K", filed="2025-02-15", accn="0000000000-25-000001"),
                            fact(210, start=None, end="2025-03-31", fy=2025, fp="Q1", form="10-Q", filed="2025-05-01", accn="0000000000-25-000002"),
                        ]
                    },
                },
                "NetIncomeLoss": {
                    "label": "Net Income",
                    "units": {
                        "USD": [
                            fact(12, start="2024-01-01", end="2024-12-31", fy=2024, fp="FY", form="10-K", filed="2025-02-15", accn="0000000000-25-000001"),
                            fact(3, start="2025-01-01", end="2025-03-31", fy=2025, fp="Q1", form="10-Q", filed="2025-05-01", accn="0000000000-25-000002"),
                            fact(7, start="2025-01-01", end="2025-06-30", fy=2025, fp="Q2", form="10-Q", filed="2025-08-01", accn="0000000000-25-000003"),
                        ]
                    },
                },
            }
        },
    }
