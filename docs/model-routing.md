# Model routing in Pi

The kit keeps the agent roles and orchestration contracts provider-neutral. Pi
chooses the actual model through the native `pi-subagents` settings rather than
through OpenCode's environment-variable names.

## Settings shape

Put this in `~/.pi/agent/settings.json` for a global setup, or in a project Pi
settings file when you want a project-specific choice:

```json
{
  "defaultProvider": "your-provider",
  "defaultModel": "your-provider/model-standard",
  "subagents": {
    "agentScope": "both",
    "chainScope": "both",
    "defaultModel": "your-provider/model-standard",
    "agentOverrides": {
      "lead": { "model": "your-provider/model-orchestrator" },
      "designer": { "model": "your-provider/model-design" },
      "researcher": { "model": "your-provider/model-research" },
      "specifier": { "model": "your-provider/model-standard" },
      "developer": { "model": "your-provider/model-coding" },
      "reviewer": { "model": "your-provider/model-review" },
      "evaluator": { "model": "your-provider/model-standard" },
      "debugger": { "model": "your-provider/model-standard" },
      "evolver": { "model": "your-provider/model-standard" }
    }
  }
}
```

The model value is the provider-qualified identifier understood by your Pi
provider registry. Replace the examples with IDs that exist in your install;
the kit does not guess or silently substitute a different model. Keep API keys,
tokens and auth state in Pi's provider configuration, never in this repository
or in an agent file.

The effective precedence is: per-run override, agent frontmatter, matching
`agentOverrides` entry, `subagents.defaultModel`, then the parent/default Pi
model. Run `/subagents-models` in Pi to inspect the effective routing.

OpenCode variables such as `OPENCODE_LEAD_MODEL` are not read by Pi. This is
intentional: the Pi configuration is explicit and uses `subagents`' native
contract.
