# Hướng dẫn tích hợp Activity Log

## Tổng quan

Hệ thống Activity Log được thiết kế để ghi lại tất cả các hoạt động quan trọng của user trong hệ thống, bao gồm:

- Tạo, duyệt, từ chối, xóa, chỉnh sửa tài liệu
- Tạo và xử lý yêu cầu (approval requests, edit requests)
- Tạo và xử lý báo cáo vi phạm
- Quản lý bình luận
- Quản lý user (ban/unban)
- Quản lý organization và subject

## Cấu trúc

### Models

- **ActivityLog Model** (`src/models/activity_log.model.js`): Lưu trữ log activities
  - `user`: User thực hiện hành động
  - `action`: Loại hành động (enum)
  - `target_type`: Loại đối tượng bị tác động
  - `target_id`: ID của đối tượng
  - `target_title`: Tên/tiêu đề đối tượng
  - `description`: Mô tả chi tiết
  - `metadata`: Dữ liệu bổ sung

### Services

- **activity_log.service.js**: Xử lý logic ghi và query logs
  - `logActivity()`: Ghi log hoạt động
  - `getRecentActivities()`: Lấy danh sách activities
  - `getUserActivities()`: Lấy activities của user
  - `getActivityStatistics()`: Thống kê activities
  - `cleanupOldLogs()`: Xóa logs cũ

### Admin Statistics Integration

- **admin_statistics.service.js**: Tích hợp vào dashboard
  - `getRecentActivitiesForAdmin()`: Lấy activities cho admin dashboard

## Cách sử dụng

### 1. Import service

```javascript
const { logActivity } = require("./activity_log.service");
```

### 2. Ghi log activity

```javascript
await logActivity({
  userId: req.user.userId,
  action: "DOCUMENT_CREATED",
  targetType: "Document",
  targetId: document._id,
  targetTitle: document.title,
  description: `Tạo tài liệu "${document.title}"`,
  metadata: {
    documentType: document.doc_type,
    subject: document.subject,
  },
});
```

### 3. Actions được hỗ trợ

```javascript
// Document actions
"DOCUMENT_CREATED";
"DOCUMENT_APPROVED";
"DOCUMENT_REJECTED";
"DOCUMENT_DELETED";
"DOCUMENT_EDITED";
"DOCUMENT_HIDDEN";

// Edit request actions
"EDIT_REQUEST_CREATED";
"EDIT_REQUEST_APPROVED";
"EDIT_REQUEST_REJECTED";

// Approval request actions
"APPROVAL_REQUEST_CREATED";
"APPROVAL_REQUEST_APPROVED";
"APPROVAL_REQUEST_REJECTED";

// Report actions
"REPORT_CREATED";
"REPORT_RESOLVED";
"REPORT_DISMISSED";

// Comment actions
"COMMENT_CREATED";
"COMMENT_DELETED";

// User management actions
"USER_BANNED";
"USER_UNBANNED";

// Organization & Subject actions
"ORGANIZATION_CREATED";
"ORGANIZATION_UPDATED";
"SUBJECT_CREATED";
"SUBJECT_UPDATED";
```

## Ví dụ tích hợp

### Document Service

```javascript
// Trong createDocument()
const doc = new Document(docData);
await doc.save();

await logActivity({
  userId: data.user,
  action: "DOCUMENT_CREATED",
  targetType: "Document",
  targetId: doc._id,
  targetTitle: doc.title,
  description: `Tạo tài liệu "${doc.title}"`,
  metadata: {
    docType: doc.doc_type,
    fileType: doc.file_type,
    subject: doc.subject,
  },
});
```

### Report Service

```javascript
// Trong createReport()
const report = new Report(reportData);
await report.save();

await logActivity({
  userId: reporterId,
  action: "REPORT_CREATED",
  targetType: "Report",
  targetId: report._id,
  targetTitle: document.title,
  description: `Báo cáo vi phạm tài liệu "${document.title}"`,
  metadata: {
    documentId: document._id,
    violationTypes: report.type,
    reason: report.reason,
  },
});
```

### Comment Service

```javascript
// Trong createComment()
const comment = new Comment(commentData);
await comment.save();

await logActivity({
  userId: userId,
  action: "COMMENT_CREATED",
  targetType: "Comment",
  targetId: comment._id,
  targetTitle: null,
  description: `Bình luận tài liệu "${document.title}"`,
  metadata: {
    documentId: document._id,
    commentContent: comment.content.substring(0, 100),
  },
});
```

## Best Practices

1. **Không throw error**: Service `logActivity()` được thiết kế để không throw error, chỉ log lỗi ra console để không ảnh hưởng đến luồng chính.

2. **Metadata hữu ích**: Thêm thông tin bổ sung vào metadata để dễ debug và phân tích sau này.

3. **Description rõ ràng**: Viết description ngắn gọn nhưng đầy đủ thông tin.

4. **Target title**: Luôn cung cấp targetTitle khi có thể để dễ hiển thị trong UI.

## Query Activities

### Lấy activities gần đây

```javascript
const { getRecentActivities } = require("./activity_log.service");

const result = await getRecentActivities({
  limit: 50,
  userId: "user_id", // Optional
  action: "DOCUMENT_CREATED", // Optional
  targetType: "Document", // Optional
  startDate: new Date("2025-01-01"), // Optional
  endDate: new Date(), // Optional
});
```

### Lấy activities của user

```javascript
const { getUserActivities } = require("./activity_log.service");

const result = await getUserActivities(userId, 100);
```

### Thống kê activities

```javascript
const { getActivityStatistics } = require("./activity_log.service");

const stats = await getActivityStatistics(new Date("2025-01-01"), new Date());
```

## Cleanup

### Tự động xóa logs cũ

Nên setup một cron job để xóa logs cũ định kỳ:

```javascript
const { cleanupOldLogs } = require("./activity_log.service");

// Xóa logs cũ hơn 90 ngày
await cleanupOldLogs(90);
```

## Admin Dashboard Integration

Activities được tự động hiển thị trong admin dashboard thông qua API:

```
GET /admin/statistics/dashboard
```

Response bao gồm `recent_activities` với format:

```json
{
  "success": true,
  "data": {
    "statistics": {...},
    "recent_activities": [
      {
        "id": "...",
        "user": {
          "id": "...",
          "name": "Nguyễn Văn A",
          "avatar": "...",
          "email": "..."
        },
        "action": "DOCUMENT_APPROVED",
        "actionLabel": "Duyệt tài liệu",
        "targetType": "Document",
        "targetId": "...",
        "targetTitle": "Tài liệu ABC",
        "description": "Duyệt tài liệu \"Tài liệu ABC\"",
        "metadata": {...},
        "timestamp": "2025-11-06T..."
      }
    ],
    "tasks": [...]
  }
}
```

## Các service cần tích hợp

### Đã tích hợp ✅

- approval_request.service.js (APPROVAL_REQUEST_CREATED, APPROVED, REJECTED)

### Cần tích hợp 🔲

- document.service.js (DOCUMENT_CREATED, DELETED, EDITED)
- edit_approval.service.js (EDIT_REQUEST_CREATED, APPROVED, REJECTED)
- report.service.js (REPORT_CREATED, RESOLVED, DISMISSED)
- comment.service.js (COMMENT_CREATED, DELETED)
- user.service.js (USER_BANNED, USER_UNBANNED)
- organization.service.js (ORGANIZATION_CREATED, UPDATED)
- subject.service.js (SUBJECT_CREATED, UPDATED)

## Performance

- Indexes được tạo tự động trên các fields thường query (createdAt, user, action)
- Log activity là async và không block main operation
- Recommend cleanup logs cũ định kỳ để giữ database nhẹ
