# Example: Path Traversal in Go Module

This is a fully filled report for an unauthenticated path traversal in a Go HTTP library. Use it as a reference for high-severity, no-interaction vulnerabilities.

---

## Part A — VulDB Form

**Vendor**
```
go-chi
```

**Product**
```
chi
```

**Version**
```
up to and including v5.0.8
```

**Class**
```
Path Traversal
```

**Description**
```
A path traversal vulnerability was found in the Go module github.com/go-chi/chi up to and
including version v5.0.8. It has been classified as Path Traversal.

The issue affects the FileServer() handler in _examples/fileserver/main.go and the underlying
http.FileServer integration. When serving files from a restricted root directory, the handler
fails to fully normalise the request path before resolving it against the filesystem root,
allowing an attacker to escape the intended directory.

An attacker can send an HTTP GET request with a path-traversal sequence such as
/../../../etc/passwd to read arbitrary files outside the web root. No authentication is
required and no user interaction is needed. The attack can be performed remotely.

Affected component: net/http FileServer integration via chi.FileServer()
Affected function: FileServer()

Root cause: The request URL path is not fully cleaned with path.Clean() before being joined
to the filesystem root, allowing ../ sequences to escape the intended directory boundary.

Suggested fix: Apply filepath.Clean() to the resolved path and verify it remains within the
intended root directory before opening any file. Return HTTP 403 for any path that escapes
the root.
```

**Advisory / Exploit**
```
https://github.com/<user>/chi-traversal-poc
```

**CVE checkbox**
Tick only after confirming: vendor notified, no existing CVE, no other CNA processing.

---

## Part B — Full Advisory

**Title**
```
chi up to v5.0.8 FileServer path traversal Arbitrary File Read
```

**Summary**

A path traversal vulnerability was found in the Go module `github.com/go-chi/chi` up to and including version v5.0.8. It has been classified as CWE-22.

**Affected Component**

| Field | Value |
|---|---|
| File | `_examples/fileserver/main.go`, internal FileServer handler |
| Function | `FileServer()` |
| Package | `Go:github.com/go-chi/chi` |
| Version tested | v5.0.8 |
| Affected versions | up to and including v5.0.8 |
| Fixed version | none at time of reporting |

**Root Cause**

The `FileServer()` handler joins the incoming URL path to the filesystem root without applying `filepath.Clean()` first. A request path such as `/../../../etc/passwd` is passed through after URL-decoding, allowing `..` sequences to traverse above the intended root:

```go
// simplified representation of the vulnerable pattern
func FileServer(r chi.Router, path string, root http.FileSystem) {
    fs := http.FileServer(root)
    r.Get(path+"/*", func(w http.ResponseWriter, r *http.Request) {
        fs.ServeHTTP(w, r)  // path not cleaned before serving
    })
}
```

**Impact**

An unauthenticated remote attacker can read arbitrary files accessible to the process user account by sending crafted HTTP requests. On Linux systems this includes `/etc/passwd`, application config files, and private keys. No user interaction is required.

**Attack Requirements**

- Attack vector: Network
- Authentication required: No
- User interaction required: No
- Preconditions: Application must use `chi.FileServer()` to serve static files
- Scope: Unchanged
- CVSS v3.1: `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N` — 7.5 High

**Proof of Concept**

Install:
```bash
go get github.com/go-chi/chi/v5@v5.0.8
```

Minimal server (save as `main.go`):
```go
package main

import (
    "net/http"
    "github.com/go-chi/chi/v5"
)

func main() {
    r := chi.NewRouter()
    r.Handle("/static/*", http.StripPrefix("/static",
        http.FileServer(http.Dir("/var/www/html"))))
    http.ListenAndServe(":8080", r)
}
```

Trigger:
```bash
curl http://localhost:8080/static/../../../etc/passwd
```

Result: Contents of `/etc/passwd` returned in the HTTP response body.

**Reproduction Steps**

1. Install the affected version: `go get github.com/go-chi/chi/v5@v5.0.8`
2. Build and run the minimal server above
3. Send the traversal request: `curl http://localhost:8080/static/../../../etc/passwd`
4. Observe: file contents outside `/var/www/html` are returned

**Suggested Fix**

After resolving the request path against the root, verify the result is still within the intended directory:

```go
func safeOpen(root, requestPath string) (*os.File, error) {
    cleaned := filepath.Clean(filepath.Join(root, requestPath))
    if !strings.HasPrefix(cleaned, filepath.Clean(root)+string(os.PathSeparator)) {
        return nil, os.ErrPermission
    }
    return os.Open(cleaned)
}
```

Return HTTP 400 or 403 for any path that escapes the root — do not reveal whether the file exists.

**Vendor Contact**

- Reported via GitHub Security Advisory on [DATE]
- Vendor acknowledged on [DATE] / No response as of [DATE]

**References**

- Vulnerable code: `https://github.com/go-chi/chi/blob/v5.0.8/...`
- GitHub Security Advisory: [URL]
- CWE-22: `https://cwe.mitre.org/data/definitions/22.html`
