export const LEAD_ORCHESTRATION_MARKER = "OPENCODE_PI_LEAD_ORCHESTRATOR_V1";

const READ_ONLY_TOOLS = [
  "read", "grep", "find", "ls", "bash", "subagent", "subagent_wait", "subagent_supervisor", "intercom",
];
const WRITE_TOOLS = new Set(["edit", "write"]);
const MUTATING_BASH = /(?:^|[;&|]\s*)(?:sudo\s+)?(?:rm|mv|cp|mkdir|rmdir|touch|install|chmod|chown)\b|(?:^|[;&|]\s*)git\s+(?:add|commit|apply|clean|checkout|reset|restore|switch)\b|(?:^|[;&|]\s*)(?:npm|pnpm|yarn)\s+(?:install|uninstall|update|remove)\b|(?:^|[^<])>{1,2}/i;
const DIRECT_WRITE_REASON = "The lead session is orchestration-only; delegate file changes to developer.";
const BASH_WRITE_REASON = "The lead session is orchestration-only; delegate mutating shell work to developer.";
const REVIEW_GATE_REASON = "A multi-stage implementation workflow must include a reviewer child before the lead can close.";

const LEAD_PROMPT = `
${LEAD_ORCHESTRATION_MARKER}
You are the OpenCode-compatible lead orchestrator for this Pi session.

Your job is to classify the user's request, choose the smallest correct workflow, delegate it, and consolidate the results. You are not an implementation agent: do not edit or write repository files, do not implement fixes yourself, do not perform substantive code investigation, and do not review a diff as a substitute for the assigned agent.

For every user request, delegate to an actual child through the subagent tool; never merely describe a delegation. Use the smallest valid route:
- small, clear, low-risk change: delegate one developer child with objective, acceptance criteria, constraints, and validation;
- technical, product, API, library, architecture, or risk uncertainty: delegate researcher first;
- enough context but missing criteria, tasks, or a validation plan: delegate specifier;
- an existing diff, implementation, or plan requiring audit: delegate reviewer;
- non-trivial feature or migration: run a sequential workflow researcher -> specifier -> developer -> reviewer, adding designer only when visual or UX concerns matter.

The parent lead must use workflowScript/runs.run or runs.all and wait for the required child results before synthesizing. A developer child is the only normal writer; a reviewer child is the final authority for non-trivial work. Do not claim a child ran unless the subagent tool returned its result. If the routing decision is genuinely ambiguous, ask the user before delegating.
`;

function isMutationBash(command) {
  return typeof command === "string" && MUTATING_BASH.test(command);
}

function hasAgent(workflowScript, agent) {
  if (typeof workflowScript !== "string") return false;
  const escaped = agent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bagent\\s*:\\s*['\"]${escaped}['\"]`, "i").test(workflowScript);
}

function missesReviewerGate(input) {
  const workflowScript = input?.workflowScript;
  return hasAgent(workflowScript, "developer")
    && (hasAgent(workflowScript, "researcher") || hasAgent(workflowScript, "specifier"))
    && !hasAgent(workflowScript, "reviewer");
}

function restrictParentTools(pi) {
  if (typeof pi.getAllTools !== "function" || typeof pi.setActiveTools !== "function") {
    return;
  }
  const available = new Set(pi.getAllTools().map((tool) => tool?.name).filter((name) => typeof name === "string"));
  const active = READ_ONLY_TOOLS.filter((name) => available.has(name));
  pi.setActiveTools(active);
}

export default function registerOrchestrator(pi, options = {}) {
  if (!pi || typeof pi.on !== "function") {
    throw new Error("Pi extension API is unavailable.");
  }
  const isChild = options.isChild ?? process.env.PI_SUBAGENT_CHILD === "1";
  if (isChild) {
    return;
  }

  pi.on("session_start", () => {
    restrictParentTools(pi);
  });

  pi.on("before_agent_start", (event) => {
    restrictParentTools(pi);
    const systemPrompt = typeof event?.systemPrompt === "string" ? event.systemPrompt : "";
    if (systemPrompt.includes(LEAD_ORCHESTRATION_MARKER)) {
      return { systemPrompt };
    }
    return { systemPrompt: `${systemPrompt}\n${LEAD_PROMPT}` };
  });

  pi.on("agent_start", () => {
    // pi-subagents registers the native supervisor tools during before_agent_start.
    // Refresh after registration so the lead can answer child coordination requests.
    restrictParentTools(pi);
  });

  pi.on("tool_call", (event) => {
    if (WRITE_TOOLS.has(event?.toolName)) {
      return { block: true, reason: DIRECT_WRITE_REASON };
    }
    if (event?.toolName === "bash" && isMutationBash(event?.input?.command)) {
      return { block: true, reason: BASH_WRITE_REASON };
    }
    if (event?.toolName === "subagent" && missesReviewerGate(event?.input)) {
      return { block: true, reason: REVIEW_GATE_REASON };
    }
    return undefined;
  });
}
