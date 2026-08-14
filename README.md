# Pi Agent Orchestration Kit

[![Checks](https://github.com/jcarlosrodicio/pi-agent-orchestration-kit/actions/workflows/check.yml/badge.svg)](https://github.com/jcarlosrodicio/pi-agent-orchestration-kit/actions/workflows/check.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Node.js >=22](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

A reproducible, local-first [Pi](https://github.com/badlogic/pi-mono) harness for
research, planning, implementation, review, and safe agent orchestration.

This is a public, sanitized distribution. It is designed to make a Pi install
behave like a disciplined software team without publishing credentials,
private integrations, machine-specific paths, transcripts, or local state.

> **Security boundary:** this package is an orchestration harness, not a
> sandbox. Review the permissions and tools exposed by your Pi installation
> before using it on a repository or a machine you care about.

## What it provides

- A read-only `lead` router that decides when work should be delegated.
- Phase agents for `researcher`, `designer`, `specifier`, `developer`, and
  `reviewer`.
- Optional sidecars for `scoper`, `evaluator`, `debugger`, and `evolver`.
- Prompts for feature work, planning, research, implementation, review,
  testing, design, bounded loops, and autonomous operation.
- Pi extensions and runtime bindings for the public orchestration contracts.
- A shell export guard that blocks high-signal environment enumeration and
  secret propagation while allowing ordinary setup such as PATH and NODE_ENV.
- Skills and chains that keep phase boundaries, review gates, and bounded
  autonomy explicit.
- A repository check that rejects symlinks, non-regular files, private markers,
  and missing public-package metadata.

## Install

Install the public package directly from GitHub:

```bash
pi install git:github.com/jcarlosrodicio/pi-agent-orchestration-kit
```

For a reproducible setup, pin the installation to a release tag:

```bash
pi install git:github.com/jcarlosrodicio/pi-agent-orchestration-kit@v0.2.1
```

Or clone it and install the local checkout:

```bash
git clone https://github.com/jcarlosrodicio/pi-agent-orchestration-kit.git
pi install ./pi-agent-orchestration-kit
```

Inspect the installed package and its optional resources with:

```bash
pi config
pi list
```

### Updating the harness

Pi's package installer is the update mechanism; publishing this harness to npm
is not required. Packages installed from an unpinned Git source can be updated
with:

```bash
pi update --extensions
```

You can update Pi and its packages together with `pi update --all`. A package
installed from a local path, such as `pi install ./pi-agent-orchestration-kit`,
has no remote source and is not updated by Pi; reinstall it from Git or repeat
the local checkout installation after pulling new commits.

Pinned tags and commits are intentionally skipped by `pi update --extensions`.
Move a pinned installation to a new release explicitly:

```bash
pi install git:github.com/jcarlosrodicio/pi-agent-orchestration-kit@v0.3.0
```

Use release tags for controlled, reproducible upgrades and the unpinned Git
source when you deliberately want the latest default branch. Review the
release notes before changing a production or VPS installation.

Pi still needs a provider configured in your own environment. The kit does not
ship provider credentials, auth state, or service-specific secrets.

### Per-agent model routing

Pi uses `pi-subagents`' native routing settings. Configure the provider-qualified
model for each role in `~/.pi/agent/settings.json` under
`subagents.agentOverrides`; the checked-in example is
[`examples/pi-settings.models.example.json`](examples/pi-settings.models.example.json)
and the full precedence rules are in [docs/model-routing.md](docs/model-routing.md).
The kit never commits provider keys or assumes that an OpenCode model variable
exists in Pi.

### Open Design

The local `open_design` writer is included for create-only workspace artifacts.
For the remote Open Design workbench, export `OPEN_DESIGN_URL` before starting
Pi. The extension then exposes health, catalog, project, and design-run tools;
the setup and endpoint contract are documented in
[docs/open-design.md](docs/open-design.md). If the variable is absent, only the
remote bridge is unavailable; the rest of the harness still starts.

## How orchestration works

```text
request
  -> lead (routing and delegation; read-only)
       -> researcher / designer / specifier (when uncertainty or design exists)
       -> developer (implementation)
       -> reviewer (independent final review)
  -> evidence and validation
```

Small, clear requests can take a direct developer path. Non-trivial feature
work uses explicit phase barriers so research, specification, implementation,
and review do not silently collapse into one model turn. The lead coordinates;
it is not the implementation agent.

## Repository layout

| Path | Purpose |
| --- | --- |
| `agents/` | Pi agent role definitions |
| `roles/` | Lead routing contract |
| `prompts/` | User-facing workflow prompts |
| `chains/` | Multi-phase orchestration chains |
| `skills/` | Reusable engineering and review guidance |
| `extensions/` | Optional Pi extension adapters |
| `runtime/` | Managed command bindings and runtime assets |
| `scripts/check.mjs` | Public-package safety and completeness check |

## Public safety boundary

The repository deliberately excludes:

- credentials, API keys, tokens, cookies, and auth/session state;
- raw transcripts, private memory, local search databases, and private MCPs;
- private endpoints, local filesystem paths, and machine-specific wrappers;
- generated runtime state, caches, logs, and user-specific configuration.

Keep provider configuration and optional integrations in your own Pi setup. If
you add a new integration, document its safe configuration contract and never
commit its secret values.

## Development

Requirements: Node.js 22 or newer and npm.

```bash
npm ci
npm run check:all
npm run check:release
```

`check:all` validates the public package and runs its tests. `check:release`
also runs the production-dependency audit used by CI. See
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and
[SECURITY.md](SECURITY.md) before reporting a vulnerability.

## Relationship to OpenCode

The private OpenCode harness is the canonical authoring source for the
orchestration contracts. This repository is its sanitized Pi distribution and
can be installed independently. Changes to the canonical harness are exported
through a maintained publication workflow; private OpenCode configuration is
never required at runtime and is never modified by this repository.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
