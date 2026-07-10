# request-broker-safety Specification

## Purpose
TBD - created by archiving change harden-quality-and-request-broker. Update Purpose after archive.
## Requirements
### Requirement: Request broker accepts only public destinations
The request broker SHALL reject URLs with credentials, local hostnames, private or non-routable literal addresses, and DNS names that resolve to any non-public address before invoking the network fetch implementation.

#### Scenario: Literal loopback is rejected
- **WHEN** a request targets `http://127.0.0.1/metadata`
- **THEN** the broker returns `ok: false` with failure reason `unsafe_destination` without calling `fetch`

#### Scenario: DNS resolves to a private address
- **WHEN** the configured resolver returns a private address for an otherwise valid hostname
- **THEN** the broker returns `unsafe_destination` before calling `fetch`

#### Scenario: Public destination proceeds
- **WHEN** the URL is HTTP(S) without credentials and all resolved addresses are public
- **THEN** the broker performs the request using the existing cache and retry behavior

### Requirement: Redirects are bounded and revalidated
The request broker MUST follow redirects manually, MUST validate each resolved redirect destination with the same public-destination policy, and MUST stop after at most five redirect hops.

#### Scenario: Redirect to private destination is rejected
- **WHEN** a public response redirects to a loopback or private destination
- **THEN** the broker returns `unsafe_destination` and does not request the redirect target

#### Scenario: Redirect limit is exceeded
- **WHEN** responses continue redirecting beyond the configured maximum
- **THEN** the broker returns failure reason `too_many_redirects`

#### Scenario: Cross-host redirect drops host-specific credentials
- **WHEN** a GitHub API request redirects to a different hostname
- **THEN** request headers are recomputed and the GitHub token is not sent to the new hostname

### Requirement: Response reads are memory bounded
The request broker SHALL stream response bodies and SHALL stop reading once the configured maximum body size is exceeded.

#### Scenario: Content length is already too large
- **WHEN** a response declares a `Content-Length` above the configured maximum
- **THEN** the broker returns `response_too_large` without buffering the body

#### Scenario: Stream grows beyond the limit
- **WHEN** streamed chunks exceed the maximum despite a missing or smaller declared length
- **THEN** the broker cancels the body reader and returns `response_too_large`

#### Scenario: Bounded response retains current metadata
- **WHEN** a response body is within the limit
- **THEN** the broker returns its byte count, SHA-256, preview, sanitized headers, and cache metadata as before

### Requirement: Broker identity tracks package version
The default request User-Agent SHALL contain the installed `oh-my-vul` package version rather than a hard-coded historical version.

#### Scenario: Versioned User-Agent
- **WHEN** the broker sends a request without `OMV_USER_AGENT`
- **THEN** its User-Agent contains the version from the installed package metadata

