# Official OpenAI API Specification for GPT-Image-2

This document provides the official standard OpenAI API specification for image generation (Text-to-Image) and image editing (Image-to-Image) using the `gpt-image-2` model.

---

## 1. Endpoints

### 1.1 Image Generation (Text-to-Image)
- **Endpoint**: `POST https://api.openai.com/v1/images/generations`
- **Content-Type**: `application/json`
- **Purpose**: Create a completely new image from a text prompt.

### 1.2 Image Edits (Image-to-Image / Reference)
- **Endpoint**: `POST https://api.openai.com/v1/images/edits`
- **Content-Type**: `multipart/form-data`
- **Purpose**: Create or edit an image based on one or more reference images, with or without a mask.

---

## 2. Request Parameters

The parameters below apply primarily to `/v1/images/edits`. (For `/v1/images/generations`, the structure is similar but uses JSON format and does not support the `image` or `mask` parameters).

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| **`model`** | `string` | **Yes** | The model ID. Must be `"gpt-image-2"`. |
| **`image`** | `file` or array of `file` | **Yes** | The reference image(s) to edit or draw inspiration from. Must be binary file data. Supports up to **10 images** (passed as an array of file uploads: `image[]` or multiple `image` fields depending on the HTTP client). Max 50MB per image. |
| **`prompt`** | `string` | **Yes** | A text description of the desired image or the changes to make. |
| **`mask`** | `file` | No | An image mask. Must have an alpha (transparent) channel indicating the area to edit. Max 50MB, and must have the same dimensions as the `image`. |
| **`size`** | `string` | No | The desired output dimensions. Default is `"auto"`.<br><br>**Popular Sizes:**<br>- `"1024x1024"` (Square)<br>- `"1536x1024"` (Landscape)<br>- `"1024x1536"` (Portrait)<br>- `"3840x2160"` (4K Landscape)<br><br>**Constraints:**<br>- Max edge <= `3840px`.<br>- Edges must be multiples of `16`.<br>- Aspect ratio (long:short) <= `3:1`.<br>- Total pixels between `655,360` and `8,294,400`. |
| **`quality`** | `string` | No | Rendering quality. Valid values: `"low"`, `"medium"`, `"high"`, `"auto"`. Default is `"auto"`. *Note: "low" is best for fast drafts.* |
| **`n`** | `integer` | No | The number of images to generate. Default is `1`. |
| **`response_format`** | `string` | No | The format in which the generated images are returned. Valid values: `"url"` (default), `"b64_json"`. |
| **`output_format`** | `string` | No | The image file extension format. Valid values: `"png"` (default), `"jpeg"`, `"webp"`. |
| **`output_compression`** | `integer` | No | Compression level from `0` to `100`. Only applies if `output_format` is `"jpeg"` or `"webp"`. |
| **`background`** | `string` | No | Background handling. Valid values: `"opaque"`, `"auto"`. *(Note: `gpt-image-2` does not support `"transparent"`).* |
| **`moderation`** | `string` | No | Strictness of the safety filters. Valid values: `"auto"` (default), `"low"`. |
| **`partial_images`** | `integer` | No | Value from `0` to `3`. Used for streaming to receive incomplete partial images during the generation process. |

*Important Note: The `gpt-image-2` model always processes input images at **high fidelity**. The legacy `input_fidelity` parameter has been disabled and should not be used.*

---

## 3. Response Structure

### 3.1 Example with `response_format: "url"` (Default)

```json
{
  "created": 1714000000,
  "data": [
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/private/...",
      "revised_prompt": "A highly detailed photorealistic image of..."
    }
  ],
  "usage": {
    "input_tokens": 1500,
    "input_tokens_details": {
      "image_tokens": 1400,
      "text_tokens": 100
    },
    "output_tokens": 6240,
    "total_tokens": 7740
  }
}
```

### 3.2 Example with `response_format: "b64_json"`

```json
{
  "created": 1714000000,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUg...",
      "revised_prompt": "A highly detailed photorealistic image of..."
    }
  ],
  "usage": {
    ...
  }
}
```

---

## 4. Examples

### Example 4.1: Generate an Image (Text-to-Image)

**cURL**
```bash
curl -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "A cyberpunk city at night with neon lights and flying cars",
    "size": "1536x1024",
    "quality": "high",
    "response_format": "url"
  }'
```

**Python**
```python
from openai import OpenAI

client = OpenAI()

response = client.images.generate(
    model="gpt-image-2",
    prompt="A cyberpunk city at night with neon lights and flying cars",
    size="1536x1024",
    quality="high",
    response_format="url"
)

print(response.data[0].url)
```

---

### Example 4.2: Edit Image using 4 Reference Images (Image-to-Image)

When creating a new image based on multiple reference images, you must use the `/v1/images/edits` endpoint with `multipart/form-data`.

> [!WARNING]
> **Using External URLs as Reference Images**
> If your source images are hosted online (e.g., HTTP URLs), you **must** download them into binary data (memory or disk) before sending the request. Passing an array of URL strings directly into the `image` parameter (or within a JSON body) will result in the AI ignoring the visual inputs (0 image tokens), and it will generate an image based purely on the text prompt.


**cURL**
```bash
curl -X POST "https://api.openai.com/v1/images/edits" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=gpt-image-2" \
  -F "prompt=Generate a photorealistic image of a gift basket on a white background labeled 'Relax & Unwind', containing all the items in the reference pictures." \
  -F "image[]=@body-lotion.png" \
  -F "image[]=@bath-bomb.png" \
  -F "image[]=@incense-kit.png" \
  -F "image[]=@soap.png" \
  -F "response_format=url"
```

**Python**
```python
from openai import OpenAI

client = OpenAI()

prompt = "Generate a photorealistic image of a gift basket on a white background labeled 'Relax & Unwind', containing all the items in the reference pictures."

response = client.images.edit(
    model="gpt-image-2",
    prompt=prompt,
    image=[
        open("body-lotion.png", "rb"),
        open("bath-bomb.png", "rb"),
        open("incense-kit.png", "rb"),
        open("soap.png", "rb")
    ],
    response_format="url"
)

print(response.data[0].url)
```

**Node.js (JavaScript)**
```javascript
import fs from "fs";
import OpenAI, { toFile } from "openai";

const client = new OpenAI();

async function main() {
  const prompt = "Generate a photorealistic image of a gift basket on a white background labeled 'Relax & Unwind', containing all the items in the reference pictures.";

  const imageFiles = [
    "body-lotion.png",
    "bath-bomb.png",
    "incense-kit.png",
    "soap.png"
  ];

  const images = await Promise.all(
    imageFiles.map(async (file) =>
      await toFile(fs.createReadStream(file), null, { type: "image/png" })
    )
  );

  const response = await client.images.edit({
    model: "gpt-image-2",
    prompt: prompt,
    image: images,
    response_format: "url"
  });

  console.log(response.data[0].url);
}

main();
```

---

### Example 4.3: Requesting Base64 Output with WebP format

If you prefer to receive the raw image data immediately (to save network requests) and want to save bandwidth, you can request `b64_json` as the response format and `webp` as the output format.

**cURL**
```bash
curl -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "A cute baby otter in a river",
    "size": "1024x1024",
    "response_format": "b64_json",
    "output_format": "webp",
    "output_compression": 80
  }' | jq -r '.data[0].b64_json' | base64 --decode > otter.webp
```

**Python**
```python
import base64
from openai import OpenAI

client = OpenAI()

response = client.images.generate(
    model="gpt-image-2",
    prompt="A cute baby otter in a river",
    size="1024x1024",
    response_format="b64_json",
    output_format="webp",
    output_compression=80
)

image_base64 = response.data[0].b64_json
image_bytes = base64.b64decode(image_base64)

with open("otter.webp", "wb") as f:
    f.write(image_bytes)
```
