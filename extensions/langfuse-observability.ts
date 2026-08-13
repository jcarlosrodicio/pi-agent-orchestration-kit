import { createSecretPolicyRedactor, EXTENSION_METADATA } from "./extension-contract.mjs";

export const metadata = EXTENSION_METADATA["langfuse-observability"];

function assertPiApi(pi) {
  if (!pi || typeof pi.on !== "function") {
    throw new Error("Pi extension API is unavailable.");
  }
}

function configuredEnvironment(environment) {
  if (!environment || typeof environment !== "object") {
    return null;
  }
  const values = metadata.requiredEnv.map((name) => environment[name]);
  return values.every((value) => typeof value === "string" && value.length > 0) ? values : null;
}

export function registerLangfuseObservability(pi, {
  environment = process.env,
  fetchImpl = globalThis.fetch,
  secretPolicy,
} = {}) {
  assertPiApi(pi);
  const configuration = configuredEnvironment(environment);
  const redact = createSecretPolicyRedactor(secretPolicy);
  const state = { status: configuration && redact && typeof fetchImpl === "function" ? "ready" : "degraded" };

  pi.on("turn_end", async (event) => {
    if (state.status !== "ready" || !configuration) {
      return;
    }
    const [baseUrl, publicKey, secretKey] = configuration;
    try {
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/public/ingestion`, {
        body: JSON.stringify(redact(event)),
        headers: {
          authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`,
          "content-type": "application/json",
        },
        method: "POST",
      });
      if (!response?.ok) {
        state.status = "degraded";
      }
    } catch {
      state.status = "degraded";
    }
  });
  return state;
}

export default registerLangfuseObservability;
