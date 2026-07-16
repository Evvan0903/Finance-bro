"""Generate ticker-selectable HTML, CSV, JSON, QA, dashboard, and optional PDF samples."""

from __future__ import annotations

import argparse
from pathlib import Path

from dotenv import load_dotenv

from app import build_report
from src.report_generator import generate_dashboard_html
from src.utils import OUTPUTS_DIR, ensure_directories, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a source-backed institutional-style SEC research sample."
    )
    parser.add_argument("--ticker", default="AAPL", help="U.S. public-company ticker (default: AAPL)")
    parser.add_argument(
        "--filing-scope",
        choices=("annual", "annual_and_quarterly", "full"),
        default="annual_and_quarterly",
        help="SEC filing scope (default: annual_and_quarterly)",
    )
    parser.add_argument(
        "--include-filing-text",
        action="store_true",
        help="Fetch and extract selected filing HTML sections.",
    )
    parser.add_argument(
        "--no-pdf",
        action="store_true",
        help="Skip the optional ReportLab/Kaleido PDF export.",
    )
    return parser.parse_args()


def main() -> None:
    """Generate all reproducible sample artifacts while keeping AAPL as the default."""
    args = parse_args()
    ticker = args.ticker.strip().upper()
    if not ticker:
        raise SystemExit("--ticker must not be empty")
    load_dotenv()
    ensure_directories()
    result = build_report(
        ticker,
        filing_scope=args.filing_scope,
        include_filing_text=args.include_filing_text,
        create_pdf=not args.no_pdf,
    )
    output_dir = Path(OUTPUTS_DIR)
    report_path = output_dir / f"{ticker}_SEC_financial_report.html"
    report_path.write_text(result["html_report"], encoding="utf-8")
    dashboard_path = output_dir / f"{ticker}_dashboard.html"
    dashboard_html = generate_dashboard_html(
        result["company"],
        result["metrics"],
        result["charts"],
        result["summary"],
        research_object=result["research_object"],
    )
    dashboard_path.write_text(dashboard_html, encoding="utf-8")
    annual_path = output_dir / f"{ticker}_annual_metrics.csv"
    result["metrics"].to_csv(annual_path)
    quarterly_path = output_dir / f"{ticker}_quarterly_metrics.csv"
    result["quarterly_metrics"].to_csv(quarterly_path)
    research_path = output_dir / f"{ticker}_structured_report.json"
    write_json(research_path, result["research_object"])
    qa_path = output_dir / f"{ticker}_qa_summary.json"
    write_json(qa_path, result["qa_results"])

    generated = [
        dashboard_path,
        report_path,
        annual_path,
        quarterly_path,
        research_path,
        qa_path,
    ]
    if result["pdf_path"]:
        generated.append(Path(result["pdf_path"]))
    for path in generated:
        print(f"Generated {path}")
    if result["pdf_error"]:
        print(f"PDF unavailable: {result['pdf_error']}")


if __name__ == "__main__":
    main()
