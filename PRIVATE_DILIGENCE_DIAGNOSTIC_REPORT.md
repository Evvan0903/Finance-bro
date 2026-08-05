# Clara V1 developer diagnostic report

Validation date: 2026-08-05

This report records sanitized validation outcomes only. It contains no API keys, raw response bodies, request headers, local paths, or hardcoded production findings.

## Real-source scenarios

| Profile | Company | Identity | Coverage | Evidence | Claims | Gaps | Questions | Result |
|---|---|---|---|---:|---:|---:|---:|---|
| Venture-backed technology | Anthropic PBC | Medium | Moderate public-source coverage | 8 | 12 | 6 | 6 | Pass |
| Government contractor / construction services | Turner Construction Company | Medium | Strong public-source coverage | 31 | 132 | 6 | 6 | Pass |
| Small company with limited public information | Pine Park Health | Medium | Limited public-source coverage | 4 | 4 | 6 | 6 | Pass |

All three runs used the real company websites and the live official USAspending endpoint. The reports kept company website claims labeled Company Reported, excluded weak matches, linked every claim to evidence, placed References last, used sanitized clickable HTTPS references, and avoided exact revenue, valuation, ownership, litigation, or investment conclusions.

Provider outcomes varied by entity. Company website retrieval succeeded in all three cases. USAspending returned one exact Anthropic record, 25 exact Turner records, and no exact Pine Park record; nine weak Turner recipient matches were rejected. SAM and USPTO were not configured. State registry, market context, and broad-web discovery used explicit manual/unavailable statuses. No unavailable provider blocked the company-site report.

## Automated validation

- Clara-focused tests: 9 passed, 0 failed
- Full automated suite: 102 passed, 0 failed
- TypeScript: passed
- ESLint: passed
- Vinext production build: passed
- Next.js/Vercel-compatible production build: passed
- `git diff --check`: passed
- Shared Ethan XLSX regression: passed after correcting byte-range response handling
- Browser QA: English and Chinese at 390px and 1440px, no horizontal overflow
- Live report QA: Pine Park Health generated with 10 evidence-supported sections and four final clickable references
- Export QA: Markdown, CSV, and XLSX returned valid attachment MIME types and non-empty files; PDF completed with the Clara footer and no browser errors

No manual Vercel deployment was performed.
