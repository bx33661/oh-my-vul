# Swift Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## Path traversal: URL/path construction

- Source pattern: HTTP parameter, user input field, filename from API response, or deep link parameter controls a file path.
- Sink signature: `FileManager.default.contents(atPath:)`, `Data(contentsOf: url)`, `String(contentsOfFile:)`.
- Common misuse: user-controlled path component is appended to a base URL/path without canonicalization or containment check.
- Expected guard: resolve symbolic links, canonicalize path, verify resolved path is within intended sandbox directory, reject `..` components.
- Evidence criteria: show user input source, path construction, file read/write sink, and missing containment validation.
- False-positive checks: path is from app bundle (read-only), input is validated against enum, or sandbox prevents escape.
- CWE: CWE-22

## Insecure TLS: disabled certificate validation

- Source pattern: URLSession delegate, Alamofire ServerTrustManager, or custom TLS configuration disables certificate validation.
- Sink signature: `urlSession(_:didReceive challenge:)` returning `.useCredential` unconditionally, `ServerTrustManager(evaluators: [host: DisabledTrustEvaluator()])`.
- Common misuse: certificate validation is disabled for all hosts or production builds, enabling MITM attacks.
- Expected guard: only disable for specific debug hosts behind compile-time flags, use certificate pinning for sensitive endpoints.
- Evidence criteria: show trust evaluation override, scope of disabled validation, and absence of build-configuration guard.
- False-positive checks: disabled only in DEBUG builds, limited to local development hosts, or pinning is applied for production.
- CWE: CWE-295

## SQL injection: raw query in Core Data/SQLite

- Source pattern: user input from text field, search query, or URL parameter is interpolated into a raw SQL or NSPredicate string.
- Sink signature: `sqlite3_exec(db, "SELECT ... \(input) ...")`, `NSPredicate(format: "name == '\(input)'")`.
- Common misuse: string interpolation in SQL or predicate format strings without parameterization.
- Expected guard: use `?` placeholders with `sqlite3_bind_text`, or `NSPredicate(format:argumentArray:)` with `%@` substitution.
- Evidence criteria: show user input source, string interpolation in query/predicate, execution sink, and missing parameterization.
- False-positive checks: input is numeric-only, query uses bound parameters, or predicate uses %@ with argument array.
- CWE: CWE-89
