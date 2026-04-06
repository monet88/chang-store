## 2025-02-14 - Optimize Base64 Padding Calculation O(N) to O(1)
**Learning:** Checking for padding (`=`) at the end of large base64 strings (like image payloads) using `.match(/=/g)` is highly inefficient. It forces JavaScript to scan the *entire* string (which can be several megabytes), effectively making an O(1) operation O(N) and blocking the main thread for ~10ms+ per image.
**Action:** Always use string ending checks like `.endsWith('==')` and `.endsWith('=')` when dealing with base64 padding, as it executes in O(1) time and completes in microseconds regardless of payload size.
## 2025-02-14 - Optimize Base64 Padding Calculation O(N) to O(1)
**Learning:** Checking for padding (`=`) at the end of large base64 strings (like image payloads) using `.match(/=/g)` is highly inefficient. It forces JavaScript to scan the *entire* string (which can be several megabytes), effectively making an O(1) operation O(N) and blocking the main thread for ~10ms+ per image.
**Action:** Always use string ending checks like `.endsWith('==')` and `.endsWith('=')` when dealing with base64 padding, as it executes in O(1) time and completes in microseconds regardless of payload size.
