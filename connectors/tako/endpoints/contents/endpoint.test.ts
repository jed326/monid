import { assert, assertEquals, assertRejects } from "@std/assert";
import type { Json } from "@shared/core";
import { fromFileUrl } from "@std/path";
import {
    estimateEndpoint,
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const ID = "tako#v1/contents";
const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));
const CARD_URL = "https://tako.com/card/def456";

async function run(fixture: string, body: Json) {
    return await runEndpoint({
        unit: await testSealedUnit(ID),
        input: { body },
        mode: "replay",
        fixture: await loadFixture(`${chains}${fixture}`),
    });
}

Deno.test("tako#v1/contents settles at Tako's reported cost and strips usage from the output", async () => {
    const result = await run("synthetic-contents-card.json", {
        url: CARD_URL,
        mode: "inline",
        content_format: "json_records",
        max_cost_usd: 0.01,
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        credits: { default: 0.00102 },
        evidence: { call: 1, metered: 2 },
    });
    const output = result.output as Record<string, unknown>;
    assertEquals("usage" in output, false);
    assertEquals((output.contents as unknown[]).length, 1);
});

Deno.test("tako#v1/contents estimate holds max_cost_usd", async () => {
    const usage = await estimateEndpoint(await testSealedUnit(ID), {
        body: { url: CARD_URL, max_cost_usd: 0.5 },
    });

    assertEquals(usage.evidence, { call: 1, metered: 49_900 });
});

Deno.test("tako#v1/contents estimate never holds less than the base price", async () => {
    const usage = await estimateEndpoint(await testSealedUnit(ID), {
        body: { url: CARD_URL, max_cost_usd: 0 },
    });

    assertEquals(usage.evidence, { call: 1 });
});

Deno.test("tako#v1/contents requires max_cost_usd and rejects quote_only and zdr", async () => {
    const unit = await testSealedUnit(ID);
    const bodies: Json[] = [
        { url: CARD_URL },
        { url: CARD_URL, max_cost_usd: 1, quote_only: true },
        { url: CARD_URL, max_cost_usd: 1, zdr: true },
    ];
    for (const body of bodies) {
        await assertRejects(
            () => runEndpoint({ unit, input: { body }, mode: "replay" }),
            Error,
            "INVALID_INPUT",
        );
    }
});

Deno.test("tako#v1/contents over the cap is an unbilled 422 that carries the price", async () => {
    const result = await run("synthetic-cost-cap-exceeded.json", {
        url: CARD_URL,
        max_cost_usd: 0.01,
    });

    assertEquals(result.httpStatus, 422);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as {
        message: string;
        raw: Record<string, unknown>;
    };
    assertEquals(
        output.message,
        "This export would cost up to $1.001, above max_cost_usd $0.01.",
    );
    assertEquals(output.raw.error_type, "COST_CAP_EXCEEDED");
    assertEquals(output.raw.quoted_cost_usd, 1.001);
});

Deno.test({
    name: "tako#v1/contents live (gated on TAKO_API_KEY)",
    ignore: liveSkip("tako"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(ID),
            input: {
                body: {
                    url: "https://en.wikipedia.org/wiki/Unemployment",
                    mode: "inline",
                    max_chars: 2_000,
                    max_cost_usd: 0.01,
                },
            },
            mode: "live",
        });

        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage.credits.default, 0.001);
        assert(!("usage" in (result.output as Record<string, unknown>)));
    },
});
