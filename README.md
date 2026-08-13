# Pi Agent Orchestration Kit

A public, reproducible Pi package for structured software work: routing,
research, design, specification, implementation, review, and bounded loops.

The package is derived from the private OpenCode harness, but Pi is the public
runtime surface. OpenCode remains the canonical source for the orchestration
contracts; this repository contains only the sanitized Pi distribution.

## Install

From GitHub:

```bash
pi install git:git@github.com:jcarlosrodicio/pi-agent-orchestration-kit.git
```

From a local checkout:

```bash
pi install ./pi-agent-orchestration-kit
```

Pi loads the package's agents, prompts, skills, chains, extensions, and runtime
bindings through `package.json`. Use `pi config` to inspect or disable optional
package resources.

## Included orchestration

- `lead` routes each request and delegates substantive work.
- `researcher`, `specifier`, `developer`, and `reviewer` provide phase barriers.
- `designer`, `scoper`, `evaluator`, `debugger`, and `evolver` cover specialized
  workflows and optional harness evolution.
- Prompt templates cover feature, plan, scope, research, implementation, review,
  testing, design, loops, and autonomous bounded work.
- The lead remains read-only; child agents receive the permissions declared by
  their role and the reviewer is the final authority for non-trivial work.

## Public boundary

This repository intentionally excludes local providers, private MCP servers,
credentials, auth/session state, raw transcripts, machine-local paths, and
private memory or search wrappers. Configure your own Pi provider credentials
and optional integrations locally; do not commit their values.

The public package is a derived distribution, not a replacement for the
canonical private OpenCode source. Changes to the harness should be made in the
canonical source and then exported through the maintained private publication
workflow.

## License

MIT. See [LICENSE](LICENSE).
