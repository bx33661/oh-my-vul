# Output Contract

Use this final structure for successful candidate lists.

## Table

| 排名 | 项目 | 生态 | 仓库 | Registry | Stars | 最近维护 | 规模估计 | 输入面 | 风险证据 | 可能方向 | 推荐切入 | 评分 |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|

Column requirements:

- **项目**: package name, linked when useful.
- **仓库**: verified GitHub URL.
- **Registry**: registry link or `未确认`.
- **规模估计**: include method, such as `cloc: 18k LOC`, `tokei: 7k LOC`, `find/wc: 12k LOC`, `GitHub estimate`, or `未确认`.
- **风险证据**: concise source -> sink -> guard note with exact file/function path or link.
- **推荐切入**: first file, function, or test area to inspect.
- **评分**: e.g. `78/100`.

## Follow-up Sections

After the table, add:

1. **审计建议**: one short paragraph per project. Start from the evidence path, then suggest two passive/local next steps such as writing unit tests, building a local harness, checking sanitizer behavior, tracing path normalization, or fuzzing a parser locally.
2. **数据新鲜度与限制**: state verification date, primary sources used, scripts used if any, rate-limit/network limitations, and any `未确认` fields.

## Confirmed Finding Handoff

When the user asks to turn a confirmed finding into a report, write or output an Evidence.v1 file instead of a loose prose handoff.

Preferred local workflow:

```sh
omv findings init <id> --status confirmed
omv findings validate <id>
```

Then fill `.omv/findings/<id>.yaml` using `contracts/evidence.v1.yaml`.

If file writing is unavailable, append this structure after the normal analysis:

```text
Evidence file: .omv/findings/<id>.yaml
Validation command: omv findings validate <id>
```

Follow it with a fenced YAML block that matches `contracts/evidence.v1.yaml`.

Rules:

- Use `status: confirmed` only when a tested version, source -> sink -> guard evidence, local reproducer, and impact requirements are known.
- Use `status: candidate` for promising but unproven findings.
- Use `status: blocked` when a duplicate CVE is likely, a tested version is missing, the source path is not attacker controlled, or the only trigger is developer-owned code/config.
- Mark unknown fields as `unknown` or list them under `provenance.unverified_fields`; do not fill them from memory.

## Invalid Request Template

For invalid flags, do not output a project table. Use a concise message:

```text
无法运行这个范围：`--lang <value>` 或 `--vuln <value>` 无效，或 `--count` 超出范围。

有效 `--lang`: npm, python, go, rust, java, ruby, php, csharp, swift, dart, elixir, perl, r, lua, all
有效 `--vuln`: proto, traversal, ssrf, injection, xss, redos, yaml, unsafe, deser, race, overflow, auth, csrf, xxe, sql, ssti, sandbox, redirect, upload, crypto, infoleak
有效 `--count`: 1-20
```

## Sparse Result Template

When the requested ecosystem/vulnerability pair has too few strong candidates:

```text
这个组合下高质量候选不足。我没有硬凑 `--count` 个结果；下面只列出能验证到 source -> sink -> guard 证据的候选。
```

## Safety Language

Do not describe live exploitation. Phrase next steps as local review:

- build a local unit test
- trace normalization logic
- inspect sanitizer config
- add fuzz cases for parser input
- compare safe/unsafe loader options
- review whether a guard applies before the sink
