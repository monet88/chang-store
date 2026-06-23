## 2025-02-14 - Optimize Base64 Padding Calculation O(N) to O(1)
**Learning:** Checking for padding (`=`) at the end of large base64 strings (like image payloads) using `.match(/=/g)` is highly inefficient. It forces JavaScript to scan the *entire* string (which can be several megabytes), effectively making an O(1) operation O(N) and blocking the main thread for ~10ms+ per image.
**Action:** Always use string ending checks like `.endsWith('==')` and `.endsWith('=')` when dealing with base64 padding, as it executes in O(1) time and completes in microseconds regardless of payload size.
## 2025-02-14 - Use precise substring and indexOf for base64 parsing instead of regex
**Learning:** Using regex `.match()` on multi-megabyte base64 strings is highly inefficient, blocking the main thread.
**Action:** Always use native string methods like `.indexOf()` and `.substring()` when parsing dataUrl or checking padding on large base64 image payloads for O(1) time complexity.
## 2025-02-14 - Optimize Base64 Encoding using Native FileReader
**Learning:** Converting large `ArrayBuffer` payloads (like 5MB images from API/fetch) into base64 strings using a JS-side chunking loop (`String.fromCharCode` + `btoa`) is extremely slow (~260ms in benchmark) and blocks the main UI thread. Even processing in 32KB chunks fails to avoid substantial overhead because the strings are repeatedly allocated and concatenated in JavaScript.
**Action:** Always prefer the browser's native C++ methods for binary to base64 conversions. Specifically, use `FileReader.readAsDataURL(blob)` instead of manually parsing the `ArrayBuffer`. It's non-blocking, heavily optimized by the browser engine, and up to ~85% faster (completes in ~33ms).
## 2025-02-14 - Use useMemo for React Context Provider values
**Learning:** Passing a new object literal directly to a React Context Provider's `value` prop (e.g., `value={{ someMethod }}`) creates a new object reference on every render. This forces all components consuming that context to re-render, leading to massive cascading re-renders, especially for root-level providers like `ApiProvider` or `LanguageProvider`.
**Action:** Always wrap the `value` object passed to React Context Providers with `useMemo` (e.g., `const value = useMemo(() => ({ someMethod }), [someMethod])`) to preserve object identity and prevent unnecessary re-renders.
