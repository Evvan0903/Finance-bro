import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_SITE_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ALLOWED_VARIABLES = new Set([
  "FRED_API_KEY",
  "BEA_API_KEY",
  "CENSUS_API_KEY",
  "DATA_GOV_API_KEY",
  "SEC_USER_AGENT",
]);

export function resolveSiteDirectory(startDirectory = process.cwd()) {
  let current = resolve(startDirectory);
  while (true) {
    if (existsSync(join(current, "package.json")) && existsSync(join(current, "app"))) return current;
    const nestedSite = join(current, "site");
    if (existsSync(join(nestedSite, "package.json")) && existsSync(join(nestedSite, "app"))) {
      return nestedSite;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return SCRIPT_SITE_DIRECTORY;
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed.at(-1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    const inner = trimmed.slice(1, -1);
    return first === '"'
      ? inner.replaceAll("\\n", "\n").replaceAll("\\r", "\r").replaceAll("\\t", "\t").replaceAll('\\"', '"')
      : inner;
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

export function parseEnvironmentFile(contents) {
  const parsed = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || !ALLOWED_VARIABLES.has(match[1])) continue;
    parsed.set(match[1], unquote(match[2]));
  }
  return parsed;
}

export async function loadProjectEnvironment({
  environment = process.env,
  startDirectory = process.cwd(),
  nodeEnvironment = environment.NODE_ENV || "development",
} = {}) {
  const siteDirectory = resolveSiteDirectory(startDirectory);
  const files = [
    `.env.${nodeEnvironment}.local`,
    ...(nodeEnvironment === "test" ? [] : [".env.local"]),
    `.env.${nodeEnvironment}`,
    ".env",
  ];
  const loadedFiles = [];
  for (const filename of files) {
    const path = join(siteDirectory, filename);
    if (!existsSync(path)) continue;
    const parsed = parseEnvironmentFile(await readFile(path, "utf8"));
    for (const [name, value] of parsed) {
      if (environment[name] === undefined) environment[name] = value;
    }
    loadedFiles.push(filename);
  }
  return { siteDirectory, loadedFiles };
}
