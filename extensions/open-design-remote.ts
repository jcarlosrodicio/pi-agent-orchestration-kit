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

async function requestJson(base: string, pathname: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${base}${pathname}`, {
      ...init,
      headers: { ...JSON_HEADERS, ...(init.headers || {}) },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text.slice(0, 1000); }
    if (!response.ok) {
      throw new Error(`Open Design request failed (${response.status}).`);
    }
    return body;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Open Design request timed out.");
    if (error?.message?.startsWith("Open Design request failed")) throw error;
    throw new Error("Open Design request failed.");
  } finally {
    clearTimeout(timer);
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

function parseSse(buffer: string) {
  const frames: Array<{ event: string; data: any }> = [];
  let rest = buffer;
  while (true) {
    const end = rest.indexOf("\n\n");
    if (end < 0) break;
    const raw = rest.slice(0, end);
    rest = rest.slice(end + 2);
    let event = "message";
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      if (line.startsWith("data: ")) data += line.slice(6);
    }
    try { frames.push({ event, data: JSON.parse(data) }); } catch { frames.push({ event, data }); }
  }
  return { frames, rest };
}

async function runChat(base: string, body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10 * 60_000);
  try {
    const response = await fetch(`${base}/api/chat`, {
      body: JSON.stringify(body), headers: JSON_HEADERS, method: "POST", signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error("Open Design chat request failed.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stdout = "";
    let stderr = "";
    let end: any = null;
    let eventsCount = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const parsed = parseSse(buffer);
      buffer = parsed.rest;
      for (const frame of parsed.frames) {
        eventsCount += 1;
        if (frame.event === "stdout") stdout += String(frame.data?.chunk ?? "");
        if (frame.event === "stderr") stderr += String(frame.data?.chunk ?? "");
        if (frame.event === "agent") {
          if (typeof frame.data?.delta === "string") stdout += frame.data.delta;
          if (typeof frame.data?.text === "string") stdout += frame.data.text;
        }
        if (frame.event === "end") end = frame.data;
        if (frame.event === "error") throw new Error("Open Design agent request failed.");
      }
    }
    if (typeof end?.code === "number" && end.code !== 0) throw new Error("Open Design agent exited unsuccessfully.");
    return { stdout, stderr, eventsCount };
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Open Design agent request timed out.");
    if (error?.message?.startsWith("Open Design")) throw error;
    throw new Error("Open Design agent request failed.");
  } finally {
    clearTimeout(timer);
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
