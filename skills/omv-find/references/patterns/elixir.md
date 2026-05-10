# Elixir Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## Code injection: Code.eval_string

- Source pattern: HTTP parameter, WebSocket message, config value, or template variable reaches a dynamic code evaluation function.
- Sink signature: `Code.eval_string(user_input)`, `Code.eval_quoted(ast)`, `:erlang.binary_to_term(data)`.
- Common misuse: user-controlled string is evaluated as Elixir/Erlang code without sandboxing or input restriction.
- Expected guard: avoid dynamic code evaluation entirely, use pattern matching on known commands, or restrict to compile-time macros.
- Evidence criteria: show user input source, eval call site, and missing input validation or sandboxing.
- False-positive checks: input is from admin-only LiveView, eval is compile-time only, or input is validated against a fixed command set.
- CWE: CWE-94

## Atom exhaustion: String.to_atom

- Source pattern: HTTP parameter, JSON key, or external input is converted to an atom without bounds checking.
- Sink signature: `String.to_atom(user_input)`, `:"#{user_input}"`, `List.to_atom(charlist)`.
- Common misuse: unbounded user input creates atoms, which are never garbage collected, leading to VM memory exhaustion.
- Expected guard: use `String.to_existing_atom/1` which raises on unknown atoms, or validate input against a known set before conversion.
- Evidence criteria: show user input source, to_atom call, and missing existing_atom guard or input validation.
- False-positive checks: input is from a fixed enum, to_existing_atom is used, or atom creation is bounded by application logic.
- CWE: CWE-400

## SQL injection: raw Ecto query

- Source pattern: HTTP parameter, search query, or filter value is interpolated into a raw SQL fragment in Ecto.
- Sink signature: `Ecto.Adapters.SQL.query(repo, "SELECT ... #{input}")`, `fragment("... #{input} ...")`.
- Common misuse: user input is string-interpolated into raw SQL fragments instead of using parameterized placeholders.
- Expected guard: use `fragment("... ? ...", ^input)` with pinned variables, or Ecto query builder with automatic parameterization.
- Evidence criteria: show user input source, string interpolation in SQL/fragment, and missing parameterization.
- False-positive checks: input is cast to integer, fragment uses ? placeholders with pinned values, or query builder handles escaping.
- CWE: CWE-89
