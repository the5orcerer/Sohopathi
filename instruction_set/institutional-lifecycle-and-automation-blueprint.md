# Sohopathi Institutional Lifecycle & Workflow Automation Blueprint

**Status:** Proposed product and engineering specification  
**Date:** September 18, 2026  
**Repository:** `the5orcerer/Sohopathi`

## 1. Purpose

Sohopathi is intended to operate as an institutional operating system for schools: a cloud-based School Management System and Employee/ERP platform that replaces paper records, disconnected spreadsheets, repetitive manual work, and fragmented operational tools.

The platform must not behave as a collection of unrelated CRUD modules. A real institutional action should automatically update every related domain that depends on it.

For example, admitting a student should not stop after creating an admission record. It should connect the student to an institution, academic year, class, section, guardian, account, billing, payment, documents, notifications, tasks, audit history, and future academic progression.

> **Core principle:** Every major institutional action must produce a complete, auditable, tenant-safe workflow across all affected domains.

This document defines the target architecture, lifecycle workflows, domain events, automation rules, state machines, data requirements, approval boundaries, failure handling, and implementation roadmap needed to make Sohopathi pipeline-focused and deeply interconnected.

---

## 2. Product Vision

Sohopathi should allow an institution to move through its daily operations using connected workflows:

```text
Lead → Admission → Enrollment → Billing → Documents → Attendance → Assessment
     → Examination → Result → Promotion → New Academic Year → Graduation/Exit
```

For employees:

```text
Application → Hiring → Employee Onboarding → Role → Attendance → Tasks → Leave
          → Payroll → Performance → Renewal/Exit
```

The system should make the correct next action obvious and automate everything that is deterministic, while preserving human approval for sensitive decisions.

### 2.1 What the platform should eliminate

- Re-entering the same student or employee data in multiple screens
- Printing and manually filing admission forms, receipts, ID cards, and certificates
- Manually copying students from one class to another after results
- Untracked fee collection and payment corrections
- Informal task assignment through paper, chat, or memory
- Missing exam marks and late teacher submissions
- Ambiguous ownership of approvals
- Destructive edits that erase financial or academic history
- Cross-institution data leakage
- Hidden automation that cannot be audited or retried

### 2.2 What the platform should provide

- One canonical record for each person and relationship
- Academic-year-aware enrollment history
- Event-driven workflows with retry and idempotency
- Configurable policies instead of hard-coded institutional rules
- Human approval gates for high-impact actions
- Generated documents tied to immutable template versions
- Financial records that preserve history
- Operational timelines showing what happened, when, why, and by whom
- Automation that is visible, explainable, and reversible where appropriate

---

## 3. Current Repository Foundations

The repository already contains most of the domain foundations required for this direction:

| Capability | Existing foundation |
|---|---|
| Multi-tenancy and RLS | `src/core/db.ts`, `db/schema.sql` |
| Authentication | `src/core/auth/`, JWT and Supabase fallback |
| Permission and scope enforcement | `src/core/permissions/` |
| Module registration | `src/core/registry/module-registry.ts` |
| Admissions | `src/modules/admission/` |
| Students and enrollment | `src/modules/core/` |
| Academic history | `coreRepository.getStudentAcademicHistory()` |
| Examinations and marks | `src/modules/exams/` and attendance exam routes |
| Billing and payments | `src/modules/finance/` |
| Templates and generated documents | `src/modules/documents/` |
| Tasks and notifications | `src/modules/core/notification-task-service.ts` |
| Audit trail | `src/core/audit/audit-logger.ts` |
| Database event table | `public.event` in `db/schema.sql` |
| Integration tests | `tests/integration/` |

The main gap is orchestration. Existing modules can perform individual operations, but the platform needs a lifecycle/workflow layer that coordinates them without making each module tightly coupled to every other module.

---

## 4. Architectural Model

The recommended architecture has four layers:

```text
User Command
    ↓
Application Service / Domain Transaction
    ↓
Canonical State Changes + Outbox Event
    ↓
Workflow Handlers
    ├── Billing
    ├── Documents
    ├── Notifications
    ├── Tasks
    ├── Academic Progression
    ├── Payroll/HR
    └── Audit Timeline
```

### 4.1 Commands

Commands represent intentional actions by a user or system process:

```text
ApproveAdmission
RecordPayment
PublishExamResult
EvaluatePromotion
ApprovePromotion
CreateEmployee
ApproveLeave
GeneratePayroll
```

Every command must have:

- Institution context
- Actor or system identity
- Permission and scope verification
- Input validation
- Idempotency key where the action may be retried
- Audit information
- Clear success and failure result

### 4.2 Domain transactions

A domain transaction changes the authoritative business records. It should be short, atomic, and focused on invariants.

Example: admission approval should atomically create or link the student, guardian, enrollment, account, and admission status. It should also write the event that announces completion.

### 4.3 Events

Events announce facts that have already happened. They must not be vague commands such as `do_everything_for_student`.

Good:

```text
admission.completed
student.enrollment_created
billing.invoice_issued
exam.result_published
student.promotion_approved
```

Bad:

```text
run_automation
update_everything
process_student
```

### 4.4 Workflow handlers

Handlers react to events and perform side effects in their own bounded responsibilities. For example, `admission.completed` may be handled by separate billing, document, notification, and task handlers.

Handlers must be:

- Idempotent
- Retryable
- Observable
- Tenant-aware
- Independently testable
- Safe to run more than once

---

## 5. Canonical Domain Relationships

All important records must be connected through real foreign keys and explicit relationships.

```text
Institution
├── Academic Years
│   ├── Classes
│   │   └── Sections
│   │       └── Enrollments
│   │           └── Students
│   ├── Subjects
│   ├── Teacher Assignments
│   ├── Attendance Sessions
│   ├── Examinations
│   ├── Assignments
│   └── Results
├── Employees
│   ├── Memberships
│   ├── Roles
│   ├── Attendance
│   ├── Leave Requests
│   ├── Tasks
│   └── Payroll
├── Guardians
├── Finance
│   ├── Fee Structures
│   ├── Fee Assignments
│   ├── Invoices
│   ├── Payments
│   ├── Receipts
│   └── Ledger Transactions
├── Documents
│   ├── Templates
│   ├── Template Versions
│   └── Generated Documents
├── Notifications
├── Tasks
├── Workflow Runs
├── Events
└── Audit Timeline
```

### 5.1 Person versus participation

A student or employee is a person. Their participation in an institution or academic year is represented separately.

```text
Profile/User
    ↓
Student or Employee record
    ↓
Institution membership
    ↓
Academic enrollment / employment assignment
```

Do not overwrite the student’s identity when their class changes. A class change is an enrollment transition.

### 5.2 Enrollment is historical

The existing `enrollment` model should remain the historical source of truth. Promotion must create a new academic-year enrollment, not overwrite the student’s entire academic history.

Recommended enrollment states:

```text
pending
active
completed
transferred
withdrawn
cancelled
```

Recommended transition metadata:

```text
source_enrollment_id
transition_reason
transition_event_id
created_by_membership_id
created_at
```

---

## 6. Workflow and Event Infrastructure

The existing `public.event` table should evolve into a durable event/outbox system.

### 6.1 Recommended event fields

```text
id
institution_id
academic_year_id
aggregate_type
aggregate_id
type
payload
actor_membership_id
correlation_id
causation_id
idempotency_key
status
attempts
available_at
locked_at
processed_at
failed_at
last_error
created_at
```

Suggested statuses:

```text
pending
processing
completed
retrying
dead_letter
cancelled
```

### 6.2 Event envelope

```json
{
  "id": "event-uuid",
  "type": "admission.completed",
  "institutionId": "institution-uuid",
  "academicYearId": "academic-year-uuid",
  "aggregateType": "student",
  "aggregateId": "student-uuid",
  "actorMembershipId": "staff-uuid",
  "correlationId": "workflow-uuid",
  "causationId": "parent-event-uuid",
  "occurredAt": "2026-09-18T10:00:00Z",
  "payload": {}
}
```

### 6.3 Event rules

1. Events are written in the same database transaction as the canonical state change.
2. A committed state change must always have its corresponding event.
3. A failed transaction must not emit a usable event.
4. Handlers must record their own processing result.
5. Reprocessing the same event must not duplicate invoices, documents, notifications, or enrollments.
6. Events must never cross institution boundaries.
7. Sensitive payloads must avoid storing secrets or raw passwords.
8. The event payload should contain IDs and immutable facts; handlers may re-read current authorized data.

### 6.4 Workflow runs and steps

A workflow is a business process. An event is only a fact.

Recommended tables:

```text
workflow_run
- id
- institution_id
- workflow_type
- aggregate_type
- aggregate_id
- status
- current_step
- correlation_id
- initiated_by
- started_at
- completed_at
- failure_reason

workflow_step
- id
- workflow_run_id
- step_key
- status
- required
- attempts
- input_snapshot
- output_snapshot
- error_message
- started_at
- completed_at
```

Workflow step statuses:

```text
pending
running
completed
failed
skipped
waiting_approval
compensated
```

This makes onboarding and promotion visible to administrators instead of hiding progress inside logs.

---

## 7. Student Lifecycle

The complete student lifecycle should be modeled as:

```text
Lead
  ↓
Application Draft
  ↓
Submitted
  ↓
Under Review
  ↓
Shortlisted
  ↓
Approved
  ↓
Onboarding
  ↓
Active Enrollment
  ↓
Assessment and Attendance
  ↓
Result Published
  ↓
Promotion / Retention / Transfer
  ↓
Graduation / Withdrawal / Alumni
```

### 7.1 Student lifecycle states

The student record and the enrollment record should not use one shared status field.

Student status:

```text
prospect
active
suspended
withdrawn
graduated
alumni
archived
```

Admission status:

```text
submitted
under_review
shortlisted
approved
rejected
cancelled
```

Enrollment status:

```text
pending
active
completed
promoted
retained
transferred
withdrawn
```

---

## 8. Admission-to-Onboarding Pipeline

### 8.1 Target flow

```text
Admission Application
    ↓
Validation and duplicate check
    ↓
Class/section/capacity validation
    ↓
Admission approval
    ↓
Student account and profile
    ↓
Guardian relationship
    ↓
Academic enrollment
    ↓
Admission billing
    ↓
Payment and receipt
    ↓
ID card and admission documents
    ↓
Credentials and notifications
    ↓
Onboarding tasks
    ↓
Admission completed
```

### 8.2 Admission approval transaction

The command `POST /api/admissions/:id/admit` should eventually call an application service such as:

```text
AdmissionOnboardingService.approve()
```

The transaction should:

1. Confirm the application exists in the current institution.
2. Confirm it is not already admitted.
3. Confirm a valid academic year exists.
4. Confirm the target class belongs to the institution and academic year.
5. Confirm the target section belongs to the target class.
6. Confirm section capacity and enrollment rules.
7. Resolve or generate a unique admission number.
8. Create or reuse the student profile.
9. Create or reuse the student login account.
10. Create or update guardian records and relationships.
11. Create the first enrollment.
12. Update the application to `approved` or `admitted`.
13. Create `admission.completed` in the outbox.
14. Write an audit timeline entry.

The transaction must not silently fail after creating only half of the canonical records.

### 8.3 Admission completion handlers

#### Billing handler

Create an admission invoice using the institution’s configured fee policy:

```text
Admission Fee
Registration Fee
Session Fee
Tuition Deposit
Transport Fee
ID Card Fee
Other configured charges
```

Rules:

- Use the student and enrollment IDs.
- Use the admission academic year.
- Do not create a duplicate invoice if the event is retried.
- If the application fee was already paid, create a payment or allocation reference rather than charging twice.
- Use an immutable invoice number.

#### Payment handler

If payment was collected during admission:

```text
Payment received
    ↓
Payment allocation
    ↓
Invoice balance recalculated
    ↓
Receipt generated
    ↓
billing.payment_received event
```

Completed payments must not be edited destructively. Corrections use reversal, adjustment, refund, or replacement transactions.

#### Document handler

Generate configured documents from a template version:

```text
Admission form
Student ID card
Admission receipt
Welcome letter
Student profile summary
```

Each generated document must retain:

```text
template_id
template_version
entity_type
entity_id
workflow_run_id
variables_snapshot
generated_by
created_at
```

The system ID-card template already exists in `src/modules/documents/system-templates.ts`. Admission onboarding should invoke it automatically when the institution’s policy enables automatic ID-card generation.

#### Account and notification handler

Create notifications and tasks for:

```text
Student:
- Account created
- Username and first-login instructions
- Class and section assignment

Guardian:
- Admission confirmation
- Fee/payment information
- Student credentials or secure credential delivery

Administration:
- Admission completed
- Missing documents or unpaid balance

Class teacher:
- New student added to section
```

Never store or expose raw passwords in event payloads or audit logs. Prefer a one-time password setup link or secure credential delivery workflow.

#### Task handler

Create configurable onboarding tasks, for example:

```text
Verify student documents
Collect photograph
Print physical ID card
Confirm guardian contact
Assign transport route
Assign library record
Confirm medical information
```

Each task must have an owner, due date, status, and source workflow.

### 8.4 Admission completion criteria

The onboarding workflow is complete only when:

```text
Student exists
Guardian relationship exists
Enrollment exists
Admission state is admitted
Billing state is recorded
Required documents are generated or intentionally skipped
Required notifications are dispatched or queued
Required tasks are created
Audit timeline is complete
```

A document or notification provider failure should not delete the student. It should create a retryable failed step and an administrative alert.

---

## 9. Academic-Year and Promotion Pipeline

### 9.1 Academic-year lifecycle

```text
Planning
  ↓
Configured
  ↓
Open for enrollment
  ↓
Active
  ↓
Closing
  ↓
Results finalized
  ↓
Promotion review
  ↓
Closed
  ↓
Archived
```

An institution should be allowed to prepare the next academic year before closing the current one.

### 9.2 Result finalization

Promotion must not run against incomplete marks. Before evaluation:

1. Every required examination must be published or explicitly waived.
2. Every required subject must have complete marks or an approved exception.
3. Missing marks must be visible to exam controllers.
4. Teachers with incomplete marks should receive notifications and tasks.
5. The institution must explicitly finalize the result set.
6. The finalized result set must be immutable except through a controlled reopen process.

Existing exam states provide a foundation:

```text
DRAFT
→ SCHEDULED
→ MARKS_COLLECTION
→ UNDER_REVIEW
→ READY_TO_PUBLISH
→ PUBLISHED
→ REOPENED
```

### 9.3 Promotion policy

Promotion must be policy-driven and institution-configurable.

Example policy:

```text
Minimum overall percentage: 33%
Minimum attendance: 75%
Maximum failed subjects: 1
Required subjects: Mathematics, English, Science
Allow manual override: true
Auto-create next enrollment: false
Generate new ID card: true
Generate next-year invoice: true
Notify guardian: true
```

The policy should support:

- Overall percentage threshold
- GPA threshold
- Subject-specific minimums
- Required-subject rules
- Maximum failed subject count
- Attendance requirement
- Financial hold policy
- Conduct or administrative hold policy
- Class capacity policy
- Manual approval requirement
- Automatic promotion toggle

### 9.4 Promotion evaluation

For each active enrollment:

```text
1. Find the finalized result set.
2. Calculate total, percentage, GPA, and subject outcomes.
3. Calculate attendance for the relevant academic period.
4. Check policy conditions.
5. Check active holds and exceptions.
6. Determine eligible, retained, or review status.
7. Create a promotion decision record.
8. Create an approval task if required.
```

Promotion decision fields:

```text
id
institution_id
student_id
from_enrollment_id
from_academic_year_id
from_class_id
from_section_id
to_academic_year_id
to_class_id
to_section_id
decision
status
calculated_percentage
gpa
failed_subject_count
attendance_percentage
policy_snapshot
reason
approved_by_membership_id
approved_at
completed_at
```

Decision values:

```text
promote
retain
review
transfer
withdraw
```

Decision statuses:

```text
pending
eligible
waiting_approval
approved
rejected
completed
reversed
```

### 9.5 Promotion completion

Promotion must create a new historical enrollment:

```text
Old enrollment:
2026 → Class 9 → Section A → completed/promoted

New enrollment:
2027 → Class 10 → Section A → active
```

The completion transaction should:

1. Re-check the decision and source enrollment.
2. Confirm the target academic year is valid.
3. Confirm target class and section belong to the institution.
4. Confirm the student has no conflicting active enrollment for that academic year.
5. Mark the previous enrollment as completed/promoted.
6. Insert the new enrollment.
7. Preserve the old class, section, roll, and academic-year data.
8. Emit `student.promoted`.
9. Write an audit entry.

Do not update the student’s identity record to `Class 10`. The current class can be projected from the active enrollment, while history remains intact.

### 9.6 Promotion handlers

After `student.promoted`:

```text
Finance:
- Apply next-year fee structure
- Create invoices if configured
- Carry forward approved balances

Documents:
- Generate promotion letter if enabled
- Generate new ID card if required
- Generate result/report document

Notifications:
- Notify student
- Notify guardian
- Notify class teacher
- Notify finance if balance exists

Tasks:
- Confirm new section placement
- Confirm books/uniform/transport
- Confirm document printing
```

### 9.7 Manual override

Manual promotion must require:

```text
Override reason
Actor identity
Permission
Original evaluation snapshot
Approved decision
Audit entry
```

An override must never erase the original automated evaluation.

---

## 10. Finance Integration Pipeline

Finance should be a connected subsystem, not a generic record editor.

```text
Fee Structure
    ↓
Fee Assignment
    ↓
Invoice
    ↓
Payment
    ↓
Payment Allocation
    ↓
Receipt
    ↓
Ledger / Reports
```

### 10.1 Student financial relationships

Invoices should reference, where applicable:

```text
institution_id
student_id
enrollment_id
academic_year_id
class_id
section_id
billing_period
invoice items
```

This makes it possible to answer:

- What did the student owe in Class 9A?
- Which academic year generated the charge?
- Which payments settled the invoice?
- What balance should carry into the next year?

### 10.2 Financial states

Invoice:

```text
draft
issued
partially_paid
paid
overdue
waived
cancelled
```

Payment:

```text
pending
completed
failed
cancelled
refunded
partially_refunded
```

### 10.3 Financial immutability

After a payment is completed:

```text
Do not silently edit the amount, date, method, or receiver.
```

Use:

```text
reversal
adjustment
refund
replacement transaction
```

Every financial correction must preserve the original record and explain the reason.

### 10.4 Employee finance

Employee workflows should eventually connect:

```text
Employee
  ↓
Salary Structure
  ↓
Allowances and Deductions
  ↓
Payroll Run
  ↓
Payroll Approval
  ↓
Payment
  ↓
Payslip
```

Payroll must remain separate from student invoices, although both may use shared financial accounts and reporting infrastructure.

---

## 11. Document Automation

Documents should be generated as workflow outputs, not only through manual buttons.

### 11.1 Document triggers

```text
admission.completed
  → admission form
  → student ID card
  → admission receipt

billing.payment_received
  → payment receipt

exam.result_published
  → marksheet
  → report card
  → result certificate

student.promoted
  → promotion letter
  → updated ID card

student.withdrawn
  → transfer certificate
  → clearance statement

employee.joined
  → employee ID card
  → appointment document

payroll.completed
  → payslip
```

### 11.2 Template versioning

Templates must be versioned. A generated document must always point to the exact version used.

```text
template
  └── template_version
        └── generated_document
```

Changing an ID-card template must not change previously generated cards or historical certificates.

### 11.3 Variable resolution

The variable registry should support canonical entities:

```text
institution.*
academicYear.*
student.*
guardian.*
enrollment.*
class.*
section.*
exam.*
result.*
invoice.*
payment.*
employee.*
payroll.*
```

The document service should resolve values from authoritative records rather than relying on the frontend to submit all identity fields manually.

---

## 12. Employee Lifecycle and HR Automation

Sohopathi should treat employees as first-class institutional participants.

```text
Candidate
  ↓
Application
  ↓
Approved Hire
  ↓
Employee Profile
  ↓
Institution Membership
  ↓
Role and Department
  ↓
Onboarding Tasks
  ↓
Attendance and Leave
  ↓
Performance
  ↓
Payroll
  ↓
Renewal / Transfer / Exit
```

### 12.1 Employee onboarding

`employee.joined` should be able to trigger:

```text
Create or link profile
Create membership
Assign role
Assign manager/department
Create employee ID document
Create onboarding task bundle
Enable attendance tracking
Notify manager
Add to payroll eligibility if configured
```

### 12.2 Employee task automation

Task recipients should be selectable by:

```text
specific employee
role
department
manager
class teacher
subject teacher
exam controller
filtered employee group
```

This mechanism should be reusable by exams, notices, notifications, onboarding, leave, and operational workflows.

### 12.3 Employee attendance and leave

Events:

```text
employee.attendance_marked
employee.leave_requested
employee.leave_approved
employee.leave_rejected
```

Leave approval should update availability and optionally notify payroll or scheduling workflows.

---

## 13. Notifications and Tasks

Notifications and tasks should be event-driven and configurable per institution.

### 13.1 Channels

```text
in-app
email
SMS
push
```

The institution may enable or disable channels by event type and recipient type.

### 13.2 Recommended event mappings

```text
admission.completed
  → student, guardian, class teacher, admissions team

billing.invoice_issued
  → guardian, student, finance team

billing.payment_received
  → guardian, student, cashier

exam.marks_pending
  → teacher, exam controller

exam.result_published
  → student, guardian, class teacher

student.promoted
  → student, guardian, new class teacher, finance team

employee.leave_requested
  → manager, HR

employee.leave_approved
  → employee, manager, scheduling team
```

### 13.3 Reliable delivery

A notification should have its own delivery record:

```text
notification_delivery
- id
- event_id
- recipient
- channel
- status
- provider_message_id
- attempts
- last_error
- sent_at
```

A provider failure should be retryable and should not fail the originating admission or promotion transaction.

---

## 14. Approval Gates and Human Control

Automation should not remove institutional responsibility.

### 14.1 Actions requiring approval

Configurable approval should be available for:

```text
Admission approval
Large discounts or fee waivers
Payment reversals and refunds
Exam result publication
Promotion overrides
Employee hiring
Payroll approval
Student withdrawal
Transfer certificate issuance
```

### 14.2 Approval record

```text
approval_request
- id
- institution_id
- workflow_run_id
- approval_type
- entity_type
- entity_id
- requested_by
- assigned_to
- status
- decision
- reason
- decided_by
- decided_at
```

### 14.3 Separation of duties

Examples:

```text
Accountant creates payment
Principal approves refund
Exam teachers enter marks
Exam controller publishes result
Class teacher requests promotion override
Academic administrator approves override
```

---

## 15. Idempotency, Retry, and Compensation

### 15.1 Idempotency

Every workflow step that creates an external or financial side effect must be safely repeatable.

Examples:

```text
Unique admission invoice per workflow and fee policy
Unique generated document per event/template/entity where appropriate
Unique notification delivery per event/recipient/channel
Unique next-year enrollment per student/academic year
Unique payment provider transaction reference
```

### 15.2 Retry policy

Recommended retry schedule:

```text
Attempt 1: immediate
Attempt 2: 1 minute
Attempt 3: 5 minutes
Attempt 4: 30 minutes
Attempt 5: 2 hours
Then: dead-letter queue and administrator alert
```

### 15.3 Compensation

If a side effect fails after the core transaction:

```text
Do not delete the canonical student or enrollment.
Mark the workflow step as failed.
Create an administrator task.
Allow retry.
Record the error and correlation ID.
```

For financial actions, compensation must use reversal or adjustment records, never destructive deletion.

---

## 16. Audit Timeline

The current audit log should be complemented by a human-readable timeline.

Example:

```text
18 Sep 2026, 10:00
Admission approved for Rahim Ahmed
Class: 9A
By: Admissions Officer

18 Sep 2026, 10:00
Student account created
Username: rahim.2026

18 Sep 2026, 10:01
Admission invoice issued
Amount: ৳ 8,500

18 Sep 2026, 10:02
Payment received
Amount: ৳ 8,500
Method: bKash

18 Sep 2026, 10:02
Student ID card generated
Template: Official Student ID Card v3

18 Sep 2026, 10:03
Guardian notification queued
```

Audit records should capture:

```text
who
what
when
where
institution
entity
old value
new value
reason
correlation ID
workflow ID
```

Raw JSON remains useful for administrators and debugging, but the default UI should show understandable business changes.

---

## 17. Permissions and Scope

Authorization should follow this chain:

```text
User
  ↓
Institution Membership
  ↓
Role
  ↓
Permission
  ↓
Feature Availability
  ↓
Scope
  ↓
Resource Ownership
  ↓
Action
```

Example:

```text
Teacher 01
  ↓
Teacher role
  ↓
marks.write
  ↓
Examinations feature enabled
  ↓
Assigned sections
  ↓
Assigned subject
  ↓
Exam paper
  ↓
Student marks
  ↓
Write marks
```

The workflow layer must reuse the existing permission middleware and tenant-aware `withDb()` flow. It must not introduce special role checks such as `if role === 'admin'` throughout handlers.

Sensitive workflow permissions should include:

```text
admissions.approve
billing.invoice.create
billing.payment.create
billing.payment.reverse
billing.refund.approve
exam.marks.write
exam.result.publish
promotion.evaluate
promotion.approve
promotion.override
student.transfer
student.withdraw
employee.hire
payroll.approve
workflow.retry
workflow.cancel
```

Feature availability and permission must remain separate:

```text
Feature disabled → nobody can use it
Feature enabled → permission and scope determine access
```

---

## 18. Data Integrity Rules

The database must enforce relationships wherever possible.

Examples:

```text
student.institution_id → institution.id
enrollment.student_id → student.id
enrollment.academic_year_id → academic_year.id
enrollment.class_id → class.id
enrollment.section_id → section.id
exam.academic_year_id → academic_year.id
exam_candidate.exam_id → exam.id
exam_candidate.student_id → student.id
mark.exam_id → exam.id
mark.student_id → student.id
invoice.student_id → student.id
payment.invoice_id → invoice.id
generated_document.template_id → template.id
```

Recommended constraints:

```text
UNIQUE(student_id, academic_year_id) for one enrollment per year
UNIQUE(exam_id, student_id, subject_id) for one mark per subject
UNIQUE(student_id, academic_year_id, fee_policy_key) for generated annual fees
UNIQUE(event_id, handler_key) for event handler execution
UNIQUE(event_id, recipient, channel) for notification delivery
```

Where a student may have multiple historical or concurrent enrollments, replace overly strict constraints with explicit active-record constraints and well-defined state transitions.

---

## 19. API Direction

The current module routes can remain, but orchestration should be introduced through application services.

Recommended service boundaries:

```text
src/core/workflows/
  event-bus.ts
  event-store.ts
  workflow-runner.ts
  workflow-types.ts
  idempotency.ts

src/modules/admission/
  admission-service.ts
  admission-workflows.ts

src/modules/promotion/
  manifest.ts
  repository.ts
  routes.ts
  promotion-service.ts
  policy-engine.ts

src/modules/finance/
  billing-service.ts
  payment-service.ts

src/modules/documents/
  document-workflow-handler.ts

src/modules/notifications/
  delivery-service.ts

src/modules/hr/
  employee-service.ts
```

Example endpoints:

```text
POST /api/admissions/:id/admit
GET  /api/workflows/:id
POST /api/workflows/:id/retry
POST /api/workflows/:id/cancel
POST /api/promotion/evaluate
GET  /api/promotion/decisions
POST /api/promotion/decisions/:id/approve
POST /api/promotion/decisions/:id/reject
POST /api/promotion/decisions/:id/complete
GET  /api/students/:id/timeline
GET  /api/students/:id/lifecycle
```

The admission endpoint should remain backward-compatible while internally delegating to the new service.

---

## 20. Frontend Direction

The frontend should expose workflows, not only records.

### 20.1 Student 360 lifecycle view

The existing student history drawer should evolve into a lifecycle timeline containing:

```text
Admission
Account
Guardian
Enrollment history
Attendance
Assignments
Examinations
Results
Invoices
Payments
Documents
Tasks
Notifications
Promotion decisions
```

### 20.2 Workflow center

Add a workflow center showing:

```text
Running workflows
Waiting approvals
Failed steps
Retryable actions
Recently completed workflows
Dead-lettered events
```

### 20.3 Admission workspace

The admission screen should show a pipeline:

```text
Application → Review → Approval → Onboarding → Completed
```

The operator should see missing documents, unpaid fees, failed document generation, and unassigned tasks without visiting multiple modules.

### 20.4 Promotion workspace

The academic administration screen should provide:

```text
Result readiness
Incomplete marks
Eligible students
Students requiring review
Promotion preview
Target class/section assignment
Financial holds
Bulk approval
Bulk completion
```

Every bulk action must display a preview and require confirmation.

---

## 21. Reporting and Observability

The system should report workflow health, not only row counts.

Recommended metrics:

```text
Admission completion rate
Average admission onboarding time
Failed onboarding steps
Unpaid admission invoices
ID cards generated versus pending
Exam marks completion rate
Promotion eligibility rate
Promotion exceptions
Failed notifications
Workflow retry count
Average payment settlement time
Employee onboarding completion rate
Payroll approval delay
```

Every workflow log should include:

```text
institution_id
workflow_id
event_id
handler_key
correlation_id
latency
status
error_code
```

Sentry should receive workflow failures with institution, workflow, event, and aggregate tags, without exposing passwords or sensitive financial payloads.

---

## 22. End-to-End Scenario: Admission to Active Student

### Scenario

A new student is admitted to Class 9A on September 18, 2026.

### Expected pipeline

```text
1. Application exists and is assigned to Class 9.
2. Admissions officer selects Section A.
3. System validates institution, academic year, class, section, and capacity.
4. Student account is created or reused.
5. Student record is created.
6. Guardian record is created and linked.
7. Enrollment is created for the active academic year.
8. Admission application becomes admitted.
9. Admission invoice is created.
10. Payment is recorded if collected.
11. Receipt is generated.
12. Student ID card is rendered from the default ID-card template.
13. Admission form snapshot is generated.
14. Credentials notification is queued securely.
15. Guardian confirmation is queued.
16. Class teacher receives a new-student notification.
17. Onboarding tasks are created.
18. The student timeline shows every step.
19. `admission.completed` and downstream events are auditable.
```

### Failure example

If ID-card generation fails:

```text
Student and enrollment remain valid.
Billing remains valid.
Workflow step becomes failed.
Admin receives a retry task.
A retry regenerates the card without creating a duplicate admission.
```

---

## 23. End-to-End Scenario: Examination to Promotion

### Scenario

A Class 9A student completes the annual examination.

### Expected pipeline

```text
1. Exam is created for the academic year and target section.
2. Candidates are snapshotted.
3. Subject papers are assigned to teachers.
4. Teachers enter marks.
5. Missing marks produce tasks and notifications.
6. Exam controller reviews completion.
7. Result is published.
8. Student result is calculated.
9. Attendance and policy rules are evaluated.
10. Promotion decision is created.
11. Decision is automatically approved or sent for review according to policy.
12. Old enrollment becomes completed/promoted.
13. New academic-year enrollment is created in Class 10.
14. New class/section assignment is validated.
15. New-year billing is generated if configured.
16. New ID card and promotion document are generated if configured.
17. Student and guardian are notified.
18. Class teacher and finance team receive relevant tasks.
19. Student timeline records the transition.
```

### Non-promotion example

If the student fails two required subjects:

```text
Decision: retain or review
No new enrollment is created automatically
Guardian notification explains the result
Academic administrator receives a review task
Manual override is possible only with permission and reason
```

---

## 24. Testing Strategy

Every workflow requires unit, integration, and retry tests.

### Admission tests

```text
Creates student, guardian, account, and enrollment atomically
Rejects invalid section or cross-institution IDs
Prevents duplicate admission
Creates exactly one invoice on retry
Creates exactly one ID-card document on retry
Does not expose passwords in events or audit logs
```

### Promotion tests

```text
Uses finalized results only
Calculates policy correctly
Preserves old enrollment history
Creates one next-year enrollment
Rejects duplicate promotion completion
Supports manual override with reason
Handles target-section capacity
```

### Finance tests

```text
Payment updates invoice balance correctly
Completed payment cannot be destructively edited
Retries do not duplicate receipts
Refunds and reversals preserve history
Cross-tenant financial access is rejected
```

### Workflow tests

```text
Events are committed with source transactions
Failed handlers retry
Dead-letter events are visible
Handlers are idempotent
Workflow status is accurate
Correlation IDs appear in audit and logs
```

### Security tests

```text
No cross-institution event processing
No cross-institution enrollment
No cross-institution invoice access
Permission and scope are checked for commands
RLS remains active for workflow handlers
```

---

## 25. Implementation Roadmap

### Phase 1: Foundation

1. Formalize event envelope and event statuses.
2. Add event handler registration and processing.
3. Add idempotency keys.
4. Add workflow run and workflow step records.
5. Add workflow timeline queries.
6. Add test helpers for event processing.

### Phase 2: Admission onboarding

1. Extract admission approval into an application service.
2. Keep student, guardian, enrollment, and application updates atomic.
3. Emit `admission.completed`.
4. Add admission billing handler.
5. Add payment/receipt handler.
6. Add ID-card and admission-document handler.
7. Add notification and task handlers.
8. Add admission workflow UI.

### Phase 3: Academic progression

1. Add promotion module and manifest.
2. Add promotion policy configuration.
3. Add result finalization checks.
4. Add promotion evaluation and decision records.
5. Add manual approval and override flow.
6. Add new enrollment creation.
7. Add promotion downstream handlers.

### Phase 4: Finance maturity

1. Separate invoice items, payment allocations, refunds, and adjustments.
2. Add student enrollment references to invoices.
3. Add financial ledger/audit protections.
4. Add approval separation for refunds and adjustments.
5. Add academic-year carry-forward rules.

### Phase 5: Employee and HR workflows

1. Add employee lifecycle records.
2. Add employee onboarding workflow.
3. Connect roles, departments, attendance, leave, tasks, and payroll.
4. Add employee document automation.
5. Add payroll approval workflow.

### Phase 6: Operational intelligence

1. Add workflow center.
2. Add lifecycle timeline.
3. Add workflow health dashboards.
4. Add provider delivery monitoring.
5. Add institution-configurable automation policies.

---

## 26. Non-Negotiable Design Rules

1. Everything is institution-scoped.
2. Academic operations are academic-year-aware.
3. Enrollment history is never destroyed by promotion.
4. Financial history is never silently rewritten.
5. Documents always preserve their template version and variables snapshot.
6. Events are committed with canonical state changes.
7. Handlers are idempotent and retryable.
8. Automation failures do not erase valid business records.
9. Human overrides require permission, reason, and audit history.
10. No workflow may bypass tenant RLS or permission middleware.
11. No frontend-submitted identity data should override authoritative server-side records without validation.
12. No raw passwords or secrets may enter events, audit logs, documents, or notifications.
13. Bulk operations require previews, validation, and audit records.
14. Every important workflow must be visible to administrators.
15. The system should automate deterministic work while preserving human control over judgment-based decisions.

---

## 27. Final Direction

Sohopathi should evolve from a set of connected management modules into a **workflow-first institutional ERP**.

The goal is not merely to add more screens. The goal is to make the relationships between existing screens and records operationally meaningful:

```text
Admission creates the student.
Enrollment places the student academically.
Billing creates the financial responsibility.
Payment settles that responsibility.
Documents formalize the institutional record.
Attendance and assessment build the academic history.
Examinations produce results.
Results drive promotion decisions.
Promotion creates the next enrollment.
Notifications and tasks keep people aligned.
Audit history explains everything.
```

When implemented this way, Sohopathi can eliminate a large amount of repetitive school administration while retaining the controls, history, accountability, and flexibility expected from a serious cloud ERP platform.
