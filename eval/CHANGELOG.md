# Eval history

## v1-baseline - 2026-07-30

**Giai đoạn:** Baseline hai cặp PDF/transcript.

**Input:** 26 case cho chat, quiz, flashcard, sai nguồn, câu mơ hồ, ngoài phạm vi, prompt injection và material không tồn tại.

**Output:** 17/26 PASS (65,4%), source isolation 100%, out-of-scope 0%, Gemini live 0/26. Quality bar chưa đạt.

**Kết luận:** Mapping Day 1/Day 2 không trộn citation. Agent vẫn cần scope guard, cơ chế hỏi lại câu mơ hồ và retrieval tốt hơn cho Day 2. Lần chạy này dùng fallback do rate limit nên chưa đủ điều kiện release.

**Quyết định cho version sau:** Tạo suite mới khi bắt đầu thay đổi hành vi; không sửa lại case của `v1-baseline`.

## v2-source-scope - 2026-07-30

**Giai đoạn:** Upload một tài liệu và chọn phạm vi nguồn cho AI.

**Input mới:** Chat theo slide đang xem, chat theo toàn bộ tài liệu, quiz và flashcard từ file tải lên, cùng trường hợp file không trích xuất được nội dung.

**Citation:** Tài liệu lớp tiếp tục dùng `Txx-xxx`; file người dùng tải lên dùng `Pxxx`.

**Output:** 21/30 PASS (70%), source isolation 100%, 5/5 case mới PASS, Gemini live 0/30.

**Kết luận:** Upload, hai phạm vi nguồn, quiz và flashcard từ file tải lên đã đạt exit criteria. Quality bar toàn suite chưa đạt vì các lỗi baseline về câu mơ hồ/ngoài phạm vi vẫn còn và lượt chạy dùng fallback.

## v3-grounding-quality - 2026-07-30

**Giai đoạn:** Chuẩn hóa câu trả lời có căn cứ theo golden set Day 1.

**Input:** 30 case regression v2 và 20 case lấy trực tiếp từ `golden-set.md`, gồm chống bịa, thiếu dữ kiện, từ chối và trả lời đúng trong tài liệu.

**Output:** 50/50 PASS (100%), source isolation 100%, out-of-scope 100%. Cấu trúc chat bắt buộc có `answer`, `evidence`, `confidence`, `note` và `citations`.

**Kết luận:** Toàn bộ hành vi và schema đạt khi chạy bằng fallback có căn cứ. Gemini trả HTTP 429 do quota nên có 0/50 response live; quality gate live chưa đạt và cần chạy lại sau khi quota API được cấp.

**Báo cáo:** `results/v3-grounding-quality/2026-07-30T15-48-12-952Z.json`.

## v4-slide-primary-annotations - 2026-07-31

**Giai đoạn:** Annotation, VI/EN và đổi thứ tự ưu tiên nguồn.

**Input:** 30 case regression, 20 case golden Day 1 và 2 case tiếng Anh.

**Thay đổi nguồn:** Slide/PDF được trích thành `Pxxx` và là nguồn sự thật chính. Transcript `Txx-xxx` chỉ bổ sung cách diễn giải cho ý đã có trên slide; không được dùng để tạo một kết luận độc lập.

**Output:** 52/52 PASS (100%), source isolation 100%, out-of-scope 100%, hai case tiếng Anh PASS.

**Kết luận:** Logic slide-primary, schema grounding và fallback đạt toàn bộ case. Lượt cuối có 0/52 response live do quota Gemini, vì vậy quality gate live vẫn đang chờ quota.

**Báo cáo:** `results/v4-slide-primary-annotations/2026-07-30T20-47-32-484Z.json`.
