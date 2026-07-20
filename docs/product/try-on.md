# Virtual Try-On

## Purpose

Dress a subject photo in uploaded clothing items using AI image editing.
The flagship feature of Chang Store.

## Behavior

1. User uploads one or more subject photos (people wearing any outfit).
2. User uploads clothing items (up to 4 per outfit: clothing, shoes, bag, accessory).
3. Optional: background prompt, extra styling prompt, multi-person marker.
4. AI generates the subject wearing the specified clothing.
5. Results can be upscaled or refined via chat session.

## Modes

- **Multi-model**: Multiple subject photos, each gets its own result set.
- **Wardrobe Mode**: Pre-define outfit sets, batch-generate all combinations
  against selected subjects. Up to 4 sets, 4 items per set, concurrency of 4.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| Subject image(s) | Yes | Person photo(s) to dress |
| Clothing item(s) | Yes | Up to 4 items with type tag |
| Source prompt | No | Describe clothing if no image (max 180 chars) |
| Background prompt | No | Custom background description |
| Extra prompt | No | Additional styling instructions |
| Aspect ratio | No | Default 3:4 |
| Resolution | No | Model-aware output size. Flash-Lite and 2.5 Flash are fixed to 1K; supported Gemini 3 models expose 1K, 2K, and 4K. |
| Num images | No | How many variants to generate |

## Multi-Person Mode

When a photo contains multiple people, user can place a marker to indicate
which person to dress. The marker position is composited onto the image before
sending to the API.

## Key Files

- `src/components/VirtualTryOn.tsx` — UI
- `src/hooks/useVirtualTryOn.ts` — logic + state
- `src/hooks/useWardrobeMode.ts` — wardrobe batch logic
- `src/utils/virtual-try-on-prompt-builder.ts` — prompt construction
- `src/utils/batch-image-session.ts` — batch item remapping
- `src/components/WardrobeSetCard.tsx` — wardrobe set UI

## Validation Path

- Upload subject + clothing → generate → image returned
- Wardrobe mode: create set → generate all → batch results
- Multi-person: place marker → generate → correct person dressed
