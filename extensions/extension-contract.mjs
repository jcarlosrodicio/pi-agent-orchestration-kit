const POLICY_KEYS = [
  "credentialValueMarkers",
  "forbiddenPathSegments",
  "privateEndpointEnvironmentNames",
  "privateEnvironmentValueNames",
  "safeMetadataFieldNames",
  "schemaVersion",
  "sensitiveFieldCategories",
  "variableNameOnlyFieldNames",
];

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function plainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownDataKeys(value) {
  if (!plainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    return null;
  }
  const keys = Object.keys(value);
  if (Object.getOwnPropertyNames(value).length !== keys.length) {
    return null;
  }
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor;
  }) ? keys : null;
}

function ownArrayValues(value) {
  if (!Array.isArray(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    return null;
  }
  const keys = Object.keys(value);
  const names = Object.getOwnPropertyNames(value);
  if (keys.length !== value.length || names.length !== value.length + 1 || !names.includes("length")) {
    return null;
  }
  const entries = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !("value" in descriptor)) {
      return null;
    }
    entries.push(descriptor.value);
  }
  return entries;
}

function exactKeys(value, expected) {
  const keys = ownDataKeys(value);
  if (!keys || keys.length !== expected.length) {
    return false;
  }
  const actual = [...keys].sort();
  const sortedExpected = [...expected].sort();
  return actual.every((key, index) => key === sortedExpected[index]);
}

function exactValue(actual, expected, active = new Set()) {
  if (actual === expected) {
    return true;
  }
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object" || active.has(actual)) {
    return false;
  }
  active.add(actual);
  try {
    if (Array.isArray(expected)) {
      const values = ownArrayValues(actual);
      return Boolean(values) && values.length === expected.length && values.every((value, index) => exactValue(value, expected[index], active));
    }
    if (!plainObject(expected) || !exactKeys(actual, Object.keys(expected))) {
      return false;
    }
    return Object.keys(expected).every((key) => exactValue(actual[key], expected[key], active));
  } finally {
    active.delete(actual);
  }
}

function exactStringSet(value, expected) {
  const entries = ownArrayValues(value);
  if (!entries || entries.some((entry) => typeof entry !== "string") || entries.length !== expected.length) {
    return false;
  }
  const actual = [...new Set(entries)].sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((entry, index) => entry === wanted[index]);
}

export const PI_EXTENSION_API_CONTRACT = deepFreeze({
  apiVersion: 1,
  metadataFields: ["apiVersion", "capability", "requiredEnv"],
  methods: ["on", "registerTool"],
});

export const EXTENSION_METADATA = deepFreeze({
  dotenv: {
    apiVersion: PI_EXTENSION_API_CONTRACT.apiVersion,
    capability: "environment-loading",
    requiredEnv: [],
  },
  "langfuse-observability": {
    apiVersion: PI_EXTENSION_API_CONTRACT.apiVersion,
    capability: "observability",
    requiredEnv: ["LANGFUSE_BASE_URL", "LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"],
  },
  "open-design": {
    apiVersion: PI_EXTENSION_API_CONTRACT.apiVersion,
    capability: "open-design",
    requiredEnv: [],
  },
  rtk: {
    apiVersion: PI_EXTENSION_API_CONTRACT.apiVersion,
    capability: "command-efficiency",
    requiredEnv: [],
  },
  "shell-export-guard": {
    apiVersion: PI_EXTENSION_API_CONTRACT.apiVersion,
    capability: "shell-export-guard",
    requiredEnv: [],
  },
});

export const TOKEN_USAGE_CAPABILITY = deepFreeze({
  evidence: "pi-subagents-capability-inspected",
  provider: "pi-subagents",
  status: "healthy",
});

export function tokenUsageCapabilityMatches(value) {
  return exactValue(value, TOKEN_USAGE_CAPABILITY);
}

export function tokenUsageEvidenceMatches(value) {
  return exactKeys(value, ["tokenUsage"])
    && tokenUsageCapabilityMatches(value.tokenUsage);
}

// This public policy snapshot travels with the generated package. Tests require it to equal config/secret-policy.json.
export const SECRET_POLICY = deepFreeze({
  credentialValueMarkers: ["bearer ", "basic ", "password=", "token=", "api_key=", "apikey=", "cookie="],
  forbiddenPathSegments: ["auth.json", "mcp-cache.json", "run-history.jsonl", "session", "sessions", "transcript", "transcripts", "trust.json"],
  privateEndpointEnvironmentNames: {},
  privateEnvironmentValueNames: {},
  safeMetadataFieldNames: [
    "agentModels", "args", "capabilities", "capability", "command", "description", "directTools", "enabled",
    "environmentName", "evidence", "id", "kind", "lifecycle", "managedValues", "mcpServers", "metadata",
    "mcpId", "models", "name", "ownership", "ownershipSelectors", "permission", "provider", "providerId",
    "providers", "requirements", "references", "requestTimeoutMs", "scope", "skills", "source", "status", "subject",
    "task", "targets", "timeout", "transport", "transformer", "type",
  ],
  schemaVersion: 1,
  sensitiveFieldCategories: {
    credential: ["apiKey", "authorization", "cookie", "cookies", "headers", "password", "token"],
    private_endpoint: ["baseUrl", "endpoint", "url"],
  },
  variableNameOnlyFieldNames: ["apiKeyEnv", "bearerTokenEnv", "env", "environment", "tokenEnv", "urlEnv"],
});

export function extensionMetadataMatches(value) {
  return exactValue(value, EXTENSION_METADATA);
}

export function isVerifiedPiExtensionApi(value) {
  return exactKeys(value, ["apiVersion", "metadataFields", "methods", "status"])
    && value.status === "verified"
    && value.apiVersion === PI_EXTENSION_API_CONTRACT.apiVersion
    && exactStringSet(value.methods, PI_EXTENSION_API_CONTRACT.methods)
    && exactStringSet(value.metadataFields, PI_EXTENSION_API_CONTRACT.metadataFields);
}

function forbiddenPath(value, forbiddenSegments) {
  return value.replaceAll("\\", "/").split("/").some((segment) => forbiddenSegments.has(segment.toLowerCase()));
}

function endpointLike(value) {
  return /(?:https?|wss?):\/\//i.test(value);
}

/**
 * Creates a closure-safe payload redactor only for the exact shipped secret policy.
 * It never evaluates getters and omits keys classified as sensitive.
 */
export function createSecretPolicyRedactor(policy) {
  if (!exactKeys(policy, POLICY_KEYS) || !exactValue(policy, SECRET_POLICY)) {
    return null;
  }
  const sensitiveKeys = new Set(Object.values(SECRET_POLICY.sensitiveFieldCategories)
    .flat()
    .map((name) => name.toLowerCase()));
  const markers = SECRET_POLICY.credentialValueMarkers.map((marker) => marker.toLowerCase());
  const forbiddenSegments = new Set(SECRET_POLICY.forbiddenPathSegments.map((segment) => segment.toLowerCase()));

  function redact(value, active = new Set()) {
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      return endpointLike(value) || forbiddenPath(value, forbiddenSegments) || markers.some((marker) => normalized.includes(marker))
        ? "[REDACTED]"
        : value;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number") {
      return Number.isFinite(value) || typeof value !== "number" ? value : "[REDACTED]";
    }
    if (typeof value !== "object" || active.has(value)) {
      return "[REDACTED]";
    }
    active.add(value);
    try {
      if (Array.isArray(value)) {
        const entries = ownArrayValues(value);
        return entries ? entries.map((entry) => redact(entry, active)) : "[REDACTED]";
      }
      const keys = ownDataKeys(value);
      if (!keys) {
        return "[REDACTED]";
      }
      const result = {};
      for (const key of keys.sort()) {
        if (sensitiveKeys.has(key.toLowerCase())) {
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !("value" in descriptor)) {
          return "[REDACTED]";
        }
        result[key] = redact(descriptor.value, active);
      }
      return result;
    } finally {
      active.delete(value);
    }
  }

  return redact;
}
