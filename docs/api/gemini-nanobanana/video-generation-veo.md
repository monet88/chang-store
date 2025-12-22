# Generate videos with Veo 3.1 in Gemini API

Generate high-fidelity videos with native audio using Google's Veo 3.1 API.

Source: https://ai.google.dev/gemini-api/docs/video

---

Veo 3.1 is Google's state-of-the-art model for generating high-fidelity, 8-second 720p or 1080p videos featuring stunning realism and natively generated audio. You can access this model programmatically using the Gemini API. To learn more about the available Veo model variants, see the Model Versions section.

Veo 3.1 excels at a wide range of visual and cinematic styles and introduces several new capabilities:

- **Video extension**: Extend videos that were previously generated using Veo.
- **Frame-specific generation**: Generate a video by specifying the first and last frames.
- **Image-based direction**: Use up to three reference images to guide the content of your generated video.

For more information about writing effective text prompts for video generation, see the Veo prompt guide

## Text to video generation

Choose an example to see how to generate a video with dialogue, cinematic realism, or creative animation:

### Python

```python
import time
from google import genai
from google.genai import types

client = genai.Client()

prompt = """A close up of two people staring at a cryptic drawing on a wall, torchlight flickering.
A man murmurs, 'This must be it. That's the secret code.' The woman looks at him and whispering excitedly, 'What did you find?'"""

operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt=prompt,
)

# Poll the operation status until the video is ready.
while not operation.done:
    print("Waiting for video generation to complete...")
    time.sleep(10)
    operation = client.operations.get(operation)

# Download the generated video.
generated_video = operation.response.generated_videos[0]
client.files.download(file=generated_video.video)
generated_video.video.save("dialogue_example.mp4")
print("Generated video saved to dialogue_example.mp4")
```

### JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

const prompt = `A close up of two people staring at a cryptic drawing on a wall, torchlight flickering.
A man murmurs, 'This must be it. That's the secret code.' The woman looks at him and whispering excitedly, 'What did you find?'`;

let operation = await ai.models.generateVideos({
    model: "veo-3.1-generate-preview",
    prompt: prompt,
});

// Poll the operation status until the video is ready.
while (!operation.done) {
    console.log("Waiting for video generation to complete...")
    await new Promise((resolve) => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({
        operation: operation,
    });
}

// Download the generated video.
ai.files.download({
    file: operation.response.generatedVideos[0].video,
    downloadPath: "dialogue_example.mp4",
});
console.log(`Generated video saved to dialogue_example.mp4`);
```

### Go

```go
package main

import (
    "context"
    "log"
    "os"
    "time"

    "google.golang.org/genai"
)

func main() {
    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)
    if err != nil {
        log.Fatal(err)
    }

    prompt := `A close up of two people staring at a cryptic drawing on a wall, torchlight flickering.
    A man murmurs, 'This must be it. That's the secret code.' The woman looks at him and whispering excitedly, 'What did you find?'`

    operation, _ := client.Models.GenerateVideos(
        ctx,
        "veo-3.1-generate-preview",
        prompt,
        nil,
        nil,
    )

    // Poll the operation status until the video is ready.
    for !operation.Done {
    log.Println("Waiting for video generation to complete...")
        time.Sleep(10 * time.Second)
        operation, _ = client.Operations.GetVideosOperation(ctx, operation, nil)
    }

    // Download the generated video.
    video := operation.Response.GeneratedVideos[0]
    client.Files.Download(ctx, video.Video, nil)
    fname := "dialogue_example.mp4"
    _ = os.WriteFile(fname, video.Video.VideoBytes, 0644)
    log.Printf("Generated video saved to %s\n", fname)
}
```

### REST

```bash
# Note: This script uses jq to parse the JSON response.
# GEMINI API Base URL
BASE_URL="https://generativelanguage.googleapis.com/v1beta"

# Send request to generate video and capture the operation name into a variable.
operation_name=$(curl -s "${BASE_URL}/models/veo-3.1-generate-preview:predictLongRunning" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -X "POST" \
  -d '{
    "instances": [{
        "prompt": "A close up of two people staring at a cryptic drawing on a wall, torchlight flickering. A man murmurs, \"This must be it. That'\''s the secret code.\" The woman looks at him and whispering excitedly, \"What did you find?\""
      }
    ]
  }' | jq -r .name)

# Poll the operation status until the video is ready
while true; do
  # Get the full JSON status and store it in a variable.
  status_response=$(curl -s -H "x-goog-api-key: $GEMINI_API_KEY" "${BASE_URL}/${operation_name}")

  # Check the "done" field from the JSON stored in the variable.
  is_done=$(echo "${status_response}" | jq .done)

  if [ "${is_done}" = "true" ]; then
    # Extract the download URI from the final response.
    video_uri=$(echo "${status_response}" | jq -r '.response.generateVideoResponse.generatedSamples[0].video.uri')
    echo "Downloading video from: ${video_uri}"

    # Download the video using the URI and API key and follow redirects.
    curl -L -o dialogue_example.mp4 -H "x-goog-api-key: $GEMINI_API_KEY" "${video_uri}"
    break
  fi
  # Wait for 5 seconds before checking again.
  sleep 10
done
```

## Image to video generation

The following code demonstrates generating an image using Gemini 2.5 Flash Image aka Nano Banana, then using that image as the starting frame for generating a video with Veo 3.1.

### Python

```python
import time
from google import genai

client = genai.Client()

prompt = "Panning wide shot of a calico kitten sleeping in the sunshine"

# Step 1: Generate an image with Nano Banana.
image = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=prompt,
    config={"response_modalities":['IMAGE']}
)

# Step 2: Generate video with Veo 3.1 using the image.
operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt=prompt,
    image=image.parts[0].as_image(),
)

# Poll the operation status until the video is ready.
while not operation.done:
    print("Waiting for video generation to complete...")
    time.sleep(10)
    operation = client.operations.get(operation)

# Download the video.
video = operation.response.generated_videos[0]
client.files.download(file=video.video)
video.video.save("veo3_with_image_input.mp4")
print("Generated video saved to veo3_with_image_input.mp4")
```

### JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

const prompt = "Panning wide shot of a calico kitten sleeping in the sunshine";

// Step 1: Generate an image with Nano Banana.
const imageResponse = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  prompt: prompt,
});

// Step 2: Generate video with Veo 3.1 using the image.
let operation = await ai.models.generateVideos({
  model: "veo-3.1-generate-preview",
  prompt: prompt,
  image: {
    imageBytes: imageResponse.generatedImages[0].image.imageBytes,
    mimeType: "image/png",
  },
});

// Poll the operation status until the video is ready.
while (!operation.done) {
  console.log("Waiting for video generation to complete...")
  await new Promise((resolve) => setTimeout(resolve, 10000));
  operation = await ai.operations.getVideosOperation({
    operation: operation,
  });
}

// Download the video.
ai.files.download({
    file: operation.response.generatedVideos[0].video,
    downloadPath: "veo3_with_image_input.mp4",
});
console.log(`Generated video saved to veo3_with_image_input.mp4`);
```

### Go

```go
package main

import (
    "context"
    "log"
    "os"
    "time"

    "google.golang.org/genai"
)

func main() {
    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)
    if err != nil {
        log.Fatal(err)
    }

    prompt := "Panning wide shot of a calico kitten sleeping in the sunshine"

    // Step 1: Generate an image with Nano Banana.
    imageResponse, err := client.Models.GenerateContent(
        ctx,
        "gemini-2.5-flash-image",
        prompt,
        nil, // GenerateImagesConfig
    )
    if err != nil {
        log.Fatal(err)
    }

    // Step 2: Generate video with Veo 3.1 using the image.
    operation, err := client.Models.GenerateVideos(
        ctx,
        "veo-3.1-generate-preview",
        prompt,
        imageResponse.GeneratedImages[0].Image,
        nil, // GenerateVideosConfig
    )
    if err != nil {
        log.Fatal(err)
    }

    // Poll the operation status until the video is ready.
    for !operation.Done {
        log.Println("Waiting for video generation to complete...")
        time.Sleep(10 * time.Second)
        operation, _ = client.Operations.GetVideosOperation(ctx, operation, nil)
    }

    // Download the video.
    video := operation.Response.GeneratedVideos[0]
    client.Files.Download(ctx, video.Video, nil)
    fname := "veo3_with_image_input.mp4"
    _ = os.WriteFile(fname, video.Video.VideoBytes, 0644)
    log.Printf("Generated video saved to %s\n", fname)
}
```

### Using reference images

Veo 3.1 now accepts up to 3 reference images to guide your generated video's content. Provide images of a person, character, or product to preserve the subject's appearance in the output video.

### Python

```python
import time
from google import genai

client = genai.Client()

prompt = "The video opens with a medium, eye-level shot of a beautiful woman with dark hair and warm brown eyes. She wears a magnificent, high-fashion flamingo dress with layers of pink and fuchsia feathers, complemented by whimsical pink, heart-shaped sunglasses. She walks with serene confidence through the crystal-clear, shallow turquoise water of a sun-drenched lagoon. The camera slowly pulls back to a medium-wide shot, revealing the breathtaking scene as the dress's long train glides and floats gracefully on the water's surface behind her. The cinematic, dreamlike atmosphere is enhanced by the vibrant colors of the dress against the serene, minimalist landscape, capturing a moment of pure elegance and high-fashion fantasy."

dress_reference = types.VideoGenerationReferenceImage(
  image=dress_image, # Generated separately with Nano Banana
  reference_type="asset"
)

sunglasses_reference = types.VideoGenerationReferenceImage(
  image=glasses_image, # Generated separately with Nano Banana
  reference_type="asset"
)

woman_reference = types.VideoGenerationReferenceImage(
  image=woman_image, # Generated separately with Nano Banana
  reference_type="asset"
)

operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt=prompt,
    config=types.GenerateVideosConfig(
      reference_images=[dress_reference, glasses_reference, woman_reference],
    ),
)

# Poll the operation status until the video is ready.
while not operation.done:
    print("Waiting for video generation to complete...")
    time.sleep(10)
    operation = client.operations.get(operation)

# Download the video.
video = operation.response.generated_videos[0]
client.files.download(file=video.video)
video.video.save("veo3.1_with_reference_images.mp4")
print("Generated video saved to veo3.1_with_reference_images.mp4")
```

### Using first and last frames

Veo 3.1 lets you create videos using interpolation, or specifying the first and last frames of the video.

### Python

```python
import time
from google import genai

client = genai.Client()

prompt = "A cinematic, haunting video. A ghostly woman with long white hair and a flowing dress swings gently on a rope swing beneath a massive, gnarled tree in a foggy, moonlit clearing. The fog thickens and swirls around her, and she slowly fades away, vanishing completely. The empty swing is left swaying rhythmically on its own in the eerie silence."

operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt=prompt,
    image=first_image, # Generated separately with Nano Banana
    config=types.GenerateVideosConfig(
      last_frame=last_image # Generated separately with Nano Banana
    ),
)

# Poll the operation status until the video is ready.
while not operation.done:
    print("Waiting for video generation to complete...")
    time.sleep(10)
    operation = client.operations.get(operation)

# Download the video.
video = operation.response.generated_videos[0]
client.files.download(file=video.video)
video.video.save("veo3.1_with_interpolation.mp4")
print("Generated video saved to veo3.1_with_interpolation.mp4")
```

## Extending Veo videos

Use Veo 3.1 to extend videos that you previously generated with Veo by 7 seconds and up to 20 times.

Input video limitations:

- Veo-generated videos only up to 141 seconds long.
- Gemini API only supports video extensions for Veo-generated videos.
- Input videos are expected to have a certain length, aspect ratio, and dimensions:
  - Aspect ratio: 9:16 or 16:9
  - Resolution: 720p
  - Video length: 141 seconds or less

The output of the extension is a single video combining the user input video and the generated extended video for up to 148 seconds of video.

### Python

```python
import time
from google import genai

client = genai.Client()

prompt = "Track the butterfly into the garden as it lands on an orange origami flower. A fluffy white puppy runs up and gently pats the flower."

operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    video=butterfly_video,
    prompt=prompt,
    config=types.GenerateVideosConfig(
        number_of_videos=1,
        resolution="720p"
    ),
)

# Poll the operation status until the video is ready.
while not operation.done:
    print("Waiting for video generation to complete...")
    time.sleep(10)
    operation = client.operations.get(operation)

# Download the video.
video = operation.response.generated_videos[0]
client.files.download(file=video.video)
video.video.save("veo3.1_extension.mp4")
print("Generated video saved to veo3.1_extension.mp4")
```

## Handling asynchronous operations

Video generation is a computationally intensive task. When you send a request to the API, it starts a long-running job and immediately returns an `operation` object. You must then poll until the video is ready, which is indicated by the `done` status being true.

The core of this process is a polling loop, which periodically checks the job's status.

### Python

```python
import time
from google import genai
from google.genai import types

client = genai.Client()

# After starting the job, you get an operation object.
operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt="A cinematic shot of a majestic lion in the savannah.",
)

# Alternatively, you can use operation.name to get the operation.
operation = types.GenerateVideosOperation(name=operation.name)

# This loop checks the job status every 10 seconds.
while not operation.done:
    time.sleep(10)
    # Refresh the operation object to get the latest status.
    operation = client.operations.get(operation)

# Once done, the result is in operation.response.
# ... process and download your video ...
```

### JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

// After starting the job, you get an operation object.
let operation = await ai.models.generateVideos({
  model: "veo-3.1-generate-preview",
  prompt: "A cinematic shot of a majestic lion in the savannah.",
});

// This loop checks the job status every 10 seconds.
while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Refresh the operation object to get the latest status.
    operation = await ai.operations.getVideosOperation({ operation });
}

// Once done, the result is in operation.response.
// ... process and download your video ...
```

## Veo API parameters and specifications

These are the parameters you can set in your API request to control the video generation process.

| Parameter | Description | Veo 3.1 & Veo 3.1 Fast | Veo 3 & Veo 3 Fast | Veo 2 |
| --- | --- | --- | --- | --- |
| `prompt` | The text description for the video. Supports audio cues. | `string` | `string` | `string` |
| `negativePrompt` | Text describing what not to include in the video. | `string` | `string` | `string` |
| `image` | An initial image to animate. | `Image` object | `Image` object | `Image` object |
| `lastFrame` | The final image for an interpolation video to transition. Must be used in combination with the `image` parameter. | `Image` object | `Image` object | `Image` object |
| `referenceImages` | Up to three images to be used as style and content references. | `VideoGenerationReferenceImage` object (Veo 3.1 only) | n/a | n/a |
| `video` | Video to be used for video extension. | `Video` object | n/a | n/a |
| `aspectRatio` | The video's aspect ratio. | `"16:9"` (default, 720p & 1080p), `"9:16"`(720p & 1080p) | `"16:9"` (default, 720p & 1080p), `"9:16"` (720p & 1080p) | `"16:9"` (default, 720p), `"9:16"` (720p) |
| `resolution` | The video's resolution. | `"720p"` (default), `"1080p"` (only supports 8s duration) `"720p"` only for extension | `"720p"` (default), `"1080p"` (16:9 only) | Unsupported |
| `durationSeconds` | Length of the generated video. | `"4"`, `"6"`, `"8"`. Must be "8" when using extension or interpolation (supports both 16:9 and 9:16), and when using `referenceImages` (only supports 16:9) | `"4"`, `"6"`, `"8"` | `"5"`, `"6"`, `"8"` |
| `personGeneration` | Controls the generation of people. | Text-to-video & Extension: `"allow_all"` only. Image-to-video, Interpolation, & Reference images: `"allow_adult"` only | Text-to-video: `"allow_all"` only. Image-to-video: `"allow_adult"` only | Text-to-video: `"allow_all"`, `"allow_adult"`, `"dont_allow"`. Image-to-video: `"allow_adult"`, and `"dont_allow"` |

Note that the `seed` parameter is also available for Veo 3 models. It doesn't guarantee determinism, but slightly improves it.

## Veo prompt guide

This section contains examples of videos you can create using Veo, and shows you how to modify prompts to produce distinct results.

### Safety filters

Veo applies safety filters across Gemini to help ensure that generated videos and uploaded photos don't contain offensive content. Prompts that violate our terms and guidelines are blocked.

### Prompt writing basics

Good prompts are descriptive and clear. To get the most out of Veo, start with identifying your core idea, refine your idea by adding keywords and modifiers, and incorporate video-specific terminology into your prompts.

The following elements should be included in your prompt:

- **Subject**: The object, person, animal, or scenery that you want in your video, such as _cityscape_, _nature_, _vehicles_, or _puppies_.
- **Action**: What the subject is doing (for example, _walking_, _running_, or _turning their head_).
- **Style**: Specify creative direction using specific film style keywords, such as _sci-fi_, _horror film_, _film noir_, or animated styles like _cartoon_.
- **Camera positioning and motion**: [Optional] Control the camera's location and movement using terms like _aerial view_, _eye-level_, _top-down shot_, _dolly shot_, or _worms eye_.
- **Composition**: [Optional] How the shot is framed, such as _wide shot_, _close-up_, _single-shot_ or _two-shot_.
- **Focus and lens effects**: [Optional] Use terms like _shallow focus_, _deep focus_, _soft focus_, _macro lens_, and _wide-angle lens_ to achieve specific visual effects.
- **Ambiance**: [Optional] How the color and light contribute to the scene, such as _blue tones_, _night_, or _warm tones_.

#### More tips for writing prompts

- **Use descriptive language**: Use adjectives and adverbs to paint a clear picture for Veo.
- **Enhance the facial details**: Specify facial details as a focus of the photo like using the word _portrait_ in the prompt.

### Prompting for audio

With Veo 3, you can provide cues for sound effects, ambient noise, and dialogue. The model captures the nuance of these cues to generate a synchronized soundtrack.

- **Dialogue:** Use quotes for specific speech. (Example: "This must be the key," he murmured.)
- **Sound Effects (SFX):** Explicitly describe sounds. (Example: tires screeching loudly, engine roaring.)
- **Ambient Noise:** Describe the environment's soundscape. (Example: A faint, eerie hum resonates in the background.)

### Prompting with reference images

You can use one or more images as inputs to guide your generated videos, using Veo's image-to-video capabilities. Veo uses the input image as the initial frame. Select an image closest to what you envision as the first scene of your video to animate everyday objects, bring drawings and paintings to life, and add movement and sound to nature scenes.

### Negative prompts

Negative prompts specify elements you _don't_ want in the video.

- ❌ Don't use instructive language like _no_ or _don't_. (e.g., "No walls").
- ✅ Do describe what you don't want to see. (e.g., "wall, frame").

### Aspect ratios

Veo lets you specify the aspect ratio for your video.

- **Widescreen (16:9)**: Create a video with a tracking drone view of a man driving a red convertible car in Palm Springs, 1970s, warm sunlight, long shadows.
- **Portrait (9:16)**: Create a video highlighting the smooth motion of a majestic Hawaiian waterfall within a lush rainforest.

## Limitations

- **Request latency:** Min: 11 seconds; Max: 6 minutes (during peak hours).
- **Regional limitations:** In EU, UK, CH, MENA locations, the following are the allowed values for `personGeneration`:
  - Veo 3: `allow_adult` only.
  - Veo 2: `dont_allow` and `allow_adult`. Default is `dont_allow`.
- **Video retention:** Generated videos are stored on the server for 2 days, after which they are removed. To save a local copy, you must download your video within 2 days of generation. Extended videos are treated as newly generated videos.
- **Watermarking:** Videos created by Veo are watermarked using SynthID, our tool for watermarking and identifying AI-generated content.
- **Safety:** Generated videos are passed through safety filters and memorization checking processes that help mitigate privacy, copyright and bias risks.
- **Audio error:** Veo 3.1 will sometimes block a video from generating because of safety filters or other processing issues with the audio. You will not be charged if your video is blocked from generating.

## Model features

| Feature | Description | Veo 3.1 & Veo 3.1 Fast | Veo 3 & Veo 3 Fast | Veo 2 |
| --- | --- | --- | --- | --- |
| **Audio** | Natively generates audio with video. | ✔️ Always on | ✔️ Always on | ❌ Silent only |
| **Input Modalities** | The type of input used for generation. | Text-to-Video, Image-to-Video, Video-to-Video | Text-to-Video, Image-to-Video | Text-to-Video, Image-to-Video |
| **Resolution** | The output resolution of the video. | 720p & 1080p (8s length only) 720p only when using video extension. | 720p & 1080p (16:9 only) | 720p |
| **Frame Rate** | The output frame rate of the video. | 24fps | 24fps | 24fps |
| **Video Duration** | Length of the generated video. | 8 seconds, 6 seconds, 4 seconds. 8 seconds only when using reference images | 8 seconds | 5-8 seconds |
| **Videos per Request** | Number of videos generated per request. | 1 | 1 | 1 or 2 |
| **Status & Details** | Model availability and further details. | Preview | Stable | Stable |

## Model versions

Check out the Pricing and Rate limits pages for more Veo model-specific usage details.

Veo Fast versions allow developers to create videos with sound while maintaining high quality and optimizing for speed and business use cases.

### Veo 3.1 Preview

| Property | Description |
| --- | --- |
| Model code | **Gemini API** `veo-3.1-generate-preview` |
| Supported data types | **Input** Text, Image **Output** Video with audio |
| Limits | **Text input** 1,024 tokens **Output video** 1 |
| Latest update | September 2025 |

### Veo 3.1 Fast Preview

| Property | Description |
| --- | --- |
| Model code | **Gemini API** `veo-3.1-fast-generate-preview` |
| Supported data types | **Input** Text, Image **Output** Video with audio |
| Limits | **Text input** 1,024 tokens **Output video** 1 |
| Latest update | September 2025 |

### Veo 3

| Property | Description |
| --- | --- |
| Model code | **Gemini API** `veo-3.0-generate-001` |
| Supported data types | **Input** Text, Image **Output** Video with audio |
| Limits | **Text input** 1,024 tokens **Output video** 1 |
| Latest update | July 2025 |

### Veo 3 Fast

| Property | Description |
| --- | --- |
| Model code | **Gemini API** `veo-3.0-fast-generate-001` |
| Supported data types | **Input** Text, Image **Output** Video with audio |
| Limits | **Text input** 1,024 tokens **Output video** 1 |
| Latest update | July 2025 |

### Veo 2

| Property | Description |
| --- | --- |
| Model code | **Gemini API** `veo-2.0-generate-001` |
| Supported data types | **Input** Text, image **Output** Video |
| Limits | **Text input** N/A **Image input** Any image resolution and aspect ratio up to 20MB file size **Output video** Up to 2 |
| Latest update | April 2025 |

## What's next

- Get started with the Veo 3.1 API by experimenting in the Veo Quickstart Colab and the Veo 3.1 applet.
- Learn how to write even better prompts with our Introduction to prompt design.

---

Last updated 2025-11-05 UTC.
