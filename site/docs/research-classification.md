# Deterministic SEC SIC Classification

FinBro classifies companies on the server. The user supplies a ticker or company name; the application resolves one SEC reporting identity and uses the issuer's SEC Submissions SIC code as the authoritative classification input.

```text
Ticker / company name
        ↓
Exact SEC identity and zero-padded CIK
        ↓
SEC Submissions (SIC code and description)
        ↓
Central SIC registry
        ↓
General or validated research pack
        ↓
Metric Locator
        ↓
Canonical Metric Registry
        ↓
Evidence-backed bilingual Web / PDF report
```

## Separate responsibilities

- **SIC classification** maps an SEC SIC code to a detected sector and pack identifier. It does not inspect business-description prose.
- **Research-pack selection** chooses research questions, relevant KPIs, catalysts, risks, and a supported valuation framework.
- **Metric extraction** searches verified public evidence and publishes only supported values into unique Canonical Metric Objects.

Client-provided sector and subindustry fields are deprecated and ignored. This prevents user choices from overriding SEC classification.

## Resolution and fallback

Ticker resolution uses this order: known alias, bundled exact identity, exact SEC ticker, exact normalized legal name, then controlled name search. Exact ticker results are deduplicated by normalized ticker plus zero-padded CIK; ambiguity requires genuinely distinct CIKs.

Research-pack fallback is deterministic:

1. exact SIC mapping;
2. recognized SIC family with a broad pack;
3. recognized sector using Sector General;
4. unmapped or missing SIC using General Corporate.

The response records the SIC, detected sector, selected pack, fallback level, and classification reason. Missing specialization never becomes an SEC-outage error.

## Current pack registry

The registry contains Technology Hardware General, Semiconductor General, Software & SaaS General, Internet & Platform General, Commercial Banking General, Diversified Financials General, Biopharma General, Oil & Gas General, Industrial Machinery General, Consumer Products General, Sector General, and General Corporate.

Semiconductors, commercial banking, biopharma, integrated oil and gas, and industrial machinery reuse the existing validated methodologies. Other packs provide a conservative universal-company core and request additional metrics only when supported by verified evidence.

## Deliberate MVP boundary

This layer uses deterministic code only. Embeddings, vector search, machine-learning classifiers, LLM classification, and fuzzy business-description matching are intentionally deferred because they would make classification harder to reproduce and audit. SIC can be broad or dated, so the selected method and fallback reason remain visible for review.
