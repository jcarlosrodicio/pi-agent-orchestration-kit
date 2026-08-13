# Security policy

## Scope and warning

This repository publishes an agent orchestration harness. It is not a
sandbox, isolation boundary, or permission system. Pi, the model provider, the
operating system, and any enabled tools retain their own authority. Review
those permissions before installing the package in a sensitive environment.

The public package is intentionally sanitized. It must not contain credentials,
tokens, cookies, auth or session state, private endpoints, local filesystem
paths, private MCP definitions, raw transcripts, or generated runtime state.

## Supported versions

Security fixes target the latest commit on `master` and the latest published
release. Older snapshots may not receive a backport.

## Reporting a vulnerability

Please report vulnerabilities privately through a
[GitHub Security Advisory](https://github.com/jcarlosrodicio/pi-agent-orchestration-kit/security/advisories/new).
Include a concise description, affected commit or version, reproduction steps,
impact, and a suggested mitigation when available. Do not include secret
values in the report.

If the advisory form is unavailable, contact the maintainer through the
repository's GitHub profile and request a private security channel. Do not
publish the details until a fix or coordinated disclosure date is agreed.

## Response process

We will acknowledge a report when practical, reproduce it, assess severity,
prepare a fix, and publish a release note that does not expose sensitive
details. Reports that concern Pi itself or a third-party provider may need to
be coordinated with that upstream project as well.
