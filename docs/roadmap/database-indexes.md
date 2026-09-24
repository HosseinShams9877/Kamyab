# Required Database Indexes

> Indexes the workload needs, grouped by the query that justifies each one. PostgreSQL creates an index automatically for every primary key and every `@unique` constraint, so those are noted but not re-created. The rest are chosen from the actual read patterns in [05-pages-fields.md](../knowledge/05-pages-fields.md) (dashboard, lists, renewals queue) and the engine (C-14).

## Unique constraints (auto-indexed — listed for completeness)

| Table | Columns | Purpose |
|-------|---------|---------|
| Employee | (mobile) | username uniqueness |
| Customer | (mobile) | one customer per mobile |
| Customer | (code) | immutable customer code |
| Service | (name) | service-name uniqueness |
| Case | (number) | case-number uniqueness |
| ServiceDuration | (serviceId, title) | no duplicate duration titles within a service |
| PermissionException | (employeeId, permissionKey) | one override per key |
| **SentReminder** | **(periodId, ruleId, channel)** | **"each reminder once per period" (rule 5)** |
| **BirthdayLog** | **(customerId, year)** | **"each customer once per year" (rule 5)** |
| SmsTemplate | (eventKey) | one template per event |
| Lookup tables | (title) | unique titles for reasons/results/methods/categories/departments |

## Secondary indexes to create

### Case
| Index | Columns | Serves |
|-------|---------|--------|
| case_status | (status) | dashboard "active cases", case list filters |
| case_owner_status | (ownerId, status) | employee panel "my cases"; owner-scoped lists |
| case_customer | (customerId) | the customer page's case list |
| case_staleness | (status, lastActivityAt) | dashboard "stale cases" (active + not moved past threshold) |
| case_service | (serviceId) | "cannot delete a used service" checks, reports |

### Period
| Index | Columns | Serves |
|-------|---------|--------|
| period_status_expiry | (status, expiryDate) | the renewals queue (all/urgent/near/expired tabs), dashboard "near renewals", and the engine's abandonment scan |
| period_case | (caseId) | a case's period list |
| period_followup | (status, followUpStatus) | the "no follow-up" tab and unfollowed-renewal alert |

> `period_status_expiry` is the most important non-unique index in the system: nearly every renewals view and the abandonment engine filter on active periods within a date window.

### CaseStage
| Index | Columns | Serves |
|-------|---------|--------|
| stage_period_order | (periodId, order) | rendering a period's path in order |
| stage_period_status | (periodId, status) | current-stage / progress computation |

### Payment
| Index | Columns | Serves |
|-------|---------|--------|
| payment_period | (periodId) | computing paid/balance for a period |
| payment_date | (receiptDate) | financial reports over a date range |

### Task
| Index | Columns | Serves |
|-------|---------|--------|
| task_owner_status | (ownerId, status) | "my tasks", assigned, employee workload |
| task_due_status | (dueDate, status) | "today", "overdue" tabs and the overdue-alert engine |
| task_case | (caseId) | a case's task tab |
| task_archive | (status, closedAt) | the archiving engine (closed tasks past the threshold) and the archive tab |

### FollowUp
| Index | Columns | Serves |
|-------|---------|--------|
| followup_case_created | (caseId, createdAt) | the case/customer follow-up timeline, newest first |
| followup_period | (periodId) | a period's last follow-up on its card |

### SmsMessage
| Index | Columns | Serves |
|-------|---------|--------|
| sms_status | (status) | the queue processor picks up QUEUED rows; settings shows sent/queued/failed counts |

### Notification
| Index | Columns | Serves |
|-------|---------|--------|
| notif_user_read | (userId, read) | a user's unread notifications |

### ActivityHistory
| Index | Columns | Serves |
|-------|---------|--------|
| history_entity | (entityType, entityId, createdAt) | the history tab of any record, newest first |

### Employee
| Index | Columns | Serves |
|-------|---------|--------|
| employee_status | (status) | active-employee pick lists, the "last active manager" guard |
| employee_dept | (departmentId) | the workload table grouped by department |

## Notes on search

Global search (C-16) spans customer name/company/mobile/IDs/code and case number/service name. For the expected data size a set of the b-tree indexes above (Customer.mobile, Customer.code, Case.number) plus simple `ILIKE`-prefix queries is sufficient. If the customer/case volume grows large, add a PostgreSQL **trigram (`pg_trgm`) GIN index** on `Customer.fullName`, `Customer.companyName`, and `Service.name` to keep substring search fast — defer this until measured, rather than adding it speculatively.

## Principle

Every index above is justified by a concrete query in the specification. Do not add indexes speculatively: each one costs write time and storage, and the `period_status_expiry`, `task_due_status`, and the two uniqueness constraints carry most of the real workload.
