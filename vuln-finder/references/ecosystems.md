# Ecosystem Discovery Reference

Use this reference after parsing `--lang`. For `--lang all`, sample across core lanes first, then add extended-lane projects only when metadata and code evidence are strong.

## Valid Ecosystems

| Flag | Ecosystem | Registry source | Registry identity format |
|---|---|---|---|
| `npm` | Node.js / JavaScript / TypeScript | npm package page/API | npm package name |
| `python` | Python | PyPI project page/API | PyPI project name |
| `go` | Go | pkg.go.dev | Go module path |
| `rust` | Rust | crates.io | crate name |
| `java` | Java / JVM | Maven Central | `groupId:artifactId` |
| `ruby` | Ruby | RubyGems | gem name |
| `php` | PHP | Packagist | `vendor/package` |
| `csharp` | C# / .NET | NuGet | package ID |
| `swift` | Swift | Swift Package Index or CocoaPods | package/repo name |
| `dart` | Dart / Flutter | pub.dev | package name |
| `elixir` | Elixir / Erlang | Hex.pm | package name |
| `perl` | Perl | MetaCPAN / CPAN | distribution/module name |
| `r` | R | CRAN | package name |
| `lua` | Lua | LuaRocks | rock name |

## Maturity Lanes

Core lanes: npm, Python, Go, Rust, Java, Ruby. These have the strongest registry conventions and source-pattern guidance.

Extended lanes: PHP, C#, Swift, Dart, Elixir, Perl, R, Lua. Use these when explicitly requested or when `--lang all` needs diversity. Return fewer results if source/sink/guard evidence is thin.

## GitHub Search Shapes

Use `pushed:>=YYYY-MM-DD` with a date 12 months before the current date unless the user asks for stale projects.

```text
{keyword} language:JavaScript stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:TypeScript stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Python stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Go stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Rust stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Java stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Ruby stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:PHP stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:C# stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Swift stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Dart stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Elixir stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Perl stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:R stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
{keyword} language:Lua stars:50..3000 pushed:>=YYYY-MM-DD archived:false fork:false
```

## Keyword Rotation

| Ecosystem | Functional keywords |
|---|---|
| npm | parser, converter, cli, middleware, plugin, loader, renderer, sanitizer, zip, tar, template, yaml, markdown, html, xml, auth, jwt |
| Python | parser, converter, cli, plugin, loader, renderer, sanitizer, archive, template, yaml, markdown, html, xml, pickle |
| Go | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, html, xml, redirect, upload |
| Rust | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, html, xml, unsafe, ffi |
| Java | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, serialization, deserialization, http-client, crypto |
| Ruby | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, gem, rack, middleware |
| PHP | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, laravel-package, wordpress-plugin |
| C# | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, aspnet-middleware |
| Swift | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, upload |
| Dart | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, flutter-plugin |
| Elixir | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, phoenix-plug |
| Perl | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, cpan-module |
| R | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, rds |
| Lua | parser, converter, cli, plugin, loader, renderer, archive, template, yaml, xml, json, neovim-plugin |

## Flagship Exclusions

Drop heavily audited flagship projects and main org repos unless the user specifically requests them.

Common exclusions: Django, Flask, Express, Fastify, React, Vue, Angular, Vite, Next.js, Nuxt, webpack, Babel, TypeScript core, urllib3, requests, axios, tokio, actix, gin, echo, Beego, Fiber, Spring Framework, Spring Boot, Rails, Devise, Nokogiri core, Laravel, Symfony, WordPress core, .NET Core, ASP.NET Core, Entity Framework, Swashbuckle, Newtonsoft.Json, Alamofire, Kingfisher, SnapKit, Lottie-iOS, flutter/engine, provider, dio, getx, Phoenix Framework, Ecto, Moose, DBI, ggplot2, dplyr, tidyverse, Penlight, LuaJIT.

## Candidate Record

For each raw candidate, track:

- project name
- verified repository URL
- ecosystem
- registry URL and package/module identity, if any
- short purpose
- discovery source
- reason it may match the requested vulnerability class
