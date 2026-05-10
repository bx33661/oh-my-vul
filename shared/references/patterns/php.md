# PHP Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## Object injection: unserialize

- Source pattern: HTTP body, cookie, session data, or database value reaches an unserialize call.
- Sink signature: `unserialize($userInput)`, `igbinary_unserialize($data)`.
- Common misuse: attacker-controlled serialized string is deserialized without class allowlist, enabling magic method chains.
- Expected guard: use `json_decode` instead, or pass `allowed_classes: []` option to `unserialize`, or validate input format before deserialization.
- Evidence criteria: show source of serialized data, unserialize call site, available gadget classes with `__wakeup`/`__destruct`, and missing allowed_classes restriction.
- False-positive checks: input is from trusted internal source, allowed_classes is restricted, no exploitable gadget chain exists, or input is validated as JSON.
- CWE: CWE-502

## SQL injection: query interpolation

- Source pattern: HTTP parameter, form field, URL segment, or header value is interpolated into a SQL query string.
- Sink signature: `$pdo->query("... $input ...")`, `mysqli_query($conn, "... $input ...")`, `DB::raw($input)`.
- Common misuse: user input is concatenated or interpolated into SQL without parameterized queries or proper escaping.
- Expected guard: use prepared statements with bound parameters, or ORM query builder with automatic escaping.
- Evidence criteria: show user input source, string interpolation into SQL, query execution sink, and absence of parameter binding.
- False-positive checks: input is cast to integer, query uses prepared statements, input comes from trusted enum, or ORM handles escaping.
- CWE: CWE-89

## Remote code execution: eval/system

- Source pattern: HTTP parameter, uploaded filename, template variable, or config value reaches a code execution function.
- Sink signature: `eval($code)`, `system($cmd)`, `exec($cmd)`, `passthru($cmd)`, `shell_exec($cmd)`, `proc_open($cmd)`, `preg_replace('/e', ...)`.
- Common misuse: user-controlled string is passed to code or command execution without sanitization or allowlisting.
- Expected guard: avoid dynamic code execution entirely, use allowlisted commands with escapeshellarg, or sandbox with restricted function list.
- Evidence criteria: show user input source, path to execution function, and missing input validation or command construction guard.
- False-positive checks: input is from admin-only interface, command is static with no user segments, or execution is disabled by PHP configuration.
- CWE: CWE-78
