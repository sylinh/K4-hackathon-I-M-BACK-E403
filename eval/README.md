# VLearn eval theo phiên bản

Bộ eval kiểm thử hai gói học liệu:

- `day-1-foundation`: `d1-slide-hackathon.pdf` + Transcript 04 (`T04-*`);
- `day-2-product`: `d2-slide-hackathon.pdf` + Transcript 01 (`T01-*`).
- file người dùng tải lên: citation theo trang (`P001`, `P002`, ...).

## Ba loại phiên bản

1. **Giai đoạn** nằm trong `versions.json`, mô tả mục tiêu và trạng thái công việc.
2. **Suite version** nằm trong `suites/<version>.json`, là bộ input và expected output đã đóng băng.
3. **Run version** nằm trong `results/<version>/<timestamp>.json`, là output thực tế của một lần chạy và không bị ghi đè.

`results/latest.json` chỉ là con trỏ tới báo cáo mới nhất. Báo cáo đầy đủ luôn nằm trong thư mục của version tương ứng.

## Một test case gồm gì?

- `input`: payload thực tế gửi đến `POST /api/agent`;
- `expected`: điều kiện output phải đạt, không phải câu trả lời mẫu nguyên văn;
- `actualOutput`: output agent trả về khi chạy;
- `checks`: kết quả từng phép kiểm;
- `passed`: chỉ `true` khi mọi phép kiểm của case đều đạt.

## Chạy một version

Khởi động ứng dụng ở terminal thứ nhất:

```powershell
cd web
npm run dev
```

Chạy version được đánh dấu `currentVersion` trong `versions.json`:

```powershell
cd web
npm run eval
```

Chỉ định version:

```powershell
npm run eval:v4
# hoặc
npm run eval -- --version v4-slide-primary-annotations
```

Có thể đổi URL và khoảng nghỉ:

```powershell
$env:EVAL_BASE_URL="http://localhost:3000"
$env:EVAL_DELAY_MS="1200"
npm run eval -- --version v4-slide-primary-annotations
```

Mỗi lần chạy tạo một file timestamp mới. Runner không ghi đè báo cáo cũ.

Suite v4 chạy 30 case regression, tự nạp 20 case từ `golden-set.md` và
thêm hai case tiếng Anh. Với chat, runner kiểm tra cả `answer`, `evidence`,
`confidence`, `note`, `citations` và bắt buộc citation chính là trang slide
`Pxxx`.

## Tạo version tiếp theo

1. Sao chép suite gần nhất sang `suites/vN-<mục-tiêu>.json`.
2. Đổi `version`, `stage` và chỉ bổ sung case liên quan tới mục tiêu giai đoạn.
3. Thêm version vào `versions.json` với trạng thái `active`.
4. Chạy suite và lưu kết luận vào `CHANGELOG.md`.
5. Chỉ chuyển trạng thái thành `completed` khi đạt exit criteria.

Không sửa suite hoặc quality bar sau khi đã xem kết quả. Khi tiêu chí thay đổi, tạo version mới.

## Quality bar hiện tại

- tổng tỷ lệ PASS tối thiểu 80%;
- không trộn Day 1/Day 2: 100%;
- case ngoài phạm vi phải xử lý đúng: 100%;
- toàn bộ lượt chạy phải có ít nhất một response `live: true`.

Fallback không làm rớt riêng một case chỉ vì `live: false`, nhưng toàn bộ lượt eval không đạt quality bar nếu không có lời gọi Gemini thật.
