# ScopeLine

ScopeLine is a Chinese-first institutional research MVP for ChatGPT Sites. Enter a company name or ticker to generate a point-in-time, source-linked research brief from official SEC filings.

## What it does

- resolves the issuer through the SEC company directory;
- supports domestic and foreign-private-issuer forms, including 10-K, 10-Q, 20-F, and 6-K;
- normalizes three to five annual periods from SEC Company Facts;
- separates reported facts, derived calculations, analyst assumptions, management statements, and interpretations;
- covers financial trends, cash flow, balance sheet, earnings quality, thesis, catalysts, risks, and scenario valuation;
- leaves unavailable values visible rather than inventing them;
- exports the generated report to Markdown or the browser print-to-PDF flow.

The MVP does not use live market prices and therefore does not publish a rating or target price. It is research information, not investment advice.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run lint
npm test
```

Set `SEC_USER_AGENT` to a descriptive contact string for production SEC requests. The application does not require D1, R2, or an OpenAI API key.
