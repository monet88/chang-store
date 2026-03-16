---
status: testing
phase: 04-ai-studio-inline-upscale-preview-guidance-and-reliability
source: [04-01-SUMMARY.md]
started: "2026-03-16T19:58:00.000Z"
updated: "2026-03-16T19:58:00.000Z"
---

## Current Test

number: 1
name: Auto-Advance to Enhance After Analysis
expected: |
  In AI Studio mode, upload an image and click "Analyze Image."
  After analysis completes, the step header should automatically advance
  to the Enhance step (highlighted purple), without manual navigation.
awaiting: user response

## Tests

### 1. Auto-Advance to Enhance After Analysis
expected: In AI Studio mode, upload an image and click "Analyze Image." After analysis completes, the step header should automatically advance to the Enhance step (highlighted purple), without manual navigation.
result: [pending]

### 2. Preview Simulation Displays with Amber Styling
expected: After analysis auto-advances to Enhance, a preview simulation card should appear with amber/warning border and background. It should have a "⚠️ Simulated Preview" badge, disclaimer text, and lines describing sharpness, texture, lighting, and preservation risks from the analyzed image.
result: [pending]

### 3. Guidance Card Shows 4-Step Guide
expected: On the Enhance step, a "📋 Gemini Execution Guide" card should appear with 4 numbered steps (Review report → Check risks → Trigger upscale → Compare result). Below the steps, a recommended next action should show "🚀 Ready! Trigger upscale to enhance your image."
result: [pending]

### 4. Upscale Button Present and Enabled
expected: On the Enhance step (after analysis), a gradient blue-to-indigo "Upscale with AI Prompt" button should be present and enabled. It should be full-width with hover effects.
result: [pending]

### 5. Studio Upscale Execution
expected: Clicking "Upscale with AI Prompt" should show a loading spinner with "Upscaling with AI-generated prompt..." text. Upon completion, the button is replaced by a green "✅ Upscale complete!" indicator, and the upscaled result appears in the output panel.
result: [pending]

### 6. Guidance Card Adapts After Upscale
expected: After the studio upscale completes, the guidance card's recommended action should change to "✅ Upscale complete — review the result in the output panel."
result: [pending]

### 7. Error Display and Dismissal
expected: If the upscale fails (e.g., network error), a red error banner should appear below the guidance card with the error message and an "✕" dismiss button. Clicking "✕" should clear the error.
result: [pending]

### 8. No API Key Error
expected: If no Gemini API key is configured, the guidance card should show a red error state saying "Configure your Gemini API key in Settings to use AI Studio." The upscale button should be disabled.
result: [pending]

### 9. Studio Result Preservation Across Image Switches
expected: After upscaling Image A in Studio mode, add Image B. Switch back to Image A — the studio upscale result, preview text, and Enhance step position should still be preserved.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0

## Gaps

[none yet]
