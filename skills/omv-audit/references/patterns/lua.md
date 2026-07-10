# Lua Vulnerability Patterns

## Command injection: os.execute and io.popen

- Source pattern: HTTP parameters, game/plugin messages, configuration, filenames, or CLI values reach an operating-system command string.
- Sink signature: `os.execute(command)` or `io.popen(command, mode)` with attacker-controlled text.
- Common misuse: Concatenating an untrusted value into a shell command or allowing the value to select command options.
- Expected guard: Avoid the shell, select fixed commands, validate each argument against a strict allowlist, and reject metacharacters and option injection.
- Evidence criteria: Trace an external value to the command boundary and show that a meaningful command fragment remains attacker-controlled.
- False-positive checks: Confirm the call is reachable in the deployed host and is not limited to trusted build or administrator scripts.
- CWE: CWE-78

## Path traversal: io.open and filesystem helpers

- Source pattern: Request paths, uploaded filenames, archive entries, plugin data, or configuration controls a local path.
- Sink signature: `io.open(path, mode)`, `os.remove(path)`, `os.rename(old, new)`, or LuaFileSystem operations on an untrusted path.
- Common misuse: Prefixing a base directory without canonicalization or accepting absolute and parent-relative segments.
- Expected guard: Normalize the final path, reject absolute and parent-relative input, and verify containment under the intended base directory.
- Evidence criteria: Show source-to-sink propagation and a normalized path that escapes the authorized root or reaches a sensitive file.
- False-positive checks: Check allowlists, chroot/container boundaries, read-only modes, and whether only trusted local configuration reaches the sink.
- CWE: CWE-22

## Code injection: load and loadstring

- Source pattern: Network input, templates, plugin content, configuration, or saved state reaches dynamic Lua compilation.
- Sink signature: `load(chunk)`, `loadstring(code)`, or `dofile(filename)` with attacker-controlled code or path.
- Common misuse: Evaluating expressions or plugins from untrusted input with the default global environment.
- Expected guard: Do not compile untrusted text; otherwise use a narrowly constructed environment, strict grammar, and explicit capability allowlist.
- Evidence criteria: Prove control of compiled text or loaded file and identify which sensitive globals or capabilities remain accessible.
- False-positive checks: Confirm text is not a fixed internal script and verify that a restricted environment actually blocks filesystem, process, and network access.
- CWE: CWE-94
