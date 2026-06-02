# Đánh giá Kế hoạch Di trú Vertex CLI Proxy Toggle - Nhãn quan Flow Tracer

Tôi đã hoàn thành việc rà soát và đối chiếu kế hoạch hành động trong thư mục `plans/260602-1520-vertex-cli-proxy-toggle/` với mã nguồn hiện tại của dự án. Dưới đây là các lỗi thiết kế, kịch bản thất bại và các điểm mâu thuẫn được phát hiện. Không có lời khen ngợi nào ở đây, chỉ có các vấn đề cần phải sửa đổi ngay lập tức để tránh làm hỏng ứng dụng.

---

## 1. Danh sách các phát hiện nghiêm trọng (Critical & High Severity)

### Phát hiện 1: Lỗi sập hệ thống do cấu hình `ThinkingConfig` cứng tại Text Service
- **Vị trí**: 
  - [src/services/gemini/text.ts:L13-16](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/gemini/text.ts#L13-16) (hàm `generateText`)
  - [src/services/gemini/text.ts:L219-221](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/gemini/text.ts#L219-221) (hàm `generateStylePromptFromImage`)
  - [src/services/gemini/text.ts:L278-280](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/gemini/text.ts#L278-280) (hàm `analyzeScene`)
- **Mức độ nghiêm trọng**: **Critical** (Nghiêm trọng)
- **Kịch bản thất bại**: 
  Kế hoạch di trú tại Phase 4 quyết định chuyển model mặc định sang `gemini-3.5-flash` và model Pro sang `gemini-3.1-pro`. Kế hoạch nêu rằng *"không cần thiết lập giới hạn thinkingBudget vì cấu hình mặc định không thực thi chế độ thinking"*. 
  Tuy nhiên, trong mã nguồn thực tế, tham số cấu hình `thinkingConfig` (với `thinkingBudget: 32768`) bị **khóa cứng** trực tiếp trong cấu hình yêu cầu của cả 3 hàm tạo văn bản trên. Khi gọi API Gemini với model `gemini-3.5-flash` (là một model không hỗ trợ khả năng suy nghĩ/thinking), API của Google sẽ lập tức trả về lỗi **HTTP 400 Bad Request** với thông báo *"Thinking config is not supported for this model"*. Tất cả các luồng tạo text mặc định sẽ bị lỗi hoàn toàn.

### Phát hiện 2: Mất đồng bộ cấu hình Proxy khi khởi động lại ứng dụng
- **Vị trí**: 
  - [src/contexts/ApiProviderContext.tsx](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/contexts/ApiProviderContext.tsx)
  - [src/services/apiClient.ts](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/apiClient.ts)
- **Mức độ nghiêm trọng**: **High** (Cao)
- **Kịch bản thất bại**:
  Theo mô tả trong Phase 2, các cấu hình proxy (`vertexProxyEnabled`, `vertexProxyUrl`, `vertexProxyApiKey`) sẽ được lưu vào `localStorage` và cập nhật thông qua hàm Save trên giao diện. 
  Tuy nhiên, kế hoạch hoàn toàn bỏ qua việc đồng bộ hóa các thông tin lưu trữ này sang singleton `apiClient.ts` khi ứng dụng khởi động (mount). Khi người dùng refresh trang, mặc dù giao diện Settings vẫn hiển thị Proxy đang được "Bật" (do đọc trực tiếp từ `safeStorage`), đối tượng SDK `GoogleGenAI` trong `apiClient.ts` lại được khởi tạo lại theo cấu hình mặc định (gọi trực tiếp tới Google API, không có URL proxy). Điều này dẫn đến lỗi xác thực hoặc kết nối sai địa chỉ âm thầm.

### Phát hiện 3: Sai lệch tên model cứng của các hàm helper và lỗi tìm-thay-thế
- **Vị trí**: 
  - `plans/260602-1520-vertex-cli-proxy-toggle/phase-04-model-fallback-cleanup.md` (Dòng 30 và 66)
  - [src/services/gemini/text.ts:L64](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/gemini/text.ts#L64) (`generateImageDescription`)
  - [src/services/gemini/text.ts:L113](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/gemini/text.ts#L113) (`generateClothingDescription`)
  - [src/services/gemini/text.ts:L161](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/gemini/text.ts#L161) (`generatePoseDescription`)
- **Mức độ nghiêm trọng**: **High** (Cao)
- **Kịch bản thất bại**:
  Kế hoạch yêu cầu: *"Di chuyển các helper Gemini text nội bộ đang bị fix cứng sang `gemini-2.5-flash` sang `gemini-3.5-flash`"*. 
  Nhưng thực tế, các helper này trong mã nguồn đang được khóa cứng với model `'gemini-3-flash'`, hoàn toàn không tồn tại chuỗi `'gemini-2.5-flash'` trong file `text.ts`. Do đó, lệnh tìm kiếm và thay thế tự động sẽ thất bại hoặc không thay đổi gì trong mã nguồn sản phẩm. Ngược lại, Phase 4 và Phase 5 lại hướng dẫn cập nhật các tệp kiểm thử (như `text.test.ts`) để mong đợi kết quả trả về sử dụng model `gemini-3.5-flash`. Sự không khớp này sẽ làm hỏng bộ suite kiểm thử tự động (`npm run test`) ngay lập tức.

### Phát hiện 4: Thiếu kiểm tra an toàn nội dung (Safety Checks) trong luồng tạo ảnh qua Proxy
- **Vị trí**: 
  - `plans/260602-1520-vertex-cli-proxy-toggle/phase-03-proxy-image-generation.md` (Thiết kế luồng phân tích phản hồi)
  - [src/services/gemini/image.ts:L134-161](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/gemini/image.ts#L134-161)
- **Mức độ nghiêm trọng**: **High** (Cao)
- **Kịch bản thất bại**:
  Trong luồng tạo ảnh trực tiếp (`generateImages`), SDK tự động ném ra ngoại lệ nếu xảy ra lỗi. Tuy nhiên, đối với luồng Proxy sử dụng `generateContent` với cấu hình định dạng ảnh, kế hoạch chỉ mô tả thuật toán phân tích cú pháp đơn giản: `candidates → content.parts → inlineData`. 
  Kế hoạch hoàn toàn bỏ qua việc xác thực trạng thái `finishReason` của candidate (ví dụ: `SAFETY`, `RECITATION`, `OTHER`). Khi người dùng gửi một prompt bị bộ lọc của Google chặn lại, API trả về danh sách `parts` trống rỗng. Việc truy cập trực tiếp `content.parts[0].inlineData` mà không kiểm tra an toàn trước sẽ gây ra lỗi runtime loại `TypeError: Cannot read properties of undefined (reading 'parts')`. Ứng dụng sẽ bị crash thay vì báo lỗi an toàn chi tiết giống như luồng trực tiếp (`error.api.safetyBlock`).

---

## 2. Các phát hiện mức độ trung bình (Medium Severity)

### Phát hiện 5: Lặp lại yêu cầu Fallback dư thừa gây tăng độ trễ (Redundant Fallback)
- **Vị trí**: 
  - `plans/260602-1520-vertex-cli-proxy-toggle/phase-04-model-fallback-cleanup.md` (Luồng xử lý lỗi tạo ảnh)
  - [src/services/gemini/image.ts](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/gemini/image.ts)
- **Mức độ nghiêm trọng**: **Medium** (Trung bình)
- **Kịch bản thất bại**:
  Kế hoạch yêu cầu khi luồng tạo ảnh qua proxy lỗi (do hạn ngạch hoặc lỗi không hỗ trợ) sẽ tự động thử lại (fallback) bằng model `imagen-4.0-fast-generate-001`. 
  Nhưng kế hoạch không có bước kiểm tra xem model được yêu cầu ban đầu có phải đã là `imagen-4.0-fast-generate-001` hay chưa. Nếu người dùng chọn chính model Fast này từ đầu và gặp lỗi quá hạn ngạch (quota exceeded), hệ thống sẽ gửi thêm một yêu cầu trùng lặp vô ích tới chính model đó, làm tăng gấp đôi thời gian chờ mạng (latency) của người dùng một cách vô nghĩa trước khi hiển thị thông báo lỗi.

### Phát hiện 6: Bỏ quan tham số model cấu hình tại Text Service Facade
- **Vị trí**: 
  - [src/services/textService.ts:L84](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/textService.ts#L84)
  - [src/services/textService.ts:L118](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/textService.ts#L118)
  - [src/services/textService.ts:L152](file:///media/monet/SSD%20Web/CodeBase/chang-store/src/services/textService.ts#L152)
- **Mức độ nghiêm trọng**: **Medium** (Trung bình)
- **Kịch bản thất bại**:
  Trong lớp trung gian `textService.ts`, các hàm như `generateImageDescription`, `generateClothingDescription` và `generatePoseDescription` đều chấp nhận tham số cấu hình model từ cấp trên (UI/Hook). Tuy nhiên, khi gọi xuống các hàm thực thi của `geminiTextService`, các hàm này lại hoàn toàn bỏ qua việc truyền tham số model đó đi và chỉ truyền đối tượng ảnh `image` (`geminiTextService.generateImageDescription(image)`). Điều này khiến cấu hình model người dùng lựa chọn ở tầng trên không bao giờ có hiệu lực cho các tác vụ này.

---

## 3. Khuyến nghị điều chỉnh hành động

1. **Khắc phục lỗi ThinkingConfig**: Tại `src/services/gemini/text.ts`, phải bổ sung logic để kiểm tra xem model có hỗ trợ suy nghĩ hay không trước khi thêm `thinkingConfig` vào tham số gửi đi. Hoặc chỉ thêm `thinkingConfig` khi model là `gemini-2.5-pro` hoặc `gemini-3.1-pro` (nếu kiểm chứng hỗ trợ).
2. **Khởi tạo đồng bộ khi Mount**: Thêm một `useEffect` trong `ApiProviderContext.tsx` chạy khi mount để kiểm tra nếu `vertexProxyEnabled` là true thì lập tức gọi `setGeminiBaseUrl(vertexProxyUrl)` và `setGeminiApiKey(vertexProxyApiKey)`.
3. **Sửa đổi chuỗi tìm kiếm model**: Đổi chuỗi đích từ `gemini-2.5-flash` thành `gemini-3-flash` khi viết tài liệu di trú mã nguồn của các helper trong `text.ts`.
4. **Bổ sung Safety Check**: Sao chép phần logic kiểm tra `finishReason` và `promptFeedback` từ luồng tạo ảnh gốc hoặc hàm `editImage` sang luồng tạo ảnh mới bằng proxy.
5. **Chặn vòng lặp Fallback**: Thêm điều kiện `if (model !== 'imagen-4.0-fast-generate-001')` trước khi kích hoạt luồng fallback tự động trong luồng tạo ảnh proxy.
