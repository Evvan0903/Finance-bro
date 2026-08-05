# Market Data Diagnostic Report

## Summary

Market-data retrieval is generally working. The validator automatically loaded `site/.env.local` on 2026-08-05 and known-good checks succeeded for FRED, BLS, Congress.gov through DATA GOV, and SEC. BEA and Census reached their official services with the documented credential parameters, but the supplied credentials were rejected.

## Provider Results

| Provider | Status | Main issue | Action needed |
|---|---|---|---|
| FRED | success | `FEDFUNDS` returned one usable observation for 2026-07-01 | None |
| BEA | authenticationFailed | `GETDATASETLIST` reached BEA with `UserID`, but the credential was rejected | Verify or replace `BEA_API_KEY` |
| Census | authenticationFailed | 2023 CBP reached Census with `key`, but the credential was rejected | Verify or replace `CENSUS_API_KEY` |
| BLS | success | Public CES request returned 18 usable observations | None |
| DATA GOV | success | Congress.gov returned one usable bill record | None |
| SEC | success | NVIDIA Submissions returned filing data through 2026-07-20 | None |

## Mapping Issues

- None confirmed. The stable BEA dataset-list and Census 2023 CBP requests show credential rejection, not a mapping, year-range, dataset, or series defect.

## Fixes Applied

- Added automatic Next-style project env loading for the standalone validator from either the repository root or `site`, with shell values taking precedence.
- Centralized exact-name credential normalization and safe state diagnostics for FRED, BEA, Census, and DATA GOV.
- Reused the shared configuration in production providers and validation; BEA maps `BEA_API_KEY` to `UserID`, and Census maps `CENSUS_API_KEY` to `key`.
- Added response-aware status classification and retained sanitized server-only diagnostics without changing Ethan’s public-report behavior.

## Remaining Actions

- Verify or replace `BEA_API_KEY`; configure the corrected value separately in Vercel if production uses BEA.
- Verify or replace `CENSUS_API_KEY`; configure the corrected value separately in Vercel if production uses authenticated Census quota.
- Re-run `node scripts/validate-market-providers.mjs` from `site` after either credential changes.
