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
