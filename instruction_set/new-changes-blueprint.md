rootplinix, this is essentially a **domain-level product specification** for the academic, examination, assignment, attendance, document, billing, permissions, and institutional settings layers of Biddyapith. I’ve reorganized it into something much closer to an implementation-ready product/engineering specification, while also adding the missing relationships, states, permissions, edge cases, and operational rules. Because apparently schools require a small ERP before they will agree to record whether a child attended class.

The most important architectural principle should be:

> **Everything is institution-scoped and relational. Nothing important should exist as an isolated record.**

That means `Student → Enrollment → Academic Year → Class → Section → Subject → Teacher Assignment → Exam/Assignment/Attendance`, etc.

# Biddyapith Institutional Academic & Management Specification

## 1. Core Architecture Principle

Every feature must operate inside an institution and, where applicable, an academic year.

The primary hierarchy should be:

```text
Institution
 ├── Academic Year
 │    ├── Classes
 │    │    ├── Sections
 │    │    │    ├── Student Enrollments
 │    │    │    ├── Subjects
 │    │    │    └── Teacher Assignments
 │    │    │
 │    │    └── Academic Operations
 │    │
 │    ├── Examinations
 │    ├── Assignments
 │    ├── Attendance
 │    └── Results
 │
 ├── Employees
 ├── Students
 ├── Guardians
 ├── Documents
 ├── Finance
 ├── Notifications
 ├── Tasks
 ├── Audit Logs
 └── Institution Settings
```

Nothing should reference another institution's records.

Every relational entity should carry or derive:

```text
institution_id
academic_year_id   [where applicable]
```

and authorization must verify both ownership and scope.

---

# 2. Permission & Scope Architecture

The existing permission model should be expanded rather than creating special-case authorization logic for every feature.

Permissions should follow:

```text
resource.action
```

Examples:

```text
exam.create
exam.read
exam.update
exam.delete
exam.publish

exam.subject.create
exam.subject.read
exam.subject.update

exam.student.assign
exam.student.read

exam.room.create
exam.room.read
exam.room.update

exam.guard.assign

exam.marks.read
exam.marks.write
exam.marks.update

exam.result.publish
exam.result.reopen

assignment.create
assignment.read
assignment.update
assignment.delete

assignment.submission.read
assignment.submission.write
assignment.submission.update
assignment.mark.write

attendance.read
attendance.write
attendance.update

employee.attendance.read
employee.attendance.write
employee.attendance.update

template.create
template.read
template.update
template.delete
template.publish

invoice.create
invoice.read
invoice.update
invoice.delete
invoice.payment.create
invoice.payment.read
invoice.payment.update
invoice.refund
invoice.report
```

However, **permission alone is not enough**.

Every permission should potentially have a scope:

```text
Institution
Campus
Academic Year
Class
Section
Subject
Assigned Students
Self
```

For example:

```text
marks.write
scope = assigned_subject + assigned_classes
```

A mathematics teacher should therefore not gain access to every mark merely because they possess `marks.write`.

---

# 3. Examination & Marks Management

This should become one of the core modules of Biddyapith.

There should be a distinction between:

### A. Examination

The overall examination event.

Example:

```text
Class 5B
Class Test - Male
Academic Year: 2026
Exam Controller: Teacher 06
Date: 15 September 2026
Status: Draft
```

### B. Examination Subjects

Individual subjects inside an examination.

```text
Bangla
Teacher: Teacher 02
Syllabus: Chapter 1-5
Maximum Mark: 50
Pass Mark: 17
```

```text
English
Teacher: Teacher 01
Syllabus: Chapter 1-5
Maximum Mark: 50
Pass Mark: 17
```

```text
Mathematics
Teacher: Teacher 05
Syllabus: Chapter 1-5
Maximum Mark: 50
Pass Mark: 17
```

### C. Examination Candidates

Students actually participating.

An exam can target:

```text
Entire Class
Entire Section
Multiple Classes
Multiple Sections
Specific Students
Filtered Students
```

The candidate list should be **snapshotted when the exam is finalized**.

This matters enormously.

If Class 5B has 50 students today and two students transfer tomorrow, the historical examination should not mysteriously acquire or lose candidates.

---

# 4. Exam Creation

Authorized users can create examinations.

Required fields:

```text
Exam Name
Exam Type
Academic Year
Class / Section
Description
Instructions
Start Date
End Date
Registration/Candidate Deadline
Maximum Marks
Pass Criteria
Exam Controller
Status
```

Optional:

```text
Chapter
Syllabus
Remarks
Attachment
Exam Pattern
Grading Scheme
```

Exam types can include:

```text
Class Test
Monthly Test
Weekly Test
Half-Yearly
Annual
Model Test
Quiz
Practical
Viva
Assignment Assessment
Other
```

The system should not hard-code these excessively. `Exam Type` should be configurable by the institution.

---

# 5. Student Eligibility & Filtering

The candidate selector should be powerful.

Instead of only:

```text
Class 5B
```

allow:

```text
Class = 5
Section = B
Gender = Male
Status = Active
Enrollment = Current
Roll = 01-30
```

or:

```text
Class = 5
Sections = A,B,C
Students = manually selected
```

Filters should be composable.

For example:

```text
Class: 5
Section: B
Gender: Male
Roll: 1-30
Status: Active
```

Then:

```text
Preview: 30 students
```

The selected students become the exam candidates.

---

# 6. Exam Scheduling

An examination itself may contain multiple subject sessions.

Example:

```text
Exam
└── Class 5B Class Test
     ├── English
     │    ├── Date: 15 Sep
     │    ├── Time: 10:00-11:00
     │    └── Room: 704
     │
     ├── Bangla
     │    ├── Date: 15 Sep
     │    ├── Time: 10:00-11:00
     │    └── Room: 408
     │
     └── Mathematics
          └── ...
```

This allows different subjects to have different schedules.

---

# 7. Exam Rooms & Guards

Rooms should be reusable institutional entities.

```text
Room
 ├── Room Number
 ├── Building
 ├── Floor
 ├── Capacity
 └── Status
```

An exam session creates a room allocation.

Example:

```text
Room 704
Subject: English
Time: 10:00-11:00

Guards:
Teacher 07
Teacher 10

Candidates:
Roll 01-30
```

Another:

```text
Room 408
Subject: Bangla
Time: 10:00-11:00

Guards:
Teacher 23
Teacher 08

Candidates:
Roll 31-50
```

The system should validate:

```text
Candidate count <= room capacity
Guard cannot be assigned to overlapping sessions
Student cannot be assigned to two rooms for the same session
Room cannot host overlapping sessions
```

Human beings are remarkably creative at scheduling two things in the same room simultaneously, so the software should stop them.

---

# 8. Exam Controller

The Exam Controller becomes the operational owner of the examination.

They can:

```text
View examination
View candidates
Manage subjects
Assign teachers
Assign rooms
Assign guards
Assign students
Monitor marks
Send reminders
Correct marks
Reopen marks
Publish results
Generate marksheets
Notify students
```

Subject teachers have a narrower scope.

For example:

```text
English Teacher
    ↓
English marks only
    ↓
Assigned candidates only
```

They cannot modify:

```text
Bangla marks
Math marks
Exam configuration
Candidate assignment
Final result
```

unless their permissions explicitly allow it.

---

# 9. Marks Entry

Each examination subject creates a mark-entry workload.

Example:

```text
Exam: Class 5B Class Test
Subject: English
Teacher: Teacher 01

Candidates:
01
02
03
...
23
24
...
50
```

Teacher 01 enters:

```text
Student 23 → 34
```

Math teacher:

```text
Student 23 → 44
```

Bangla teacher:

```text
Student 23 → 40
```

The resulting record becomes:

```text
Student 23
 ├── Bangla: 40
 ├── English: 34
 └── Mathematics: 44
```

---

# 10. Marks Status

Every mark should have an explicit state.

```text
Not Started
Draft
Submitted
Locked
Reopened
Corrected
```

At minimum:

```text
NOT_ENTERED
ENTERED
LOCKED
```

This allows the controller dashboard to show:

```text
Bangla
40 / 50 students completed
10 pending
```

and:

```text
English
35 / 50 completed
15 pending
```

---

# 11. Marks Monitoring Dashboard

The Exam Controller should have a matrix.

Example:

| Subject | Teacher    | Assigned | Entered | Pending | Status   |
| ------- | ---------- | -------: | ------: | ------: | -------- |
| Bangla  | Teacher 02 |       50 |      40 |      10 | Pending  |
| English | Teacher 01 |       50 |      35 |      15 | Pending  |
| Math    | Teacher 05 |       50 |      50 |       0 | Complete |

Clicking a subject opens the detailed student list.

Example:

```text
Bangla

01 ✓
02 ✓
03 ✓
...
23 ✓
24 ✗
25 ✗
26 ✗
...
30 ✗
```

The controller can select:

```text
24-30
```

and:

```text
Notify Teacher 02
Create Task
```

---

# 12. Teacher Task Integration

This should connect directly to the existing Tasks system.

When marks are incomplete:

```text
Exam Controller
        ↓
Select Pending Marks
        ↓
Notify Teacher
        ↓
Create Task
```

Task:

```text
Title:
Complete Bangla marks for Class 5B Class Test

Assigned To:
Teacher 02

Related Exam:
Class 5B Class Test

Related Subject:
Bangla

Deadline:
...
```

The task should automatically disappear/complete when all required marks are submitted, depending on the task configuration.

---

# 13. Result Validation

Before publication, the controller gets a validation screen.

System checks:

```text
All candidates assigned
All subjects configured
All marks entered
No mark > maximum
No negative marks
No duplicate marks
No missing marks
All required teachers completed
All exam sessions completed
```

Optional warnings:

```text
Student absent
Student exempted
Student transferred
Student withheld
```

These should be explicit states rather than hacks such as entering `0`.

---

# 14. Result Publication

Exam status:

```text
Draft
Scheduled
Running
Marks Collection
Under Review
Ready to Publish
Published
Reopened
Archived
```

Only authorized users can transition:

```text
Ready to Publish → Published
Published → Reopened
```

After publication:

```text
Subject Teachers:
Read only

Students:
Read result

Parents/Guardians:
Read result, if enabled

Exam Controller:
Can correct/reopen according to permission
```

---

# 15. Published Result

Student dashboard:

```text
Class Test - Male
15 September 2026

Bangla       40/50
English      34/50
Mathematics  44/50

Total        118/150
Percentage   78.67%
Grade        A
```

Also:

```text
View Marksheet
Download Marksheet
```

Notifications:

```text
Your Class 5B Class Test result has been published.
```

Bulk notification:

```text
Notify all students
Notify selected students
Notify students with failed subjects
Notify students with absent status
```

---

# 16. Marksheet Template System

Marksheets should not be hard-coded.

They should be generated from a template.

Variables could include:

```text
{{institution.name}}
{{institution.code}}
{{institution.address}}

{{student.name}}
{{student.photo}}
{{student.roll}}
{{student.registration_number}}

{{class.name}}
{{section.name}}
{{academic_year.name}}

{{exam.name}}
{{exam.date}}

{{subject.name}}
{{subject.mark}}
{{subject.maximum_mark}}

{{result.total}}
{{result.percentage}}
{{result.grade}}
{{result.position}}
```

And potentially loops:

```text
{{#subjects}}
...
{{/subjects}}
```

This makes one template capable of handling different examinations.

---

# 17. Marks Correction / Recheck

Published results should support controlled correction.

Example:

```text
Published
   ↓
Recheck requested
   ↓
Paper reviewed
   ↓
Correction authorized
   ↓
Marks updated
   ↓
Change recorded
   ↓
Student notified
```

Important:

A teacher should **not silently modify published marks**.

Every correction should record:

```text
Old mark
New mark
Changed by
Changed at
Reason
Related recheck/request
```

This belongs in the audit system.

---

# 18. Client-Side PDF Generation

Your approach here makes sense.

The server should primarily provide:

```text
Structured result data
+
Template definition
```

The client generates:

```text
HTML / document representation
→ PDF
→ Print
```

For bulk printing:

```text
Select 500 students
        ↓
Load result data
        ↓
Render template
        ↓
Generate PDFs
        ↓
Print / download
```

For performance, avoid making 500 independent API calls.

Use:

```text
Bulk result endpoint
```

with pagination/chunking where necessary.

---

# 19. Assignments

Assignments are subject-scoped.

Relationship:

```text
Teacher
 ↓
Subject Assignment
 ↓
Class / Section
 ↓
Assignment
 ↓
Student Submission
```

Teacher creates:

```text
Title
Description
Subject
Class
Section
Deadline
Maximum Mark
Attachments
Instructions
```

Students automatically see assignments matching their enrollment.

---

# 20. Assignment Submission

Student workflow:

```text
Assignment
 ↓
Solve
 ↓
Take photo
 ↓
Upload
 ↓
Submit
```

After submission:

```text
Submission = LOCKED
```

Student can:

```text
submission.read
```

but not:

```text
submission.update
```

unless the teacher explicitly reopens it.

This distinction is important.

You can have:

```text
assignment.edit
```

for assignment configuration, while:

```text
assignment.submission.update
```

controls the student's actual submission.

---

# 21. Assignment Submission Permissions

Suggested permissions:

```text
assignment.create
assignment.read
assignment.update
assignment.delete

assignment.submission.create
assignment.submission.read
assignment.submission.update
assignment.submission.delete

assignment.mark.read
assignment.mark.write
assignment.mark.update
```

Student:

```text
assignment.read
assignment.submission.create
assignment.submission.read
```

Teacher:

```text
assignment.create
assignment.read
assignment.update
assignment.submission.read
assignment.mark.write
assignment.mark.update
```

Admin/authorized:

```text
Everything within scope
```

---

# 22. Assignment Submission Files

Uploads should be stored separately from database records.

Database:

```text
submission
 ├── id
 ├── assignment_id
 ├── student_id
 ├── submitted_at
 ├── status
 └── marks
```

Storage:

```text
/institution/{institution_id}/assignments/{assignment_id}/submissions/{student_id}/...
```

Do not store image binaries directly in PostgreSQL.

---

# 23. Attendance

Attendance must distinguish between:

```text
Attendance Session
Attendance Record
```

Example:

```text
Class 5B
15 Sep
1st Period
Teacher 08
```

records:

```text
Student 01 → Present
Student 02 → Present
Student 03 → Absent
```

---

# 24. Flexible Attendance Operations

Institutions can choose their operational model.

### Model A

One attendance per day:

```text
Class Teacher → Daily Attendance
```

### Model B

Period attendance:

```text
1st Period
2nd Period
3rd Period
...
```

### Model C

Start + End:

```text
Morning Attendance
Evening Attendance
```

This should be controlled through institution settings rather than custom coding.

Example:

```text
Attendance Mode:
[Daily]
[Per Period]
[Start + End]
```

---

# 25. Teacher Attendance Scope

If all teachers have:

```text
attendance.write
```

they can create attendance only for their authorized class/subject/session.

For example:

```text
Teacher 08
Class 5B
Period 1
```

The attendance record should preserve:

```text
taken_by
class
section
date
period
session_type
```

Therefore the system can identify:

> Teacher 08 recorded the Class 5B attendance for first period.

---

# 26. Employee Attendance

Employee attendance is separate from student attendance.

Employee records should never accidentally appear in student attendance.

Permissions:

```text
employee.attendance.read
employee.attendance.write
employee.attendance.update
```

Possible modes:

```text
Admin records employee attendance
```

or:

```text
Employee records own attendance
```

If self-attendance is enabled:

```text
employee.attendance.self.write
```

must only permit:

```text
current_user.employee_id
```

Never:

```text
arbitrary employee_id
```

The existing 404 on the employee attendance page should be treated as a feature defect and corrected as part of this module.

---

# 27. Attendance Editing

Once saved:

```text
Attendance → Saved
```

Authorized users can:

```text
read
update
save
```

Every update should create an audit entry.

For example:

```text
Student 23
Present → Absent

Changed by Teacher 08
15 Sep 2026 09:42
Reason: Student arrived after attendance
```

---

# 28. Document Template Builder

This deserves to be a proper application rather than a glorified textarea wearing a tie.

The template builder should have:

```text
Full editor
Live preview
Page controls
Margins
Headers
Footers
Tables
Images
Text blocks
Variables
Conditional blocks
Repeating blocks
Page breaks
Alignment
Fonts
Sizes
Spacing
Borders
```

The editor should show the actual page layout.

---

# 29. Variable System

Variables should be centrally defined.

Categories:

```text
Institution
Academic
Student
Guardian
Employee
Teacher
Class
Section
Subject
Exam
Result
Finance
Invoice
Attendance
Assignment
```

Example:

```text
{{student.name}}
{{student.roll}}
{{student.class}}
{{student.section}}

{{institution.name}}
{{institution.logo}}
{{institution.code}}

{{employee.name}}
{{employee.designation}}
```

Variables should have metadata:

```text
key
label
type
source
availability
description
```

Example:

```text
student.name
Type: string
Source: Student
Available in: Student documents, Marksheets, Certificates
```

This prevents users from randomly typing variable names and discovering at PDF-generation time that humanity has once again invented a runtime error.

---

# 30. Template Context

A template should declare what it is intended for.

Example:

```text
Template Type:
Student Marksheet
```

Available variables automatically become:

```text
Institution
Student
Academic Year
Class
Section
Exam
Subjects
Results
```

For:

```text
Employee Salary Slip
```

available variables become:

```text
Institution
Employee
Designation
Salary
Allowances
Deductions
Payment
```

This makes the builder reliable.

---

# 31. System Templates

Biddyapith should provide default templates:

```text
Student Marksheet
Student ID Card
Admission Form
Transfer Certificate
Character Certificate
Employee ID Card
Appointment Letter
Salary Slip
Invoice
Payment Receipt
Fee Statement
Exam Attendance Sheet
Exam Room List
Result Summary
```

Institutions can:

```text
Use system template
Duplicate template
Customize duplicate
Create new template
Set default
Archive
```

System templates themselves should not be destructively modified.

---

# 32. Mandatory Watermark

Every generated document should contain an immutable footer/watermark:

```text
Powered by Biddyapith
```

or the final approved application branding.

Users should not have permission to:

```text
edit
delete
hide
move
disable
```

the mandatory branding layer.

Architecturally, this should be a **system-rendered layer**, not an editable object in the template.

---

# 33. Template Versioning

Templates should be versioned.

Example:

```text
Marksheet Template
Version 1
Version 2
Version 3
```

A generated document should retain:

```text
template_id
template_version
generated_at
generated_by
```

Therefore changing a template tomorrow does not alter the historical appearance of a document generated yesterday.

---

# 34. Global Filters

Filters should become a reusable UI pattern across the application.

Examples:

```text
Academic Year
Campus
Class
Section
Subject
Role
Employee
Student
Status
Date Range
Gender
Exam
Payment Status
```

Filters should support:

```text
single
multiple
range
search
select all
clear all
saved filters
```

For example:

```text
Class: 5, 6, 7
Section: A, B
Status: Active
```

The same filtering engine should be reused rather than rebuilding filter logic separately for every page.

---

# 35. Assignment / Task User Selection

Task assignee should support:

```text
Specific user
Multiple users
Role
Department
Class teacher
Subject teacher
Exam teacher
Filtered employees
```

Example:

```text
Role = Teacher
Subject = English
Class = 5B
```

Result:

```text
Teacher 01
Teacher 08
Teacher 12
```

Then:

```text
Assign Task
```

This same selection mechanism can later power:

```text
Notifications
Tasks
Exam assignments
Permission assignments
Announcements
```

---

# 36. Content Limits

All user-generated text fields should have defined limits.

Example:

```text
Title: 150 characters
Short description: 500
Description: 10,000
Notice body: 20,000
Task description: 10,000
Assignment description: 10,000
```

These should be:

```text
validated client-side
validated server-side
stored safely in DB
```

The server must always enforce the final limit.

Client-side validation alone is basically asking users to behave themselves on the internet.

---

# 37. Student / Guardian Model

The old `Guardian` role should be removed from the employee role system.

Guardians are not employees.

Correct model:

```text
Student
  ↓
Guardian relationship
  ↓
Guardian record
```

Employee directory:

```text
Teachers
Staff
Administrators
Other Employees
```

must never include guardians.

Student directory:

```text
Students
```

Guardian information may be displayed as a relationship:

```text
Student
 ├── Father
 ├── Mother
 └── Guardian
```

but it should not be treated as an employee identity.

---

# 38. Audit Logs

The existing:

```text
View Payload Diff
```

should become:

```text
Change Log
```

Human-readable.

Instead of:

```json
{
  "old": {
    "marks": 34
  },
  "new": {
    "marks": 40
  }
}
```

show:

```text
Marks changed

Student: Rahim
Subject: English
Old Mark: 34
New Mark: 40

Changed by: Teacher 06
Date: 15 Sep 2026, 11:42 AM
Reason: Recheck
```

Audit logs should capture:

```text
Who
What
When
Where
Entity
Entity ID
Old value
New value
Reason
IP/device metadata where appropriate
```

But the UI should show human-readable changes.

Raw JSON can remain internally available to administrators/debugging if needed, but should not be the primary interface.

---

# 39. Institution Settings

Remove:

```text
Subdomain
```

from editable institution settings.

The subdomain should be infrastructure-managed.

Introduce:

```text
Institute Code / EIIN
```

Example:

```text
Institute Name: ABC School & College
Institute Code: 123456
```

This should be unique where the institution's jurisdiction requires uniqueness.

---

# 40. Feature-Based Institution Settings

Introduce:

```text
Institution → Features
```

Each feature can have:

```text
Enabled
Disabled
Restricted
```

For restricted features:

```text
Allowed Roles
Allowed Users
Allowed Scopes
```

Example:

```text
Finance
Status: Enabled
Access:
  Principal
  Accountant
```

Example:

```text
Assignment
Status: Enabled
Access:
  Teachers
  Students
```

Example:

```text
Online Payment
Status: Disabled
```

This gives you a proper feature-management layer rather than scattering:

```text
if institution.xyz_enabled
```

through 400 files.

---

# 41. Feature Permission vs Feature Availability

These should be two separate concepts.

### Feature setting

Does the institution use Finance?

```text
finance.enabled = true
```

### Permission

Who can access Finance?

```text
finance.read
finance.invoice.create
finance.payment.create
```

Therefore:

```text
Feature OFF
→ Nobody accesses it.

Feature ON
→ Permission determines who can access it.
```

This is much cleaner.

---

# 42. Invoice & Institution Billing

This should be treated as a **high-sensitivity financial subsystem**, not another CRUD page.

Core entities:

```text
Fee Structure
Fee Category
Fee Assignment
Invoice
Invoice Item
Payment
Payment Allocation
Discount
Waiver
Refund
Late Fee
Transaction
Financial Account
Receipt
Billing Period
```

---

# 43. Student Billing Relationship

Example:

```text
Student
 ↓
Fee Structure
 ↓
Fee Assignment
 ↓
Invoice
 ↓
Payment
 ↓
Receipt
```

Example invoice:

```text
Invoice #INV-2026-000123

Student: Rahim
Class: 5B
Billing Period: September 2026

Tuition Fee        1,500
Exam Fee             300
Transport Fee        800
-------------------------
Subtotal           2,600
Discount              100
-------------------------
Total              2,500

Paid               1,500
Due                1,000
```

---

# 44. Employee & Institution Financial Integration

Finance should connect with:

```text
Students
Employees
Academic Year
Classes
Institution
Payment methods
Accounts
Reports
```

For employees:

```text
Salary
Allowances
Deductions
Payroll
Payment
```

For institutions:

```text
Income
Expense
Accounts
Cash/bank
Transactions
```

Do not collapse all of this into one `invoice` table. Finance becomes a nightmare when every financial concept is forced into one generic record.

---

# 45. Payment

Payment records should include:

```text
Payment ID
Invoice
Student / Account
Amount
Payment Method
Transaction Reference
Date
Received By
Status
Notes
```

Methods:

```text
Cash
Bank
Mobile Banking
Online Gateway
Cheque
Other
```

Payment status:

```text
Pending
Completed
Failed
Cancelled
Refunded
Partially Refunded
```

---

# 46. Financial Immutability

Once a payment is completed, avoid destructive editing.

Instead of:

```text
Payment 500 → change to 700
```

use:

```text
Original Payment: 500
Correction/Adjustment: +200
```

or:

```text
Reverse old transaction
Create corrected transaction
```

This preserves accounting history.

For financial systems:

> **Never silently rewrite history.**

---

# 47. Financial Permissions

This needs much finer permissions than ordinary modules.

For example:

```text
finance.read

invoice.create
invoice.read
invoice.update
invoice.cancel

payment.create
payment.read
payment.update
payment.reverse
payment.refund

fee.create
fee.update
fee.delete

discount.create
discount.approve

finance.report.read
finance.export

financial_settings.manage
```

Potential approval separation:

```text
Accountant
→ Create payment

Principal
→ Approve refund

Admin
→ Configure financial system
```

This gives proper separation of duties.

---

# 48. Notifications

Notifications should become event-driven.

Events:

```text
exam.created
exam.scheduled
exam.reminder
exam.marks_pending
exam.result_published

assignment.created
assignment.deadline
assignment.submitted
assignment.marked

attendance.marked
attendance.absent

invoice.created
invoice.due
payment.received
payment.failed
```

Each event can have:

```text
In-app
Email
SMS
```

depending on institutional configuration.

---

# 49. Relational Integrity

The database should enforce relationships wherever possible.

For example:

```text
exam.institution_id
exam.academic_year_id
exam.class_id
exam.section_id
```

must reference valid records.

Likewise:

```text
exam_subject.exam_id
exam_subject.subject_id
exam_subject.teacher_id
```

And:

```text
exam_candidate.exam_id
exam_candidate.student_id
```

And:

```text
mark.exam_subject_id
mark.student_id
```

with uniqueness constraints such as:

```text
UNIQUE(exam_subject_id, student_id)
```

This prevents duplicate mark records.

---

# 50. Recommended Core Entity Relationships

A simplified architecture:

```text
Institution
│
├── AcademicYear
│   │
│   ├── Class
│   │   └── Section
│   │       └── Enrollment
│   │           └── Student
│   │
│   ├── Subject
│   │
│   └── TeacherAssignment
│
├── Examination
│   ├── ExamCandidate
│   ├── ExamSubject
│   │   ├── Subject
│   │   ├── Teacher
│   │   ├── ExamSession
│   │   └── Mark
│   │
│   ├── ExamRoom
│   ├── RoomAssignment
│   └── Result
│
├── Assignment
│   └── Submission
│
├── AttendanceSession
│   └── AttendanceRecord
│
├── DocumentTemplate
│   └── TemplateVersion
│
├── Invoice
│   ├── InvoiceItem
│   └── PaymentAllocation
│
├── Payment
│
├── Employee
│   └── EmployeeAttendance
│
├── Task
├── Notification
├── AuditLog
└── FeatureSettings
```

---

# 51. Important State-Machine Principle

Several modules should use explicit state machines.

### Examination

```text
DRAFT
 ↓
SCHEDULED
 ↓
MARKS_COLLECTION
 ↓
UNDER_REVIEW
 ↓
READY_TO_PUBLISH
 ↓
PUBLISHED
 ↓
REOPENED
 ↓
PUBLISHED
```

### Assignment

```text
DRAFT
 ↓
PUBLISHED
 ↓
CLOSED
```

### Submission

```text
NOT_SUBMITTED
 ↓
SUBMITTED
 ↓
MARKED
 ↓
REOPENED
```

### Invoice

```text
DRAFT
 ↓
ISSUED
 ↓
PARTIALLY_PAID
 ↓
PAID
```

### Payment

```text
PENDING
 ↓
COMPLETED
```

with separate:

```text
FAILED
CANCELLED
REFUNDED
```

This prevents random boolean fields such as:

```text
is_done
is_complete
is_final
is_published
is_locked
```

from eventually becoming a philosophical debate between six mutually contradictory booleans.

---

# 52. Performance Requirements

For the features you've described, performance should be designed around **bulk operations**.

Avoid:

```text
GET student
GET mark
GET subject
GET teacher
GET class
...
```

for hundreds of students.

Prefer:

```text
GET exam/{id}/marks-summary
GET exam/{id}/marks
GET exam/{id}/candidates
```

with server-side filtering and pagination.

For dashboards:

```text
one aggregated query
```

is preferable to dozens of independent requests.

For marksheet generation:

```text
bulk result data
+
template
```

then client-side rendering.

---

# 53. Authorization Architecture

I would make authorization follow this exact conceptual chain:

```text
User
 ↓
Membership
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

For example:

```text
Teacher 01
 ↓
Teacher Role
 ↓
marks.write
 ↓
Exam feature enabled
 ↓
Class 5B
 ↓
English subject
 ↓
Exam 2026-09
 ↓
Student 23
 ↓
WRITE MARK
```

This is much safer than:

```text
if user.role === "teacher"
```

because that approach works beautifully until someone discovers that teachers should not edit the Principal's salary records. Then everyone has a bad Tuesday.

---

# 54. Recommended Permission Groups

You can organize the growing permission matrix into groups:

```text
Academic
 ├── Classes
 ├── Subjects
 ├── Enrollments
 └── Academic Years

Examination
 ├── Exams
 ├── Candidates
 ├── Sessions
 ├── Rooms
 ├── Guards
 ├── Marks
 ├── Results
 └── Marksheets

Assignments
 ├── Assignments
 └── Submissions

Attendance
 ├── Student
 └── Employee

People
 ├── Students
 ├── Guardians
 ├── Teachers
 └── Employees

Documents
 ├── Templates
 └── Generated Documents

Finance
 ├── Fees
 ├── Invoices
 ├── Payments
 ├── Refunds
 └── Reports

Communication
 ├── Notices
 ├── Notifications
 └── Tasks

Administration
 ├── Roles
 ├── Permissions
 ├── Features
 ├── Institution Settings
 └── Audit Logs
```

---

# 55. Final Product Direction

The resulting Biddyapith architecture should effectively have these major layers:

```text
                    BIDDYAPITH
                         │
              ┌──────────┴──────────┐
              │                     │
         INSTITUTION            IDENTITY
              │                     │
     ┌────────┼─────────┐           │
     │        │         │           │
 Academic  People    Settings      Roles
     │        │         │           │
     │        │      Features    Permissions
     │        │
     ├────────┼───────────────────────────┐
     │        │                           │
 Examination Assignments              Attendance
     │        │                           │
     │        │                           │
 Results   Submissions                Records
     │
 Documents
     │
 Templates
     │
 Finance
     │
 Invoices → Payments → Receipts → Reports
```

The key design rule I would lock down **before adding more UI** is this:

> **Biddyapith should be built around relationships, scopes, permissions, states, and auditability. The UI comes afterward.**

That is especially important for Examinations and Finance. Those two modules are not merely CRUD. They are workflows with ownership, authorization, state transitions, historical integrity, bulk operations, and irreversible consequences.

If you build those foundations correctly, adding things later such as **report cards, certificates, transcripts, promotion, student ranking, payroll, fee collection, SMS notifications, result rechecking, practical exams, multiple campuses, or even online examinations** becomes an extension of the model rather than another surgery on the backend.
