import { EXTENSION_METADATA } from "./extension-contract.mjs";

export const metadata = EXTENSION_METADATA["open-design"];

type DesignInput = {
  baseUrl?: string;
  name?: string;
  prompt?: string;
  skillId?: string;
  designSystemId?: string;
  agentId?: string;
  model?: string;
  kind?: string;
  fidelity?: string;
};

const JSON_HEADERS = { "Content-Type": "application/json" };
const encoder = new TextEncoder();

export const OPEN_DESIGN_HTTP_LIMITS = Object.freeze({
  connectTimeoutMs: 5_000,
  totalTimeoutMs: 120_000,
  idleTimeoutMs: 15_000,
  maxJsonBytes: 1_048_576,
  maxSseBytes: 8_388_608,
  maxOutputBytes: 2_097_152,
  maxEvents: 10_000,
});

function resolveLimits(overrides: any = {}) {
  return Object.fromEntries(Object.entries(OPEN_DESIGN_HTTP_LIMITS).map(([name, fallback]) => [
    name,
    Number.isFinite(Number(overrides[name])) ? Math.max(100, Math.floor(Number(overrides[name]))) : fallback,
  ]));
}

function assertPiApi(pi: any) {
  if (!pi || typeof pi.registerTool !== "function") {
    throw new Error("Pi extension API is unavailable.");
  }
}

function configuredBaseUrl(input?: string) {
  const raw = input || process.env.OPEN_DESIGN_URL;
  if (!raw) {
    throw new Error("OPEN_DESIGN_URL is not configured.");
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("OPEN_DESIGN_URL must be a valid HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("OPEN_DESIGN_URL must be an HTTP(S) URL without credentials, query, or hash.");
  }
  return parsed.toString().replace(/\/$/, "");
}

function boundedText(value: unknown, limit: number) {
  return typeof value === "string" ? value.slice(-limit) : "";
}

function timeoutError(message: string) {
  return new Error(`Open Design request ${message}`);
}

function createBudget(limits: any) {
  const controller = new AbortController();
  let failure: Error | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let totalTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectConnectTimeout: (error: Error) => void = () => {};
  let rejectTotalTimeout: (error: Error) => void = () => {};
  const abort = (error: unknown) => {
    if (failure) return failure;
    failure = error instanceof Error ? error : new Error(String(error));
    controller.abort(failure);
    return failure;
  };
  const connectTimeout = new Promise<never>((_, reject) => {
    rejectConnectTimeout = reject;
    connectTimer = setTimeout(() => rejectConnectTimeout(abort(timeoutError("timed out while connecting"))), limits.connectTimeoutMs);
  });
  const totalTimeout = new Promise<never>((_, reject) => {
    rejectTotalTimeout = reject;
    totalTimer = setTimeout(() => rejectTotalTimeout(abort(timeoutError("timed out"))), limits.totalTimeoutMs);
  });
  void totalTimeout.catch(() => {});
  return {
    signal: controller.signal,
    connectTimeout,
    totalTimeout,
    markHeadersReceived() { clearTimeout(connectTimer); },
    abort,
    errorOr(error: unknown) { return failure || (error instanceof Error ? error : new Error(String(error))); },
    dispose() { clearTimeout(connectTimer); clearTimeout(totalTimer); },
  };
}

async function fetchWithBudget(url: string, init: RequestInit, options: any = {}) {
  const limits = resolveLimits(options.limits);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("Open Design requires a fetch implementation.");
  const budget = createBudget(limits);
  try {
    const response = await Promise.race([
      Promise.resolve().then(() => fetchImpl(url, { ...init, signal: budget.signal })),
      budget.connectTimeout,
      budget.totalTimeout,
    ]);
    budget.markHeadersReceived();
    return { response, budget, limits };
  } catch (error) {
    const failure = budget.errorOr(error);
    budget.dispose();
    throw failure;
  }
}

async function readWithIdleTimeout(reader: ReadableStreamDefaultReader<Uint8Array>, budget: any, idleTimeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(budget.abort(timeoutError("timed out while reading"))), idleTimeoutMs);
      }),
      budget.totalTimeout,
    ]);
  } catch (error) {
    throw budget.errorOr(error);
  } finally {
    clearTimeout(timer);
  }
}

async function cancelResponseBody(response: Response) {
  try { await response.body?.cancel?.(); } catch { /* best effort after abort */ }
}

async function readBoundedText(response: Response, budget: any, limits: any, label: string, maxBytes = limits.maxJsonBytes) {
  const contentLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    const error = new Error(`${label} response exceeds ${maxBytes} bytes`);
    budget.abort(error);
    await cancelResponseBody(response);
    throw error;
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await readWithIdleTimeout(reader, budget, limits.idleTimeoutMs);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error(`${label} response exceeds ${maxBytes} bytes`);
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } catch (error) {
    budget.abort(error);
    await reader.cancel().catch(() => {});
    throw budget.errorOr(error);
  } finally {
    reader.releaseLock();
  }
}

export async function requestJson(base: string, pathname: string, init: RequestInit = {}, options: any = {}) {
  let transport;
  try {
    transport = await fetchWithBudget(`${base}${pathname}`, {
      ...init,
      headers: { ...JSON_HEADERS, ...(init.headers || {}) },
    }, options);
  } catch (error: any) {
    if (error?.message?.includes("timed out")) throw new Error("Open Design request timed out.");
    throw new Error("Open Design request failed.");
  }
  const { response, budget, limits } = transport;
  try {
    const text = await readBoundedText(response, budget, limits, `Open Design ${pathname}`);
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : null; } catch { body = text.slice(0, 1000); }
    if (!response.ok) throw new Error(`Open Design request failed (${response.status}).`);
    return body;
  } catch (error: any) {
    if (error?.message?.includes("timed out")) throw new Error("Open Design request timed out.");
    if (error?.message?.startsWith("Open Design request failed")) throw error;
    throw new Error("Open Design request failed.");
  } finally {
    budget.dispose();
  }
}

function randomId(length = 8) {
  const value = globalThis.crypto?.randomUUID?.().replaceAll("-", "") || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return value.slice(0, length);
}

function safeSlug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "open-design-project";
}

function projectUrl(base: string, projectId: string) {
  return `${base}/projects/${encodeURIComponent(projectId)}`;
}

function fileUrl(base: string, projectId: string, fileName: string, raw = false) {
  const safeName = fileName.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `${base}/${raw ? "api/" : ""}projects/${encodeURIComponent(projectId)}/files/${safeName}`;
}

function eventDelimiter(input: string) {
  const candidates = [[input.indexOf("\r\n\r\n"), 4], [input.indexOf("\n\n"), 2], [input.indexOf("\r\r"), 2]]
    .filter(([index]) => index !== -1) as [number, number][];
  return candidates.sort(([left], [right]) => left - right)[0] || null;
}

export function parseSse(buffer: string) {
  const frames: Array<{ event: string; data: any }> = [];
  let rest = buffer;
  while (true) {
    const delimiter = eventDelimiter(rest);
    if (!delimiter) break;
    const [end, length] = delimiter;
    const raw = rest.slice(0, end);
    rest = rest.slice(end + length);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split(/\r\n|\n|\r/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    }
    const dataText = dataLines.join("\n");
    let data: any = dataText;
    try { data = dataText ? JSON.parse(dataText) : null; } catch { /* keep text */ }
    frames.push({ event, data });
  }
  return { frames, rest };
}

function appendOutput(parts: string[], bytes: number, value: unknown, limits: any) {
  const text = String(value ?? "");
  const nextBytes = bytes + encoder.encode(text).byteLength;
  if (nextBytes > limits.maxOutputBytes) throw new Error(`Open Design stdout/stderr output exceeds ${limits.maxOutputBytes} bytes`);
  parts.push(text);
  return nextBytes;
}

export async function runChat(base: string, body: unknown, options: any = {}) {
  let transport;
  try {
    transport = await fetchWithBudget(`${base}/api/chat`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }, options);
  } catch (error: any) {
    if (error?.message?.includes("timed out")) throw new Error("Open Design agent request timed out.");
    throw new Error("Open Design agent request failed.");
  }
  const { response, budget, limits } = transport;
  try {
    if (!response.ok || !response.body) {
      await readBoundedText(response, budget, limits, "Open Design chat");
      throw new Error("Open Design chat request failed.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const stdoutParts: string[] = [];
    const stderrParts: string[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let streamBytes = 0;
    let buffer = "";
    let end: any = null;
    let eventsCount = 0;
    try {
      while (true) {
        const chunk = await readWithIdleTimeout(reader, budget, limits.idleTimeoutMs);
        if (chunk.done) {
          buffer += decoder.decode();
          break;
        }
        streamBytes += chunk.value.byteLength;
        if (streamBytes > limits.maxSseBytes) throw new Error(`Open Design SSE response exceeds ${limits.maxSseBytes} bytes`);
        buffer += decoder.decode(chunk.value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        for (const frame of parsed.frames) {
          eventsCount += 1;
          if (eventsCount > limits.maxEvents) throw new Error(`Open Design SSE event count exceeds ${limits.maxEvents}`);
          if (frame.event === "stdout") stdoutBytes = appendOutput(stdoutParts, stdoutBytes, frame.data?.chunk, limits);
          if (frame.event === "stderr") stderrBytes = appendOutput(stderrParts, stderrBytes, frame.data?.chunk, limits);
          if (frame.event === "agent") {
            if (typeof frame.data?.delta === "string") stdoutBytes = appendOutput(stdoutParts, stdoutBytes, frame.data.delta, limits);
            if (typeof frame.data?.text === "string") stdoutBytes = appendOutput(stdoutParts, stdoutBytes, frame.data.text, limits);
          }
          if (frame.event === "end") end = frame.data;
          if (frame.event === "error") throw new Error("Open Design agent request failed.");
        }
      }
      if (buffer.trim()) throw new Error("Open Design SSE stream ended with an incomplete event.");
      if (typeof end?.code === "number" && end.code !== 0) throw new Error("Open Design agent exited unsuccessfully.");
      return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), end, eventsCount };
    } catch (error) {
      budget.abort(error);
      await reader.cancel().catch(() => {});
      throw budget.errorOr(error);
    } finally {
      reader.releaseLock();
    }
  } catch (error: any) {
    if (error?.message?.includes("timed out")) throw new Error("Open Design agent request timed out.");
    if (error?.message?.startsWith("Open Design")) throw error;
    throw new Error("Open Design agent request failed.");
  } finally {
    budget.dispose();
  }
}

function systemPrompt(skillId: string, skillBody: string, designSystemId: string | null, designSystemBody: string | null) {
  return [
    "# Open Design Runtime",
    "",
    "You are a senior visual designer and frontend prototyper working inside Open Design.",
    "Follow the active skill and design system exactly. Prefer writing a complete index.html into the project workspace.",
    "Use credible content, strong hierarchy, accessible contrast, responsive layout, and a self-review before finishing.",
    "",
    `## Active skill: ${skillId}`,
    "",
    skillBody,
    "",
    designSystemBody ? `## Active design system: ${designSystemId}\n\n${designSystemBody}` : "## Active design system\n\nUse a restrained professional default.",
  ].join("\n");
}

function baseParameters() {
  return { properties: { baseUrl: { type: "string" } }, additionalProperties: false, type: "object" };
}

function register(pi: any, name: string, description: string, parameters: any, execute: (input: any) => Promise<unknown>) {
  pi.registerTool({ name, description, parameters, execute });
}

export function registerOpenDesignRemote(pi: any) {
  assertPiApi(pi);
  register(pi, "open_design_health", "Check whether the configured Open Design workbench is reachable.", baseParameters(), async (input = {}) => ({ healthy: true, data: await requestJson(configuredBaseUrl(input.baseUrl), "/api/health") }));
  register(pi, "open_design_list_agents", "List agent CLIs detected by Open Design.", baseParameters(), async (input = {}) => requestJson(configuredBaseUrl(input.baseUrl), "/api/agents"));
  register(pi, "open_design_list_skills", "List skills available in Open Design.", baseParameters(), async (input = {}) => requestJson(configuredBaseUrl(input.baseUrl), "/api/skills"));
  register(pi, "open_design_list_design_systems", "List design systems available in Open Design.", baseParameters(), async (input = {}) => requestJson(configuredBaseUrl(input.baseUrl), "/api/design-systems"));

  register(pi, "open_design_create_project", "Create an Open Design project without starting generation.", {
    additionalProperties: false,
    properties: { ...baseParameters().properties, name: { type: "string" }, prompt: { type: "string" }, skillId: { type: "string" }, designSystemId: { type: "string" }, kind: { type: "string" }, fidelity: { type: "string" } },
    required: ["name", "prompt"], type: "object",
  }, async (input: DesignInput) => {
    const base = configuredBaseUrl(input.baseUrl);
    const projectId = `${safeSlug(input.name || "project")}-${randomId()}`;
    const created = await requestJson(base, "/api/projects", { body: JSON.stringify({ id: projectId, name: input.name, skillId: input.skillId || "web-prototype", designSystemId: input.designSystemId || null, pendingPrompt: input.prompt, metadata: { kind: input.kind || "prototype", fidelity: input.fidelity || "high-fidelity" } }), method: "POST" });
    return { projectId, url: projectUrl(base, projectId), created };
  });

  register(pi, "open_design_run_design", "Create an Open Design project and run generation through the configured workbench.", {
    additionalProperties: false,
    properties: { ...baseParameters().properties, name: { type: "string" }, prompt: { type: "string" }, skillId: { type: "string" }, designSystemId: { type: "string" }, agentId: { type: "string" }, model: { type: "string" }, kind: { type: "string" }, fidelity: { type: "string" } },
    required: ["name", "prompt", "skillId"], type: "object",
  }, async (input: DesignInput) => {
    const base = configuredBaseUrl(input.baseUrl);
    const projectId = `${safeSlug(input.name || "project")}-${randomId()}`;
    await requestJson(base, "/api/projects", { body: JSON.stringify({ id: projectId, name: input.name, skillId: input.skillId, designSystemId: input.designSystemId || null, pendingPrompt: input.prompt, metadata: { kind: input.kind || "prototype", fidelity: input.fidelity || "high-fidelity" } }), method: "POST" });
    const skill: any = await requestJson(base, `/api/skills/${encodeURIComponent(input.skillId || "")}`);
    const designSystem: any = input.designSystemId ? await requestJson(base, `/api/design-systems/${encodeURIComponent(input.designSystemId)}`) : null;
    const result = await runChat(base, { agentId: input.agentId || "opencode", message: input.prompt, systemPrompt: systemPrompt(input.skillId || "", String(skill?.body || ""), input.designSystemId || null, designSystem?.body ? String(designSystem.body) : null), projectId, attachments: [], model: input.model || null, reasoning: null });
    const filesData: any = await requestJson(base, `/api/projects/${encodeURIComponent(projectId)}/files`);
    const files = Array.isArray(filesData?.files) ? filesData.files.map((file: any) => ({ name: file.name, kind: file.kind, size: file.size, uiUrl: fileUrl(base, projectId, file.name), rawUrl: fileUrl(base, projectId, file.name, true) })) : [];
    return { projectId, projectUrl: projectUrl(base, projectId), files, outputPreview: boundedText(result.stdout, 4000), stderrPreview: boundedText(result.stderr, 1000), eventsCount: result.eventsCount };
  });
}

export default registerOpenDesignRemote;
