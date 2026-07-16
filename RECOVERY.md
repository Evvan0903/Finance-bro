# Recovery Checkpoint

## Original objective

Incrementally upgrade `skills/institutional_equity_research/SKILL.md` into a public-source, research-pattern learning system for institutional equity research, forensic accounting, public-side due diligence, earnings quality, credit-style risk review, and investment-committee memos. The upgrade must abstract functional methods without copying protected expression or trade dress, add structured supporting YAML libraries and design/asset controls, validate every resource, and preserve the existing skill rather than replace it.

## Completed tasks

- Read the full upgrade request and the existing `SKILL.md`.
- Read and followed the Codex `skill-creator` instructions.
- Performed the required pre-edit gap audit and saved it as `gap_analysis.yaml`.
- Completed public-source research across fundamental research, valuation, investment-committee process, credit methodology, forensic accounting, reporting quality, and public-side diligence.
- Confirmed the governing rights rule: public access does not imply redistribution permission; store source metadata and original observations only.
- Created the required directory skeleton for patterns, design resources, assets, benchmarks, and validation scripts.
- Created six report archetypes in `patterns/report_archetypes.yaml`.
- Created section contracts in `patterns/section_blueprints.yaml`, including the requested report sections plus evidence-for/evidence-against committee sections.
- Created twelve reusable analytical chains in `patterns/analytical_patterns.yaml`.
- Created all seventeen public-side diligence categories and the bounded finding schema in `patterns/diligence_patterns.yaml`.
- Created five cross-sector benchmark cases in `benchmarks/benchmark_cases.yaml`.
- Created initial design-system resources in `design/layout_tokens.yaml`, `design/visual_grammar.yaml`, and `design/sector_visual_motifs.yaml`.
- Created the manifest-gated asset registry in `assets/asset_manifest.yaml`.
- Parsed all ten currently present skill YAML files successfully with PyYAML after correcting flow-list quoting in `section_blueprints.yaml`.
- Semantically reviewed the design and asset layer against the requested layout, visual-grammar, asset-manifest, and sector-motif requirements.
- Created and validated `research_corpus.yaml` with 34 public-source metadata entries, complete required fields, unique source IDs, conservative reuse boundaries, and no report-content storage.
- Created and validated `patterns/forensic_patterns.yaml` with 38 deterministic public-filings screens, full required topic coverage, explicit alternative explanations, source routing, and non-accusatory signal labels.
- Created and validated the six complementary pattern libraries: 17 chart patterns, 10 table patterns, 8 layout patterns, 7 writing patterns, 8 disclosure blocks, and 9 sector patterns; all existing referenced IDs resolve.
- Created and validated `patterns/pattern_provenance.yaml`, covering all 166 adopted pattern, layout, visual, and motif IDs plus all 29 section-blueprint IDs through 24 rights-reviewed provenance sets.
- Created and ran `scripts/validate_resources.py`; it validates required resources, YAML parsing, corpus metadata, forensic contracts, reference resolution, provenance coverage, asset manifest gating, benchmark coverage, terminology, and named-style prohibition.
- Incrementally extended `SKILL.md` from 254 to 335 lines with concise resource routing, public-research rules, archetype/diligence/forensic/credit/IC execution, original design controls, the required ten-level conflict hierarchy, and a publication-blocking QA gate; both resource and skill validation pass.
- Stopped all active implementation work at a completed patch boundary when the checkpoint was requested.

## Remaining tasks

- Validate all YAML files and run the skill-creator `quick_validate.py` check.
- Run terminology, prohibited-claim, copyright, asset-manifest, and provenance coverage checks.
- Forward-test the upgraded skill on a fresh example task and record any refinements.
- Produce the requested final directory tree and eighteen-part implementation summary.

## Current status

Checkpointed mid-upgrade. The gap analysis, core archetype/blueprint layer, analytical patterns, diligence library, benchmark cases, design/asset resources, a 34-source rights-aware corpus, a 38-test forensic library, the complete chart/table/layout/writing/disclosure/sector pattern layer, full pattern provenance, deterministic resource validation, and an incrementally extended `SKILL.md` exist on disk. All present YAML files parse successfully; `SKILL.md` is 335 lines, resource validation passes, and the skill-creator validation passes. The support files are now wired into the existing skill without replacing its original Sections 1–26.

No remote push has been performed. No full third-party reports, report pages, screenshots, branded visuals, proprietary ratings, forecasts, target prices, or copied layouts were added.

## Files modified or created for this upgrade

- `skills/institutional_equity_research/gap_analysis.yaml`
- `skills/institutional_equity_research/patterns/report_archetypes.yaml`
- `skills/institutional_equity_research/patterns/section_blueprints.yaml`
- `skills/institutional_equity_research/patterns/analytical_patterns.yaml`
- `skills/institutional_equity_research/patterns/diligence_patterns.yaml`
- `skills/institutional_equity_research/benchmarks/benchmark_cases.yaml`
- `skills/institutional_equity_research/design/layout_tokens.yaml`
- `skills/institutional_equity_research/design/visual_grammar.yaml`
- `skills/institutional_equity_research/design/sector_visual_motifs.yaml`
- `skills/institutional_equity_research/assets/asset_manifest.yaml`
- `skills/institutional_equity_research/research_corpus.yaml`
- `skills/institutional_equity_research/patterns/forensic_patterns.yaml`
- `skills/institutional_equity_research/patterns/chart_patterns.yaml`
- `skills/institutional_equity_research/patterns/table_patterns.yaml`
- `skills/institutional_equity_research/patterns/layout_patterns.yaml`
- `skills/institutional_equity_research/patterns/writing_patterns.yaml`
- `skills/institutional_equity_research/patterns/disclosure_patterns.yaml`
- `skills/institutional_equity_research/patterns/sector_patterns.yaml`
- `skills/institutional_equity_research/patterns/pattern_provenance.yaml`
- `skills/institutional_equity_research/scripts/validate_resources.py`
- `RECOVERY.md`
- `TODO.md`

The existing `skills/institutional_equity_research/SKILL.md` was extended in place after all supporting libraries were created and validated.

## Next recommended step

Read this file and `TODO.md`, inspect the latest local commit, and compare the committed tree with these notes. Then run the complete YAML and skill validation suite, terminology and prohibited-claim checks, asset/provenance checks, and a fresh-context forward test. Resume only the unchecked work; do not regenerate or overwrite the completed resources unless validation identifies a specific defect.

## Assumptions and pending decisions

- All public research sources are methodology/provenance references only unless an explicit compatible reuse license is recorded.
- Quantitative forensic thresholds are configurable screening heuristics, not legal, GAAP, audit, fraud, or misconduct thresholds.
- Issuer-level findings must cite issuer or authoritative public evidence; methodology documents cannot prove an issuer-specific finding.
- Public-side diligence cannot claim complete verification and must label matters outside public scope.
- Asset folders may remain empty; every future asset must be original or properly licensed and registered in `asset_manifest.yaml` before use.
- The exact report-style implementation should remain original and generic; named institutional style imitation is prohibited.
- No product-code integration was requested in this phase; the primary deliverable is the upgraded reusable skill and its support resources.

## Recovery procedure for the next session

1. Read `RECOVERY.md`.
2. Read `TODO.md`.
3. Inspect the latest local commit.
4. Compare the repository with the recovery notes.
5. Resume only unfinished work.
6. Never restart the project from scratch or overwrite completed work.
