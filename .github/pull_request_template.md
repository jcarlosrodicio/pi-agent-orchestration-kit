## Summary

<!-- What behavior or public contract changes? -->

## Change type

- [ ] Agent, role, prompt, or chain
- [ ] Skill or extension
- [ ] Runtime safety or package boundary
- [ ] Documentation
- [ ] CI or repository maintenance

## Validation

- [ ] `npm ci`
- [ ] `npm run check:all`
- [ ] `npm run check:release`
- [ ] Bounded Pi smoke test (when an extension or runtime binding changed)
- [ ] Documentation updated when behavior changed

## Public safety checklist

- [ ] No credentials, tokens, cookies, auth/session state, transcripts, or logs
- [ ] No private endpoints, machine-specific paths, local MCPs, or private wrappers
- [ ] The lead remains read-only and delegates implementation work
- [ ] A reviewer remains an independent final gate for non-trivial changes
- [ ] The change is portable without the private OpenCode checkout

## Notes and limitations

<!-- Include safe output, known limitations, and follow-up work. -->
