# tako-connector (delta)

## ADDED Requirements

### Requirement: Tako provider definition
The tako provider SHALL declare name `tako`, `request.baseUrl`
`https://tako.com/api`, auth `presets.auth.header("X-API-Key")`,
timeouts 60 s / 60 s, and one credit pool `default` ("US dollars"). Its
`usage.consolidate` SHALL pluck `$.usage` from the output and claim
`usage.total_cost_usd` in `default`.

#### Scenario: The reported cost settles the call
- **WHEN** a Tako endpoint returns 200 with `usage.total_cost_usd`
  0.135
- **THEN** usage credits are `{default: 0.135}`
- **AND** the output carries no `usage` key

#### Scenario: A provider error is data, zero usage
- **WHEN** any endpoint returns 401 with
  `{error_type, error_message}`
- **THEN** the run completes as HTTP 401, `isProviderError` true,
  usage `{credits: {}, evidence: {}}`

### Requirement: Search holds an upper bound
`tako#v3/search` SHALL bill `call` ($0.007) plus `metered` micro-cents.
Its estimate SHALL hold, in micro-cents, 500 at `deep` effort, plus
`ceil(sources.data.max_variable_cost_usd × 100000)` when the data source
is present, plus `2000 + min(20 × max_rows, 2400) × 10` when
`sources.data.include_contents` is true.

#### Scenario: A bare query holds the default cap
- **WHEN** the input is `{query}` alone
- **THEN** the estimate is `{call: 1, metered: 25000}`

#### Scenario: A web-only search holds the base price
- **WHEN** `sources` is `{web: {}}`
- **THEN** the estimate is `{call: 1}`

#### Scenario: Evidence equals the claim
- **WHEN** `usage.total_cost_usd` is 0.012
- **THEN** evidence is `{call: 1, metered: 500}`

### Requirement: Search binding defaults reach the wire
A bare `{query}` SHALL send `effort: "fast"` and `sources` with
`data: {include_contents: false, max_rows: 20,
max_variable_cost_usd: 0.25}` and `web: {highlights: true}`. A caller's
`sources` SHALL keep only the keys it sent, with defaults filled in.
`variable_cost` and `zdr` SHALL fail INVALID_INPUT.

### Requirement: Contents holds max_cost_usd
`tako#v1/contents` SHALL require `max_cost_usd`, bill `call` ($0.001)
plus `metered` micro-cents, and estimate
`max(0, ceil(max_cost_usd × 100000) − 100)` on `metered`. `quote_only`
and `zdr` SHALL fail INVALID_INPUT.

#### Scenario: Over the cap is unbilled
- **WHEN** Tako returns 422 `COST_CAP_EXCEEDED`
- **THEN** usage is `{credits: {}, evidence: {}}` and the message
  carries the quoted price

### Requirement: Quote is free
`tako#v1/contents/quote` SHALL use the `FREE` usage model, send
`quote_only: true`, and reject `quote_only` and `max_cost_usd` in its
input.
