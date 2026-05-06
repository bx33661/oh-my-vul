# Disclosure And Submission Walkthrough

中文版本见下方。

## English

This walkthrough uses sanitized placeholders only. After a finding validates and the report draft is ready, run:

```sh
/omv-critic demo-finding
/omv-report demo-finding
/omv-disclose timeline demo-finding
```

Record platform bookkeeping locally:

```sh
omv submissions record demo-finding --platform vuldb --submission-id 12345 --url https://example.test/submission/12345
omv submissions track demo-finding
omv submissions close demo-finding --cve CVE-2026-12345
```

Local state under `.omv/submissions/` and `.omv/notes/` may contain private research details. Sanitize before sharing snippets in advisories or public issues.

## 中文

本 walkthrough 只使用脱敏占位符。当 finding 已通过校验并生成报告草稿后，运行：

```sh
/omv-critic demo-finding
/omv-report demo-finding
/omv-disclose timeline demo-finding
```

本地记录提交状态：

```sh
omv submissions record demo-finding --platform vuldb --submission-id 12345 --url https://example.test/submission/12345
omv submissions track demo-finding
omv submissions close demo-finding --cve CVE-2026-12345
```

`.omv/submissions/` 和 `.omv/notes/` 里的内容可能包含私有研究细节。公开披露或复制到 issue/advisory 前必须先脱敏。
