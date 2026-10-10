# Gemini spike (Lane A, Sat Oct 10 2026)

Script: `node scripts/photo-test.mjs <photo.jpg> [expected requestId]`. It uses the server's own
prompt, schema, call wrapper and cleaning code (`server/gemini.mjs`), so it tests the deployed path.

## Variant that worked (first try, no fallback needed)

- `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`, header `x-goog-api-key`.
- Body: `contents[0].parts = [{text: prompt}, {inline_data: {mime_type: "image/jpeg", data: <base64>}}]`.
- `generationConfig` keys: `temperature` (0.2), `responseMimeType` ("application/json"), `responseSchema` (OpenAPI-style, uppercase types, `nullable: true` for `notAllowed` and `match.requestId`, `enum` for condition/category).
- `responseJsonSchema` and the no-schema fallback were never needed (still coded in the spike).
- No thinking config sent; `usageMetadata` reports no thought tokens.

## Runs (2 real calls total)

Fake open requests in the prompt: r1 "Reading lamp for my desk", r2 "Winter coat, size M-ish", r3 "Mini fridge for a double".

| Photo | HTTP | Latency | Tokens (prompt / image part / output / total) | match |
|---|---|---|---|---|
| `public/seed/lamp.jpg` (682x1024, 148 KB) | 200 | 1914 ms | 1470 / 1107 / 112 / 1582 | `r1` (expected r1) |
| `public/seed/fan.jpg` (1024x943, 394 KB) | 200 | 2276 ms | 1451 / 1088 / 106 / 1557 | `null` (expected null) |

All asserts passed both runs: `identified === true`, valid `condition`, raw `match.requestId` in {r1, r2, r3, null}, expected match.

Lamp draft:
```json
{"identified": true, "title": "Blue adjustable desk lamp",
 "description": "Blue metal desk lamp with an adjustable arm and a round silver base.",
 "condition": "good", "conditionNotes": "", "category": "lighting", "notAllowed": null,
 "match": {"requestId": "r1", "reason": "This is a standing desk reading lamp which matches the request for a desk lamp."}}
```

Fan draft:
```json
{"identified": true, "title": "Blue metal desk fan",
 "description": "Small blue metal desk fan with a round stand and a black power cord.",
 "condition": "good", "conditionNotes": "", "category": "electronics", "notAllowed": null,
 "match": {"requestId": null, "reason": "None of the open requests ask for a desk fan."}}
```

## Notes and deviations

- No deviation from SPEC for the request shape.
- Condition honesty is lenient: the fan blades look dusty in the photo, yet the model said "good" with no notes. The UI already asks the owner to check the draft.
- `aiError` values the server can return: `rate_limited` (429), `timeout` (20 s), `bad_json` (unparseable or off-schema), `unavailable` (no key, network error after one retry, 5xx after one retry, other HTTP errors). SPEC lists the first three; `unavailable` is the catch-all.
- Not tested live: 429 handling (no way to trigger it without burning quota).

## Real path through the server (2 more real calls; 4 of 6 used in total)

Server started without `GEMINI_MOCK` (`PORT=3200 DATA_DIR=.tmp-a/real node server/index.mjs`), after the
coordinator's condition-honesty prompt tweak was added to `describePrompt`.

- `POST /api/items/draft` (Maya, `public/seed/fan.jpg`): HTTP 200, 1343 ms end to end. Draft:
  `{"identified": true, "title": "Blue desk fan", "description": "Small round blue desk fan with a metal stand and a black power cord.", "condition": "fair", "conditionNotes": "The fan blades and center are dusty.", "category": "electronics", "notAllowed": null, "match": {"requestId": null, "reason": "This is a fan, not a reading lamp or winter coat."}}`, `aiError: null`, `mock: false`.
  The tweak fixed the lenient condition (was "good" with empty notes). Maya's own open request was not offered to Gemini.
- `POST /api/requests` (Priya, "Desk fan for a hot room"): HTTP 200, 788 ms. Text-only `suggestItems` with the
  same `responseSchema` variant (object with a `suggestions` array) returned
  `[{"itemId": "i_fan", "reason": "This small desk fan will help cool your room since your window does not open."}]`, `aiError: null`.
