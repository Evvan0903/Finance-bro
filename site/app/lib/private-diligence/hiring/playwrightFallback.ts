import { lookup } from "node:dns/promises";
import { isBlockedNetworkAddress, normalizeOfficialCompanyUrl } from "../security";

type BrowserLike = {
  launch(options: { headless: true; executablePath?: string; args?: string[] }): Promise<{
    newPage(): Promise<{ goto(url: string, options: { waitUntil: "domcontentloaded"; timeout: number }): Promise<unknown>; content(): Promise<string> }>;
    close(): Promise<void>;
  }>;
};

// A fixed, optional server dependency. Keeping this as a runtime import prevents
// the web application bundle from resolving Chromium's optional internals.
const PLAYWRIGHT_CORE_MODULE = "playwright-core";

/**
 * Optional server-side Playwright renderer for public, JS-rendered careers pages.
 * It is never exposed as a browser endpoint and stays on the confirmed hostname.
 * Deployments must intentionally provide a compatible Playwright runtime.
 */
export function createPlaywrightBrowserRenderer(officialHostname: string) {
  return async (urlText: string) => {
    const url = normalizeOfficialCompanyUrl(urlText);
    const normalize = (value: string) => value.toLowerCase().replace(/^www\./, "");
    if (normalize(url.hostname) !== normalize(officialHostname)) {
      throw new Error("Browser fallback destination was rejected");
    }
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((item) => isBlockedNetworkAddress(item.address))) {
      throw new Error("Browser fallback destination resolved to a blocked address");
    }
    try {
      // Keep Playwright optional: local/API deployments that do not provide a
      // browser return a structured browser_fallback_failed result instead.
      const playwright = await import(/* @vite-ignore */ PLAYWRIGHT_CORE_MODULE) as { chromium?: BrowserLike };
      if (!playwright.chromium) throw new Error("Playwright Chromium is unavailable");
      const browser = await playwright.chromium.launch({
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        args: ["--disable-dev-shm-usage", "--no-sandbox"],
      });
      try {
        const page = await browser.newPage();
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 12_000 });
        return await page.content();
      } finally {
        await browser.close();
      }
    } catch (error) {
      throw new Error(`Browser fallback failed: ${error instanceof Error ? error.message : "renderer unavailable"}`);
    }
  };
}
