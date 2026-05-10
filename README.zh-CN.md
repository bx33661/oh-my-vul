# oh-my-vul

<p align="center">
  <strong>面向 Claude Code 的证据优先漏洞研究技能集合。</strong>
</p>

<p align="center">
  <a href="https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml"><img src="https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml/badge.svg" alt="validate"></a>
  <a href="https://www.npmjs.com/package/oh-my-vul"><img src="https://img.shields.io/npm/v/oh-my-vul" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="license: MIT"></a>
</p>

<p align="center">
  <a href="README.md">English</a>
  ·
  <a href="docs/vulnerability-research-best-practices.zh-CN.md">漏洞挖掘最佳实践</a>
  ·
  <a href="RELEASE.md">发布指南</a>
</p>

> **定位：** `oh-my-vul` 用来辅助研究员发现值得审计的开源项目，整理 **source -> sink -> guard** 证据链，并把已确认的问题转成适合提交给 **VulDB**、**CVE**、**GHSA**、**OSV** 或 Markdown advisory 的报告草稿。
>
> **安全边界：** 本项目只面向*被动研究*和*本地验证*。它不是批量扫描器，也不是线上攻击工具。

---

## 一眼看懂

| 模块 | 能力 |
|---|---|
| **目标发现** | `/omv-find` 找出值得审计的开源包和代码入口。 |
| **证据账本** | `.omv/findings/*.yaml` 保存结构化 Evidence.v1 研究状态。 |
| **深度审计** | `/omv-audit` 用 source -> sink -> guard 证明或否定候选漏洞。 |
| **本地复现** | `/omv-repro` 记录用户真实本地观测和复现材料。 |
| **报告生成** | `/omv-report` 从 validated finding 生成审稿友好的报告草稿。 |
| **请求可靠性** | `omv request ...` 识别限流、拒绝、来源健康和缓存元数据请求。 |
| **CLI 管理** | `omv dashboard`、`omv doctor`、`omv findings ...` 管理本地状态。 |

## 快速开始

```sh
npx oh-my-vul setup
omv doctor
omv request preflight
```

如果没有全局安装 `omv`，用 npx 临时运行：

```sh
npx -p oh-my-vul omv doctor
```

在 Claude Code 中使用典型流程：

```text
/omv-find --lang npm --vuln traversal --count 10

omv findings init demo-traversal
/omv-audit demo-traversal
omv repro init demo-traversal
/omv-repro demo-traversal
omv findings validate demo-traversal
omv findings doctor demo-traversal

/omv-report demo-traversal
omv report artifacts demo-traversal
```

<details>
<summary><strong>安装选项</strong></summary>

用户级安装：

```sh
npx oh-my-vul setup
```

项目级安装：

```sh
npx oh-my-vul setup --scope project
```

常用参数：

```sh
npx oh-my-vul setup --force
npx oh-my-vul setup --dry-run
npx oh-my-vul setup --json
omv doctor --json
omv doctor --strict
omv version --json
```

项目级安装会写入 `.omv/setup-scope.json`，让 `omv doctor` 自动识别当前项目使用 user 还是 project scope。

</details>

## 工作流

```text
/omv-find
  -> 候选项目和源码入口
  -> .omv/findings/<id>.yaml
  -> /omv-audit
  -> omv repro init <id>
  -> /omv-repro
  -> omv findings validate <id>
  -> omv findings doctor <id>
  -> /omv-report
  -> omv report artifacts <id>
  -> 提交前报告草稿
```

**重点：** `oh-my-vul` 区分*证据完整度*和*提交就绪度*。字段填得多不等于漏洞已经可提交；缺少本地观测、存在 blocker、版本边界不清或可利用性未证明时，仍应保持 `candidate` 或 `blocked`。

## 包含的技能

| 技能 | 命令 | 用途 |
|---|---|---|
| `omv` | `/omv` | 查看本地工作区状态、活跃 finding、归档状态和已安装技能 |
| `omv-find` | `/omv-find` | 发现并排序值得审计的开源包 |
| `omv-audit` | `/omv-audit` | 深入审计候选 finding，补齐 Evidence.v1 证据字段 |
| `omv-repro` | `/omv-repro` | 引导本地复现，记录真实 observed_result |
| `omv-report` | `/omv-report` | 从 confirmed finding 生成 VulDB/CVE/GHSA/OSV 报告草稿 |
| `omv-radar` | `/omv-radar` | 被动 watchlist 情报，刷新 advisory/release 信号 |
| `omv-dedup` | `/omv-dedup` | 去重分析，生成 NVD/GHSA/OSV/生态查询并更新 Evidence.v1 |
| `omv-disclose` | `/omv-disclose` | 负责任披露生命周期辅助，包括时间线和沟通草稿 |
| `omv-critic` | `/omv-critic` | 提交前反向审稿，找出可能被 CNA 或平台拒绝的原因 |

## 发现审计目标

```text
/omv-find --lang npm --vuln traversal --count 10
/omv-find --lang python --vuln injection keyword
/omv-find --lang all --count 12 markdown parser
```

<details>
<summary><strong>支持语言和漏洞类型</strong></summary>

支持的语言：

```text
npm python go rust java ruby php csharp swift dart elixir perl r lua all
```

支持的漏洞类型别名：

```text
proto traversal ssrf injection xss redos yaml unsafe deser race overflow auth
csrf xxe sql ssti sandbox redirect upload crypto infoleak
```

</details>

`/omv-find` 应输出带证据的候选结果，包括仓库、注册表身份、维护活跃度、代码规模估计、**source -> sink -> guard** 笔记和下一步本地审计建议。

## 请求可靠性

`/omv-find` 经常要读取公开 registry 元数据、GitHub 元数据、raw 源码文件和源码归档。这些来源可能限流、拒绝、路径不存在或临时不可用。请求密集型研究前，先用 TypeScript request broker 检查来源健康：

```sh
omv request preflight
omv request preflight --json --refresh
omv request fetch https://registry.npmjs.org/markdown-it --json
omv request fetch https://api.github.com/repos/owner/repo --accept application/json --refresh
```

broker 会把缓存写入 `.omv/cache/http/`，脱敏响应头，并输出结构化 `failure.reason`、`rateLimit`、`expiresAt` 和 `recommendation`。如果环境里有 `GITHUB_TOKEN` 或 `GH_TOKEN`，GitHub API 请求会自动使用 token。

常见失败分类包括 `rate_limited`、`auth_required`、`bot_blocked_or_forbidden`、`not_found`、`network_timeout`、`network_error`、`upstream_error` 和 `invalid_url`。这些分类应作为研究状态信号：相关字段保持未确认，优先使用 registry/source archive fallback，不要反复重试已经被拒绝的 URL。

完整行为、JSON 字段、缓存策略和 Playwright 评估见 [docs/request-broker.zh-CN.md](docs/request-broker.zh-CN.md)。

## Evidence 账本

项目本地研究状态保存在 `.omv/findings/`。这些文件默认应视为私有研究记录，不应直接发布。

```sh
omv findings init demo-traversal
omv findings workflow
omv findings show demo-traversal
omv findings validate demo-traversal
```

Evidence 文件遵循 [contracts/evidence.v1.yaml](contracts/evidence.v1.yaml)。confirmed finding 必须通过字段级校验，包括：

- 测试版本
- source/sink/guard 证据
- 本地 reproducer
- 用户报告的 observed result
- CVSS 向量
- 去重状态
- unknown 字段记录

<details>
<summary><strong>状态含义</strong></summary>

| 状态 | 含义 |
|---|---|
| `candidate` | 有潜力，但证据不完整 |
| `confirmed` | tested version、source、sink、guard、reproducer、observed_result 等关键证据已知 |
| `blocked` | 证据链断裂、疑似重复、无法复现，暂不应继续报告 |

更新状态：

```sh
omv findings promote demo-traversal --status confirmed
omv findings promote demo-traversal --status blocked
```

</details>

## 生成报告

当 finding 通过验证后，运行：

```text
/omv-report <id>
```

`/omv-report` 会根据 Evidence.v1 内容生成平台化报告草稿，并尽量避免常见拒稿问题：

- **不把未验证字段默认为事实**
- **candidate 或 blocked 不生成 submission-ready 报告**
- **提醒重复 CVE/CNA 风险**
- 针对 VulDB、GHSA、OSV、Markdown 选择合适格式
- 保持 PoC 语言克制，只面向本地验证和审稿

## 安全边界

`oh-my-vul` 只支持**非破坏性研究**：

- 只阅读公开元数据和公开源码
- 优先使用本地测试、本地 harness 和可复现实验
- 不攻击第三方线上服务
- 不生成凭据窃取、数据外传或滥用 payload
- 未验证结论必须标记为未验证

## 要求

- **Claude Code**
- **Node.js 20 或更高版本**

## 文档

| 文档 | 用途 |
|---|---|
| [README.md](README.md) | 英文项目指南 |
| [docs/request-broker.zh-CN.md](docs/request-broker.zh-CN.md) | 请求代理、失败分类、缓存和 Playwright 评估 |
| [docs/request-broker.md](docs/request-broker.md) | 英文 request broker 指南 |
| [docs/vulnerability-research-best-practices.zh-CN.md](docs/vulnerability-research-best-practices.zh-CN.md) | 使用本项目做漏洞研究的最佳实践 |
| [docs/examples/demo-finding-flow.md](docs/examples/demo-finding-flow.md) | 脱敏的端到端 finding 工作流示例 |
| [docs/roadmap-0.8.md](docs/roadmap-0.8.md) | `v0.8` CLI 改进计划 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 开发与贡献规则 |
| [SECURITY.md](SECURITY.md) | 报告本项目安全问题 |
| [RELEASE.md](RELEASE.md) | 发布与兼容性检查 |
| [contracts/README.md](contracts/README.md) | Evidence.v1 等共享 schema |

## 开发

```sh
npm install
npm run sync-metadata
npm run sync-assets
npm run validate
npm run release:check
npm run pack:check
```

<details>
<summary><strong>发布前检查</strong></summary>

```sh
npm view oh-my-vul version
npm run release:check
npm pack --dry-run
npm publish --access public
```

`package.json` 是发布版本的事实来源。metadata sync 会同步 registry 和生成文档。

</details>

## 许可证

MIT
