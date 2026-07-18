# ScopeLine

ScopeLine is a bilingual Chinese/English, sector-aware institutional research application for ChatGPT Sites. Select a supported market, sector, and subindustry, then enter a company name or ticker to generate a point-in-time research brief from official SEC filings and dated public industry evidence.

## What it does

- resolves the issuer through the SEC company directory;
- supports U.S.-listed Integrated Oil & Gas and Semiconductors through visibly different modular analyst packs;
- switches the interface, generated report, errors, Markdown export, and application-owned PDF export between Chinese and English while remembering the user's preference;
- supports domestic and foreign-private-issuer forms, including 10-K, 10-Q, 20-F, and 6-K;
- normalizes three to five annual periods from SEC Company Facts;
- retrieves screened 2025+ sector evidence only after sector, subindustry, geography, and date filtering;
- keeps reusable research methodology separate from time-sensitive evidence;
- separates reported facts, derived calculations, analyst assumptions, management statements, and interpretations;
- produces a compact 12-section report with sector KPIs, peers, earnings quality, debates, filing watchlist, catalysts, risks, scenarios, and transparent valuation;
- calculates free cash flow only as operating cash flow minus cash capital expenditure and labels it unavailable when either input is missing;
- refreshes the sector outlook independently without refetching the company;
- leaves unavailable values visible rather than inventing them;
- caches reusable SEC payloads, company reports, peer facts, and outlook retrievals;
- exports the generated report to Markdown or a paginated application-owned PDF with a controlled footer.

The application does not use live market prices and therefore does not publish a rating or target price. Scenario valuation uses filing-supported enterprise metrics and intentionally avoids unsupported precision. ScopeLine is research information, not investment advice.

## Supported research packs

### Energy / Integrated Oil & Gas

Production, realized prices, LNG, refining, cash capital expenditure, strict free cash flow, net debt, shareholder returns, commodity sensitivity, and major projects. Peer references: Exxon Mobil, Chevron, BP, and TotalEnergies.

### Technology / Semiconductors

End-market exposure, AI/data-center mix, gross margin, inventory, capital expenditure, strict free cash flow, product cycles, customer concentration, market share, and export controls. Peer references: AMD, Broadcom, Intel, and TSMC.

## Evidence and limitations

Issuer financials and filing dates come from official SEC submissions and Company Facts. Current sector context uses dated, public evidence from EIA, IEA, SIA, SEMI, and the U.S. Bureau of Industry and Security. Retrieval stores metadata and original summaries rather than full reports.

The current scope is limited to supported U.S.-listed issuers with sufficient standardized SEC XBRL. Market prices, sell-side estimates, consensus target prices, and proprietary research are not used. Peer tables may be partial when a peer request fails or standardized facts are unavailable.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run lint
npm test
```

Set `SEC_USER_AGENT` to a descriptive contact string for production SEC requests. The application does not require D1, R2, or an OpenAI API key.

## Vercel

Set Vercel's Root Directory to `site`. Vercel uses `npm ci` and `npm run vercel-build`, which builds the existing App Router application with Next.js and Webpack. Set `SEC_USER_AGENT` in Vercel to a descriptive contact string for live SEC requests, for example `FinBro research@example.com`.
