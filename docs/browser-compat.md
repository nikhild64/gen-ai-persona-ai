# Browser Compatibility

## Support matrix

| Browser | Minimum | Notes |
|---|---|---|
| Chromium | 120+ | Primary dev target. `PerformanceObserver` + `fetch` + `AbortSignal` + IndexedDB all native. |
| Firefox | 120+ | SSE streaming via `ReadableStream` verified. `sessionStorage` behaves identically. |
| Safari (macOS) | 16.4+ | `AsyncIterable` + `crypto.randomUUID` require ≥ 16.4. Older Safaris hard-fail. |
| Safari (iOS) | 16.4+ | Same requirements; test on physical device where possible. |

Browser features relied on:

- `AsyncIterable<T>` (E2-S1 provider adapters).
- `ReadableStream` + `TextDecoder` (SSE parsing in adapters).
- `fetch` with `AbortSignal` (AD-14 cancellation).
- `IndexedDB` (AD-6 storage) + `sessionStorage` (AD-11 BYO-Key).
- `crypto.randomUUID` (Message/Thread IDs).
- CSS custom properties + `[data-persona]` scope selectors (AD-17).

## Manual smoke procedure

Per browser/version combo:

1. Open the live URL in a fresh incognito window.
2. Click Hitesh's persona card on landing → chat surface loads.
3. Paste a valid Gemini key via the Settings modal (`⚙` in the header).
4. Send "Hi in one word" → response should stream token-by-token.
5. Click the persona-switcher → route to Piyush → thread flips + theme
   slides.
6. Send another message → response streams.
7. Switch to Ask-Both mode → Hitesh answers → bridge notice → Piyush
   answers.
8. Refresh the tab → both threads restored from IndexedDB.

## Final matrix (fill after E12-S3 smoke)

| Browser | UJ-1 setup | UJ-2 long chat | UJ-3 jailbreak | UJ-4 Ask-Both |
|---|---|---|---|---|
| Chromium 121 (macOS) | ☐ | ☐ | ☐ | ☐ |
| Chromium 121 (Windows) | ☐ | ☐ | ☐ | ☐ |
| Firefox 122 (macOS) | ☐ | ☐ | ☐ | ☐ |
| Safari 17.2 (macOS) | ☐ | ☐ | ☐ | ☐ |
| Safari 17 (iOS) | ☐ | ☐ | ☐ | ☐ |

_Last tested:_ **_fill after final smoke run_**.
