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
- Stopped all active implementation work at a completed patch boundary when the checkpoint was requested.

## Remaining tasks

- Perform semantic review of the newly created design and asset YAML files; their YAML syntax has been validated.
- Create `research_corpus.yaml` from the completed source ledgers, with every required metadata and rights field.
- Create `patterns/forensic_patterns.yaml` and cover every requested revenue, expense, cash-flow, balance-sheet, governance, and reporting-risk topic.
- Create the remaining pattern files: `chart_patterns.yaml`, `table_patterns.yaml`, `layout_patterns.yaml`, `writing_patterns.yaml`, `disclosure_patterns.yaml`, and `sector_patterns.yaml`.
- Create `patterns/pattern_provenance.yaml` for every adopted pattern.
- Create a deterministic resource-validation script under `scripts/`.
- Incrementally extend the existing `SKILL.md` with concise resource routing, mandatory versus optional rules, the exact conflict hierarchy, forensic/diligence/credit/IC execution guidance, copyright supremacy, and publication-blocking QA.
- Validate all YAML files and run the skill-creator `quick_validate.py` check.
- Run terminology, prohibited-claim, copyright, asset-manifest, and provenance coverage checks.
- Forward-test the upgraded skill on a fresh example task and record any refinements.
- Produce the requested final directory tree and eighteen-part implementation summary.

## Current status

Checkpointed mid-upgrade. The gap analysis, core archetype/blueprint layer, analytical patterns, diligence library, benchmark cases, and initial design/asset resources exist on disk, and all ten present YAML files parse successfully. `SKILL.md` itself has deliberately not yet been changed, because the request requires supporting libraries to be created before the concise routing update. The skill remains usable in its original form, while the new support files are not yet wired into it.

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
- `RECOVERY.md`
- `TODO.md`

The existing `skills/institutional_equity_research/SKILL.md` was inspected but not modified during this interrupted phase.

## Next recommended step

Read this file and `TODO.md`, inspect the latest local commit, and compare the committed tree with these notes. Then validate the existing YAML files before creating `research_corpus.yaml` and `forensic_patterns.yaml`. Resume only the unchecked work; do not regenerate or overwrite the completed gap audit, archetypes, section blueprints, analytical patterns, diligence patterns, or benchmark cases unless validation identifies a specific defect.

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
