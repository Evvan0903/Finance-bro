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

test("server-renders the ScopeLine research request", async () => {
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
  assert.match(html, /输入一家公司/);
  assert.match(html, /id="company"/);
  assert.match(html, /生成尽调报告/);
  assert.match(html, /SEC-first/);
  assert.match(html, />中文</);
  assert.match(html, />EN</);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("rejects invalid research requests in the default Chinese locale before external data access", async () => {
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

test("keeps the bilingual client-to-API locale contract explicit", async () => {
  const [client, route, types] = await Promise.all([
    readFile(new URL("../app/ResearchApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/research-types.ts", import.meta.url), "utf8"),
  ]);

  assert.match(
    client,
    /JSON\.stringify\(\{\s*company:\s*query,\s*locale:\s*requestedLocale\s*\}\)/s,
  );
  assert.match(route, /locale\?:\s*ResearchLocale/);
  assert.match(route, /payload\.locale\s*===\s*["']en["']\s*\?\s*["']en["']\s*:\s*["']zh["']/);
  assert.match(types, /export type ResearchLocale\s*=\s*["']zh["']\s*\|\s*["']en["']/);
  assert.match(types, /locale:\s*ResearchLocale/);
  assert.match(client, /scopeline-locale/);
  assert.match(client, /document\.documentElement\.lang/);
  assert.match(client, />EN</);
  assert.match(client, />中文</);
});

test("removes disposable starter assets and metadata", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<ResearchApp \/>/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(layout, /ScopeLine/);
  assert.doesNotMatch(page + layout + packageJson, /_sites-preview|codex-preview|react-loading-skeleton/);

  await Promise.all([
    assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", projectRoot))),
    access(new URL("public/og.png", projectRoot)),
    access(new URL("public/favicon.png", projectRoot)),
  ]);
});
