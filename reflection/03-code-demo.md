# Reflection 3

**Vai trò:** Code + demo

## Phần mình làm
- Mình phụ trách ghép luồng UI chính, nối highlight với hành động tạo quiz/flashcard, và giữ cho prototype bấm được từ đầu đến cuối.
- Mình cũng tham gia chỉnh phần demo flow để 5 phút trình bày có thể đi qua cả happy path lẫn case lỗi.
- Ngoài ra, mình hỗ trợ kiểm tra những chỗ dễ gãy giữa mock UI và API thật để tránh đến lúc demo mới phát hiện.

## AI hỗ trợ thế nào
- Mình dùng AI để phác thảo component, gợi ý cách tách state, và viết nhanh các đoạn boilerplate cho phần hiển thị kết quả.
- AI cũng giúp mình rà lại naming và chỉ ra những chỗ flow nhìn được trên màn hình nhưng chưa đủ rõ về logic.
- Tuy nhiên, mình phải tự map lại toàn bộ luồng để chắc rằng mỗi nút bấm đều dẫn đến hành vi mà mình có thể giải thích khi bị hỏi.

## Bài học từ case fail
- Case fail của nhóm là lúc mình quá tập trung vào happy path, nên phần xử lý khi thiếu context hoặc không đủ evidence chưa đủ nổi bật.
- Điều đó làm nhóm dễ tự tin quá sớm vào prototype, trong khi demo thật lại thường bị hỏi vào những đoạn “không chắc”.
- Mình hiểu rằng một prototype tốt không chỉ là chạy được, mà còn phải cho thấy cách nó xử lý lỗi và giới hạn.

## Mình sẽ làm khác lần sau
- Mình sẽ build phần fail state sớm hơn, không để tới cuối mới thêm.
- Mình sẽ viết README hoặc note kỹ thuật ngắn hơn nhưng rõ hơn để bất kỳ ai trong nhóm cũng giải thích được phần mình đã làm.
- Mình sẽ test demo với người khác trước sớm hơn, vì phản hồi từ người ngoài thường lộ ra những chỗ mình tự xem là hiển nhiên.

