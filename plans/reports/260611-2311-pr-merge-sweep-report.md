# Báo cáo review và verify PR

- Thời gian: 2026-06-11 23:11 ICT
- Phạm vi: rà soát các PR mở tại `monet88/chang-store`, verify cục bộ trong khả năng môi trường hiện tại, merge tuần tự các PR đạt yêu cầu.
- Story Harness: `OPS-PR-MERGE-SWEEP`

## Kết luận nhanh

- Đã merge:
  - PR [#39](https://github.com/monet88/chang-store/pull/39) `🎨 Palette: Add descriptive aria-labels to language switcher buttons` tại commit `20c9ac7`
  - PR [#41](https://github.com/monet88/chang-store/pull/41) `⚡ Bolt: optimize base64 encoding with FileReader in downloadImage` tại commit `db6feae`
  - PR [#43](https://github.com/monet88/chang-store/pull/43) `⚡ Bolt: Optimize base64 dataUrl parsing in toGatewayImage` tại commit `45be234`
  - PR [#45](https://github.com/monet88/chang-store/pull/45) `🎨 Palette: Make image overlay buttons keyboard accessible` tại commit `f2aae31`
  - PR [#47](https://github.com/monet88/chang-store/pull/47) `⚡ Bolt: Optimize canvas.toDataURL to canvas.toBlob` tại commit `651ddb1`
  - PR [#48](https://github.com/monet88/chang-store/pull/48) `🛡️ Sentinel: [CRITICAL] Fix timing attack vulnerability in API key check` tại commit `65a38f3`
- Chưa merge:
  - PR `#42`, `#44`, `#46`: bị supersede bởi các PR mới hơn cùng cụm thay đổi đã merge (`#43`, `#47`)
  - PR `#38`: còn giá trị cục bộ ở một số chỗ `split(',')[1]`, nhưng đụng chồng với cụm `imageUtils` đã đổi sang `toBlob`; nên giữ lại để tách/rework thay vì merge nguyên trạng
  - PR `#29`: thêm bundle ECC/agent config diện rộng, chưa đủ bằng chứng cần thiết cho repo hiện tại
  - PR `#28`: nhánh cũ, phạm vi rất lớn, trạng thái không sạch với `main`, lệch kiến trúc SPA/gateway hiện tại nên không an toàn để merge trực tiếp

## Verify đã chạy

- Đã đọc tài liệu bắt buộc: `README.md`, `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/ARCHITECTURE.md`, `docs/CONTEXT_RULES.md`, `AGENTS.md`
- Đã ghi `Harness intake` và tạo story `OPS-PR-MERGE-SWEEP`
- Đã kiểm tra `CodeGraph` index khỏe và đối chiếu mã hiện tại trên `main`
- Với các PR frontend nhỏ:
  - `npx tsc --noEmit`
  - `node node_modules/eslint/bin/eslint.js <các file thay đổi>`
  - `git diff --check main...HEAD`
- Với PR `#48` ở `gateway`:
  - `node node_modules/typescript/bin/tsc -p gateway/tsconfig.json`
  - `node node_modules/eslint/bin/eslint.js gateway/src/auth/gateway-auth.ts`
  - review diff hẹp trên `gateway/src/auth/gateway-auth.ts`

## Phát hiện quan trọng

1. Validate toàn repo bằng `npm run lint` trên một số branch cũ không đáng tin cho tác vụ này.
Lý do: script cũ gọi `eslint`/`vitest` trực tiếp và repo hiện còn nhiều lỗi lint nền trong `.agents/skills/*` không liên quan tới các PR đang review.

2. Validate `gateway` bằng wrapper script đang bị chặn bởi `node_modules` lệch nền tảng.
Biểu hiện: `npm --prefix gateway run compile` và `npm --prefix gateway run test` dừng tại `check-node-platform` do thiếu package native Windows và còn sót package Linux.

3. Nhiều PR mở là bản lặp/chồng lớp chứ không phải thay đổi độc lập.
Hai cụm rõ nhất là `toGatewayImage` (`#42`, `#43`) và `canvas.toBlob` (`#44`, `#46`, `#47`). Merge bản cũ sau khi bản mới đã vào `main` chỉ làm tăng xung đột và nhiễu lịch sử.

4. PR `#45` cần chỉnh branch trước khi merge.
Nội dung hữu ích là a11y cho `HoverableImage`, nhưng branch gốc mang theo `pnpm-lock.yaml` không phù hợp workflow `npm` của repo và thiếu khóa i18n cho `delete`/`viewFull`. Đã chỉnh branch, đẩy lại và merge bản đã làm sạch.

## Điểm số

- Chất lượng mã: 90/100
- Bao phủ kiểm thử cục bộ: 72/100
- Tuân thủ standards/repo rules: 86/100
- Phù hợp yêu cầu người dùng: 95/100
- Nhất quán kiến trúc: 88/100
- Đánh giá rủi ro: 84/100
- Điểm tổng hợp: 87/100
- Khuyến nghị: Needs Discussion

## Giải thích khuyến nghị

- Phần đã merge là hợp lý và có bằng chứng đủ mạnh.
- Phần còn lại không nên merge tiếp theo kiểu “quét sạch” vì đa số là PR đã lỗi thời, trùng nội dung, hoặc lệch hướng kiến trúc hiện tại.
- Nếu muốn xử lý nốt backlog PR mở, nên làm bước hai:
  - đóng `#42`, `#44`, `#46` như superseded
  - tách `#38` thành PR mới nhỏ hơn dựa trên `main` hiện tại
  - review lại `#29` và `#28` như các đề xuất độc lập, không đi cùng đợt merge này

## Checklist review

- Mục tiêu: hoàn tất
- Phạm vi: hoàn tất một phần có kiểm soát
- Deliverables: merge 6 PR, báo cáo này, dấu vết Harness
- Mapping bàn giao: code trên `main`, báo cáo tại `plans/reports/`, story/traces trong Harness
- Đánh giá dependency và rủi ro: hoàn tất
- Kết luận có timestamp: hoàn tất
