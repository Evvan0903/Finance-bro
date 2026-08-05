# Market Data Diagnostic Report

## Summary

Market-data retrieval is generally working: known-good server-side checks succeeded for FRED, BLS, Congress.gov through DATA GOV, and SEC. BEA and Census requests reached their official services but the configured credentials were rejected; Ethan can continue with successful providers while omitting unsupported market assets.

## Provider Results

| Provider | Status | Main issue | Action needed |
|---|---|---|---|
| FRED | success | Stable FEDFUNDS request returned a usable observation | None |
| BEA | authenticationFailed | Configured credential was rejected by dataset metadata request | Verify or replace `BEA_API_KEY` |
| Census | authenticationFailed | Configured credential was rejected by the 2023 CBP request | Verify or replace `CENSUS_API_KEY` |
| BLS | success | Public CES request returned usable observations | None |
| DATA GOV | success | Congress.gov returned a usable bill record | None |
| SEC | success | NVIDIA Submissions request returned current filing data | None |

## Mapping Issues

- None confirmed. BEA industry and Census NAICS mapping validation remains blocked until the rejected credentials are corrected.

## Fixes Applied

- Removed provider names, statuses, errors, and fallback details from Ethan’s public Industry Data Coverage section.
- Removed visible source-ID labels from Section 13 cards while preserving provenance in exports, Sources and limitations, and internal visual records.
- Added sanitized server-only provider diagnostics and removed the detailed market provider result object before the public response is serialized.
- Preserved partial-provider behavior, the quarterly-default frequency control, original-frequency data exports, and precise aggregated-period tooltips.

## Remaining Actions

- Verify or replace `BEA_API_KEY` in the server environment and mirror the corrected value in Vercel if production uses BEA.
- Verify or replace `CENSUS_API_KEY` in the server environment and mirror the corrected value in Vercel if production uses Census CBP.
- Re-run `site/scripts/validate-market-providers.mjs` after updating either credential.
