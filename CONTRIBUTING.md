# Contributing

Thanks for helping improve the Pi Agent Orchestration Kit. Contributions are
welcome when they preserve the public safety boundary and keep orchestration
behavior understandable.

## Before opening a pull request

1. Keep the change focused. Explain the user-visible behavior and the phase or
   contract it changes.
2. Do not add credentials, tokens, cookies, auth state, transcripts, logs,
   private endpoints, machine-specific paths, local MCP configuration, or
   generated state.
3. Preserve the lead's read-only routing role and the independent reviewer
   barrier for non-trivial work.
4. Add or update tests and documentation when behavior changes.
5. Run the same checks used by CI:

   ```bash
   npm ci
   npm run check:all
   npm run check:release
   ```

6. If an extension or runtime binding changes, run a bounded Pi smoke test and
   describe the exact command and result in the pull request.

## Pull request expectations

Every pull request should include:

- a short summary of the behavior change;
- the affected agent, prompt, chain, skill, extension, or runtime contract;
- validation results and any known limitation;
- confirmation that the public package contains no private configuration.

The repository requires CI, an approving code-owner review, and resolved review
conversation before `master` can be updated. Keep commits small enough to
review and avoid unrelated formatting or generated files.

## Design conventions

- `lead` routes and delegates; it does not implement the task.
- `developer` owns implementation changes after delegation.
- `reviewer` is independent from the implementation phase and is the final
  quality and safety gate for a non-trivial change.
- Checkers fail closed when a public-boundary decision is ambiguous.
- Public resources must be portable and must not depend on a private checkout.

## Reporting security issues

Please do not open a public issue for an undisclosed vulnerability. Follow
[SECURITY.md](SECURITY.md) instead.
