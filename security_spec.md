# Security Specification: Tiger GroupCraft & Pass Tracker

## 1. Data Invariants

1. **Authorized Teacher Allowlist**: Only Google-authenticated users with `request.auth.token.email_verified == true` and lowercase email in `['c_tokar@chuh.org', 'j_kravitz@chuh.org']` may read or write any classroom document.
2. **Single Shared Workspace**: All data lives under `/workspaces/chuh_shared`. Arbitrary workspace IDs are rejected.
3. **Master Gate Relational Integrity**: Sections, students, and pass logs cannot exist without an existing `/workspaces/chuh_shared` document (and students cannot exist without an existing parent section document).
4. **Hall Pass Bounds**: `passesUsed` must always be an integer between `0` and `4` inclusive (`0 <= passesUsed <= 4`). `outTimestamp` must be a non-negative number (`0` when in room, epoch ms when out).
5. **Bounded Station Arrays**: A section's `groups` array cannot exceed `8` color tables, and each group's `studentIds` cannot exceed `100`.
6. **Immutable Ownership & Timestamps**: `createdAt`, `createdBy`, `workspaceId`, `sectionId`, and `id` cannot be mutated after creation. All `createdAt` and `updatedAt` timestamps must equal `request.time`.
7. **Append-Only Pass Audit Trail**: `passLogs` entries cannot be updated or deleted once created.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)

1. **Unauthenticated Read**: `GET /workspaces/chuh_shared` with `auth: null`.
2. **Unauthorized Email**: `GET /workspaces/chuh_shared/sections/sec_1` with `email: "other_teacher@chuh.org"`, `email_verified: true`.
3. **Unverified Email Spoof**: `GET /workspaces/chuh_shared` with `email: "c_tokar@chuh.org"`, `email_verified: false`.
4. **Shadow Field Injection on Create**: Create student with extra ghost field `{ ..., isAdmin: true }`.
5. **Shadow Field Injection on Update**: Update student `passesUsed` while also smuggling `{ ..., createdBy: "hacker@evil.com" }`.
6. **Pass Limit Bypass**: Update student with `passesUsed: 5` (exceeds max `4`) or `passesUsed: -1`.
7. **Type Poisoning**: Update student `passesUsed: "4"` (string instead of int) or `name: 12345`.
8. **Resource Exhaustion (1MB String)**: Create section with `name` of 2,000 characters (`> 120` limit).
9. **ID Poisoning**: Create student with ID `../../admin` or a 300-character ID failing `^[a-zA-Z0-9_\-]+$`.
10. **Client Timestamp Forgery**: Create passLog with `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
11. **Audit Log Tampering**: Update or delete an existing `/workspaces/chuh_shared/passLogs/log_1` document.
12. **Unbounded Group Array Attack**: Update section with `groups` array containing `9` tables (`> 8` limit).
