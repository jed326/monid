# Proposal: add-connector-tako

## Why

Tako (tako.com) searches a knowledge graph of licensed, structured data
and the live web in one call. A data result is a card: a chart or table
with its sources, a description, and rows a caller can fetch. Coverage
includes markets and company fundamentals, economic indicators, people
and companies, website traffic and SEO, sports, weather, and prediction
markets. No connector in the catalog searches structured statistics.

## What Changes

- **connectors/tako**: 3 synchronous endpoints, `X-API-Key` auth, base
  URL `https://tako.com/api`, 60 s timeouts (Tako's own server limit;
  a deep search's deadline is 30 s).
  - `tako#v3/search` (`POST /v3/search`): cards and web results.
  - `tako#v1/contents` (`POST /v1/contents`): a card's data rows, or a
    web page's extracted text.
  - `tako#v1/contents/quote` (`POST /v1/contents` with `quote_only`):
    the price of the same contents request, free.
- **Billing settles on Tako's own receipt.** Every metered Tako
  response carries `usage.total_cost_usd`, the full charge for the call.
  The provider's `usage.consolidate` plucks `usage` out of the output
  and claims that total in one pool, `default`, in US dollars.
- **Two lines on each paid endpoint.** `call` is `PER_CALL` at the
  endpoint's minimum charge: $0.007 for search, $0.001 for contents.
  `metered` is `PER_UNIT` `CREDIT` at $0.00001, one micro-cent, the
  smallest unit Tako bills, and carries everything above the minimum.
  `usage.evidence` sets `metered` from `usage.total_cost_usd`, so the
  derived total equals the claim.
- **Every hold is an upper bound.** Tako prices some data per unit
  (website traffic and SEO cards) and prices card rows by source, so a
  call's cost isn't known before it runs. Each paid endpoint has a cost
  cap that Tako enforces, and the estimate holds the cap:
  - Search: `sources.data.max_variable_cost_usd`, defaulted to $0.25
    at the binding. Tako serves a card priced per unit only when its
    worst-case price fits in what's left of the cap, and returns a
    placeholder otherwise. The estimate also holds the $0.005 deep
    premium and, when `sources.data.include_contents` is true, the
    worst case for inlined rows: 20 cards at $0.001 each, plus at most
    2,400 rows (Tako's 2,000-row response budget plus a 20-row floor
    per card) at $0.10 per 1,000, Tako's highest row rate.
  - Contents: `max_cost_usd`, required at the binding. Tako prices the
    call before it reads any data and returns an unbilled 422
    `COST_CAP_EXCEEDED` when the price is above the cap.
- **Binding changes from Tako's schema:**
  - Search: `effort` defaults to `fast` (Tako's default);
    `sources` defaults to `{data: {}, web: {}}`, which is what Tako
    searches when `sources` is omitted, so the data defaults apply;
    `sources.data.include_contents` defaults to `false` and
    `sources.data.max_rows` to 20 (Tako's defaults for this account);
    `sources.web.highlights` defaults to `true`. Tako's API defaults
    highlights to `false` for direct callers; for gateway users,
    highlights give better results, because the agent reads the
    snippet instead of fetching the page.
  - Search: `variable_cost` (both spellings) isn't exposed. Tako
    rejects it next to a cap, and the cap always has a value; a cap of
    0 serves every per-unit card as a placeholder.
  - Contents: `quote_only` isn't exposed; the quote endpoint covers it.
    A $0 claim falls back to the derived fold, which would bill the
    `call` line for a free quote.
  - `zdr` isn't exposed on either endpoint.
- **Category leaves.** `macro-data`, `weather`, and `sports` are new;
  no existing leaf covers them.

## Capabilities

- `tako-connector`.

## Non-goals

- `/v1/answer`, the agent run endpoints, the graph endpoints, and the
  enrichment endpoints.

## Impact

New connector tree and three category leaves. No schema or engine
contract change: `ENGINE_VERSION` unchanged, no new `Unit`, preset, or
hook.
