# Phase 2: Baseline Capture System

**Status:** Pending
**Priority:** P2
**Effort:** 4h

---

## Context Links

- [Plan Overview](./plan.md)
- [Phase 1: Research & Design](./phase-01-research-design.md)
- [Baseline Types](../../__tests__/baselines/types.ts) (to be created)

---

## Overview

Build automated system to capture model output baselines. Creates structured snapshots with metadata for future comparison.

**Prerequisites:**
- Phase 1 completed (types defined, thresholds set)
- Test API keys configured
- pHash library installed

---

## Architecture

### Components

```
__tests__/baselines/
├── types.ts                          # TypeScript definitions
├── captureBaseline.ts                # Capture logic
├── utils/
│   ├── imageMetadata.ts              # Extract dimensions, size, pHash
│   ├── videoMetadata.ts              # Extract duration, resolution
│   └── modelVersion.ts               # Detect model version
├── config.ts                         # Operations to baseline
└── cli.ts                            # CLI interface

__baselines__/                        # Git-tracked outputs
├── gemini/image/*.json
├── gemini/video/*.json
├── aivideoauto/*.json
└── metadata.json
```

---

## Related Code Files

### To Create

1. **`__tests__/baselines/types.ts`** (50 lines)
   - Interface definitions from Phase 1 design

2. **`__tests__/baselines/config.ts`** (80 lines)
   - List of operations to baseline
   - Input parameters per operation
   - Model mappings

3. **`__tests__/baselines/utils/imageMetadata.ts`** (60 lines)
   - Extract dimensions using `sharp`
   - Calculate pHash
   - Get file size

4. **`__tests__/baselines/utils/videoMetadata.ts`** (40 lines)
   - Extract duration, resolution using `ffprobe`
   - Get file size

5. **`__tests__/baselines/utils/modelVersion.ts`** (30 lines)
   - Extract version from SDK/API response
   - Fallback to package.json version

6. **`__tests__/baselines/captureBaseline.ts`** (150 lines)
   - Main capture logic
   - Iterate operations from config
   - Call real APIs
   - Extract metadata
   - Save JSON files

7. **`__tests__/baselines/cli.ts`** (80 lines)
   - Command-line interface
   - Argument parsing (--model, --operation, --all)
   - Progress reporting

---

## Implementation Steps

### Step 1: Setup Dependencies (30min)

```bash
npm install --save-dev sharp phash ffprobe-static
```

**Packages:**
- `sharp`: Image processing (metadata, dimensions)
- `phash`: Perceptual hashing
- `ffprobe-static`: Video metadata extraction

### Step 2: Create Type Definitions (30min)

**File:** `__tests__/baselines/types.ts`

```typescript
/** Baseline metadata about when/how it was captured */
export interface BaselineMetadata {
  modelVersion: string;       // "gemini-3-flash-preview"
  capturedAt: string;         // ISO timestamp
  capturedBy: string;         // "ci" | "manual" | username
  sdkVersion: string;         // "@google/genai@1.2.3"
  environmentHash: string;    // Git commit SHA
  validUntil?: string;        // Optional expiry date
}

/** Comparison thresholds for validation */
export interface ComparisonThresholds {
  dimensionsTolerance: number;    // ±10% = 0.1
  fileSizeTolerance: number;      // ±30% = 0.3
  phashMaxDistance: number;       // Hamming distance < 10
  formatMatch: boolean;           // MIME type must match
  safetyPass: boolean;            // Safety filters must pass
}

/** Complete baseline structure */
export interface Baseline {
  metadata: BaselineMetadata;
  operation: {
    name: string;              // "editImage", "generateVideo"
    service: string;           // "gemini/image", "aivideoauto"
    model: string;             // Full model name
  };
  input: {
    prompt: string;
    images?: string[];         // Base64 samples (truncated)
    aspectRatio?: string;
    resolution?: string;
    [key: string]: any;
  };
  output: {
    mimeType: string;
    dimensions?: { width: number; height: number };
    fileSizeKB: number;
    durationSeconds?: number;  // For video only
    phash?: string;            // Perceptual hash (images/video thumbnails)
    base64Sample: string;      // First 100 chars for visual inspection
  };
  validationCriteria: ComparisonThresholds;
}
```

### Step 3: Create Config (45min)

**File:** `__tests__/baselines/config.ts`

```typescript
import { EditImageParams } from '@/services/gemini/image';

export interface BaselineOperation {
  name: string;
  service: 'gemini/image' | 'gemini/video' | 'gemini/text' | 'aivideoauto';
  models: string[];
  inputs: any;  // Operation-specific params
  thresholds: ComparisonThresholds;
}

export const BASELINE_OPERATIONS: BaselineOperation[] = [
  // Gemini Image Operations
  {
    name: 'editImage',
    service: 'gemini/image',
    models: ['gemini-3-flash-preview', 'gemini-3-pro-image-preview'],
    inputs: {
      images: [{ base64: SAMPLE_IMAGE_BASE64, mimeType: 'image/png' }],
      prompt: 'Make this image look professional for a product catalog',
      aspectRatio: '1:1',
      resolution: '1K',
    },
    thresholds: {
      dimensionsTolerance: 0.1,
      fileSizeTolerance: 0.3,
      phashMaxDistance: 10,
      formatMatch: true,
      safetyPass: true,
    },
  },
  {
    name: 'generateImage',
    service: 'gemini/image',
    models: ['imagen-4.0-generate-001'],
    inputs: {
      prompt: 'A professional model wearing a blue dress in studio lighting',
      aspectRatio: '3:4',
      numberOfImages: 1,
    },
    thresholds: { /* same */ },
  },
  // ... more operations
];

const SAMPLE_IMAGE_BASE64 = "..."; // Stock test image
```

### Step 4: Implement Metadata Extractors (1h)

**File:** `__tests__/baselines/utils/imageMetadata.ts`

```typescript
import sharp from 'sharp';
import phash from 'phash';
import { ImageFile } from '@/types';

export interface ImageMetadata {
  dimensions: { width: number; height: number };
  fileSizeKB: number;
  phash: string;
}

export async function extractImageMetadata(image: ImageFile): Promise<ImageMetadata> {
  // Convert base64 to buffer
  const buffer = Buffer.from(image.base64, 'base64');

  // Extract dimensions
  const metadata = await sharp(buffer).metadata();

  // Calculate file size
  const fileSizeKB = Math.round(buffer.length / 1024);

  // Calculate perceptual hash
  // Save temp file for phash (library requirement)
  const tempPath = `/tmp/baseline-${Date.now()}.png`;
  await sharp(buffer).toFile(tempPath);
  const phashValue = await phash.hash(tempPath);

  // Cleanup temp file
  await fs.unlink(tempPath);

  return {
    dimensions: {
      width: metadata.width!,
      height: metadata.height!,
    },
    fileSizeKB,
    phash: phashValue,
  };
}
```

**File:** `__tests__/baselines/utils/videoMetadata.ts`

```typescript
import ffprobe from 'ffprobe-static';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VideoMetadata {
  dimensions: { width: number; height: number };
  durationSeconds: number;
  fileSizeKB: number;
  thumbnailPhash: string;  // pHash of middle frame
}

export async function extractVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  // Run ffprobe to get metadata
  const { stdout } = await execAsync(
    `${ffprobe.path} -v quiet -print_format json -show_format -show_streams "${videoPath}"`
  );

  const data = JSON.parse(stdout);
  const videoStream = data.streams.find((s: any) => s.codec_type === 'video');

  // Extract middle frame for thumbnail comparison
  const midTime = parseFloat(data.format.duration) / 2;
  const thumbnailPath = `/tmp/thumbnail-${Date.now()}.png`;
  await execAsync(
    `ffmpeg -ss ${midTime} -i "${videoPath}" -frames:v 1 "${thumbnailPath}"`
  );

  // Get pHash of thumbnail
  const thumbnailPhash = await phash.hash(thumbnailPath);

  // Cleanup
  await fs.unlink(thumbnailPath);

  return {
    dimensions: {
      width: videoStream.width,
      height: videoStream.height,
    },
    durationSeconds: parseFloat(data.format.duration),
    fileSizeKB: Math.round(data.format.size / 1024),
    thumbnailPhash,
  };
}
```

### Step 5: Implement Capture Logic (1.5h)

**File:** `__tests__/baselines/captureBaseline.ts`

```typescript
import { BASELINE_OPERATIONS } from './config';
import { Baseline, BaselineMetadata } from './types';
import { extractImageMetadata } from './utils/imageMetadata';
import { extractVideoMetadata } from './utils/videoMetadata';
import { detectModelVersion } from './utils/modelVersion';
import * as geminiImage from '@/services/gemini/image';
import * as geminiVideo from '@/services/gemini/video';
import * as aivideoauto from '@/services/aivideoautoService';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface CaptureOptions {
  model?: string;        // Filter by specific model
  operation?: string;    // Filter by specific operation
  all?: boolean;         // Capture all baselines
}

export async function captureBaselines(options: CaptureOptions): Promise<void> {
  console.log('🎯 Starting baseline capture...\n');

  // Filter operations based on options
  const operations = BASELINE_OPERATIONS.filter(op => {
    if (options.operation && op.name !== options.operation) return false;
    if (options.model && !op.models.includes(options.model)) return false;
    return true;
  });

  console.log(`📋 Capturing ${operations.length} operations...\n`);

  for (const op of operations) {
    for (const model of op.models) {
      console.log(`⚙️  Processing: ${op.service} → ${op.name} (${model})`);

      try {
        // Call real API
        const output = await callOperation(op, model);

        // Extract metadata
        const metadata = await extractMetadata(output, op.service);

        // Build baseline object
        const baseline: Baseline = {
          metadata: createMetadata(model),
          operation: {
            name: op.name,
            service: op.service,
            model,
          },
          input: {
            ...op.inputs,
            // Truncate base64 for readability
            images: op.inputs.images?.map((img: any) => ({
              ...img,
              base64: img.base64.substring(0, 100) + '...',
            })),
          },
          output: {
            ...metadata,
            base64Sample: output.base64?.substring(0, 100) + '...' || '',
          },
          validationCriteria: op.thresholds,
        };

        // Save to file
        await saveBaseline(baseline, op.service, op.name, model);

        console.log(`✅ Captured: ${model}\n`);
      } catch (error) {
        console.error(`❌ Failed: ${model}`, error);
      }
    }
  }

  console.log('🎉 Baseline capture complete!');
}

async function callOperation(op: BaselineOperation, model: string): Promise<any> {
  switch (op.service) {
    case 'gemini/image':
      if (op.name === 'editImage') {
        const results = await geminiImage.editImage({ ...op.inputs, model });
        return results[0];
      }
      // ... other operations
      break;

    case 'gemini/video':
      return geminiVideo.generateVideo({ ...op.inputs, model });

    case 'aivideoauto':
      // ... AIVideoAuto calls
      break;
  }
}

async function extractMetadata(output: any, service: string): Promise<any> {
  if (service.includes('image')) {
    return extractImageMetadata(output);
  } else if (service.includes('video')) {
    // Save video to temp file for ffprobe
    const tempPath = `/tmp/video-${Date.now()}.mp4`;
    const buffer = Buffer.from(output.base64, 'base64');
    await fs.writeFile(tempPath, buffer);
    const metadata = await extractVideoMetadata(tempPath);
    await fs.unlink(tempPath);
    return metadata;
  }
}

function createMetadata(model: string): BaselineMetadata {
  const gitHash = execSync('git rev-parse HEAD').toString().trim();
  const packageJson = require('@/package.json');

  return {
    modelVersion: model,
    capturedAt: new Date().toISOString(),
    capturedBy: process.env.USER || 'manual',
    sdkVersion: packageJson.dependencies['@google/genai'],
    environmentHash: gitHash,
  };
}

async function saveBaseline(
  baseline: Baseline,
  service: string,
  operation: string,
  model: string
): Promise<void> {
  const dir = path.join('__baselines__', service);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${operation}-${model.replace(/[^a-z0-9]/gi, '-')}.json`;
  const filepath = path.join(dir, filename);

  await fs.writeFile(filepath, JSON.stringify(baseline, null, 2));
}
```

### Step 6: Create CLI Interface (30min)

**File:** `__tests__/baselines/cli.ts`

```typescript
import { program } from 'commander';
import { captureBaselines } from './captureBaseline';

program
  .name('baseline')
  .description('Capture model output baselines for regression testing')
  .option('-m, --model <model>', 'Capture specific model (e.g., gemini-3-flash)')
  .option('-o, --operation <operation>', 'Capture specific operation (e.g., editImage)')
  .option('-a, --all', 'Capture all baselines (default)')
  .action(async (options) => {
    await captureBaselines(options);
  });

program.parse();
```

**Package.json script:**

```json
{
  "scripts": {
    "test:baseline:capture": "tsx __tests__/baselines/cli.ts"
  }
}
```

---

## Todo List

Setup:
- [ ] Install dependencies (sharp, phash, ffprobe-static)
- [ ] Add package.json script
- [ ] Create directory structure

Implementation:
- [ ] Create types.ts with interfaces
- [ ] Create config.ts with operations list
- [ ] Implement imageMetadata.ts utility
- [ ] Implement videoMetadata.ts utility
- [ ] Implement modelVersion.ts utility
- [ ] Implement captureBaseline.ts core logic
- [ ] Implement cli.ts interface

Testing:
- [ ] Test imageMetadata extraction
- [ ] Test videoMetadata extraction
- [ ] Test capture of single operation
- [ ] Test capture of all operations
- [ ] Verify baseline JSON structure

---

## Success Criteria

- ✅ CLI command `npm run test:baseline:capture` works
- ✅ Captures baseline for gemini-3-flash editImage
- ✅ Baseline JSON validates against types
- ✅ pHash calculated for images
- ✅ Video thumbnail pHash calculated
- ✅ Metadata includes git hash and SDK version
- ✅ All baselines stored in `__baselines__/` directory

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| API quota exhaustion during capture | High | Rate limit, capture in batches |
| pHash temp file cleanup fails | Low | Use try/finally blocks |
| Video processing timeout | Medium | Set generous timeout (5min) |
| Git LFS needed for large baselines | Low | Keep base64 truncated, only metadata |

---

## Security Considerations

- **API Keys:** Use test keys with quota limits
- **Temp Files:** Ensure cleanup in error cases
- **Baseline Review:** Check for sensitive data before commit

---

## Next Steps

After Phase 2 completion:
1. Run initial baseline capture for all operations
2. Review baseline JSON files for correctness
3. Commit baselines to git
4. Proceed to Phase 3: Comparison Engine
