# Exact Project Glossary

> Source: section A-2. **These terms must be used with exactly these meanings across the whole system.** If something is written "case" (پرونده) in one place, it must not be written "request" (درخواست) or "order" (سفارش) elsewhere. This rule applies to database table names, variables, UI text, and documentation — everywhere.

## Terms table

| Term (Persian) | Suggested code name | Exact meaning |
|----------------|---------------------|---------------|
| مشتری (Customer) | `Customer` | A natural person or company that buys a service from the institute. One customer can have several cases. |
| خدمت (Service) | `Service` | A type of work the institute performs (company registration, brand registration, business card, etc.). A service is a "definition", not a completed job. |
| پرونده (Case) | `Case` | A service **sold** to a customer. If Mr. Ahmadi buys both a business card and a brand registration, he has two cases. |
| دوره (Period) | `Period` | A validity span of a case. The first period is registration; later periods are renewals. A case renewed three times has four periods. |
| مسیر (Path) | `Path` | The ordered list of stages that must be walked to complete a job. Every service has two paths: the initial-registration path and the renewal path. |
| مرحله (Stage) | `Stage` | One step of the path. It has only a title, e.g. "Receive documents" or "Chamber of Commerce approval". |
| کار (Task) | `Task` | A specific action assigned to an employee with a due date, e.g. "Call the customer about renewal". A task differs from a stage: a stage is part of a service path, a task is a personal to-do with a date. |
| پیگیری (Follow-up) | `FollowUp` | A result an employee records after doing a task, e.g. "Customer did not answer" or "Agrees to renew". |
| پرداخت (Payment) | `Payment` | An actual receipt of money from a customer, with date, amount, and method. |
| بایگانی (Archive) | `Archive` | A completed task moved away from the daily pages after a while. **It is not deletion.** |
| رهاشده (Abandoned) | `Abandoned` | A renewal far past its due date that will effectively not happen. It leaves the work list but is not deleted. |
| لغو (Cancellation) | `Cancellation` | A case stopped mid-path. Always recorded with a reason. |

## Distinctions that must never be conflated

- **Stage ≠ Task:** a stage is part of the service-path definition and has only a title; a task is a personal to-do with an assignee, due date, and priority. A stage can lead to creating a "task", but is not itself a "task".
- **Service ≠ Case:** a service is a "definition" (a template); a case is a sold instance of that service for a specific customer.
- **Period ≠ Case:** a renewal is not a separate entity; it is just a new period of the same case.
- **Archive ≠ Delete:** archiving is only a move away from the daily pages; the record stays in place and appears in search and reports.
- **Abandoned ≠ Cancellation:** abandoned means a renewal that passed the threshold and is effectively dead; cancellation means a case deliberately stopped mid-path with a specific reason.

## Strict naming directive

Each entity has **one single name** used everywhere in the project. Forbidden-alias table:

| Correct name | Forbidden names |
|--------------|-----------------|
| Case / پرونده | request, order, Order, Request, درخواست, سفارش |
| Stage / مرحله | Step (as a separate entity), وظیفه |
| Task / کار | Job, inconsistent "tesk", Todo |
| Period / دوره | Cycle (as an entity), subscription |
| FollowUp / پیگیری | Note (a note differs from a stage note), call |
