# omv-find-research-radar Specification

## Purpose
Define research-radar behavior for `omv-find`, including portfolio lanes, pattern-pack discovery, diff signals, novelty checks, duplicate risk, audit readiness, and request diagnostics.

## Requirements
### Requirement: Finder supports research portfolio lanes
`omv-find` SHALL classify strong candidates into research portfolio lanes while preserving the existing ranked table output.

#### Scenario: Candidate has a quick local validation path
- **WHEN** a candidate has a small focused codebase, exact source->sink->guard evidence, and an obvious first unit test or harness
- **THEN** the finder marks it as a `fast-win` lane candidate and includes the local validation entry point

#### Scenario: Candidate needs deeper review
- **WHEN** a candidate has meaningful impact or complex reachability but requires multi-file review before confidence is high
- **THEN** the finder marks it as a `deep-audit` lane candidate and explains the unresolved reachability question

#### Scenario: Candidate is interesting because of recent change
- **WHEN** a candidate's recent public commit, release, or file change adds or weakens a risky parser, loader, fetcher, renderer, importer, upload path, or guard
- **THEN** the finder marks it as a `diff-alert` lane candidate with exact public change evidence or `未确认` if the evidence could not be verified

#### Scenario: Candidate has understated supply-chain reach
- **WHEN** a candidate has low stars but verified downloads, dependents, importers, or toolchain usage that suggest meaningful downstream exposure
- **THEN** the finder marks it as an `underrated` lane candidate and cites the verified reach signal

### Requirement: Finder supports pattern-pack discovery
`omv-find` SHALL support research playbooks that combine ecosystem hints, vulnerability classes, source types, sinks, and guards.

#### Scenario: User requests an archive extraction playbook
- **WHEN** the user asks for archive extractor targets or equivalent natural-language scope
- **THEN** the finder prioritizes packages with archive entry names, filenames, extraction helpers, filesystem write sinks, and path normalization guards

#### Scenario: User requests rendering pipeline targets
- **WHEN** the user asks for markdown, HTML, template, or renderer targets
- **THEN** the finder prioritizes packages with renderer inputs, sanitizer or sandbox boundaries, and HTML/template execution sinks

#### Scenario: Playbook spans multiple vulnerability aliases
- **WHEN** a playbook maps to more than one vulnerability class
- **THEN** the finder records the playbook name separately from `vuln_direction` instead of collapsing it into a single alias

### Requirement: Finder uses bounded passive diff signals
`omv-find` SHALL use recent public repository changes as an optional ranking signal without exceeding explicit source inspection budgets.

#### Scenario: Recent risky commit is verifiable
- **WHEN** public metadata identifies a recent commit or release that touches a risky file or guard
- **THEN** the finder includes the commit, file, or release reference in the candidate's risk evidence or radar context

#### Scenario: Diff evidence cannot be verified cheaply
- **WHEN** rate limits, missing metadata, non-GitHub hosting, or budget limits prevent diff verification
- **THEN** the finder records the diff signal as `未确认` and does not let it dominate the candidate score

### Requirement: Finder scores novelty and duplicate resistance
`omv-find` SHALL adjust candidate ranking based on passive duplicate and novelty signals.

#### Scenario: Public advisory appears to match the same issue
- **WHEN** advisory, CVE, GHSA, issue, or release-note evidence strongly matches the same package, vulnerability class, affected behavior, and sink
- **THEN** the finder lowers the candidate score or marks it as likely duplicate with a concise reason

#### Scenario: Package name overlaps but behavior does not match
- **WHEN** only package-name overlap is found without matching vulnerability class and sink behavior
- **THEN** the finder does not mark the candidate as duplicate and records the duplicate check as inconclusive

### Requirement: Finder emits audit-readiness notes
`omv-find` SHALL include concise audit-readiness notes for high-ranked candidates.

#### Scenario: Candidate has enough evidence for local review
- **WHEN** a candidate includes exact source->sink->guard evidence
- **THEN** the finder includes the first file/function to inspect, one local unit test or harness idea, the guard expected to accept or reject the input, and any blocker that prevents confirmation

#### Scenario: Candidate lacks exact source evidence
- **WHEN** a candidate is metadata-strong but source evidence is missing or weak
- **THEN** the finder marks audit readiness as low and explains which source path, guard, or reachability fact remains unverified

### Requirement: Finder remains passive and compatible with existing fetch strategy
`omv-find` SHALL keep all research radar behavior passive, local, and compatible with existing source fetch requirements.

#### Scenario: Radar mode inspects source
- **WHEN** the finder inspects source files for radar scoring
- **THEN** it follows the existing manifest-first source resolution and per-candidate fetch budget requirements

#### Scenario: Radar output suggests next steps
- **WHEN** the finder recommends follow-up work
- **THEN** it limits next steps to local code review, local unit tests, fuzz harness ideas, sanitizer checks, path normalization traces, and similar non-destructive activities

### Requirement: Finder helper scripts classify request failures
`omv-find` helper scripts SHALL report external request failures with stable refusal categories instead of opaque transport errors.

#### Scenario: GitHub API rate limit blocks metadata
- **WHEN** a GitHub API request returns a rate-limit response such as HTTP 403 or HTTP 429
- **THEN** the helper reports `rate_limited`, includes the HTTP status and URL, and continues with any available registry metadata or archive fallback

#### Scenario: Source path is missing
- **WHEN** a raw source request or metadata request indicates HTTP 404
- **THEN** the helper reports `not_found` instead of treating the candidate as disproven

#### Scenario: Request needs authentication
- **WHEN** a GitHub API request can use `GITHUB_TOKEN` or `GH_TOKEN`
- **THEN** the helper uses the token for GitHub API calls while still supporting unauthenticated operation

### Requirement: Finder source resolver emits stable fallbacks
`omv-find` source resolution helpers SHALL prefer manifest-derived fallbacks that reduce failed raw GitHub requests.

#### Scenario: npm package exposes a tarball
- **WHEN** the npm registry manifest includes `dist.tarball`
- **THEN** the resolver includes `source_archive_url` so source inspection can fall back to the registry archive when raw GitHub is blocked or path resolution is uncertain

#### Scenario: PyPI package exposes an sdist
- **WHEN** the PyPI metadata includes an sdist URL
- **THEN** the resolver includes `source_archive_url` so source inspection can fall back to the package archive

#### Scenario: GitHub default branch is discoverable
- **WHEN** the resolver can read the GitHub repository metadata
- **THEN** it uses the repository default branch instead of assuming `main`

#### Scenario: GitHub default branch is blocked
- **WHEN** default branch lookup is rate-limited or otherwise refused
- **THEN** the resolver records `default_branch_error`, falls back to `main`, and includes alternate branch fallback URLs

### Requirement: CLI exposes request broker diagnostics
The `omv` CLI SHALL expose request health and single-URL fetch diagnostics for finder metadata sources.

#### Scenario: User checks request health
- **WHEN** the user runs `omv request preflight`
- **THEN** the CLI checks representative public metadata sources, reports pass/warn/fail state, and records whether each result came from cache

#### Scenario: User fetches one URL through the broker
- **WHEN** the user runs `omv request fetch <url>`
- **THEN** the CLI fetches the URL with the shared request classification rules, stores a local cache entry, and reports status, cache path, response size, body hash, and failure reason when applicable

#### Scenario: User requests machine-readable output
- **WHEN** the user passes `--json` to a request broker command
- **THEN** the CLI emits structured JSON containing the same request status, cache, and failure fields used by the human-readable output

#### Scenario: Cached response exists
- **WHEN** a fresh cache entry exists for the URL and `--refresh` is not passed
- **THEN** the CLI returns the cached result without making another network request

#### Scenario: Response contains sensitive headers
- **WHEN** a fetched response includes headers such as `set-cookie`, `cookie`, or `authorization`
- **THEN** the CLI excludes those headers from request broker output and cache files

#### Scenario: Source reports rate-limit headers
- **WHEN** a response includes rate-limit headers
- **THEN** the CLI emits a structured `rateLimit` object and a recommendation when the remaining quota is exhausted

### Requirement: Documentation explains request reliability workflow
The project documentation SHALL explain how request broker diagnostics fit into finder workflows.

#### Scenario: User reads README
- **WHEN** the user reads the project README
- **THEN** they find the request preflight and single-URL fetch commands, cache location, failure classes, token behavior, and a link to detailed request broker documentation

#### Scenario: User reads best-practices guidance
- **WHEN** the user reads vulnerability research best-practices guidance
- **THEN** they find instructions to treat request refusals as research-state signals instead of proof that a candidate is invalid
