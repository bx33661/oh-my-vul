# Repro Guide

## 环境准备框架

### 版本固定

始终安装与 `versions.tested` 完全一致的版本，不接受 "latest" 或近似版本：

```bash
# npm
npm install <package>@<version>

# PyPI
pip install <package>==<version>

# Go
go get <module>@v<version>

# Ruby
gem install <gem> -v <version>
```

版本验证：安装后确认实际版本号与 `versions.tested` 一致，再进行复现。

### 沙箱隔离建议

- **npm/Node**：使用独立空目录，`npm init -y` 后再安装目标包，避免全局依赖污染
- **Python（macOS/Linux）**：使用 `python3 -m venv .venv && source .venv/bin/activate`，保持环境干净
- **Python（Windows PowerShell）**：使用 `py -3 -m venv .venv; .\.venv\Scripts\Activate.ps1`，保持环境干净
- **Go**：使用独立 `go.mod` 模块目录
- 通用原则：复现结束后可删除整个目录，不污染开发环境

### 依赖安装验证

安装完成后，执行以下检查再进入复现步骤：

1. 确认包版本：`npm list <pkg>` / `pip show <pkg>` / `go list -m all`
2. 确认入口文件可读：如 `node -e "require('<pkg>')"` 不报错
3. 若有编译步骤，先确认编译成功

---

## 观测结果记录规范

### 什么是充分的观测

`evidence.observed_result` 必须包含足以判断漏洞真实存在的具体信息，不能只写"运行成功"或"有输出"。

**不同漏洞类型的关键指标**：

| 漏洞类型 | 必须包含的观测指标 |
|---|---|
| 路径穿越 / 文件读取 | 目标文件的实际内容片段（如 `/etc/passwd` 前几行） |
| SSRF | HTTP 响应状态码 + 响应体片段，或 DNS 解析日志 |
| XSS / Injection | 注入内容出现在输出中的截图描述或输出片段 |
| 原型污染 | 受影响对象的属性值变化（如 `{}.polluted === true`） |
| 命令注入 | 命令执行的 stdout/stderr 输出片段 |
| ReDoS | 耗时数据：正常输入 vs 恶意输入的耗时对比（ms） |
| 反序列化 | 触发的异常类型 + 堆栈跟踪片段，或代码执行证据 |

### 记录格式

写入 `evidence.observed_result` 时使用以下格式：

```
<执行的具体命令或操作> → <实际观测到的输出/行为>
```

示例：
```
node -e "const plugin = require('markdown-it-include'); ..."
执行后输出包含 /etc/passwd 前三行：
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
```

### 如何从用户输出中提取关键指标

当用户粘贴执行输出时：
1. 识别与 sink 行为直接相关的输出行（忽略无关的 warning/info）
2. 向用户追问缺失的关键指标（如只看到"文件已创建"但没有文件内容）
3. 确认观测结果可被第三方复现，而非仅当前环境特有

---

## 复现失败排查框架

### 三类常见失败及识别信号

**类型 1：版本差异**

识别信号：
- 用户报告行为与 reproducer 描述不符
- 输出显示 "TypeError" 或方法不存在（新版 API 变更）
- guard 表现异常（旧版无此 guard，新版有）

处理路径：
1. 确认用户当前安装版本 vs `versions.tested`
2. 引导安装精确版本后重试
3. 若漏洞已在新版修复，在 `blockers` 中记录 "已在 vX.Y.Z 修复，复现需使用 vA.B.C"

**类型 2：Guard 触发**

识别信号：
- 输出包含安全异常、403/400 错误、输入被清理后变形
- 输出与预期 sink 行为完全不同，但程序正常运行

处理路径：
1. 记录 guard 触发的具体信息（异常类型、拦截位置）
2. 更新 `evidence.guard` 为"存在且有效"
3. 建议用户回到 `/omv-audit` 重新评估 guard 可绕过性
4. 若 guard 确实有效，结论为不可复现，标 `blocked`

**类型 3：环境缺失**

识别信号：
- 安装失败（网络、权限、编译依赖）
- 依赖冲突（peer dependency mismatch）
- 闭源或私有依赖无法获取

处理路径：
1. 对于网络/权限问题，引导用户排查（代理设置、npm registry、Python mirror）
2. 对于编译依赖，建议使用 Docker 镜像复现
3. 若环境确实无法构建，在 `blockers` 中记录 "本地环境无法安装：<具体原因>"，标 `blocked`

### 何时升级为 blocked vs 继续尝试

**直接标 blocked（不继续尝试）**：
- 已尝试 2+ 种方法均失败，且失败原因是结构性的（闭源依赖、平台限制）
- Guard 触发且分析确认无法绕过
- 版本在用户可用范围内均已修复

**继续尝试（换方法）**：
- 第一次失败原因是环境配置问题（版本、路径、权限）
- 用户报告的输出暗示正确路径已触发但观测不充分
- reproducer 步骤存在歧义，尝试另一种解读
