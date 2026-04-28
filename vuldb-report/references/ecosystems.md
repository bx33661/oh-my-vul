# Ecosystem Reference

## Quick-lookup table

| Ecosystem | Language | Vendor field | Product field | Wrong vendor |
|---|---|---|---|---|
| npm | JavaScript / TypeScript | GitHub org or project name | package name | `npm` ✗ |
| pip | Python | Author name or org (e.g. `Pallets`) | package name (e.g. `Flask`) | `PyPI` ✗ |
| Go modules | Go | GitHub org or company | module short name (e.g. `gin`) | `pkg.go.dev` ✗ |
| Cargo | Rust | Crate author or org | crate name (e.g. `serde`) | `crates.io` ✗ |
| RubyGems | Ruby | Gem author or org | gem name (e.g. `nokogiri`) | `RubyGems` ✗ |
| Maven | Java / Kotlin | Organization (e.g. `Apache`) | artifactId (e.g. `log4j-core`) | `Maven Central` ✗ |
| Gradle | Java / Kotlin | Same as Maven | Same as Maven | `Gradle` ✗ |
| NuGet | C# / .NET | Author or company | package ID (e.g. `Newtonsoft.Json`) | `NuGet` ✗ |
| Composer | PHP | Vendor part of package name (e.g. `laravel`) | package part (e.g. `framework`) | `Packagist` ✗ |
| CocoaPods | Swift / ObjC | Pod author or org | pod name (e.g. `Alamofire`) | `CocoaPods` ✗ |
| Swift Package Manager | Swift | GitHub org or author | package name | `Swift Package Index` ✗ |
| pub | Dart / Flutter | Package author or org | package name (e.g. `dio`) | `pub.dev` ✗ |
| Hex | Elixir / Erlang | Package author or org | package name (e.g. `plug`) | `Hex` ✗ |
| CPAN | Perl | Author PAUSE ID or org | distribution name (e.g. `Mojolicious`) | `CPAN` ✗ |
| CRAN | R | Author name | package name (e.g. `ggplot2`) | `CRAN` ✗ |
| LuaRocks | Lua | Rock author or org | rock name (e.g. `luasocket`) | `LuaRocks` ✗ |

The registry or package index is never the vendor. The vendor is the person or organisation responsible for the code.

---

## Version Verification Commands

Confirm the exact affected version before writing the report. Go module versions carry a `v` prefix — write `up to and including v1.9.0`, not `1.9.0`.

```bash
# npm (JavaScript / TypeScript)
npm view <package> version            # latest
npm view <package> versions           # all published versions

# pip (Python)
pip index versions <package>          # pip 21.2+
pip install <package>==               # older pip — error output lists all versions

# Go modules
go list -m -versions <module-path>
# e.g.: go list -m -versions github.com/gin-gonic/gin
# Or browse: https://pkg.go.dev/<module>?tab=versions

# Cargo (Rust)
cargo search <crate>                  # latest
# All versions: https://crates.io/crates/<crate>/versions

# RubyGems (Ruby)
gem list -r <gem>                     # latest available
gem list -r -a <gem>                  # all versions
# Or browse: https://rubygems.org/gems/<gem>/versions

# Maven / Gradle (Java / Kotlin)
# Browse: https://search.maven.org/artifact/<groupId>/<artifactId>
# Or: https://mvnrepository.com/artifact/<groupId>/<artifactId>
# Programmatic: https://search.maven.org/solrsearch/select?q=a:<artifactId>+g:<groupId>&core=gav

# NuGet (C# / .NET)
dotnet package search <package>       # .NET 8+
# Or browse: https://www.nuget.org/packages/<package>/#versions-body-tab

# Composer (PHP)
composer show <vendor>/<package> --all 2>/dev/null | grep versions
# Or browse: https://packagist.org/packages/<vendor>/<package>

# CocoaPods (Swift / ObjC)
pod trunk info <PodName>
# Or browse: https://cocoapods.org/pods/<PodName>

# Swift Package Manager
# Browse the GitHub repo tags — SPM uses git tags for versions

# pub (Dart / Flutter)
dart pub info <package>               # latest
# All versions: https://pub.dev/packages/<package>/versions

# Hex (Elixir / Erlang)
mix hex.info <package>                # latest
# All versions: https://hex.pm/packages/<package>

# CPAN (Perl)
cpan -D <Module>                      # info including version
# Or browse: https://metacpan.org/dist/<Distribution>

# CRAN (R)
available.packages()[["<package>","Version"]]   # in R session
# Or browse: https://cran.r-project.org/package=<package>

# LuaRocks (Lua)
luarocks search <rock>
# Or browse: https://luarocks.org/modules?q=<rock>
```

---

## Proof of Concept — Install Commands by Ecosystem

```bash
# npm
npm install <package>@<version>

# pip
pip install <package>==<version>

# Go
go get <module-path>@<version>
# e.g.: go get github.com/gin-gonic/gin@v1.9.0

# Cargo
cargo add <crate>@<version>
cargo build

# RubyGems
gem install <gem> -v <version>
# or in Gemfile: gem '<gem>', '<version>'

# Maven (add to pom.xml)
# <dependency>
#   <groupId>com.example</groupId>
#   <artifactId>package</artifactId>
#   <version>1.2.3</version>
# </dependency>
mvn dependency:resolve

# Gradle (add to build.gradle)
# implementation 'com.example:package:1.2.3'
gradle dependencies

# NuGet
dotnet add package <PackageId> --version <version>

# Composer
composer require <vendor>/<package>:<version>

# CocoaPods (add to Podfile)
# pod '<PodName>', '<version>'
pod install

# Swift Package Manager (add to Package.swift)
# .package(url: "https://github.com/...", exact: "<version>")
swift package resolve

# pub
dart pub add <package>:<version>
# or in pubspec.yaml: <package>: <version>

# Hex (add to mix.exs)
# {:plug, "~> <version>"}
mix deps.get

# CPAN
cpanm <Module>@<version>

# CRAN (in R session)
install.packages("<package>")
# specific version via remotes:
remotes::install_version("<package>", version = "<version>")

# LuaRocks
luarocks install <rock> <version>
```

---

## Duplicate CVE Search — by Ecosystem

Search before submitting. A duplicate found after submission causes rejection.

| Ecosystem | Where to search |
|---|---|
| **All ecosystems** | NVD (`nvd.nist.gov`) · GitHub Advisory (`github.com/advisories`) · Snyk · OSV (`osv.dev`) |
| npm | `npmjs.com/advisories` · `socket.dev` |
| pip | PyPI project page → Security tab · `osv.dev` |
| Go | `vuln.go.dev` (Go Vulnerability Database) · `osv.dev` |
| Cargo | `rustsec.org/advisories` (RustSec Advisory DB) · `osv.dev` |
| RubyGems | `rubysec.github.io` (Ruby Advisory DB) · `osv.dev` |
| Maven / Gradle | `osv.dev` · Snyk Java DB · GitHub Advisory |
| NuGet | `osv.dev` · GitHub Advisory |
| Composer | `github.com/FriendsOfPHP/security-advisories` · `osv.dev` |
| CocoaPods / SPM | `osv.dev` · GitHub Advisory |
| pub | `osv.dev` · GitHub Advisory |
| Hex | `osv.dev` · GitHub Advisory |
| CPAN | `osv.dev` · `metacpan.org` |
| CRAN | `osv.dev` |
| LuaRocks | `osv.dev` |

Also check if a GHSA number is already assigned — a GHSA auto-triggers a CVE request, so filing VulDB alongside creates a duplicate CVE risk.

---

## GitHub GHSA — Ecosystem Dropdown Values

Use the exact string when filling the GHSA "Ecosystem" field:

| Ecosystem | GHSA dropdown value |
|---|---|
| npm | `npm` |
| pip | `pip` |
| Go | `Go` |
| Cargo | `Rust` |
| RubyGems | `RubyGems` |
| Maven | `Maven` |
| NuGet | `NuGet` |
| Composer | `Composer` |
| pub | `Pub` |
| Hex | `Erlang` |
| Swift / CocoaPods | `Swift` |
| GitHub Actions | `GitHub Actions` |

---

## CWE → VulDB Class Name

VulDB's **Class** field is plain English — do not enter the CWE number.

| Vulnerability | Class field value | CWE |
|---|---|---|
| Cross-site scripting | `Cross-Site Scripting` | CWE-79 |
| OS command injection | `Command Injection` | CWE-78 |
| Shell metacharacter injection | `Command Injection` | CWE-77 |
| Path traversal / directory traversal | `Path Traversal` | CWE-22 |
| Arbitrary file write | `Arbitrary File Write` | CWE-73 / CWE-434 |
| SQL injection | `SQL Injection` | CWE-89 |
| Authentication bypass | `Authentication Bypass` | CWE-287 / CWE-288 |
| Privilege escalation | `Privilege Escalation` | CWE-269 / CWE-862 |
| SSRF | `Server-Side Request Forgery` | CWE-918 |
| Prototype pollution (JS) | `Prototype Pollution` | CWE-1321 |
| Unsafe deserialization | `Deserialization` | CWE-502 |
| ReDoS / algorithmic complexity | `Denial of Service` | CWE-1333 |
| Information disclosure | `Information Disclosure` | CWE-200 |
| XML external entity (XXE) | `XML External Entity` | CWE-611 |
| Server-side template injection | `Code Injection` | CWE-94 |
| Open redirect | `Open Redirect` | CWE-601 |
| Insecure deserialization (Java) | `Deserialization` | CWE-502 |
| Buffer overflow / memory corruption | `Memory Corruption` | CWE-120 / CWE-787 |
| Use-after-free (Rust unsafe / C) | `Memory Corruption` | CWE-416 |
| Integer overflow | `Numeric Error` | CWE-190 |
| Race condition / TOCTOU | `Race Condition` | CWE-362 |

When in doubt, choose the more conservative (less severe-sounding) class — CWE inflation erodes reviewer trust.
