# Perl Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## Command injection: open/system with user input

- Source pattern: CGI parameter, form field, filename, or environment variable is interpolated into a shell command or two-argument open.
- Sink signature: `system("cmd $input")`, `open(FH, "| $input")`, `` `$cmd $input` ``, `exec("$cmd $input")`.
- Common misuse: user-controlled string is interpolated into shell commands without escaping or argument list form.
- Expected guard: use list-form system/exec (`system("cmd", @args)`), avoid shell interpolation, validate input against allowlist.
- Evidence criteria: show user input source, shell interpolation in command string, execution sink, and missing sanitization.
- False-positive checks: input is from trusted source, command uses list form, or input is validated against fixed set.
- CWE: CWE-78

## Path traversal: open with user path

- Source pattern: CGI parameter, uploaded filename, or URL path segment controls a file path in an open call.
- Sink signature: `open(FH, "<$path")`, `open(FH, $path)`, `read_file($path)`.
- Common misuse: user-controlled path is opened without canonicalization, containment check, or null byte filtering.
- Expected guard: canonicalize with `Cwd::realpath`, verify path starts with base directory, reject `..` and null bytes, use three-argument open.
- Evidence criteria: show user input source, open call with user path, and missing containment validation.
- False-positive checks: path is from hardcoded list, realpath check is applied, or file is in read-only public directory.
- CWE: CWE-22

## Regex denial of service: user-controlled pattern

- Source pattern: HTTP parameter, search field, or config value is used as a regex pattern or matched against a vulnerable regex.
- Sink signature: `$input =~ /$user_regex/`, `qr/$user_pattern/`, regex with nested quantifiers on user input.
- Common misuse: user-controlled regex or input matched against exponential-backtracking pattern causes CPU exhaustion.
- Expected guard: use `re::engine::RE2` for user patterns, set match timeout, limit input length, or avoid user-controlled regex.
- Evidence criteria: show user input reaching regex compilation or matching, pattern with catastrophic backtracking potential, and missing timeout/length guard.
- False-positive checks: regex is fixed/hardcoded, input length is bounded, or RE2 engine is used.
- CWE: CWE-1333
