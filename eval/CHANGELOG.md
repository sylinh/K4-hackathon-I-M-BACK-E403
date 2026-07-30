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
