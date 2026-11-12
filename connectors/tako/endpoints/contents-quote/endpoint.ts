import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zContentsBody } from "../../schema/contents.ts";

export default defineEndpoint({
    meta: {
        displayName: "Tako Contents Quote",
        summary: "Price a Tako card export or web page fetch, free.",
        description: "Return what tako#v1/contents would charge for the " +
            "same request, without fetching content or charging. The " +
            "response's item carries cost and export_pricing: the " +
            "baseline, the per-1,000-row rate, premium record rates, and " +
            "the most rows the card can export. Use it to pick max_rows " +
            "and max_cost_usd before an export.",
        docsUrl:
            "https://docs.tako.com/documentation/integrating-tako/contents/pricing",
        categories: ["web-scraping", "web-extraction"],
        notes: [
            "The quote is an upper bound: an export bills only the rows it " +
            "delivers, which can be fewer than max_rows.",
        ],
    },
    endpoint: "/v1/contents/quote",
    request: { method: "POST", path: "/v1/contents" },
    input: {
        schema: {
            body: zContentsBody.omit({
                quote_only: true,
                zdr: true,
                max_cost_usd: true,
            }),
        },
        toRequest: ({ data, utils }) => ({
            ...data.input,
            body: utils.json.merge(data.input.body ?? {}, { quote_only: true }),
        }),
    },
    usage: { model: { kind: UsageModelKind.FREE } },
});
