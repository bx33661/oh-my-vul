# R Vulnerability Patterns

## Command injection: system and shell

- Source pattern: HTTP parameters, Shiny inputs, imported table values, command-line arguments, or configuration reaches an operating-system command.
- Sink signature: `system(command)`, `system2(command, args)`, `shell(command)`, or `pipe(description)` with attacker-controlled text.
- Common misuse: Concatenating a filename, URL, format option, or user expression into one shell string.
- Expected guard: Fixed executable selection, argument arrays, strict allowlists, and no shell interpretation of untrusted text.
- Evidence criteria: Trace the untrusted value into the executable or argument boundary and show that validation does not exclude shell metacharacters or option injection.
- False-positive checks: Confirm the value is externally controlled, the call is reachable, and the command is not a fixed developer-only maintenance script.
- CWE: CWE-78

## Path traversal: file and archive paths

- Source pattern: Request data, Shiny upload names, imported metadata, or package configuration controls a filesystem or archive member path.
- Sink signature: `file(path)`, `readLines(path)`, `file.copy(from, to)`, `unzip(zipfile, files, exdir)`, or `untar(tarfile, files)`.
- Common misuse: Joining an untrusted relative path to a base directory without containment checks, or extracting archive members with traversal segments.
- Expected guard: Canonicalize the destination, reject absolute and parent-relative paths, and verify containment below the intended base.
- Evidence criteria: Show the source-to-sink path and demonstrate that canonicalized output can escape the authorized directory.
- False-positive checks: Check archive-library defaults, explicit member filters, sandboxing, and whether only trusted local files reach the sink.
- CWE: CWE-22

## Unsafe deserialization: unserialize

- Source pattern: Uploaded RDS data, cache entries, message payloads, or network responses reach R object deserialization.
- Sink signature: `unserialize(connection)`, `readRDS(file)`, or `load(file)` on attacker-controlled bytes.
- Common misuse: Treating serialized R objects from an untrusted source as inert data without validating origin or allowed object shape.
- Expected guard: Accept only trusted artifacts, authenticate content, use a constrained interchange format, and isolate unavoidable parsing.
- Evidence criteria: Prove the attacker controls serialized bytes and identify a reachable behavior or resource impact caused during or after object loading.
- False-positive checks: Confirm signatures or checksums are not verified and avoid claiming code execution from sink presence alone.
- CWE: CWE-502
