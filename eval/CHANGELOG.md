# Eval history

## v1-baseline - 2026-07-30

**Giai đoạn:** Baseline hai cặp PDF/transcript.

**Input:** 26 case cho chat, quiz, flashcard, sai nguồn, câu mơ hồ, ngoài phạm vi, prompt injection và material không tồn tại.

**Output:** 17/26 PASS (65,4%), source isolation 100%, out-of-scope 0%, Gemini live 0/26. Quality bar chưa đạt.

**Kết luận:** Mapping Day 1/Day 2 không trộn citation. Agent vẫn cần scope guard, cơ chế hỏi lại câu mơ hồ và retrieval tốt hơn cho Day 2. Lần chạy này dùng fallback do rate limit nên chưa đủ điều kiện release.

**Quyết định cho version sau:** `v2-scope-guard` chỉ được tạo khi bắt đầu sửa hành vi từ chối/làm rõ; không sửa lại case của `v1-baseline`.
