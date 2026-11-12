import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zContentsBody } from "../../schema/contents.ts";

export default defineEndpoint({
    meta: {
        displayName: "Tako Contents",
        summary: "Fetch a Tako card's data rows or a web page's text.",
        description: "Fetch the content behind a search result. Pass a " +
            "card's webpage_url from tako#v3/search to get the card's data " +
            "rows as CSV or JSON, or any web page URL to get its extracted " +
            "text. Card exports bill $0.001 plus a per-row rate, and web " +
            "pages bill $0.001 each. Set max_cost_usd to the most you'll " +
            "pay; price an export for free first with " +
            "tako#v1/contents/quote.",
        docsUrl:
            "https://docs.tako.com/documentation/integrating-tako/contents/overview",
        categories: ["web-scraping", "web-extraction"],
        notes: [
            "max_cost_usd is required. Tako prices the call before it reads " +
            "any data and returns a 422 with error_type COST_CAP_EXCEEDED " +
            "and the price in quoted_cost_usd, unbilled, when the price is " +
            "above the cap.",
            "A card export without max_rows returns the whole card in 'url' " +
            "mode, up to 100,000 rows, and bills every row.",
            "premium is billed per premium record on top of the row rate; " +
            "the quote endpoint prices it.",
        ],
    },
    request: { method: "POST", path: "/v1/contents" },
    input: {
        schema: {
            body: zContentsBody.omit({ quote_only: true, zdr: true }).required({
                max_cost_usd: true,
            }),
        },
    },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                call: {
                    kind: UsageModelKind.PER_CALL,
                    consumes: { credit: "default", amount: 0.001 },
                    label: "base price",
                    description: "one card export or one web page",
                },
                metered: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.CREDIT,
                    consumes: { credit: "default", amount: 0.00001 },
                    label: "usage above the base price, micro-cents",
                    description: "card rows, premium records, and per-unit " +
                        "data such as website traffic",
                },
            },
        },
        estimate: ({ data }) => {
            const metered = Math.max(
                0,
                Math.ceil(data.input.body.max_cost_usd * 100_000) - 100,
            );
            return { counts: metered > 0 ? { metered } : {} };
        },
        evidence: ({ data, utils }) => {
            const total = utils.json.optionalNum(
                data.output,
                "$.usage.total_cost_usd",
            );
            const metered = total === undefined
                ? 0
                : Math.max(0, Math.round(total * 100_000) - 100);
            return { counts: metered > 0 ? { metered } : {} };
        },
    },
});
