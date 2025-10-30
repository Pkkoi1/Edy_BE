# API Thống Kê Cá Nhân

## Tổng quan

API thống kê cá nhân cung cấp các endpoint để lấy và đồng bộ dữ liệu thống kê hoạt động của người dùng theo năm.

## Model UserStatistics

Model lưu trữ thống kê cá nhân với cấu trúc:

```javascript
{
  user: ObjectId, // Reference to User
  year: Number, // Năm thống kê
  totalUploads: Number, // Tổng tài liệu đã upload
  totalContributions: Number, // Tổng điểm đóng góp
  totalComments: Number, // Tổng số bình luận
  totalDownloads: Number, // Tổng lượt tải
  documentTypes: { // Thống kê theo loại tài liệu
    RESEARCH_REPORT: Number,
    VIDEO: Number,
    STUDY_GUIDE: Number,
    // ... các loại khác
  },
  monthlyPoints: { // Điểm theo tháng
    1: { earned: Number, spent: Number },
    2: { earned: Number, spent: Number },
    // ... tháng 3-12
  },
  topDocuments: [{ // Top 3 tài liệu tiêu biểu
    document: ObjectId,
    title: String,
    views: Number,
    downloads: Number,
    rating: Number // % đánh giá
  }],
  monthlyReports: { // Báo cáo theo tháng
    1: {
      SPAM_OR_MISLEADING: Number,
      DUPLICATE: Number,
      // ... các loại báo cáo khác
    },
    // ... tháng 2-12
  },
  lastSyncAt: Date // Thời gian đồng bộ cuối
}
```

## API Endpoints

### 1. Lấy thống kê cá nhân

```
GET /user-statistics/me?year=2025
```

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `year` (optional): Năm cần lấy thống kê (mặc định là năm hiện tại)

**Response:**

```json
{
  "stats": {
    "totalUploads": 6,
    "totalContributions": 15,
    "totalComments": 120,
    "totalDownloads": 45
  },
  "documentTypes": {
    "RESEARCH_REPORT": 2,
    "VIDEO": 1,
    "STUDY_GUIDE": 3
    // ...
  },
  "monthlyPoints": {
    "labels": [
      "T1",
      "T2",
      "T3",
      "T4",
      "T5",
      "T6",
      "T7",
      "T8",
      "T9",
      "T10",
      "T11",
      "T12"
    ],
    "earned": [20, 25, 30, 28, 35, 40, 38, 45, 42, 48, 45, 50],
    "spent": [15, 18, 22, 20, 25, 30, 28, 32, 30, 35, 32, 38]
  },
  "topDocuments": [
    {
      "key": "64f...",
      "stt": 1,
      "title": "Tài liệu tiếng Anh kĩ năng nói chính trị Mac LêNin",
      "views": 154,
      "downloads": 28,
      "rating": "84%"
    }
  ],
  "monthlyReports": {
    "labels": [
      "T1",
      "T2",
      "T3",
      "T4",
      "T5",
      "T6",
      "T7",
      "T8",
      "T9",
      "T10",
      "T11",
      "T12"
    ],
    "datasets": [
      {
        "label": "Báo cáo nội dung",
        "data": [0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 0, 5]
      },
      {
        "label": "Tê chia sẻ tài liệu",
        "data": [0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 3]
      },
      {
        "label": "Ý kiến gây tranh",
        "data": [1, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 2]
      },
      {
        "label": "Khiếu nại khác",
        "data": [0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 1]
      }
    ]
  },
  "lastSyncAt": "2025-10-29T10:00:00.000Z"
}
```

### 2. Đồng bộ thống kê

```
POST /user-statistics/sync?year=2025
```

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `year` (optional): Năm cần đồng bộ (mặc định là năm hiện tại)

**Response:**

```json
{
  "message": "Đồng bộ thống kê thành công",
  "lastSyncAt": "2025-10-29T10:00:00.000Z"
}
```

### 3. Lấy thống kê theo năm cụ thể

```
GET /user-statistics/year/2025
```

**Headers:**

```
Authorization: Bearer <token>
```

**Path Parameters:**

- `year`: Năm cần lấy thống kê

**Response:** Tương tự như endpoint `/me`

## Script Đồng Bộ

### Đồng bộ tất cả users

```bash
node scripts/sync-user-statistics.js all [year]
```

Ví dụ:

```bash
node scripts/sync-user-statistics.js all 2025
```

### Đồng bộ user cụ thể

```bash
node scripts/sync-user-statistics.js user <userId> [year]
```

Ví dụ:

```bash
node scripts/sync-user-statistics.js user 64f1a2b3c4d5e6f7g8h9i0j1 2025
```

## Tự Động Đồng Bộ

API sẽ tự động đồng bộ dữ liệu khi:

- Lần đầu tiên truy cập thống kê của năm đó
- Dữ liệu thống kê quá cũ (> 24 giờ)

## Dữ liệu Thống kê Bao gồm

1. **Thống kê tổng quan:**

   - Số tài liệu đã upload trong năm
   - Tổng điểm đóng góp (từ point_transaction type EARN)
   - Số lần bình luận
   - Tổng lượt tải tài liệu

2. **Thống kê theo loại tài liệu:**

   - Phân loại theo doc_type của Document model

3. **Lịch sử điểm:**

   - Điểm tích lũy và tiêu theo tháng
   - Dựa trên point_transaction

4. **Top tài liệu:**

   - 3 tài liệu có nhiều view nhất
   - Hiển thị view, download, rating

5. **Báo cáo vi phạm:**
   - Số lần bị báo cáo theo tháng
   - Phân loại theo validTypes trong Report model
