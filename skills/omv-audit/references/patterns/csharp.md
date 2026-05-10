# C# Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## Deserialization: BinaryFormatter/ObjectStateFormatter

- Source pattern: HTTP body, ViewState, cookie, message queue payload, or file content reaches a deserialization call.
- Sink signature: `BinaryFormatter.Deserialize(stream)`, `ObjectStateFormatter.Deserialize(data)`, `NetDataContractSerializer.ReadObject(reader)`.
- Common misuse: untrusted byte stream is deserialized with a formatter that allows arbitrary type instantiation.
- Expected guard: use `System.Text.Json` or `JsonSerializer` with known types, avoid BinaryFormatter entirely, or implement strict `SerializationBinder` with type allowlist.
- Evidence criteria: show untrusted data source, formatter instantiation, Deserialize call, and missing type restriction or binder.
- False-positive checks: data source is trusted internal, custom binder restricts types, formatter is used only for trusted IPC, or code targets .NET 8+ where BinaryFormatter is removed.
- CWE: CWE-502

## Path traversal: Path.Combine

- Source pattern: HTTP parameter, uploaded filename, API input, or config value controls a path segment passed to file operations.
- Sink signature: `Path.Combine(basePath, userInput)`, `File.ReadAllText(path)`, `File.WriteAllBytes(path, data)`.
- Common misuse: `Path.Combine` with an absolute user path ignores the base directory; no canonical path check follows.
- Expected guard: use `Path.GetFullPath` and verify result starts with intended base directory, reject absolute paths and `..` segments.
- Evidence criteria: show user input source, Path.Combine or concatenation, file I/O sink, and missing containment validation.
- False-positive checks: input is validated against allowlist, path is resolved and base-checked, or file operation is read-only on public content.
- CWE: CWE-22

## SSRF: HttpClient with user URL

- Source pattern: HTTP parameter, webhook config, callback URL, or integration setting controls a URL passed to HttpClient.
- Sink signature: `HttpClient.GetAsync(userUrl)`, `HttpClient.SendAsync(request)`, `WebClient.DownloadString(url)`.
- Common misuse: user-controlled URL is fetched without scheme validation, hostname allowlist, or private IP filtering.
- Expected guard: parse URL, enforce https scheme, validate hostname against allowlist, resolve DNS and reject private/loopback ranges, limit redirects.
- Evidence criteria: show URL source, HttpClient call, and missing scheme/host/IP validation.
- False-positive checks: URL is from trusted config, hostname is hardcoded, proxy handles validation, or request is to a fixed internal service.
- CWE: CWE-918
