# ScopeLine Metric Locator Worklog

## Changes made

- Added a reusable, ordered Metric Locator Engine for standard SEC XBRL, filing custom XBRL, filing HTML tables, filing text, exhibits/releases, and existing presentations.
- Added deterministic extraction, unit normalization, derivation, validation, confidence, source provenance, and rejected-candidate auditing.
- Integrated Shell FY2025 locator results into the existing report without adding sectors.
- Hid unusable KPI and balance cards, reflowed remaining cards, replaced repeated missing strings with `—`, and added compact `Limited data coverage` plus expandable `Data Coverage`.

## Files changed

- `site/app/lib/metric-locator-types.ts`
- `site/app/lib/metric-definitions.ts`
- `site/app/lib/metric-locator.ts`
- `site/app/lib/shell-metric-validation.ts`
- `site/app/api/metric-locator/route.ts`
- `site/app/api/research/route.ts`
- `site/app/lib/research-types.ts`
- `site/app/lib/sector-packs.ts`
- `site/app/ResearchApp.tsx`
- `site/app/globals.css`
- `site/tests/rendered-html.test.mjs`
- `RECOVERY.md`, `TODO.md`, `WORKLOG.md`

## Shell validation

- Found: Production; realized prices; LNG volumes; refining margins; segment earnings; cash capital expenditure; strict free cash flow; net debt; dividends; share buybacks; major projects.
- Unresolved: none.
- Success rate: 11/11 (100%).
- Strict FCF: USD 42.863bn operating cash flow − USD 20.915bn cash capex = USD 21.948bn. Shell's USD 26.052bn differently defined FCF is retained as a rejected definition-mismatch candidate.

## Tests

- Passed: ESLint; targeted TypeScript checks; production build; 12/12 automated tests; full Shell 2025 Form 20-F + Company Facts locator test; integrated Shell research response test.
- Failed: none.

## Known limitations

- The engine is reusable, but each new issuer/metric still needs aliases, definitions, units, and validation rules.
- The selected realized-price value is explicitly scoped to Europe / Shell subsidiaries / crude oil and NGL; it is not a group-wide blended realization.
- If SEC filing HTML is temporarily unreachable, Shell validation uses an explicitly labeled verified FY2025 snapshot.

## Next recommended step

Monitor production extraction behavior before adding any new sector or issuer pack. Sites version 5 is live at `https://scopeline-research.evvan.chatgpt.site` and remains owner-only.
