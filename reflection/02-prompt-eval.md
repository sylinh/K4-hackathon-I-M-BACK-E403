# Reflection 2

**Vai trò:** Prompt + eval

## Phần mình làm
- Mình phụ trách thiết kế prompt cho luồng sinh quiz/flashcard, rồi chuyển các lỗi quan sát được thành golden set để đo lại.
- Mình cùng nhóm định nghĩa chất lượng theo từng chiều như groundedness, scope discipline, clarify-on-uncertainty, và usefulness.
- Mình cũng góp phần viết các case khó để tránh tình trạng test chỉ toàn happy path.

## AI hỗ trợ thế nào
- AI giúp mình tạo nhanh các biến thể prompt, sinh case phản đề, và nghĩ ra những tình huống biên mà mình chưa kịp liệt kê.
- Khi cần mở rộng golden set, AI hỗ trợ phân nhóm lỗi và đề xuất cách đặt tên cho lỗi để việc chấm nhất quán hơn.
- Dù vậy, mọi case vẫn phải được mình đọc lại từ đầu, vì eval mà lệch định nghĩa thì số đẹp cũng không có giá trị.

## Bài học từ case fail
- Case fail đáng nhớ nhất là khi output trả lời nghe rất trôi chảy nhưng lại thiếu cột mốc nguồn, hoặc suy đoán khi context chưa đủ.
- Lúc đó nhóm mới thấy rõ rằng “trả lời hay” không đồng nghĩa với “trả lời đúng” trong bài này.
- Mình học được phải ưu tiên cơ chế từ chối hoặc hỏi lại sớm hơn, thay vì cố ép model ra một câu trả lời cho đủ form.

## Mình sẽ làm khác lần sau
- Mình sẽ chốt quality bar sớm hơn và giữ nguyên, tránh thay tiêu chuẩn giữa chừng rồi làm cho kết quả khó so sánh.
- Mình sẽ viết prompt theo hướng rõ ràng về khi nào được trả lời, khi nào phải hỏi lại, và khi nào phải từ chối.
- Mình cũng sẽ dành thêm thời gian để test cùng một case ở nhiều trạng thái context khác nhau, thay vì chỉ test một lần.

