# schemas/

Zod validation schemas shared by the client (form validation) and the server
(request validation in route handlers and services). Defining each schema once
here keeps client and server validation identical.

Fixed value sets (statuses, roles, channels) are modeled as Zod enums here and
as `String` columns in Prisma — SQLite, used in development, does not support
Prisma `enum` blocks.

Schemas are added alongside their features from Phase 2 onward.
