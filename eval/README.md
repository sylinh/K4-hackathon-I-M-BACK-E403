# VLearn paired-material eval suite

Suite này kiểm thử đúng hai gói học liệu được dùng trong demo:

- `day-1-foundation`: `d1-slide-hackathon.pdf` + Transcript 04 (`T04-*`);
- `day-2-product`: `d2-slide-hackathon.pdf` + Transcript 01 (`T01-*`).

## Một test case gồm gì?

- `input`: payload thực tế gửi đến `POST /api/agent`;
- `expected`: các điều kiện output phải đạt, không phải câu trả lời mẫu nguyên văn;
- `actualOutput`: output agent trả về khi chạy;
- `checks`: kết quả từng phép kiểm;
- `passed`: chỉ `true` khi mọi phép kiểm của case đều đạt.

## Chạy suite

Khởi động ứng dụng ở terminal thứ nhất:

```powershell
cd web
npm run dev
```

Chạy eval ở terminal thứ hai:

```powershell
cd web
npm run eval
```

Đổi URL hoặc khoảng nghỉ giữa các request:

```powershell
$env:EVAL_BASE_URL="http://localhost:3000"
$env:EVAL_DELAY_MS="1200"
npm run eval
```

Báo cáo đầy đủ được ghi vào `eval/results/latest.json`.

## Quality bar

- tổng tỷ lệ PASS tối thiểu 80%;
- không trộn Day 1/Day 2: 100%;
- case ngoài phạm vi phải xử lý đúng: 100%.
- toàn bộ lượt chạy phải có ít nhất một response `live: true`.

Suite ghi nhận `live` cho từng case và tổng số response Gemini thật. Một case
không bị đánh rớt riêng chỉ vì API chuyển sang fallback khi chạm rate limit,
nhưng cả lượt eval không đạt quality bar nếu không có lời gọi Gemini thật nào.

Kết quả thấp vẫn phải được giữ nguyên trong repo. Không đổi quality bar sau khi
đã xem kết quả.
