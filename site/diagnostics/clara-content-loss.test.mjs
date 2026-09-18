import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// This diagnostic now guards the repaired behavior that originally reproduced
// the production symptom. Stable end-to-end coverage lives in tests/.
test("diagnostic: visible service copy is mapped to a bounded service candidate", async () => {
  const moduleUrl = pathToFileURL(resolve("app/lib/private-diligence/extraction/htmlExtractor.ts"));
  const { extractCompanyPage } = await import(moduleUrl.href);
  const extracted = extractCompanyPage(`
    <html><head><title>Example AI</title></head><body>
      <h1>Global Data Collection at Scale</h1>
      <p>We provide data collection, data cleaning, and data annotation services.</p>
    </body></html>
  `);

  assert.match(extracted.bodyText, /data collection/i);
  assert.ok(extracted.services.includes("data collection"));
  const candidate = extracted.factCandidates.find((item) => item.factType === "service" && item.value === "data collection");
  assert.ok(candidate);
  assert.match(candidate.excerpt, /provide data collection/i);
  assert.equal(candidate.extractionMethod, "visibleText");
});
