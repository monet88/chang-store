# Local ComfyUI — Qwen-Image 2.1 API Guide

> Measured live: **2026-09-21**
> Base URL: `http://127.0.0.1:8188`
> Target Hardware: Windows 11, NVIDIA GeForce RTX 2060 SUPER (8GB VRAM), 32GB System RAM.
> Upstream Repo: `https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF`

This document details the installation, model files, workflow architecture, and measured hardware performance of running **Qwen-Image 2.1** locally on ComfyUI as Chang Store's desktop-only four-workflow studio (**Virtual Try-On**, **Clothing Transfer**, **Identity Transfer**, and **AI Editor**).

---

## 1. Mục đích & Phạm vi sử dụng

- **Mục đích chính:** Cung cấp studio tạo và chỉnh sửa ảnh thời trang hoàn toàn cục bộ (offline / on-device) trên desktop thông qua runtime ComfyUI local, đảm bảo quyền riêng tư dữ liệu, không phụ thuộc vào kết nối đám mây và không tự động fallback sang cloud providers (Gemini / GPT Image).
- **Phân định ranh giới (Cloud vs Local):**
  - **Cloud Studios (Google Gemini / OpenAI GPT Image qua Gateway):** Ưu tiên cho các tác vụ thời trang thông thường trực tuyến. Tốc độ xử lý nhanh (**3 – 6 giây**), không tiêu tốn tài nguyên GPU / VRAM cục bộ.
  - **Local Qwen Studio (Qwen-Image 2.1 qua ComfyUI loopback):** Studio độc lập trên ứng dụng Desktop Electron dành cho 4 quy trình (Virtual Try-On, Clothing Transfer, Identity Transfer, AI Editor). Chạy tuần tự (serial: tối đa 1 job tại một thời điểm), không tự động fallback sang cloud khi gặp lỗi, kiểm soát tài nguyên VRAM trên máy local (**~2 – 3 phút** trên GPU 8GB VRAM).
---

## 2. Thông tin cài đặt trên máy Local

| Hạng mục | Vị trí / Thông số |
| :--- | :--- |
| **Thư mục cài đặt** | `D:\ComfyUI_windows_portable\` |
| **Phiên bản ComfyUI** | `v0.37.0` (Standalone Portable with Embedded Python 3.13) |
| **File thực thi khởi động** | `D:\ComfyUI_windows_portable\run_nvidia_gpu.bat` |
| **Cổng dịch vụ** | `http://127.0.0.1:8188` |
| **Custom Node bắt buộc** | `ComfyUI-GGUF` (nhánh `leejet` hỗ trợ native Qwen-Image 2.1) |
| **Vị trí Custom Node** | `D:\ComfyUI_windows_portable\ComfyUI\custom_nodes\ComfyUI-GGUF\` |

---

## 3. Danh mục Model đã tải (`abenzerps/Qwen-Image-2.1-Uncensored-GGUF`)

Toàn bộ model đặt trong `D:\ComfyUI_windows_portable\ComfyUI\models\`:

| Thành phần | Tên File | Dung lượng | Thư mục đích | Vai trò |
| :--- | :--- | :--- | :--- | :--- |
| **Diffusion DiT** | `qwen-image-2.1-Q4_K_M.gguf` | 4.60 GB (4,604,557,984 bytes) | `models/diffusion_models/` | Core diffusion model, lượng tử hóa 4-bit, bypass NSFW |
| **Text/Vision Encoder (active)** | `qwen3vl_8b_w4a8.safetensors` | 6.31 GB (6,312,105,364 bytes) | `models/text_encoders/` | Official Comfy-Org W4A8; đã verify SHA256 + VTO end-to-end |
| **Text/Vision Encoder (rollback)** | `qwen3vl_8b_int8_convrot.safetensors` | 9.35 GB (9,350,798,360 bytes) | `models/text_encoders/` | Bản cũ giữ lại để rollback |
| **VAE** | `qwen_image_2.1_vae_bf16.safetensors` | 676 MB (675,509,688 bytes) | `models/vae/` | Mã hóa và giải mã latent sang pixel ảnh |

> **RTX 2060 SUPER 8GB:** `qwen3vl_8b_w4a8.safetensors` đang là encoder active. File đã verify SHA256 `7754425e55e7bea2bfde4dde59a4cc236cb44e5ee9c215ea66ef8d47012824eb` và chạy VTO thành công. Giữ bản INT8 để rollback.

---

## 4. Đo đạc hiệu năng thực tế (Measured on RTX 2060 SUPER 8GB)

Đo đạc thực tế qua `nvidia-smi` và logs ComfyUI ngày 2026-09-21:

### Tác vụ 1: Text-to-Image (768x768, 20 steps, Euler, Simple)
- **Prompt:** *"A beautiful cinematic portrait of a young Vietnamese girl wearing a white silk ao dai in Hoi An ancient town..."*
- **GPU VRAM:** 7.4 GB / 8.0 GB (92% VRAM).
- **GPU Core Load:** 89% – 100%, công suất đỉnh 174W / 184W.
- **Tốc độ render GPU:** ~4.2s / step.
- **Tổng thời gian hoàn tất:** **261 giây (~4.3 phút)** (bao gồm thời gian nạp model lần đầu vào RAM).
- **Ảnh kết quả:** `D:\ComfyUI_windows_portable\ComfyUI\output\Qwen2_1_Test_00001_.png`.

### Tác vụ 2: Virtual Try-On (VTO) với ảnh thực tế (`images-test/model-2.jpg` + `images-test/des-1.png`)
- **Đầu vào:**
  - Mẫu: `model-2.jpg` (áo đỏ bèo nhún + quần jean ống rộng + giày đỏ trong shop thời trang).
  - Đồ thay: `des-1.png` (áo ren trắng tay bồng xuyên thấu + quần short ren đen + vòng cổ ngọc trai).
- **Cấu hình tối ưu:** Resolution 512, Steps 16, CFG 1.0, Sampler Euler, Scheduler Simple.
- **GPU VRAM:** 6.7 – 7.4 GB / 8.0 GB.
- **Tốc độ Denoising GPU:** 4.24s / step (16 steps GPU mất ~68 giây).
- **Tổng thời gian hoàn tất:** **194.14 giây (~3.2 phút)**.
- **Chất lượng VTO:** Giữ nguyên 100% bối cảnh shop thời trang, dáng đứng, giày đỏ; bóc tách áo đỏ và quần jean để thay hoàn hảo set áo ren trắng + quần short đen ren.
- **Ảnh kết quả:** `D:\ComfyUI_windows_portable\ComfyUI\output\Qwen_VTO_Model2_00001_.png`.

### Tác vụ 3: VTO sau tối ưu DynamicVRAM + W4A8
- **Encoder:** `qwen3vl_8b_w4a8.safetensors`.
- **Startup:** DynamicVRAM mặc định; không dùng `--disable-dynamic-vram`.
- **Cấu hình:** Resolution 512, Steps 16, CFG 1.0, Euler, Simple.
- **Idle VRAM sau restart:** khoảng 0.7 GB used / 7.5 GB free trước khi load model.
- **Load/encode sample:** khoảng 3.3 GB VRAM used.
- **Peak denoising quan sát:** khoảng 6.8 GB VRAM used, GPU ~99%.
- **Tổng thời gian hoàn tất:** **212.65 giây (~3.5 phút)**.
- **Kết luận:** tối ưu này giảm footprint encoder và VRAM idle/load rõ rệt; không chứng minh tăng tốc inference. Peak denoise vẫn chủ yếu do diffusion model `Q4_K_M`.
- **Ảnh kết quả:** `D:\ComfyUI_windows_portable\ComfyUI\output\Qwen_VTO_Model2_00002_.png`.

### Tác vụ 4: VTO native 1K (1024px) với bikini
- **Encoder:** `qwen3vl_8b_w4a8.safetensors`.
- **Cấu hình:** Resolution 1024, Steps 16, CFG 1.0, Euler, Simple.
- **Peak VRAM quan sát khi denoise:** khoảng **7,440 MiB / 8,192 MiB**, chỉ còn khoảng **752 MiB free**, GPU 100%.
- **Kết quả:** job hoàn tất và tạo ảnh `D:\ComfyUI_windows_portable\ComfyUI\output\Qwen_VTO_1K_Bikini_00001_.png`.
- **Kết luận:** native 1K chạy được trên RTX 2060 SUPER 8GB nhưng headroom quá thấp để dùng làm mặc định production; input lớn hơn, fragmentation hoặc workload khác có thể đẩy job vào OOM.

---

## 5. Cấu trúc Node Workflow ComfyUI (API Format)

Để chạy được Qwen-Image 2.1 GGUF trên ComfyUI backend qua API `/prompt`:

1. **`UnetLoaderGGUF`:**
   - Input: `{"unet_name": "qwen-image-2.1-Q4_K_M.gguf"}`
   - Output: `MODEL`
2. **`CLIPLoader`:**
   - Input khuyến nghị: `{"clip_name": "qwen3vl_8b_w4a8.safetensors", "type": "qwen_image"}`
   - Fallback hiện tại: `{"clip_name": "qwen3vl_8b_int8_convrot.safetensors", "type": "qwen_image"}`
   - Output: `CLIP`
3. **`VAELoader`:**
   - Input: `{"vae_name": "qwen_image_2.1_vae_bf16.safetensors"}`
   - Output: `VAE`
4. **`TextEncodeQwenImage21`:**
   - Cho phép cắm ảnh tham chiếu qua `images.image_1`, `images.image_2`, v.v.
   - Nhận `resolution` (khuyên dùng 512 trên GPU 8GB; 768/1024 là opt-in).
   - Outputs: `positive` (CONDITIONING), `negative` (CONDITIONING), `latent` (LATENT rỗng khớp kích thước).
5. **`KSampler`:**
   - `model`: Nối từ `UnetLoaderGGUF`.
   - `positive`, `negative`, `latent_image`: Nối từ `TextEncodeQwenImage21`.
   - Khuyên dùng: `cfg: 1.0`, `sampler_name: "euler"`, `scheduler: "simple"`, `steps: 12 - 16`.
6. **`VAEDecode` & `SaveImage`:** Giải mã latent ra ảnh và lưu vào `ComfyUI/output`.


### 5.1 Endpoints & Protocol Contract (ComfyUI HTTP + WebSocket)

Chang Store's desktop bridge communicates with local ComfyUI exclusively over strict loopback `http://127.0.0.1:8188` (or configured port) to prevent DNS rebinding vulnerabilities (`localhost` hostname resolution is intentionally rejected):

1. **`GET /system_stats`**:
   - Probe & health check.
   - Response: `{ system: { os: string, argv: string[] }, devices: [...] }`.
2. **`GET /object_info/{node_class}`**:
   - Custom node presence and model existence verification (`UnetLoaderGGUF`, `TextEncodeQwenImage21`).
   - Response: JSON object describing inputs, outputs, and model file enum list.
3. **`POST /upload/image`**:
   - Multipart form-data upload for reference images and upscale source images.
   - Fields: `image` (binary file), `overwrite` (`true`).
   - Response: `{ name: string, subfolder?: string, type?: string }`.
4. **`POST /prompt`**:
   - Submit workflow graph for text-to-image/VTO or bicubic upscale.
   - Request payload: `{ prompt: Record<string, unknown>, client_id: string }`.
   - Response: `{ prompt_id: string, number: number, node_errors: unknown }`.
5. **`GET /history/{promptId}`**:
   - Poll execution state and output asset metadata.
   - Response: `{ [promptId]: { status: { status_str: "success" | "error", messages?: unknown }, outputs: { [nodeId]: { images: Array<{ filename: string, subfolder?: string, type?: string }> } } } }`.
6. **`GET /view?filename=...&subfolder=...&type=...`**:
   - Download rendered image array buffer converted to base64.
   - Query params: `filename` (required), `subfolder`, `type`.
7. **`POST /interrupt`**:
   - Immediately cancel in-flight execution on KSampler.
   - Handled with timeout (1500ms) to prevent UI hanging if ComfyUI queue is blocked.
8. **`WS /ws?clientId={clientId}`**:
   - Real-time progress updates (`{"type": "progress", "data": { "value": number, "max": number }}`) and interruption notifications (`{"type": "execution_interrupted"}`).
---

## 6. Cấu hình nhẹ khuyến nghị cho GPU 8GB

- **Giữ DynamicVRAM bật**: không truyền `--disable-dynamic-vram`. Đây là mặc định nên không cần thêm flag.
- **Không ép `--lowvram` trước**: chỉ thử nếu DynamicVRAM vẫn không đủ VRAM cho workload thật.
- **Encoder**: ưu tiên `qwen3vl_8b_w4a8.safetensors`; đây là thay đổi giảm footprint lớn nhất mà không đổi Qwen-Image 2.1.
- **Diffusion**: giữ `Q4_K_M` trước. Chỉ cân nhắc `Q4_0` nếu vẫn thiếu VRAM sau khi đổi encoder và bật DynamicVRAM.
- **VTO production**: 512 px, 12–16 steps, CFG 1.0, Euler, Simple.
- **Output mặc định**: giữ kết quả VTO ở **512 px** để user review trước. Chỉ upscale 2x lên 1024 px khi user bấm Upscale cho ảnh đã chọn.
- **Native 1K**: chỉ dùng khi cần kiểm chứng chất lượng cuối cùng ở diffusion resolution cao; test thực tế đã lên khoảng **7.44 GB VRAM** và chỉ còn ~**752 MB** headroom.
- **Upscale**: ưu tiên upscale sau khi VTO đã ổn định composition/garment/body ở 512 px; có thể thêm một pass sharpen/detail nhẹ sau upscale nếu cần ảnh social/fashion sắc hơn.
- **`--cpu-vae`**: chỉ dùng khi cần nhường thêm VRAM; đổi lại decode chậm hơn.
- **`--cache-none`**: chỉ dùng nếu RAM/VRAM cache là bottleneck thực tế; đổi lại các node sẽ phải chạy lại nhiều hơn.

### Desktop app settings contract

Local Qwen is a **desktop-only** studio. The browser build does not expose its settings or runtime.

The desktop Settings surface may change the defaults used by the next Local Qwen job:

- **Resolution:** `512 | 768 | 1024`; default `512`.
- **Steps:** `1–50`; default `16`.
- **CFG:** `0.1–10.0`; default `1.0`.
- **Sampler:** `Euler | Euler a | DPM++ 2M | DPM++ 2M SDE`; default `Euler`.
- **Scheduler:** `Simple | Normal | Karras`; default `Simple`.
- **ComfyUI folder:** desktop-local path, auto-detecting `D:\ComfyUI_windows_portable` when available.

`1024` is allowed but should display a warning rather than be blocked: measured native 1K VTO used about 7.44 GB VRAM on the target 8 GB GPU.

Settings apply to the **next** generation job only. They do not mutate a job already running.

Upscale is never automatic. The user reviews the generated result first and explicitly chooses Upscale only for an image worth keeping.

---

## 7. Chang Store integration contract

### 7.1 Product boundary

- Local Qwen is exposed only by the **Electron desktop app** as a third Studio Mode: `localQwen`.
- The browser build does not render the Local Qwen studio, settings, controls, or process lifecycle.
- Initial Local Qwen Feature scope:
  - Virtual Try-On
  - Clothing Transfer
  - Identity Transfer
  - AI Editor
- Local Qwen is explicit user intent, never an automatic fallback from Gemini/GPT Image.
- A Local Qwen failure never sends the same images or prompt to cloud automatically.

### 7.2 Prompt ownership

Local Qwen owns a Qwen-specific prompt family. Reuse model-agnostic inputs such as Feature state, source-item classification, AI Scan blueprint, garment scope, background instruction, and user notes, but do not reuse Gemini or GPT wording verbatim.

Target shape:

```text
Feature UI/state
  -> model-agnostic prompt input
  -> Qwen-specific prompt builder
  -> Local ComfyUI image driver
  -> ComfyUI /prompt + progress
  -> result ImageFile
  -> existing Chang Store gallery/result actions
```

For reference-heavy Features, role ordering must be deterministic:

```text
image_1 = primary subject/destination
image_2..N = source/reference images in Feature-defined order
```

AI Editor is intentionally freer than the three structured fashion Features. The user's edit prompt is authoritative; the Qwen builder adds only minimal image-role mapping and execution framing. It must not silently inject strong face/body/background preservation rules unless the user's prompt or Feature contract requires them.

### 7.3 AI Editor reference limit

- Local Qwen AI Editor accepts at most **4 reference images per job**.
- Existing `@imgN` mention semantics remain.
- If mentions are present, send only the mentioned images, capped at 4.
- Invalid mentions fail before queueing.
- If there are no mentions, send at most the first 4 uploaded images and make that limit visible in the desktop UI.

### 7.4 Runtime ownership and lifecycle

The Electron main process owns Local ComfyUI lifecycle; the renderer never spawns arbitrary processes.

- On first Local Qwen use, probe `127.0.0.1:8188`.
- If no compatible ComfyUI is running, Chang Store starts the configured local instance.
- If an instance was already running before Chang Store started it, treat that instance as externally owned.
- Chang Store may stop only the ComfyUI process it spawned.
- Switching away from Local Qwen keeps an app-owned process warm.
- **Release GPU/RAM** stops the app-owned ComfyUI process completely. For an externally owned instance, it must not kill the process.
- On desktop app quit:
  1. cancel an active app-owned job,
  2. stop app-owned ComfyUI,
  3. continue application quit.
- Browser builds have no equivalent process API.

### 7.5 Job execution

- Local Qwen generation is **serial: one active job at a time** on the target 8 GB GPU.
- Do not reuse the cloud batch concurrency of 3 for Local Qwen.
- Queue/progress UI exposes only useful state:
  - `Starting`
  - `Ready`
  - `Generating`
  - `Error`
  - `Stopped`
  - sampling progress such as `7 / 16 steps`
- Main Feature UI does not expose ComfyUI node graphs, queue internals, or VRAM charts.
- User may cancel an active generation. Cancellation interrupts the current ComfyUI job and returns the Feature to a recoverable state.

### 7.6 Failure behavior

Startup, health, missing-model, invalid-workflow, cancellation, and OOM failures stay local.

The UI should keep the user in Local Qwen Studio and provide:

- a concrete error message,
- **Retry**,
- **Open Settings** where configuration can fix the issue.

No automatic Gemini/GPT fallback is allowed.

### 7.7 Upscale behavior

- Generation and upscale are separate user decisions.
- Local generation returns its configured resolution, default **512**.
- No result is automatically upscaled.
- After reviewing a result, the user can explicitly invoke the existing Upscale action.
- Local Qwen upscale stays local; it must not upload the result to a cloud provider as an implementation shortcut.

### 7.8 Desktop settings

The desktop-only settings surface owns:

- ComfyUI folder
- Resolution: `512 | 768 | 1024`, default `512`
- Steps: `1–50`, default `16`
- CFG: `0.1–10.0`, default `1.0`
- Sampler: `Euler | Euler a | DPM++ 2M | DPM++ 2M SDE`, default `Euler`
- Scheduler: `Simple | Normal | Karras`, default `Simple`

Do not expose every ComfyUI sampler/scheduler in phase 1. The Settings values apply to the next job only.

Selecting `1024` shows a warning but remains allowed because the measured target GPU runs close to its VRAM ceiling at native 1K.

### 7.9 Minimal desktop bridge surface

Keep the preload boundary named and narrow. The Local Qwen bridge needs only explicit capabilities such as:

```text
status
start
stopOwned
generate
cancel
upscale
```

Do not expose a generic shell/command IPC or generic localhost proxy to the renderer.

### Startup chuẩn

```powershell
D:/ComfyUI_windows_portable/python_embeded/python.exe -s D:/ComfyUI_windows_portable/ComfyUI/main.py --windows-standalone-build --listen 127.0.0.1 --port 8188 --disable-auto-launch
```

Không dùng:

```text
--disable-dynamic-vram
```

---

## 8. Lệnh kiểm tra nhanh (Re-verify Recipe)

```bash
# 1. Khởi động ComfyUI (nếu chưa chạy)
D:/ComfyUI_windows_portable/python_embeded/python.exe -s D:/ComfyUI_windows_portable/ComfyUI/main.py --windows-standalone-build --listen 127.0.0.1 --port 8188 --disable-auto-launch

# 2. Kiểm tra server hoạt động và thông số hệ thống
curl -s http://127.0.0.1:8188/system_stats

# 3. Kiểm tra custom node và model bắt buộc
curl -s http://127.0.0.1:8188/object_info/UnetLoaderGGUF
curl -s http://127.0.0.1:8188/object_info/TextEncodeQwenImage21
```

### Verify DynamicVRAM

```powershell
(Invoke-RestMethod http://127.0.0.1:8188/system_stats).system.argv
```

Kết quả không được chứa `--disable-dynamic-vram`.
