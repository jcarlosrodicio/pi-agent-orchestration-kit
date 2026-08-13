import assert from "node:assert/strict";
import test from "node:test";
import { registerOpenDesignRemote } from "../extensions/open-design-remote.ts";

const TOOL_NAMES = [
  "open_design_health",
  "open_design_list_agents",
  "open_design_list_skills",
  "open_design_list_design_systems",
  "open_design_create_project",
  "open_design_run_design",
];

function fakePi() {
  const tools = [];
  return { tools, registerTool(tool) { tools.push(tool); } };
}

function response(body, { status = 200, headers = {} } = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
    status,
  });
}

test("registers the complete remote Open Design tool surface", () => {
  const pi = fakePi();
  registerOpenDesignRemote(pi);
  assert.deepEqual(pi.tools.map(({ name }) => name), TOOL_NAMES);
  assert.equal(new Set(pi.tools.map(({ name }) => name)).size, TOOL_NAMES.length);
  for (const tool of pi.tools) {
    assert.equal(tool.parameters.additionalProperties, false);
    assert.equal(typeof tool.execute, "function");
  }
});

test("health uses OPEN_DESIGN_URL and returns safe status data", async () => {
  const previous = process.env.OPEN_DESIGN_URL;
  const calls = [];
  process.env.OPEN_DESIGN_URL = "https://design.example.test/";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    return response({ status: "ok" });
  };
  try {
    const pi = fakePi();
    registerOpenDesignRemote(pi);
    const result = await pi.tools.find(({ name }) => name === "open_design_health").execute({});
    assert.deepEqual(result, { healthy: true, data: { status: "ok" } });
    assert.deepEqual(calls, [{ url: "https://design.example.test/api/health", method: "GET" }]);
    assert.equal(JSON.stringify(result).includes("design.example"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.OPEN_DESIGN_URL;
    else process.env.OPEN_DESIGN_URL = previous;
  }
});

test("rejects unsafe Open Design URLs and missing configuration without fetching", async () => {
  const previous = process.env.OPEN_DESIGN_URL;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  delete process.env.OPEN_DESIGN_URL;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("unexpected fetch");
  };
  try {
    const pi = fakePi();
    registerOpenDesignRemote(pi);
    const health = pi.tools.find(({ name }) => name === "open_design_health");
    await assert.rejects(health.execute({}), /OPEN_DESIGN_URL is not configured/);
    await assert.rejects(health.execute({ baseUrl: "https://user:secret@design.example.test" }), /HTTP\(S\) URL/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.OPEN_DESIGN_URL;
    else process.env.OPEN_DESIGN_URL = previous;
  }
});

test("runs a design through the project, skill, SSE, and files endpoints", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const pathname = new URL(String(url)).pathname;
    calls.push({ pathname, method: init.method ?? "GET" });
    if (pathname === "/api/projects") return response({ created: true });
    if (pathname === "/api/skills/dashboard") return response({ body: "Use a dense dashboard layout." });
    if (pathname === "/api/design-systems/linear") return response({ body: "Use restrained spacing." });
    if (pathname === "/api/chat") {
      return new Response([
        "event: stdout\ndata: {\"chunk\":\"created\"}\n\n",
        "event: end\ndata: {\"code\":0}\n\n",
      ].join(""), { headers: { "content-type": "text/event-stream" }, status: 200 });
    }
    if (pathname.endsWith("/files")) return response({ files: [{ name: "index.html", kind: "file", size: 42 }] });
    throw new Error(`unexpected path ${pathname}`);
  };
  try {
    const pi = fakePi();
    registerOpenDesignRemote(pi);
    const result = await pi.tools.find(({ name }) => name === "open_design_run_design").execute({
      baseUrl: "https://design.example.test",
      designSystemId: "linear",
      name: "Dashboard",
      prompt: "Build a dashboard",
      skillId: "dashboard",
    });
    assert.match(result.projectId, /^dashboard-[a-z0-9]+$/);
    assert.equal(result.projectUrl.startsWith("https://design.example.test/projects/"), true);
    assert.deepEqual(result.files.map(({ name, kind, size }) => ({ name, kind, size })), [{ name: "index.html", kind: "file", size: 42 }]);
    assert.equal(result.outputPreview, "created");
    assert.equal(result.eventsCount, 2);
    assert.deepEqual(calls.slice(0, 4).map(({ pathname, method }) => ({ pathname, method })), [
      { pathname: "/api/projects", method: "POST" },
      { pathname: "/api/skills/dashboard", method: "GET" },
      { pathname: "/api/design-systems/linear", method: "GET" },
      { pathname: "/api/chat", method: "POST" },
    ]);
    assert.match(calls[4].pathname, /^\/api\/projects\/dashboard-[a-z0-9]+\/files$/);
    assert.equal(calls[4].method, "GET");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("redacts remote response bodies from HTTP errors", async () => {
  const originalFetch = globalThis.fetch;
  const previous = process.env.OPEN_DESIGN_URL;
  process.env.OPEN_DESIGN_URL = "https://design.example.test";
  globalThis.fetch = async () => response({ secret: "do-not-return" }, { status: 500 });
  try {
    const pi = fakePi();
    registerOpenDesignRemote(pi);
    const health = pi.tools.find(({ name }) => name === "open_design_health");
    await assert.rejects(health.execute({}), (error) => {
      assert.equal(error.message, "Open Design request failed (500).");
      assert.equal(error.message.includes("do-not-return"), false);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.OPEN_DESIGN_URL;
    else process.env.OPEN_DESIGN_URL = previous;
  }
});
