# NOTE-DEBUGS

## Vitest jsdom: real image-upload pipeline always returns null

### Symptom

A test that feeds `processMultipleImageFiles` / `processUploadImageFile` a `File`
with correct PNG magic bytes comes back empty (`[]`) or `null`, even though the
file is a valid image. `validateImageFile` reports
`error.upload.invalidSignature`.

### Root cause

jsdom's `Blob.slice()` returns a blob **without** `arrayBuffer`
(`typeof slice.arrayBuffer === 'undefined'`, throws
`slice.arrayBuffer is not a function`). `validateImageFile` awaits
`file.slice(0, 12).arrayBuffer()` inside a `try/catch`, so the missing method is
swallowed and reported as an invalid signature — the file is rejected before any
decoding. `compressImage` would not work either (no image loading in jsdom), it
can only fall through to the `FileReader` fallback.

### Verified fix

Do not exercise the real upload pipeline in jsdom. Keep the decoding half
covered indirectly (mock at the caller, as `VirtualTryOn.test.tsx` does with
`vi.spyOn(imageUtils, 'processMultipleImageFiles')`) and test only the pure
parts directly: `imageFilesOnly()` in `src/utils/imageUtils.ts` exists precisely
so the filtering half has a seam-free unit test.

### Prevention / Fast path

When a test needs an "uploaded image" in vitest jsdom, first check whether the
code path touches `Blob.arrayBuffer`, `URL.createObjectURL` + `Image`, or
`canvas`. If it does, mock at the module boundary instead of feeding real
`File` objects. Probe first with a throwaway test that logs
`typeof file.slice(0, 4).arrayBuffer`.
