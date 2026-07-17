import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: builtWorker } = await import(workerUrl.href);
  return builtWorker;
}

const environment = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const context = {
  waitUntil() {},
  passThroughOnException() {},
};

test("server-renders the bilingual sector-aware research request", async () => {
  const builtWorker = await worker();
  const response = await builtWorker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    environment,
    context,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /ScopeLine/);
  assert.match(html, /一键生成公开信息尽调/);
  assert.match(html, /id="company"/);
  assert.match(html, /生成行业感知研究/);
  assert.match(html, /综合石油与天然气/);
  assert.match(html, /半导体/);
  assert.match(html, /即将推出/);
  assert.match(html, />中文</);
  assert.match(html, />EN</);
  assert.doesNotMatch(html, /输入一家公司|生成尽调报告|codex-preview|react-loading-skeleton/i);
});

test("rejects invalid research requests in Chinese before external data access", async () => {
  const builtWorker = await worker();
  const response = await builtWorker.fetch(
    new Request("http://localhost/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company: "x" }),
    }),
    environment,
    context,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "请输入 2-100 个字符的公司名或交易代码。",
  });
});

test("rejects invalid research requests in English before external data access", async () => {
  const builtWorker = await worker();
  const response = await builtWorker.fetch(
    new Request("http://localhost/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company: "x", locale: "en" }),
    }),
    environment,
    context,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Enter a company name or ticker between 2 and 100 characters.",
  });
});

test("rejects unsupported sector combinations before SEC access", async () => {
  const builtWorker = await worker();
  const response = await builtWorker.fetch(
    new Request("http://localhost/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: "NVDA",
        locale: "en",
        market: "US",
        sector: "technology",
        subindustry: "integrated-oil-gas",
      }),
    }),
    environment,
    context,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Select a currently supported market, sector, and subindustry combination.",
  });
});

test("returns distinct screened outlooks without regenerating company data", async () => {
  const builtWorker = await worker();
  const requests = [
    { market: "Europe", subindustry: "integrated-oil-gas", locale: "en", refresh: true },
    { market: "US", subindustry: "semiconductors", locale: "en", refresh: true },
  ];
  const [energyResponse, semiResponse] = await Promise.all(
    requests.map((body) =>
      builtWorker.fetch(
        new Request("http://localhost/api/sector-outlook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        environment,
        context,
      ),
    ),
  );
  assert.equal(energyResponse.status, 200);
  assert.equal(semiResponse.status, 200);
  const energy = (await energyResponse.json()).outlook;
  const semis = (await semiResponse.json()).outlook;
  assert.equal(energy.subindustry, "integrated-oil-gas");
  assert.equal(semis.subindustry, "semiconductors");
  assert.ok(energy.claims.length >= 2);
  assert.ok(semis.claims.length >= 2);
  assert.ok(energy.claims.every((claim) => claim.publicationDate >= "2025-01-01"));
  assert.ok(semis.claims.every((claim) => claim.publicationDate >= "2025-01-01"));
  assert.notDeepEqual(
    energy.claims.map((claim) => claim.publisher),
    semis.claims.map((claim) => claim.publisher),
  );
});

test("keeps the full client-to-API sector and locale contract explicit", async () => {
  const [client, route, types, outlookRoute] = await Promise.all([
    readFile(new URL("../app/ResearchApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/research-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sector-outlook/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(client, /JSON\.stringify\(requestBody\(query,\s*requestedLocale\)\)/);
  assert.match(client, /company:\s*query/);
  assert.match(client, /\bmarket,\s*\n\s*sector,\s*\n\s*subindustry,\s*\n\s*options,/);
  assert.match(route, /type ResearchPayload/);
  assert.match(route, /selectionFromPayload/);
  assert.match(types, /selection:\s*ResearchSelection/);
  assert.match(client, /scopeline-locale/);
  assert.match(client, /document\.documentElement\.lang/);
  assert.match(outlookRoute, /getSectorOutlook/);
  assert.match(client, /refreshSectorOutlook/);
});

test("enforces strict FCF and sector-specific analyst packs", async () => {
  const [route, packs, evidence, retrieval] = await Promise.all([
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-packs.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-evidence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-retrieval.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /Free cash flow = operating cash flow - cash capital expenditure/);
  assert.match(route, /safeSubtract\(operatingCashFlow,\s*cashCapex\)/);
  assert.doesNotMatch(route, /safeAdd\(operatingCashFlow(?:Value)?,\s*investingCashFlow/);
  assert.match(route, /Unable to calculate free cash flow from available filings\./);

  for (const required of [
    "Production",
    "Realized prices",
    "LNG volumes",
    "Refining margins",
    "Commodity sensitivity",
    "Major projects",
    "End-market revenue",
    "AI / data-center exposure",
    "Gross margin",
    "Customer concentration",
    "Market share",
  ]) assert.match(packs, new RegExp(required.replace("/", "\\/"), "i"));
  assert.match(packs, /EV \/ FCF/);
  assert.match(packs, /EV \/ Revenue/);
  assert.match(packs, /XOM/);
  assert.match(packs, /AMD/);

  assert.match(evidence, /MIN_PUBLICATION_DATE = "2025-01-01"/);
  assert.match(evidence, /source\.publicationDate < MIN_PUBLICATION_DATE/);
  assert.match(evidence, /seenUrls/);
  assert.match(evidence, /source\.accessible/);
  assert.match(retrieval, /filteredSources/);
  assert.match(retrieval, /embed\(/);
  assert.match(retrieval, /full reports are never loaded/);
});

test("owns PDF pagination and footer instead of browser print metadata", async () => {
  const [client, pdf, css] = await Promise.all([
    readFile(new URL("../app/ResearchApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/pdf-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /exportReportPdf/);
  assert.match(client, /data-pdf-block/);
  assert.doesNotMatch(client, /window\.print\(\)/);
  assert.match(pdf, /ScopeLine Research \| \$\{meta\.ticker\} \| \$\{meta\.researchDate\} \| Page \$\{pageNumber\}/);
  assert.match(pdf, /table \{ min-width: 0 !important/);
  assert.match(css, /\.scenario-grid \{ break-inside: avoid/);
  assert.match(css, /\.source-columns small \{ color: #526878;.*font-size: 10px/s);
});

test("removes disposable starter assets and keeps private Sites metadata", async () => {
  const [page, layout, packageJson, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<ResearchApp \/>/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(layout, /ScopeLine/);
  assert.match(hosting, /appgprj_6a585b81f7708191b13b1c34903345a9/);
  assert.doesNotMatch(page + layout + packageJson, /_sites-preview|codex-preview|react-loading-skeleton/);

  await Promise.all([
    assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", projectRoot))),
    access(new URL("public/og.png", projectRoot)),
    access(new URL("public/favicon.png", projectRoot)),
  ]);
});
