| 排名 | 项目 | 生态 | 仓库 | Registry | Stars | 最近维护 | 规模估计 | 输入面 | 风险证据 | 可能方向 | 推荐切入 | 评分 | Portfolio lane | Playbooks | Diff/novelty | Duplicate risk | Audit readiness |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | synthetic-yaml-rules | python | https://github.com/example/synthetic-yaml-rules | pypi.org/project/synthetic-yaml-rules | 340 | 2026-04 | cloc: 8k LOC | user rule YAML | source uploaded rule file -> sink yaml.safe_load in rules/load.py#load_rules -> guard schema check after parse | YAML parser / auth config | rules/load.py#load_rules | 73/100 | fast-win | config-loader | novelty: no matching fixture advisory by sink behavior | low | high; local test: schema bypass fixture; blocker: plugin config source 未确认 |
| 8 | synthetic-yaml-legacy | python | https://github.com/example/synthetic-yaml-legacy | pypi.org/project/synthetic-yaml-legacy | 510 | 2026-01 | GitHub estimate: 16k LOC | imported YAML profile | source profile import -> sink yaml.load in legacy/profile.py#load_profile -> guard Loader argument missing | YAML unsafe load | legacy/profile.py#load_profile | 38/100 | 未确认 | config-loader | novelty: weak; sanitized advisory format GHSA-xxxx-yyyy-zzzz appears to match same package, yaml.load sink, and affected range | likely_duplicate; deprioritized because advisory behavior matches | medium; local test possible, but report path blocked by duplicate risk |

**Duplicate and novelty notes**

- synthetic-yaml-legacy is likely_duplicate and was deliberately lowered/deprioritized: the sanitized advisory fixture matches package, vulnerability class, sink behavior, and affected range. Do not promote it as a fresh CVE lead without disproving the match.
- synthetic-yaml-rules remains lower duplicate risk because the fixture advisory search did not match the same sink behavior.

**Audit readiness**

- synthetic-yaml-rules: high; entry rules/load.py#load_rules; local test uses a schema edge-case fixture; expected guard is schema validation before authorization-sensitive fields are consumed.
- synthetic-yaml-legacy: medium; local test is straightforward, but duplicate risk blocks report-readiness.

**数据新鲜度与限制**

验证日期: 2026-05-08. Sources used: sanitized fixture registry data, advisory fixture, and local source snippets. 未确认 fields are listed rather than inferred.
