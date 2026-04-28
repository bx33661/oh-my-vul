This handoff is blocked and is not ready for submission.

Blockers:
- No tested version is present, so the affected version boundary cannot be written for VulDB.
- The source to sink data flow is not proven. The packet says the source is `JSON body`, the sink is `recursive assignment`, and the guard is `not verified`, but it does not show a confirmed source -> sink -> guard trace.

Preserved facts:
- Package: `npm:demo-merge`
- Repository: `https://github.com/example/demo-merge`
- Candidate class: Prototype Pollution / CWE-1321
- Affected component: `src/merge.js`
- Affected function: `mergeDeep()`
- Verification date: 2026-04-28

Missing before submission:
- Exact tested version.
- Local reproducer showing attacker-controlled JSON reaching `mergeDeep()`.
- Observed result, such as prototype pollution on a clean object.
- Authentication and precondition details for the host application.

Minimum next step: test a published version locally, record the source -> sink -> guard path, and include the observed result before drafting VulDB form fields.
