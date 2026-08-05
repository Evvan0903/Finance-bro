export type PrivateDiligenceConfiguration = {
  sam: { configured: boolean; key: string | null };
  uspto: { configured: boolean; key: string | null };
  webDiscovery: { configured: boolean; provider: string | null };
};

function credential(value: string | undefined) {
  if (value === undefined) return null;
  let normalized = value.trim();
  if (normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized || null;
}

export function readPrivateDiligenceConfiguration(
  environment: Record<string, string | undefined> = process.env,
): PrivateDiligenceConfiguration {
  const sam = credential(environment.SAM_API_KEY);
  const uspto = credential(environment.USPTO_API_KEY);
  const webDiscovery = credential(environment.PRIVATE_DILIGENCE_WEB_PROVIDER);
  return {
    sam: { configured: Boolean(sam), key: sam },
    uspto: { configured: Boolean(uspto), key: uspto },
    webDiscovery: { configured: Boolean(webDiscovery), provider: webDiscovery },
  };
}

export const PRIVATE_DILIGENCE_ENVIRONMENT_VARIABLES = [
  "SAM_API_KEY",
  "USPTO_API_KEY",
  "PRIVATE_DILIGENCE_WEB_PROVIDER",
] as const;
