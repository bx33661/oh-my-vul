# disclosure-lifecycle Specification

## Purpose
TBD - created by archiving change advance-intelligence-disclosure-lifecycle. Update Purpose after archive.
## Requirements
### Requirement: Disclosure template generation
`/omv-disclose` SHALL generate responsible disclosure email templates from a finding for initial contact, follow-up, and deadline reminder flows.

#### Scenario: Vendor category selects template
- **WHEN** the finding identifies a vendor as an individual maintainer, company, or foundation
- **THEN** the skill selects the corresponding disclosure template and fills package, impact, affected version, and reproduction summary fields

### Requirement: Disclosure Evidence writeback
The disclosure workflow SHALL update Evidence.v1 disclosure fields after user confirmation.

#### Scenario: Contact date is recorded
- **WHEN** the user confirms that a vendor contact was sent
- **THEN** the CLI records `disclosure.vendor_contacted`, `disclosure.contact_date`, and `disclosure.planned_disclosure_date`

### Requirement: Disclosure timeline
`omv disclose timeline <id>` SHALL print key disclosure dates for a default 90-day window and supported custom windows.

#### Scenario: Default timeline is printed
- **WHEN** the user runs `omv disclose timeline demo`
- **THEN** the CLI prints initial contact, 45-day follow-up, 7-day reminder, and planned disclosure dates

### Requirement: Submission records
`omv submissions` SHALL record and track platform submission metadata under `.omv/submissions/<id>.yaml`.

#### Scenario: Submission is recorded
- **WHEN** the user runs `omv submissions record demo --platform vuldb --submission-id 12345 --url https://example.test/submission/12345`
- **THEN** the CLI writes a local submission record associated with finding `demo`

#### Scenario: Submission is closed with CVE
- **WHEN** the user runs `omv submissions close demo --cve CVE-2026-12345`
- **THEN** the submission record is marked closed and the CVE identifier is available to archive workflows

### Requirement: Archive includes submission summary
Strict archive flows SHALL include submission status when a finding has submission records.

#### Scenario: Reported archive preserves submission metadata
- **WHEN** a finding with submission records is archived as reported
- **THEN** the archive output includes the platform, submission id, URL, status, and CVE when present

