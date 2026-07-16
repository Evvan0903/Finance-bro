#!/usr/bin/env python3
"""Validate institutional-equity-research bundled YAML resources deterministically."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

import yaml


SKILL_ROOT = Path(__file__).resolve().parents[1]
PATTERNS = SKILL_ROOT / "patterns"
DESIGN = SKILL_ROOT / "design"
ASSETS = SKILL_ROOT / "assets"
BENCHMARKS = SKILL_ROOT / "benchmarks" / "benchmark_cases.yaml"
CORPUS = SKILL_ROOT / "research_corpus.yaml"
PROVENANCE = PATTERNS / "pattern_provenance.yaml"

REQUIRED_FILES = [
    SKILL_ROOT / "SKILL.md",
    CORPUS,
    PATTERNS / "report_archetypes.yaml",
    PATTERNS / "section_blueprints.yaml",
    PATTERNS / "analytical_patterns.yaml",
    PATTERNS / "forensic_patterns.yaml",
    PATTERNS / "diligence_patterns.yaml",
    PATTERNS / "chart_patterns.yaml",
    PATTERNS / "table_patterns.yaml",
    PATTERNS / "layout_patterns.yaml",
    PATTERNS / "writing_patterns.yaml",
    PATTERNS / "disclosure_patterns.yaml",
    PATTERNS / "sector_patterns.yaml",
    PROVENANCE,
    DESIGN / "layout_tokens.yaml",
    DESIGN / "visual_grammar.yaml",
    DESIGN / "sector_visual_motifs.yaml",
    ASSETS / "asset_manifest.yaml",
    BENCHMARKS,
]

CORPUS_FIELDS = {
    "source_id",
    "publisher",
    "document_title",
    "document_type",
    "publication_date",
    "access_date",
    "public_url",
    "official_domain",
    "access_status",
    "redistribution_status",
    "permitted_use",
    "prohibited_use",
    "sectors",
    "research_categories",
    "pages_reviewed",
    "notes",
}

FORENSIC_FIELDS = {
    "pattern_id",
    "name",
    "category",
    "question",
    "required_inputs",
    "deterministic_calculation",
    "warning_threshold",
    "severity_logic",
    "alternative_explanations",
    "required_sources",
    "output_format",
    "limitations",
}

PATTERN_ID_KEYS = {
    "pattern_id",
    "archetype_id",
    "chart_id",
    "table_id",
    "disclosure_id",
    "visual_id",
    "layout_archetype_id",
    "motif_id",
}

ASSET_FIELDS = {
    "asset_id",
    "title",
    "sector",
    "asset_type",
    "purpose",
    "file_path",
    "source_type",
    "source_url",
    "license",
    "generation_prompt",
    "negative_prompt",
    "model_or_method",
    "created_at",
    "checksum",
    "aspect_ratio",
    "allowed_placements",
    "prohibited_placements",
    "alt_text",
    "contains_company_logo",
    "contains_trademark",
    "review_status",
}

EXPECTED_CHART_IDS = {f"CHART-{number:03d}" for number in range(1, 18)}
EXPECTED_TABLE_IDS = {f"TABLE-{number:03d}" for number in range(1, 11)}
EXPECTED_DISCLOSURE_IDS = {f"DISC-{number:03d}" for number in range(1, 9)}
EXPECTED_ASSET_DIRECTORIES = {
    "generated/technology",
    "generated/financials",
    "generated/healthcare",
    "generated/industrials",
    "generated/consumer",
    "generated/energy",
    "generated/real_estate",
    "generated/general",
    "licensed",
    "public_domain",
    "icons",
}

PROHIBITED_OPERATIONAL_PHRASES = {
    "fully verified",
    "no risk exists",
    "fraud confirmed",
    "management is dishonest",
    "complete due diligence performed",
}
PROHIBITED_PHRASE_SCHEMA_FILES = {
    PATTERNS / "diligence_patterns.yaml",
    PATTERNS / "disclosure_patterns.yaml",
}


def load_yaml(path: Path, errors: list[str]) -> Any:
    try:
        with path.open(encoding="utf-8") as handle:
            return yaml.safe_load(handle)
    except yaml.YAMLError as exc:
        errors.append(f"YAML parse error in {path.relative_to(SKILL_ROOT)}: {exc}")
    except OSError as exc:
        errors.append(f"Unable to read {path.relative_to(SKILL_ROOT)}: {exc}")
    return None


def collect_values(value: Any, keys: set[str], collected: set[str]) -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if key in keys and isinstance(nested, str):
                collected.add(nested)
            collect_values(nested, keys, collected)
    elif isinstance(value, list):
        for nested in value:
            collect_values(nested, keys, collected)


def collect_references(value: Any, prefix: str) -> set[str]:
    matches: set[str] = set()
    pattern = re.compile(rf"{re.escape(prefix)}-[0-9]{{3}}")

    def walk(item: Any) -> None:
        if isinstance(item, str):
            matches.update(pattern.findall(item))
        elif isinstance(item, dict):
            for child in item.values():
                walk(child)
        elif isinstance(item, list):
            for child in item:
                walk(child)

    walk(value)
    return matches


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    for path in REQUIRED_FILES:
        if not path.exists():
            errors.append(f"Missing required resource: {path.relative_to(SKILL_ROOT)}")
    for relative_directory in EXPECTED_ASSET_DIRECTORIES:
        if not (ASSETS / relative_directory).is_dir():
            errors.append(f"Missing required asset directory: assets/{relative_directory}")
    if errors:
        return report(errors, warnings)

    yaml_paths = sorted(SKILL_ROOT.rglob("*.yaml"))
    documents = {path: load_yaml(path, errors) for path in yaml_paths}
    if errors:
        return report(errors, warnings)

    corpus = documents[CORPUS]
    sources = corpus.get("sources", []) if isinstance(corpus, dict) else []
    source_ids = [source.get("source_id") for source in sources if isinstance(source, dict)]
    if not sources:
        errors.append("research_corpus.yaml has no sources")
    if len(source_ids) != len(set(source_ids)):
        errors.append("research_corpus.yaml has duplicate source_id values")
    for source in sources:
        if not isinstance(source, dict):
            errors.append("research_corpus.yaml contains a non-mapping source entry")
            continue
        missing = sorted(CORPUS_FIELDS - set(source))
        if missing:
            errors.append(f"{source.get('source_id', '<missing>')} missing corpus fields: {', '.join(missing)}")
        if not isinstance(source.get("official_domain"), bool):
            errors.append(f"{source.get('source_id', '<missing>')} official_domain must be boolean")
        if not str(source.get("public_url", "")).startswith(("https://", "http://")):
            errors.append(f"{source.get('source_id', '<missing>')} has no public URL")

    forensic = documents[PATTERNS / "forensic_patterns.yaml"]
    tests = forensic.get("tests", []) if isinstance(forensic, dict) else []
    forensic_ids = {test.get("pattern_id") for test in tests if isinstance(test, dict)}
    for test in tests:
        if not isinstance(test, dict):
            errors.append("forensic_patterns.yaml contains a non-mapping test entry")
            continue
        missing = sorted(FORENSIC_FIELDS - set(test))
        if missing:
            errors.append(f"{test.get('pattern_id', '<missing>')} missing forensic fields: {', '.join(missing)}")
    if set(forensic.get("signal_labels", [])) != {"Normal", "Monitor", "Elevated", "High concern", "Insufficient data"}:
        errors.append("forensic_patterns.yaml must use the five required signal labels")

    charts = documents[PATTERNS / "chart_patterns.yaml"].get("charts", [])
    chart_ids = {chart.get("chart_id") for chart in charts if isinstance(chart, dict)}
    if chart_ids != EXPECTED_CHART_IDS:
        errors.append(f"Chart IDs must be CHART-001 through CHART-017; found {sorted(chart_ids)}")
    tables = documents[PATTERNS / "table_patterns.yaml"].get("tables", [])
    table_ids = {table.get("table_id") for table in tables if isinstance(table, dict)}
    if table_ids != EXPECTED_TABLE_IDS:
        errors.append(f"Table IDs must be TABLE-001 through TABLE-010; found {sorted(table_ids)}")
    disclosures = documents[PATTERNS / "disclosure_patterns.yaml"].get("disclosures", [])
    disclosure_ids = {item.get("disclosure_id") for item in disclosures if isinstance(item, dict)}
    if disclosure_ids != EXPECTED_DISCLOSURE_IDS:
        errors.append(f"Disclosure IDs must be DISC-001 through DISC-008; found {sorted(disclosure_ids)}")

    provenance = documents[PROVENANCE]
    provenance_sets = provenance.get("provenance_sets", []) if isinstance(provenance, dict) else []
    covered_ids = {item for entry in provenance_sets if isinstance(entry, dict) for item in entry.get("pattern_ids", [])}
    covered_sections = {item for entry in provenance_sets if isinstance(entry, dict) for item in entry.get("section_ids", [])}
    observed_source_ids = {
        item
        for entry in provenance_sets
        if isinstance(entry, dict)
        for item in entry.get("observed_in", [])
    }
    resource_pattern_ids: set[str] = set()
    for path, document in documents.items():
        if path == PROVENANCE:
            continue
        collect_values(document, PATTERN_ID_KEYS, resource_pattern_ids)
    sections = documents[PATTERNS / "section_blueprints.yaml"].get("sections", [])
    section_ids = {section.get("section_id") for section in sections if isinstance(section, dict)}
    missing_provenance = sorted(resource_pattern_ids - covered_ids)
    if missing_provenance:
        errors.append(f"Pattern IDs missing provenance: {', '.join(missing_provenance)}")
    missing_sections = sorted(section_ids - covered_sections)
    if missing_sections:
        errors.append(f"Section blueprints missing provenance: {', '.join(missing_sections)}")
    unknown_provenance_sources = sorted(observed_source_ids - set(source_ids))
    if unknown_provenance_sources:
        errors.append(f"Provenance references unknown source IDs: {', '.join(unknown_provenance_sources)}")
    for entry in provenance_sets:
        if not isinstance(entry, dict):
            errors.append("pattern_provenance.yaml contains a non-mapping provenance entry")
            continue
        if entry.get("distinctive_expression_copied") is not False:
            errors.append(f"{entry.get('provenance_id', '<missing>')} must record distinctive_expression_copied: false")
        if entry.get("approved_for_use") is not True:
            errors.append(f"{entry.get('provenance_id', '<missing>')} must be approved_for_use: true")

    manifest = documents[ASSETS / "asset_manifest.yaml"]
    assets = manifest.get("assets", []) if isinstance(manifest, dict) else []
    manifest_paths: set[str] = set()
    for asset in assets:
        if not isinstance(asset, dict):
            errors.append("asset_manifest.yaml contains a non-mapping asset entry")
            continue
        missing = sorted(ASSET_FIELDS - set(asset))
        if missing:
            errors.append(f"{asset.get('asset_id', '<missing>')} missing asset fields: {', '.join(missing)}")
        if asset.get("review_status") != "approved":
            errors.append(f"{asset.get('asset_id', '<missing>')} is not approved")
        if asset.get("contains_company_logo") is True:
            errors.append(f"{asset.get('asset_id', '<missing>')} contains a company logo")
        if asset.get("contains_trademark") is True:
            errors.append(f"{asset.get('asset_id', '<missing>')} contains a trademark")
        if asset.get("asset_type") != "data_visualization" and "evidence_chart" not in asset.get("prohibited_placements", []):
            errors.append(f"{asset.get('asset_id', '<missing>')} must prohibit evidence_chart placement")
        manifest_paths.add(str(asset.get("file_path", "")))
    allowed_asset_files = {"asset_manifest.yaml"}
    for asset_path in ASSETS.rglob("*"):
        if asset_path.is_file() and asset_path.name not in allowed_asset_files:
            relative = str(asset_path.relative_to(SKILL_ROOT))
            if relative not in manifest_paths:
                errors.append(f"Asset is not manifest-gated: {relative}")

    benchmark = documents[BENCHMARKS]
    cases = benchmark.get("cases", []) if isinstance(benchmark, dict) else []
    required_case_sectors = {"large_technology", "semiconductor", "bank", "consumer", "industrial"}
    actual_case_sectors = {case.get("sector_case") for case in cases if isinstance(case, dict)}
    if not required_case_sectors.issubset(actual_case_sectors):
        errors.append("benchmark_cases.yaml is missing one or more required sector cases")

    all_documents = list(documents.values())
    all_chart_refs = set().union(*(collect_references(document, "CHART") for document in all_documents))
    all_table_refs = set().union(*(collect_references(document, "TABLE") for document in all_documents))
    all_disclosure_refs = set().union(*(collect_references(document, "DISC") for document in all_documents))
    all_forensic_refs = set().union(*(collect_references(document, "FA") for document in all_documents))
    for prefix, references, known in (
        ("CHART", all_chart_refs, chart_ids),
        ("TABLE", all_table_refs, table_ids),
        ("DISC", all_disclosure_refs, disclosure_ids),
        ("FA", all_forensic_refs, forensic_ids),
    ):
        unknown = sorted(references - known)
        if unknown:
            errors.append(f"Unknown {prefix} references: {', '.join(unknown)}")

    raw_text = "\n".join(path.read_text(encoding="utf-8") for path in SKILL_ROOT.rglob("*.yaml"))
    if re.search(r"\bdue diligent\b", raw_text, flags=re.IGNORECASE):
        errors.append("Incorrect terminology found: use 'due diligence', not 'due diligent'")
    if re.search(r"\bin the style of\s+(J\.?P\.?\s*Morgan|Morgan Stanley|Goldman Sachs|BlackRock|Fidelity|UBS|Citi|Morningstar|Value Line|CFRA)\b", raw_text, flags=re.IGNORECASE):
        errors.append("Named-institution style imitation found")
    for path in [SKILL_ROOT / "SKILL.md", *sorted(set(yaml_paths) - PROHIBITED_PHRASE_SCHEMA_FILES)]:
        content = path.read_text(encoding="utf-8").lower()
        for phrase in PROHIBITED_OPERATIONAL_PHRASES:
            if phrase in content:
                errors.append(f"Prohibited operational phrase found outside its schema: '{phrase}' in {path.relative_to(SKILL_ROOT)}")
    return report(errors, warnings)


def report(errors: list[str], warnings: list[str]) -> int:
    for warning in warnings:
        print(f"WARNING: {warning}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        print(f"Validation failed with {len(errors)} error(s).")
        return 1
    print("Resource validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
