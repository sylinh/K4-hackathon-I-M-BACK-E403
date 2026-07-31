# AI SPEC — VLearn Adaptive Recall Review · Nhóm I'm BACK · Zone A1
Hướng: [x] A — VLearn  [ ] B — Trợ lý Học viên  [ ] C — Làn mở
Loại: [ ] Tối ưu tính năng có sẵn  [x] Tính năng mới

## §1. User & Job
- Job executor + workflow (đính kèm worksheet JTBD / ảnh sơ đồ): `.
\K4-I-M-BACK-AI-Product-Hackathon\vlearn-focus-user-flow.png`
- Core JTBD (không tên sản phẩm/AI trong câu):
  - Khi học trên VLearn qua slide/tài liệu, học viên muốn verify mình đã nhớ đúng điểm trọng tâm và ôn lại ngắn gọn sau khi highlight, thay vì tự tổng hợp lại bằng thủ công.
- Problem statement (KHÔNG chữ AI):
  - Người học đang highlight và ghi chú rất nhiều, nhưng khi ôn lại họ hầu như chỉ đọc lướt. Không có flow kiểm tra nào giúp họ biết mình đã nhớ đúng hay chưa, và họ phải mất thời gian tự có thể biến highlight thành mini-review.
- Evidence (chuẩn A và/hoặc B — log đầy đủ trong repo):
  - Số liệu mining / kết quả khảo sát (n = 22, % xác nhận):
    - 14/22 (63.6%) truy cập VLearn hàng ngày.
    - 13/22 (59.1%) lưu giữ thông tin chủ yếu bằng highlight trực tiếp trên slide.
    - 19/22 (86.4%) đánh giá cách “chỉ đọc lại” highlight/ghi chú là kém hoặc bình thường.
    - 10/22 (45.5%) nêu pain lớn nhất là “mất quá nhiều thời gian để tự tổng hợp lại”.
    - 13/22 (59.1%) muốn hệ thống nhắc review quiz ngay, 6/22 (27.3%) muốn quiz xuất hiện ngay sau khi học xong một bài.
  - ≥5 quote/ví dụ nguyên văn + nguồn:
    1. “Chỉ xem lướt qua một lần trước khi thi.” — khảo sát, `Khao sat trai nghiem hoc tap voi vLearn.csv`.
    2. “Tự mất thời gian làm thành flashcard hoặc câu hỏi để tự đố bản thân.” — khảo sát, `Khao sat trai nghiem hoc tap voi vLearn.csv`.
    3. “Kém hiệu quả, đọc thì hiểu nhưng lúc thi lại quên sạch.” — khảo sát, `Khao sat trai nghiem hoc tap voi vLearn.csv`.
    4. “Mất quá nhiều thời gian để tự tổng hợp lại.” — khảo sát, `Khao sat trai nghiem hoc tap voi vLearn.csv`.
    5. “Đọc lại thấy nhàm chán, dễ gây buồn ngủ.” — khảo sát, `Khao sat trai nghiem hoc tap voi vLearn.csv`.
    6. “Bình thường, đôi khi tôi nhớ mang máng nhưng không chọn được đáp án.” — khảo sát, `Khao sat trai nghiem hoc tap voi vLearn.csv`.

## §2. Impact & quyết định chọn
- Bảng impact ≥3 ứng viên (bao nhiêu người · tần suất · tốn gì mỗi lần · khả thi):

| Ứng viên | Bao nhiêu người gặp | Tần suất | Mỗi lần tốn gì | Khả thi trong sự kiện | Chọn? |
|---|---:|---|---|---|---|
| Học viên highlight nhưng không review có kiểm chứng | 13/22 (59.1%) | Hàng ngày / 3-4 lần/tuần | 5-10 phút tự tổng hợp câu hỏi/flashcard | Có | Chọn |
| Học viên chỉ đọc lại highlight/ghi chú | 19/22 (86.4%) | Trước thi / cuối tuần | 2-5 phút đọc lướt nhưng khó biết mình nhớ đúng | Có | Chọn |
| Học viên muốn hệ thống nhắc làm quiz đúng nhịp | 13/22 (59.1%) | Sau mỗi bài / sau học xong một tiết | 1-2 phút, không muốn soạn biểu lướt tay | Có | Chọn |

- Ứng viên ĐÃ LOẠI + vì sao:
  - “Ghi chép ra vở/Notion để ôn lại” — loại vì dùng phương án này chỉ 2/22 (9.1%). Nó không phải luồng chiếm ưu thế và không giải quyết vấn đề `review có kiểm chứng`.
  - “Đọc lướt nhiều lần để thuộc” — loại vì 19/22 (86.4%) đã báo hiệu quả kém/bình thường; đây là cách người dùng đang nhập vào nhưng không tin nữa.
- Ứng viên CHỌN + vì sao (bằng số):
  - Chọn ứng viên “học viên đang học qua slide, highlight nhiều, nhưng không có flow mini-review ngắn và có căn cứ”.
  - Bằng số: 13/22 người highlight; 10/22 mất thời gian tổng hợp; 19/22 đánh giá review kém/bình thường; 13/22 muốn hệ thống nhắc quiz. Đây là pain có mức đồng nhất cao và có thể giải quyết bằng one-feature trong 1 ngày.

## §3. Giải pháp tương tự đã nghiên cứu
- Quizlet AI / Study mode: đáng học ở chỗ sinh flashcard/quiz nhanh từ văn bản, đáng né ở việc không giữ flow “đang xem slide/đang highlight”. Mình khác ở chỗ AI sinh review từ chỗ người dùng đang đứng ở trang nào, không bài quá rộng.
- NotebookLM: đáng học ở chuẩn citation cạnh câu trả lời, đáng né ở việc mô hình này tập trung vào “chat theo tài liệu”, không phải “mini review 2 phút ngay sau highlight.” Mình khác ở chỗ vẫn giữ flow học trên VLearn, chỉ chốt câu hỏi từ highlight hiện tại.
- Khanmigo / Study mode: đáng học ở việc convert learning material thành quiz ngắn cho người học. Đáng né là nó có thể khiến user quá tin vào nội dung AI, vì thế mình cần hiển thị rõ nguồn page và mức độ tin cậy. Mình khác ở chỗ luôn yêu cầu `groundedness` từ slide/transcript, và nếu thiếu căn cứ thì hỏi lại hoặc từ chối.

## §4. Thiết kế
- Lát cắt MỘT CÂU (1 user · 1 việc · 1 quyết định AI · 1 kết quả):
  - Một học viên đang học trên VLearn, sau khi highlight một đoạn trên trang đang xem, muốn kiểm tra mình đã nhớ đúng trọng tâm và tiết kiệm thời gian tự tổng hợp câu hỏi, nên AI tạo quiz ngắn + flashcard từ chính đoạn đó và nhắc review ngay trong luồng học; kết quả là học viên có một mini-review có căn cứ, đúng ngữ cảnh, và có thể tự sửa/kiểm tra trong 2 phút.
- Non-goals (≥3 thứ KHÔNG build):
  1. Không xây full curriculum / roadmap học tập dài hạn.
  2. Không lưu tiến độ, điểm số hay dữ liệu học tập cá nhân cho analytics chuyên sâu.
  3. Không sinh quiz từ toàn bộ slide khi user chưa chỉ rõ đoạn đang highlight.
  4. Không thực hiện các yêu cầu ngoài phạm vi tài liệu như mật khẩu, danh sách tài khoản, hay làm hộ bài tập.
- Mức prototype nhắm tới: [x] Mock [ ] Sketch [ ] Working — phần nào mock, phần nào thật:
  - Mock: UI hiện tại được dùng để highlight + tạo quiz / flashcard trong state client.
  - Thật: endpoint `/api/agent` chạy lời gọi AI thực tế để sinh quiz, flashcard và trả lời theo đúng `materialId` / `page`/ context.
- Automation: [x] conditional — lý do theo cost-of-error:
  - Nếu user đang ở một page/đoạn rõ, AI tự sinh review.
  - Nếu context mơ hồ, thiếu căn cứ hoặc không đủ thông tin, AI không đoán mà hỏi lại hoặc cắt phạm vi.
  - Sai thì ai chịu gì? Người học có thể bỏ qua hoặc sửa ngay trong flow; không gây hậu quả tài chính, quyền truy cập hay điểm số.
- §4b. Nguyên tắc đã áp dụng (≥4 — HAX/PAIR, xem guide):
  | Nguyên tắc | Áp cụ thể vào đâu trong prototype |
  |---|---|
  | G1 — Làm rõ hệ thống làm được gì | UI chỉ hiển thị “Tạo quiz/flashcard từ slide đang mở và phần highlight đang chọn”. |
  | G2 — Làm rõ nó làm tốt đến đâu | Mỗi quiz/flashcard gắn `citation` và `confidence`; user biết khi nào nên tin / khi nào nên xem lại nguồn. |
  | G10 — Thu hẹp phạm vi khi nghi ngờ | Nếu không đủ page context, hệ thống trả `ask_clarify` thay vì đoán. |
  | G11 — Giải thích vì sao | Output gắn trực tiếp với đoạn highlight và transcript; người học kiểm lại bằng chính tài liệu đọc. |
  | PAIR · Explainability + Trust | Hệ thống phải hiển thị nguồn và mức độ “được nêu trực tiếp / được suy ra / không đủ thông tin”. |
  | PAIR · Feedback + Control | User có quyền sửa highlight, đổi page, hoặc bỏ qua AI; không bị ép vào một câu trả lời khép kín. |

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản (≥8) [bảng theo guide §2.5]

| Lớp | Tình huống | Hành vi mong muốn | Nguyên tắc áp |
|---|---|---|---|
| ① Nguồn sự thật | AI bịa tên nhà phát triển / công ty khi slide không chứa thông tin | Rõ ràng “không tìm thấy đủ thông tin trong tài liệu” | G10, PAIR Explainability |
| ① Nguồn sự thật | Highlight từ phần có mơ hồ nhưng AI vẫn trả lời chắc chắn | Hỏi lại hoặc thu hẹp page khi không đủ căn cứ | G10 |
| ② Mơ hồ / thiếu thông tin | User gõ câu hỏi quá rộng mà không chọn page hoặc không có highlight | Yêu cầu làm rõ `page` / `segment` đang muốn review | G10 |
| ② Mơ hồ / thiếu thông tin | Một câu hỏi liên quan đến nhiều phương án trong tài liệu | Chỉ trả lời theo đoạn rõ ràng, hoặc nhắc user cần làm rõ | G10 |
| ③ Ngoài phạm vi / thẩm quyền | User yêu cầu cung cấp mật khẩu / danh sách tài khoản / thông tin cá nhân | Từ chối, không tiết lộ dữ liệu nhạy cảm | G1 |
| ③ Ngoài phạm vi / thẩm quyền | User yêu cầu “giải hộ bài tập” | Giải thích kiến thức phổ quát nhưng không làm hộ | G1 |
| ④ Đặc thù domain | User hỏi về hiệu ứng kỹ thuật cụ thể mà tài liệu không nêu đủ | Không đoán, trả về `insufficientAnswer` và nhắc người dùng kiểm lại slide | G11 |
| ④ Đặc thù domain | AI sinh quiz sai trọng tâm kiến thức | Hệ thống có `citation` và user có thể sửa highlight để yêu cầu mới | PAIR Feedback + Control |

## §6. Bốn đường đi của trải nghiệm
- Happy path: học viên highlight 1 đoạn -> bấm “Tạo quiz” -> AI sinh 3-5 câu MCQ + 2 flashcard trong đúng page context -> user làm bài trong dưới 2 phút -> hệ thống hiện đáp án và citation ở trang/đoạn tương ứng.
- Low-confidence (②): user hỏi về một khái niệm nhưng chưa chọn “mục đang học”; hệ thống trả `ask_clarify` như “Bạn vui lòng làm rõ khái niệm, đoạn hoặc đối tượng bạn đang nhắc tới.”
- Failure/không căn cứ (①): khi AI không tìm thấy evidence đủ trong slide/transcript, hệ thống trả “Không tìm thấy đủ thông tin trong tài liệu để kết luận.” không suy đoán thêm.
- Correction (user sửa): user tẩy highlight hoặc đổi page; AI re-run mới trên context mới và không cần reset toàn bộ flow.
- Khi bị đòi ngoài phạm vi (③): user yêu cầu mật khẩu / tài khoản / làm hộ bài tập; hệ thống từ chối rõ, không lộ dữ liệu nhạy cảm.
- Case đặc thù domain (④): ví dụ “token tính theo RAM hay GPU?”; slide không có dữ kiện, nên hệ thống trả `insufficientAnswer` và yêu cầu xem lại tài liệu.

## §7. Kiểm thử
- Chiều chất lượng + định nghĩa kiểm chứng được:
  1. Groundedness: mọi trả lời/quiz/flashcard phải có source / citation về slide/transcript đang mở.
  2. Scope discipline: câu hỏi ngoài phạm vi phải `refuse` rõ và không lộ thông tin nhạy cảm.
  3. Clarify-on-uncertainty: thiếu context phải hỏi lại, không đoán.
  4. Review usefulness: output phải là mini quiz/flashcard, tức user có thể self-check trong <2 phút.
- Golden set (≥20 case theo cơ cấu trong guide §2.6, file trong eval/):
  - `eval/golden-set.md` + `eval/suites/v4-slide-primary-annotations.json` là gold set chính với 30+ case, bao gồm bài hỏi đúng, hỏi lại, từ chối, và `citations` phải là trang `Pxxx` chính xác.
  - Quality bar xác định trong `eval/README.md`: pass >= 80%, không trộn Day 1/Day 2, out-of-scope pass = 100%, và có ít nhất một `live: true` trong toàn bộ lượt chạy.
- Quality bar (chốt từ 23:59, giữ nguyên sau đó): "Đạt khi ≥ 80% qua bộ, 100% source isolation, 100% out-of-scope pass, và có tối thiểu 1 response live."
- Kết quả các lượt chạy (bảng % — cập nhật đến trước CP6):

| Version | Total | Passed | Failed | Pass rate | Source isolation | Out-of-scope pass | Live response | Quality bar |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `v4-slide-primary-annotations` | 52 | 52 | 0 | 100% | 100% | 100% | 0 | Chưa đạt do thiếu live response |

> Quan sát: bộ eval hiện đạt 52/52 pass về `groundedness` và `source isolation`. Tuy nhiên, vì API Gemini thật chưa chạy trong lượt báo cáo cuối, `liveResponses = 0`, nên không đạt quality bar trọn vẹn. Đây là điểm cần ghi rõ trong spec để không đội “điều gì cũng ổn”.

## §8. Phân công & kế hoạch
- Phân công có tên: spec / evidence / prompt / code / demo
  - Spec / evidence: xây căn cứ bằng khảo sát và chốt `job statement`.
  - Prompt / eval: xây `golden set`, kiểm tra `answer`, `citations`, `confidence`, `note`, `action`.
  - Code: triển khai flow UI highlight → create quiz/flashcard → render citations.
  - Demo: chạy live demo, không tranh cãi với user trong lúc họ thử.
- Willing users (≥3 tên) + kế hoạch vòng validation CP5 (3 câu hỏi, ai log):
  - Willing users: 3 người học viên thật trong khoá, cùng nhóm nghiên cứu đã cho phản hồi trong khảo sát; ưu tiên người trả lời “mất quá nhiều thời gian để tự tổng hợp lại”, “đọc lại thấy nhàm chán” và “không biết mình nhớ không cho đến phòng thi”.
  - Kế hoạch validation CP5:
    1. “Bạn đang làm gì trên VLearn khi ôn trước thi?” — quan sát flow bấm.
    2. “Điều gì khó chịu nhất khi dùng flow quiz/flashcard này?” — log nguyên văn.
    3. “Kết quả này bạn có tin không — vì sao?” — đo mức tin vào response và mức độ tốn công của flow.
  - Ai log: người làm validation ghi `name` + `role` + `quote` + `severity` rõ ràng.
- Multi-prototype (nếu làm): trục khác biệt của ≥2 phương án + lý do chọn:
  - Phương án A: “Sinh quiz/flashcard tự động ngay từ highlight đã chọn.”
  - Phương án B: “Chỉ dùng nút `Tạo quiz` khi user chủ động bấm sau khi học.”
  - Chọn A vì pain chính là người học không có nhịp review ngắn và mất công tổng hợp thủ công; A trực tiếp giảm chi phí đó.

## §9. Changelog
| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
| 2026-07-31 | Chốt slice: “highlight → quiz/flashcard → review ngắn có căn cứ” | Từ khảo sát 22 người: 59.1% highlight trên slide; 86.4% đánh giá review thụ động là kém/bình thường; 45.5% báo tốn thời gian tổng hợp |
| 2026-07-31 | Đưa `conditional` làm mức automation trung tâm | Vì chất lượng cần giữ đúng ngữ cảnh slide, không đoán khi thiếu căn cứ |
| 2026-07-31 | Phân định rõ `groundedness` và `out-of-scope pass` | Để quality bar đo được cái thật: `path` phải trace được thong qua `citation`, không chỉ đẹp lời |
