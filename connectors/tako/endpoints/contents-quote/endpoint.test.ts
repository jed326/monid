import { assertEquals, assertRejects } from "@std/assert";
import type { Json } from "@shared/core";
import { directTransport, Engine } from "@monid/connector-engine";
import { fromFileUrl } from "@std/path";
import {
    estimateEndpoint,
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const ID = "tako#v1/contents/quote";
const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));
const CARD_URL = "https://tako.com/card/def456";

Deno.test("tako#v1/contents/quote is free and returns the price", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(ID),
        input: { body: { url: CARD_URL, max_rows: 100 } },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-contents-quote.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as { contents: { cost: number }[] };
    assertEquals("usage" in output, false);
    assertEquals(output.contents[0].cost, 0.00202);
});

Deno.test("tako#v1/contents/quote holds nothing", async () => {
    const usage = await estimateEndpoint(await testSealedUnit(ID), {
        body: { url: CARD_URL },
    });

    assertEquals(usage, { credits: {}, evidence: {} });
});

async function sentBody(body: Json): Promise<unknown> {
    let sent: unknown;
    const loaded = await new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: (_input, init) => {
                sent = JSON.parse(String(init?.body));
                return Promise.resolve(
                    new Response(
                        JSON.stringify({
                            request_id: "r",
                            contents: [],
                            usage: { total_cost_usd: 0 },
                        }),
                        {
                            status: 200,
                            headers: { "content-type": "application/json" },
                        },
                    ),
                );
            },
        }),
    }).load(await testSealedUnit(ID));
    await loaded.run({ body });
    return sent;
}

Deno.test("tako#v1/contents/quote sends quote_only true", async () => {
    assertEquals(await sentBody({ url: CARD_URL, max_rows: 100 }), {
        url: CARD_URL,
        max_rows: 100,
        quote_only: true,
    });
});

Deno.test("tako#v1/contents/quote takes neither quote_only nor a cap", async () => {
    const unit = await testSealedUnit(ID);
    const bodies: Json[] = [
        { url: CARD_URL, quote_only: false },
        { url: CARD_URL, max_cost_usd: 1 },
    ];
    for (const rejected of bodies) {
        await assertRejects(
            () =>
                runEndpoint({
                    unit,
                    input: { body: rejected },
                    mode: "replay",
                }),
            Error,
            "INVALID_INPUT",
        );
    }
});

Deno.test({
    name: "tako#v1/contents/quote live (gated on TAKO_API_KEY)",
    ignore: liveSkip("tako"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(ID),
            input: {
                body: { url: "https://en.wikipedia.org/wiki/Unemployment" },
            },
            mode: "live",
        });

        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage, { credits: {}, evidence: {} });
    },
});
