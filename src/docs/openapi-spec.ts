export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Sohopathi Education Platform API',
    version: '1.0.0',
    description: `
### Sohopathi Multi-Tenant School Management Platform API

Private, permission-driven backend API supporting dynamic modules, role-based access control (RBAC), multi-tenancy with PostgreSQL RLS, file storage, and real-time school operations.

---

### Authentication & Authorization Guide
1. **Bearer Token Authentication**:
   - Provide header: \`Authorization: Bearer <token>\`
   - In production: Valid Supabase Auth JWT token
   - In development/testing: Mock persona tokens are accepted:
     - \`mock-token-admin-1\`: Principal / Super Admin
     - \`mock-token-teacher-1\`: Teacher persona
     - \`mock-token-student-1\`: Student persona
     - \`mock-token-guardian-1\`: Guardian persona
     - \`mock-token-<uuid>\`: Direct user profile UUID
2. **Tenant Context Resolution**:
   - For all tenant-scoped endpoints, supply header: \`x-institution-id: <institution-uuid>\`
   - Validates that the authenticated user holds an active membership with the requested institution.
    `,
    contact: {
      name: 'Sohopathi Core Team',
    },
  },
  servers: [
    { url: '/', description: 'Current Host' },
    { url: 'http://localhost:3000', description: 'Local Development Server' },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication, session management, and self-profile operations' },
    { name: 'Onboarding', description: 'Institution onboarding and automated tenant provisioning' },
    { name: 'System', description: 'Current user context, navigation items, and dynamic dashboard widgets' },
    { name: 'Core - Institutions & Settings', description: 'Institution configuration, branding, and feature settings' },
    { name: 'Core - Roles & Permissions', description: 'Role-based access control, permission catalog, and matrix' },
    { name: 'Core - Members & Staff', description: 'Staff directory, invitation flow, and employee management' },
    { name: 'Core - Academic Structure', description: 'Academic years, classes, sections, subjects, and teacher assignments' },
    { name: 'Core - Timetables & Schedules', description: 'Class timetables, period slots, and routine management' },
    { name: 'Core - Custom Fields', description: 'Dynamic custom schema fields for students and members' },
    { name: 'Core - Audit Logs', description: 'Administrative activity trails and compliance changelogs' },
    { name: 'Core - Students & Enrollments', description: 'Student directory, roster enrollments, and academic history' },
    { name: 'Core - Notifications', description: 'In-app notification feed and read tracking' },
    { name: 'Core - Staff Tasks', description: 'Task delegation and workflow management for faculty & staff' },
    { name: 'Core - Academic Import', description: '1-Click bulk academic structure and roster migration wizard' },
    { name: 'Attendance & Marks', description: 'Daily attendance tracking, examinations, paper schedules, and marks' },
    { name: 'Notices', description: 'Institutional notice board and audience-targeted announcements' },
    { name: 'Assignments', description: 'Homework, coursework, file attachments, student submissions, and grading' },
    { name: 'Admissions', description: 'Inquiries, admission applications lifecycle, and 1-click student enrollment' },
    { name: 'Storage & Health', description: 'File uploads, storage management, and service health checks' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Bearer token. E.g. Supabase JWT or mock persona token (e.g. `mock-token-admin-1`).',
      },
      InstitutionId: {
        type: 'apiKey',
        in: 'header',
        name: 'x-institution-id',
        description: 'UUID of the active institution tenant context.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Resource not found' },
          code: { type: 'string', example: 'NOT_FOUND' },
        },
        required: ['error'],
      },
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation failed' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          details: { type: 'array', items: { type: 'object' } },
        },
      },
      Institution: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Dhaka Model International Academy' },
          subdomain: { type: 'string', example: 'dhakamodel' },
          branding: { type: 'object' },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          createdAt: { type: 'string', format: 'date-time' },
          memberCount: { type: 'integer' },
          studentCount: { type: 'integer' },
        },
      },
      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Principal Ahmed' },
          email: { type: 'string', format: 'email', example: 'admin@dhakamodel.edu.bd' },
          phone: { type: 'string', example: '+8801712345678' },
          avatarUrl: { type: 'string', nullable: true },
          mustChangePassword: { type: 'boolean' },
        },
      },
      ActiveMembership: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          institutionId: { type: 'string', format: 'uuid' },
          institutionName: { type: 'string' },
          institutionSubdomain: { type: 'string' },
          username: { type: 'string' },
          roleId: { type: 'string', format: 'uuid' },
          roleName: { type: 'string' },
        },
      },
      Role: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          institutionId: { type: 'string', format: 'uuid', nullable: true },
          name: { type: 'string', example: 'Teacher' },
          isSystem: { type: 'boolean' },
          userCount: { type: 'integer' },
        },
      },
      Permission: {
        type: 'object',
        properties: {
          key: { type: 'string', example: 'attendance.create' },
          description: { type: 'string', example: 'Take attendance for assigned sections' },
          scopeOptions: { type: 'array', items: { type: 'string' } },
        },
      },
      AcademicYear: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          institutionId: { type: 'string', format: 'uuid' },
          label: { type: 'string', example: '2026-2027' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          isCurrent: { type: 'boolean' },
        },
      },
      Class: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          academicYearId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Class 9' },
          sortOrder: { type: 'integer' },
          sectionCount: { type: 'integer' },
          studentCount: { type: 'integer' },
        },
      },
      Section: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          classId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Section A (Padma)' },
          capacity: { type: 'integer', example: 40 },
          studentCount: { type: 'integer' },
        },
      },
      Subject: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Physics' },
          code: { type: 'string', example: 'PHY101' },
        },
      },
      Student: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          admissionNo: { type: 'string', example: 'STU-2026-001' },
          name: { type: 'string', example: 'Tanvir Hossain' },
          dateOfBirth: { type: 'string', format: 'date', nullable: true },
          gender: { type: 'string', enum: ['male', 'female', 'other'], nullable: true },
          rollNo: { type: 'string', nullable: true },
          className: { type: 'string', nullable: true },
          sectionName: { type: 'string', nullable: true },
          customFields: { type: 'object', additionalProperties: true },
          guardianName: { type: 'string', nullable: true },
          guardianPhone: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'inactive', 'graduated', 'suspended'] },
        },
      },
      Schedule: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sectionId: { type: 'string', format: 'uuid' },
          subjectId: { type: 'string', format: 'uuid' },
          teacherMembershipId: { type: 'string', format: 'uuid', nullable: true },
          dayOfWeek: { type: 'string', example: 'Sunday' },
          startTime: { type: 'string', example: '09:00' },
          endTime: { type: 'string', example: '09:45' },
          roomNo: { type: 'string', example: 'Room 302' },
          subjectName: { type: 'string' },
          teacherName: { type: 'string' },
        },
      },
      CustomField: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          entityType: { type: 'string', enum: ['student', 'member', 'class', 'section'] },
          label: { type: 'string', example: 'Blood Group' },
          fieldKey: { type: 'string', example: 'blood_group' },
          fieldType: { type: 'string', enum: ['text', 'number', 'select', 'date', 'boolean', 'tag'] },
          options: { type: 'array', items: { type: 'string' }, nullable: true },
          isRequired: { type: 'boolean' },
          sortOrder: { type: 'integer' },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          institutionId: { type: 'string', format: 'uuid' },
          actorMembershipId: { type: 'string', format: 'uuid', nullable: true },
          actorName: { type: 'string', nullable: true },
          action: { type: 'string', example: 'create_student' },
          entityType: { type: 'string', example: 'student' },
          entityId: { type: 'string' },
          before: { type: 'object', nullable: true },
          after: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Submit Term 1 Marks Sheet' },
          description: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          dueDate: { type: 'string', format: 'date', nullable: true },
          assigneeName: { type: 'string' },
          creatorName: { type: 'string' },
        },
      },
      Notice: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Annual Sports Day 2026 Announcement' },
          body: { type: 'string', example: 'The annual sports competition will be held next Friday...' },
          audienceScope: { type: 'string', example: 'institution' },
          publishedAt: { type: 'string', format: 'date-time' },
          authorName: { type: 'string' },
          isRead: { type: 'boolean' },
        },
      },
      Assignment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Chapter 4 Physics Numerical Problems' },
          description: { type: 'string', nullable: true },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          sectionId: { type: 'string', format: 'uuid' },
          subjectId: { type: 'string', format: 'uuid' },
          subjectName: { type: 'string' },
          sectionName: { type: 'string' },
          totalSubmissions: { type: 'integer' },
          gradedSubmissions: { type: 'integer' },
          attachments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                fileName: { type: 'string' },
                fileKey: { type: 'string' },
                downloadUrl: { type: 'string' },
              },
            },
          },
        },
      },
      Exam: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Midterm Examination 2026' },
          term: { type: 'string', example: 'Term 1' },
          startDate: { type: 'string', format: 'date', nullable: true },
          endDate: { type: 'string', format: 'date', nullable: true },
          academicYearId: { type: 'string', format: 'uuid' },
        },
      },
      ExamPaper: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          examId: { type: 'string', format: 'uuid' },
          subjectId: { type: 'string', format: 'uuid' },
          subjectName: { type: 'string' },
          examDate: { type: 'string', format: 'date', nullable: true },
          startTime: { type: 'string', nullable: true },
          endTime: { type: 'string', nullable: true },
          roomNo: { type: 'string', nullable: true },
          maxMarks: { type: 'number', example: 100 },
          passMarks: { type: 'number', example: 40 },
          theoryWeight: { type: 'number' },
          practicalWeight: { type: 'number' },
          vivaWeight: { type: 'number' },
        },
      },
      AdmissionApplication: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          applicantName: { type: 'string', example: 'Sabbir Ahmed' },
          guardianName: { type: 'string', example: 'Mustafizur Rahman' },
          guardianPhone: { type: 'string', example: '+8801700000000' },
          guardianEmail: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['submitted', 'under_review', 'shortlisted', 'admitted', 'rejected'] },
          feeStatus: { type: 'string', enum: ['unpaid', 'paid', 'waived'] },
          className: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
      InstitutionId: [],
    },
  ],
  paths: {
    // -------------------------------------------------------------
    // Health & System
    // -------------------------------------------------------------
    '/health': {
      get: {
        tags: ['Storage & Health'],
        summary: 'Service Health Check',
        description: 'Public health status verification.',
        security: [],
        responses: {
          200: {
            description: 'Server is running and healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/storage/local-upload': {
      put: {
        tags: ['Storage & Health'],
        summary: 'Local Development Direct File Upload',
        description: 'Uploads raw binary stream directly to local storage directory.',
        parameters: [
          { name: 'key', in: 'query', required: true, schema: { type: 'string' }, description: 'Target storage key' },
        ],
        requestBody: {
          required: true,
          content: {
            '*/*': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        responses: {
          200: {
            description: 'File written successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    key: { type: 'string' },
                    downloadUrl: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { description: 'Missing key parameter' },
        },
      },
    },
    '/storage-uploads/{key}': {
      get: {
        tags: ['Storage & Health'],
        summary: 'Serve Locally Uploaded Static File',
        description: 'Serves stored assets in local development mode.',
        parameters: [
          { name: 'key', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Binary file content' },
          404: { description: 'File not found' },
        },
      },
    },

    // -------------------------------------------------------------
    // Authentication
    // -------------------------------------------------------------
    '/api/auth/institutions': {
      get: {
        tags: ['Auth'],
        summary: 'List Active Institutions for Login',
        description: 'Returns active schools and subdomains for tenant selection.',
        security: [],
        responses: {
          200: {
            description: 'List of active institutions',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Institution' },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/resolve-subdomain/{subdomain}': {
      get: {
        tags: ['Auth'],
        summary: 'Resolve Institution by Subdomain',
        description: 'Returns public institution profile and branding for a tenant subdomain (used by biddyapith.tech hosted portals).',
        security: [],
        parameters: [
          {
            name: 'subdomain',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'dhakamodel' },
            description: 'The school or tenant subdomain slug',
          },
        ],
        responses: {
          200: {
            description: 'Institution details and public branding',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Institution' },
              },
            },
          },
          404: {
            description: 'Institution not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Institution-Scoped Login',
        description: 'Authenticates user via username, email, or student admission number within an institution context.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  institutionCode: { type: 'string', description: 'Institution UUID, subdomain, or code', example: 'dhakamodel' },
                  username: { type: 'string', description: 'Login handle, email, or student admission number', example: 'admin' },
                  password: { type: 'string', example: 'password123' },
                },
                required: ['institutionCode', 'username', 'password'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Authentication successful. Returns token and session context.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', example: 'mock-token-00000000-0000-0000-0000-000000000001' },
                    user: { $ref: '#/components/schemas/UserProfile' },
                    activeMembership: { $ref: '#/components/schemas/ActiveMembership' },
                    memberships: { type: 'array', items: { $ref: '#/components/schemas/ActiveMembership' } },
                    mustChangePassword: { type: 'boolean' },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid credentials or user not found' },
        },
      },
    },
    '/api/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Sign Up New User & Create Membership',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Farhan Kabir' },
                  email: { type: 'string', format: 'email', example: 'farhan@example.com' },
                  phone: { type: 'string', example: '+8801700000000' },
                  roleName: { type: 'string', example: 'Student / Guardian' },
                  username: { type: 'string', example: 'farhan' },
                  institutionId: { type: 'string', format: 'uuid' },
                },
                required: ['name', 'email'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Account created successfully' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Forced / Self Password Update',
        description: 'Updates user password and clears `mustChangePassword` flag.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  newPassword: { type: 'string', minLength: 6, example: 'newSecurePassword123' },
                },
                required: ['newPassword'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Password updated successfully' },
          400: { description: 'Password too short' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/profile': {
      patch: {
        tags: ['Auth'],
        summary: 'Update Current User Profile',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  avatarUrl: { type: 'string' },
                  password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Profile updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    user: { $ref: '#/components/schemas/UserProfile' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/onboard': {
      post: {
        tags: ['Onboarding'],
        summary: 'Provision New Institution (Auth alias)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Dhaka Model International Academy' },
                  subdomain: { type: 'string', example: 'dhakamodel' },
                  adminEmail: { type: 'string', format: 'email', example: 'admin@dhakamodel.edu.bd' },
                  adminName: { type: 'string', example: 'Principal Ahmed' },
                  adminUsername: { type: 'string', example: 'admin' },
                  branding: { type: 'object' },
                },
                required: ['name', 'subdomain', 'adminEmail'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Institution provisioned with modules, cloned roles, and admin account' },
        },
      },
    },

    // -------------------------------------------------------------
    // Onboarding
    // -------------------------------------------------------------
    '/api/onboarding/institutions': {
      get: {
        tags: ['Onboarding'],
        summary: 'List All Provisioned Institutions (Platform Admin)',
        security: [],
        responses: {
          200: {
            description: 'List of institutions with stats',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Institution' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Onboarding'],
        summary: 'Provision New School & Onboard Tenant',
        description: 'Creates institution, activates all modules, clones role templates, creates admin user and initial membership.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Uttara High School & College' },
                  subdomain: { type: 'string', example: 'uttara' },
                  adminEmail: { type: 'string', format: 'email', example: 'principal@uttara.edu.bd' },
                  adminName: { type: 'string', example: 'Dr. Rafiqul Islam' },
                  adminUsername: { type: 'string', example: 'admin' },
                  branding: {
                    type: 'object',
                    properties: {
                      primaryColor: { type: 'string', example: '#2563eb' },
                      logoUrl: { type: 'string' },
                    },
                  },
                },
                required: ['name', 'subdomain', 'adminEmail'],
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Institution provisioned successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    institutionId: { type: 'string', format: 'uuid' },
                    subdomain: { type: 'string' },
                    institutionName: { type: 'string' },
                    username: { type: 'string' },
                    adminEmail: { type: 'string' },
                    adminName: { type: 'string' },
                    ownerMembershipId: { type: 'string', format: 'uuid' },
                    ownerUserId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error' },
        },
      },
    },

    // -------------------------------------------------------------
    // System & Dashboard
    // -------------------------------------------------------------
    '/api/me': {
      get: {
        tags: ['System'],
        summary: 'Get Current User & Tenant Context',
        description: 'Returns profile, current institution metadata, role, and resolved permission keys.',
        responses: {
          200: {
            description: 'Resolved context payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/UserProfile' },
                    institution: { $ref: '#/components/schemas/Institution' },
                    membership: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        institutionId: { type: 'string', format: 'uuid' },
                        roleId: { type: 'string', format: 'uuid' },
                        roleName: { type: 'string' },
                      },
                    },
                    permissions: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'No active membership' },
        },
      },
    },
    '/api/nav': {
      get: {
        tags: ['System'],
        summary: 'Get Authorized Navigation Items',
        description: 'Returns active module navigation items authorized for the user role.',
        responses: {
          200: {
            description: 'List of authorized navigation links',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string', example: 'Students' },
                      path: { type: 'string', example: '/students' },
                      requiredPermission: { type: 'string' },
                      sortOrder: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/dashboard': {
      get: {
        tags: ['System'],
        summary: 'Get Dynamic Dashboard Layout & Active Widgets',
        description: 'Computes authorized dashboard widgets and custom grid positions for the user.',
        responses: {
          200: {
            description: 'Configured dashboard widget array',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    widgets: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: 'attendance_summary' },
                          module: { type: 'string', example: 'attendance' },
                          renderer: { type: 'string', example: 'AttendanceSummary' },
                          dataSource: { type: 'string', example: '/api/attendance/summary' },
                          layout: {
                            type: 'object',
                            properties: {
                              x: { type: 'integer' },
                              y: { type: 'integer' },
                              width: { type: 'integer' },
                              height: { type: 'integer' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // -------------------------------------------------------------
    // Core - Roles & Permissions
    // -------------------------------------------------------------
    '/api/core/permissions': {
      get: {
        tags: ['Core - Roles & Permissions'],
        summary: 'List All Registered Permission Keys',
        description: 'Requires permission: `roles.manage`',
        responses: {
          200: {
            description: 'Permission catalog list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Permission' },
                },
              },
            },
          },
        },
      },
    },
    '/api/core/roles': {
      get: {
        tags: ['Core - Roles & Permissions'],
        summary: 'List Roles for Active Institution',
        description: 'Requires permission: `roles.manage`',
        responses: {
          200: {
            description: 'List of institution roles',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Role' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Core - Roles & Permissions'],
        summary: 'Create Custom Role',
        description: 'Requires permission: `roles.manage`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Exam Controller' },
                  templateRoleId: { type: 'string', format: 'uuid', description: 'Optional template role to clone grants from' },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Role created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Role' },
              },
            },
          },
        },
      },
    },
    '/api/core/roles/{id}/permissions': {
      get: {
        tags: ['Core - Roles & Permissions'],
        summary: 'Get Granted Permissions Matrix for Role',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Assigned permissions map',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      permissionKey: { type: 'string' },
                      scope: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['Core - Roles & Permissions'],
        summary: 'Update Role Permission Matrix Grants',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  permissions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        permissionKey: { type: 'string', example: 'attendance.create' },
                        scope: { type: 'string', example: 'assigned_sections' },
                      },
                      required: ['permissionKey', 'scope'],
                    },
                  },
                },
                required: ['permissions'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Permissions updated successfully' },
        },
      },
    },

    // -------------------------------------------------------------
    // Core - Members & Staff
    // -------------------------------------------------------------
    '/api/core/members': {
      get: {
        tags: ['Core - Members & Staff'],
        summary: 'List Institution Members / Staff Directory',
        description: 'Requires permission: `memberships.manage`',
        responses: {
          200: {
            description: 'Staff directory list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      userId: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      email: { type: 'string' },
                      phone: { type: 'string' },
                      roleId: { type: 'string', format: 'uuid' },
                      roleName: { type: 'string' },
                      loginUsername: { type: 'string' },
                      customFields: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/core/members/invite': {
      post: {
        tags: ['Core - Members & Staff'],
        summary: 'Invite or Provision Staff Member',
        description: 'Requires permission: `memberships.manage`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Dr. Shahinur Rahman' },
                  email: { type: 'string', format: 'email', example: 'shahinur@school.edu.bd' },
                  phone: { type: 'string', example: '+8801811223344' },
                  username: { type: 'string', example: 'shahinur' },
                  roleId: { type: 'string', format: 'uuid' },
                  temporaryPassword: { type: 'string', example: 'changeme' },
                  customFields: { type: 'object' },
                },
                required: ['name', 'email', 'roleId'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Member invited successfully' },
        },
      },
    },
    '/api/core/members/{id}': {
      patch: {
        tags: ['Core - Members & Staff'],
        summary: 'Update Member Role or Details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  roleId: { type: 'string', format: 'uuid' },
                  customFields: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Member updated successfully' },
        },
      },
      delete: {
        tags: ['Core - Members & Staff'],
        summary: 'Remove Member from Institution',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Member deleted' },
        },
      },
    },
    '/api/core/members/bulk-delete': {
      post: {
        tags: ['Core - Members & Staff'],
        summary: 'Bulk Remove Members',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  memberIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                },
                required: ['memberIds'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Deleted member count',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean' }, count: { type: 'integer' } },
                },
              },
            },
          },
        },
      },
    },

    // -------------------------------------------------------------
    // Core - Academic Structure
    // -------------------------------------------------------------
    '/api/core/academic-years': {
      get: {
        tags: ['Core - Academic Structure'],
        summary: 'List Academic Years',
        responses: {
          200: {
            description: 'List of academic years',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/AcademicYear' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Core - Academic Structure'],
        summary: 'Create Academic Year',
        description: 'Requires permission: `academic_years.manage`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  label: { type: 'string', example: '2026-2027' },
                  startDate: { type: 'string', format: 'date', example: '2026-01-01' },
                  endDate: { type: 'string', format: 'date', example: '2026-12-31' },
                  isCurrent: { type: 'boolean', default: false },
                },
                required: ['label', 'startDate', 'endDate'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Academic year created' },
        },
      },
    },
    '/api/core/classes': {
      get: {
        tags: ['Core - Academic Structure'],
        summary: 'List Classes & Grades',
        responses: {
          200: {
            description: 'List of classes with section/student counts',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Class' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Core - Academic Structure'],
        summary: 'Create Class',
        description: 'Requires permission: `classes.manage`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  academicYearId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', example: 'Class 10' },
                  sortOrder: { type: 'integer', example: 10 },
                },
                required: ['academicYearId', 'name'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Class created' },
        },
      },
    },
    '/api/core/sections': {
      get: {
        tags: ['Core - Academic Structure'],
        summary: 'List Class Sections',
        parameters: [{ name: 'classId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'List of sections',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Section' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Core - Academic Structure'],
        summary: 'Create Section',
        description: 'Requires permission: `sections.manage`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  classId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', example: 'Section B (Meghna)' },
                  capacity: { type: 'integer', example: 45 },
                },
                required: ['classId', 'name'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Section created' },
        },
      },
    },
    '/api/core/subjects': {
      get: {
        tags: ['Core - Academic Structure'],
        summary: 'List Subjects / Curriculum Courses',
        responses: {
          200: {
            description: 'List of subjects',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Subject' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Core - Academic Structure'],
        summary: 'Create Subject',
        description: 'Requires permission: `subjects.manage`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Higher Mathematics' },
                  code: { type: 'string', example: 'HMATH-101' },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Subject created' },
        },
      },
    },
    '/api/core/teachers': {
      get: {
        tags: ['Core - Academic Structure'],
        summary: 'List Available Faculty / Teachers',
        description: 'Requires permission: `teachers.assign`',
        responses: {
          200: { description: 'List of teachers' },
        },
      },
    },
    '/api/core/teacher-assignments': {
      get: {
        tags: ['Core - Academic Structure'],
        summary: 'List Section-Subject-Teacher Assignments',
        responses: {
          200: { description: 'List of active assignments' },
        },
      },
      post: {
        tags: ['Core - Academic Structure'],
        summary: 'Assign Teacher to Section & Subject',
        description: 'Requires permission: `teachers.assign`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sectionId: { type: 'string', format: 'uuid' },
                  subjectId: { type: 'string', format: 'uuid' },
                  teacherMembershipId: { type: 'string', format: 'uuid' },
                },
                required: ['sectionId', 'subjectId', 'teacherMembershipId'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Teacher assigned' },
        },
      },
    },

    // -------------------------------------------------------------
    // Core - Timetables & Schedules
    // -------------------------------------------------------------
    '/api/core/schedules': {
      get: {
        tags: ['Core - Timetables & Schedules'],
        summary: 'List Class Routine / Timetables',
        parameters: [
          { name: 'sectionId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
          { name: 'dayOfWeek', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Routine slot list',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Schedule' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Core - Timetables & Schedules'],
        summary: 'Create Timetable Period Slot',
        description: 'Requires permission: `schedules.manage`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sectionId: { type: 'string', format: 'uuid' },
                  subjectId: { type: 'string', format: 'uuid' },
                  teacherMembershipId: { type: 'string', format: 'uuid' },
                  dayOfWeek: { type: 'string', example: 'Sunday' },
                  startTime: { type: 'string', example: '08:30' },
                  endTime: { type: 'string', example: '09:15' },
                  roomNo: { type: 'string', example: 'Room 201' },
                },
                required: ['sectionId', 'subjectId', 'dayOfWeek', 'startTime', 'endTime'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Period slot created' },
        },
      },
    },
    '/api/core/schedules/{id}': {
      patch: {
        tags: ['Core - Timetables & Schedules'],
        summary: 'Update Period Slot',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Period updated' } },
      },
      delete: {
        tags: ['Core - Timetables & Schedules'],
        summary: 'Delete Period Slot',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Period deleted' } },
      },
    },

    // -------------------------------------------------------------
    // Core - Custom Fields
    // -------------------------------------------------------------
    '/api/core/custom-fields': {
      get: {
        tags: ['Core - Custom Fields'],
        summary: 'List Dynamic Custom Fields',
        parameters: [
          { name: 'entityType', in: 'query', required: false, schema: { type: 'string', enum: ['student', 'member', 'class', 'section'] } },
        ],
        responses: {
          200: {
            description: 'Custom fields schema list',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/CustomField' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Core - Custom Fields'],
        summary: 'Create Dynamic Custom Field',
        description: 'Requires permission: `custom_fields.manage`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  entityType: { type: 'string', enum: ['student', 'member', 'class', 'section'] },
                  label: { type: 'string', example: 'Blood Group' },
                  fieldKey: { type: 'string', example: 'blood_group' },
                  fieldType: { type: 'string', enum: ['text', 'number', 'select', 'date', 'boolean', 'tag'] },
                  options: { type: 'array', items: { type: 'string' }, example: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
                  isRequired: { type: 'boolean', default: false },
                  sortOrder: { type: 'integer', default: 0 },
                },
                required: ['entityType', 'label'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Field created' },
        },
      },
    },
    '/api/core/custom-fields/{id}': {
      delete: {
        tags: ['Core - Custom Fields'],
        summary: 'Delete Custom Field',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Custom field deleted' } },
      },
    },

    // -------------------------------------------------------------
    // Core - Audit Logs
    // -------------------------------------------------------------
    '/api/core/audit-logs': {
      get: {
        tags: ['Core - Audit Logs'],
        summary: 'Query Audit Activity Trail & Changelogs',
        description: 'Requires permission: `audit_logs.read`',
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'Audit log entries',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } },
              },
            },
          },
        },
      },
    },

    // -------------------------------------------------------------
    // Core - Students & Enrollments
    // -------------------------------------------------------------
    '/api/core/students': {
      get: {
        tags: ['Core - Students & Enrollments'],
        summary: 'List Students Directory',
        parameters: [
          { name: 'classId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'sectionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'List of students',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Student' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Core - Students & Enrollments'],
        summary: 'Create & Auto-Provision Student Record',
        description: 'Creates student, user profile, and active student membership with default credentials.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  admissionNo: { type: 'string', example: 'ADM-2026-101' },
                  name: { type: 'string', example: 'Abrar Fahim' },
                  dateOfBirth: { type: 'string', format: 'date' },
                  gender: { type: 'string', enum: ['male', 'female', 'other'] },
                  classId: { type: 'string', format: 'uuid' },
                  sectionId: { type: 'string', format: 'uuid' },
                  rollNo: { type: 'string', example: '05' },
                  guardianName: { type: 'string', example: 'M. Fahim' },
                  guardianPhone: { type: 'string', example: '+8801912345678' },
                  guardianRelation: { type: 'string', example: 'Father' },
                  customFields: { type: 'object' },
                },
                required: ['admissionNo', 'name'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Student created and enrolled' },
        },
      },
    },
    '/api/core/students/{id}': {
      patch: {
        tags: ['Core - Students & Enrollments'],
        summary: 'Update Student Profile',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Student record updated' } },
      },
      delete: {
        tags: ['Core - Students & Enrollments'],
        summary: 'Delete Student Record',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Student record deleted' } },
      },
    },
    '/api/core/students/bulk-delete': {
      post: {
        tags: ['Core - Students & Enrollments'],
        summary: 'Bulk Delete Students',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  studentIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                },
                required: ['studentIds'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Deleted count response' },
        },
      },
    },
    '/api/core/students/{id}/academic-history': {
      get: {
        tags: ['Core - Students & Enrollments'],
        summary: 'Get Student Academic History & Enrollment Records',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Complete chronological academic progression' } },
      },
    },
    '/api/core/students/bulk-import': {
      post: {
        tags: ['Core - Students & Enrollments'],
        summary: 'Bulk Import Students Roster',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  students: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        admissionNo: { type: 'string' },
                        name: { type: 'string' },
                        gender: { type: 'string' },
                        classId: { type: 'string', format: 'uuid' },
                        sectionId: { type: 'string', format: 'uuid' },
                        rollNo: { type: 'string' },
                      },
                      required: ['admissionNo', 'name', 'classId', 'sectionId'],
                    },
                  },
                },
                required: ['students'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Import summary and created count' },
        },
      },
    },
    '/api/core/enrollments': {
      get: {
        tags: ['Core - Students & Enrollments'],
        summary: 'List Enrollments for Section',
        parameters: [{ name: 'sectionId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Enrollment roster list' } },
      },
      post: {
        tags: ['Core - Students & Enrollments'],
        summary: 'Enroll Student in Section',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  studentId: { type: 'string', format: 'uuid' },
                  academicYearId: { type: 'string', format: 'uuid' },
                  classId: { type: 'string', format: 'uuid' },
                  sectionId: { type: 'string', format: 'uuid' },
                  rollNo: { type: 'string' },
                },
                required: ['studentId', 'academicYearId', 'classId', 'sectionId'],
              },
            },
          },
        },
        responses: { 201: { description: 'Student enrolled' } },
      },
    },

    // -------------------------------------------------------------
    // Core - Notifications
    // -------------------------------------------------------------
    '/api/core/notifications': {
      get: {
        tags: ['Core - Notifications'],
        summary: 'List Notifications Feed',
        responses: { 200: { description: 'Notifications and unread count' } },
      },
    },
    '/api/core/notifications/{id}/read': {
      patch: {
        tags: ['Core - Notifications'],
        summary: 'Mark Notification Read',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Notification marked read' } },
      },
    },
    '/api/core/notifications/read-all': {
      post: {
        tags: ['Core - Notifications'],
        summary: 'Mark All Notifications as Read',
        responses: { 200: { description: 'All notifications cleared' } },
      },
    },

    // -------------------------------------------------------------
    // Core - Staff Tasks
    // -------------------------------------------------------------
    '/api/core/tasks': {
      get: {
        tags: ['Core - Staff Tasks'],
        summary: 'List Delegated & Assigned Tasks',
        parameters: [{ name: 'filter', in: 'query', schema: { type: 'string', enum: ['all', 'assigned_to_me', 'created_by_me'] } }],
        responses: {
          200: {
            description: 'Task array',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Core - Staff Tasks'],
        summary: 'Create & Assign Staff Task',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  assigneeMembershipId: { type: 'string', format: 'uuid' },
                  title: { type: 'string', example: 'Verify Midterm Grade Submissions' },
                  description: { type: 'string' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                  dueDate: { type: 'string', format: 'date' },
                },
                required: ['assigneeMembershipId', 'title'],
              },
            },
          },
        },
        responses: { 201: { description: 'Task created' } },
      },
    },
    '/api/core/tasks/{id}/status': {
      patch: {
        tags: ['Core - Staff Tasks'],
        summary: 'Update Task Progress / Completion Status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
                },
                required: ['status'],
              },
            },
          },
        },
        responses: { 200: { description: 'Status updated' } },
      },
    },
    '/api/core/tasks/{id}': {
      delete: {
        tags: ['Core - Staff Tasks'],
        summary: 'Delete Task',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Task deleted' } },
      },
    },

    // -------------------------------------------------------------
    // Core - Settings & Academic Import
    // -------------------------------------------------------------
    '/api/core/institution/settings': {
      get: {
        tags: ['Core - Institutions & Settings'],
        summary: 'Get Institution Profile & Configuration Settings',
        responses: { 200: { description: 'Institution settings object' } },
      },
      patch: {
        tags: ['Core - Institutions & Settings'],
        summary: 'Update Institution Settings',
        description: 'Requires permission: `settings.manage`',
        responses: { 200: { description: 'Settings updated' } },
      },
    },
    '/api/core/academic/unified-import': {
      post: {
        tags: ['Core - Academic Import'],
        summary: '1-Click Unified Academic Migration & Roster Setup',
        description: 'Parses tabular batch data and provisions classes, sections, subjects, students, and enrollments in a single transaction.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  records: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        className: { type: 'string' },
                        sectionName: { type: 'string' },
                        studentName: { type: 'string' },
                        admissionNo: { type: 'string' },
                        rollNo: { type: 'string' },
                      },
                    },
                  },
                },
                required: ['records'],
              },
            },
          },
        },
        responses: { 201: { description: 'Unified import summary' } },
      },
    },

    // -------------------------------------------------------------
    // Attendance & Marks Module
    // -------------------------------------------------------------
    '/api/attendance': {
      get: {
        tags: ['Attendance & Marks'],
        summary: 'List Daily Attendance Records',
        parameters: [
          { name: 'sectionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'studentId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Attendance list' } },
      },
      post: {
        tags: ['Attendance & Marks'],
        summary: 'Take Daily Attendance for Section',
        description: 'Requires permission: `attendance.create` with assigned_sections or institution scope.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  records: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        studentId: { type: 'string', format: 'uuid' },
                        sectionId: { type: 'string', format: 'uuid' },
                        date: { type: 'string', format: 'date', example: '2026-08-31' },
                        status: { type: 'string', enum: ['present', 'absent', 'late', 'excused'] },
                      },
                      required: ['studentId', 'sectionId', 'date', 'status'],
                    },
                  },
                },
                required: ['records'],
              },
            },
          },
        },
        responses: { 201: { description: 'Attendance saved' } },
      },
    },
    '/api/attendance/summary': {
      get: {
        tags: ['Attendance & Marks'],
        summary: 'Get Real-Time Attendance Summary & Percentages',
        parameters: [
          { name: 'sectionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Summary statistics with present/absent/late counts' } },
      },
    },
    '/api/attendance/sheet': {
      get: {
        tags: ['Attendance & Marks'],
        summary: 'Get Section Attendance Grid Sheet',
        parameters: [
          { name: 'sectionId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Complete section roster with current day attendance marks' } },
      },
    },
    '/api/attendance/exams': {
      get: {
        tags: ['Attendance & Marks'],
        summary: 'List Examination Sessions',
        responses: {
          200: {
            description: 'List of exams',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Exam' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Attendance & Marks'],
        summary: 'Create Examination Session',
        description: 'Requires permission: `exams.manage`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  academicYearId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', example: 'Final Term Examination 2026' },
                  term: { type: 'string', example: 'Term 2' },
                  startDate: { type: 'string', format: 'date' },
                  endDate: { type: 'string', format: 'date' },
                },
                required: ['academicYearId', 'name'],
              },
            },
          },
        },
        responses: { 201: { description: 'Exam created' } },
      },
    },
    '/api/attendance/exams/{id}': {
      patch: {
        tags: ['Attendance & Marks'],
        summary: 'Update Exam Session',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Exam updated' } },
      },
      delete: {
        tags: ['Attendance & Marks'],
        summary: 'Delete Exam Session',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Exam deleted' } },
      },
    },
    '/api/attendance/exams/{id}/papers': {
      get: {
        tags: ['Attendance & Marks'],
        summary: 'List Exam Papers Schedule & Weights',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'List of exam papers',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ExamPaper' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Attendance & Marks'],
        summary: 'Create Exam Paper Schedule & Marks Weighting',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  subjectId: { type: 'string', format: 'uuid' },
                  examDate: { type: 'string', format: 'date' },
                  startTime: { type: 'string', example: '10:00' },
                  endTime: { type: 'string', example: '13:00' },
                  roomNo: { type: 'string', example: 'Exam Hall 1' },
                  maxMarks: { type: 'number', example: 100 },
                  passMarks: { type: 'number', example: 33 },
                  theoryWeight: { type: 'number', example: 70 },
                  practicalWeight: { type: 'number', example: 25 },
                  vivaWeight: { type: 'number', example: 5 },
                },
                required: ['subjectId'],
              },
            },
          },
        },
        responses: { 201: { description: 'Exam paper schedule created' } },
      },
    },
    '/api/attendance/exams/{id}/papers/{paperId}': {
      delete: {
        tags: ['Attendance & Marks'],
        summary: 'Delete Exam Paper',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'paperId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Paper deleted' } },
      },
    },
    '/api/attendance/marks': {
      get: {
        tags: ['Attendance & Marks'],
        summary: 'List Recorded Exam Marks',
        parameters: [
          { name: 'examId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'studentId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'subjectId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Marks list' } },
      },
      post: {
        tags: ['Attendance & Marks'],
        summary: 'Record & Grade Student Exam Marks',
        description: 'Requires permission: `marks.create`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  marks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        examId: { type: 'string', format: 'uuid' },
                        studentId: { type: 'string', format: 'uuid' },
                        subjectId: { type: 'string', format: 'uuid' },
                        marksObtained: { type: 'number', example: 88 },
                        maxMarks: { type: 'number', example: 100 },
                        grade: { type: 'string', example: 'A+' },
                      },
                      required: ['examId', 'studentId', 'subjectId', 'maxMarks'],
                    },
                  },
                },
                required: ['marks'],
              },
            },
          },
        },
        responses: { 201: { description: 'Marks recorded' } },
      },
    },

    // -------------------------------------------------------------
    // Notices Module
    // -------------------------------------------------------------
    '/api/notices': {
      get: {
        tags: ['Notices'],
        summary: 'List Institutional Notices',
        description: 'Requires permission: `notices.read`',
        responses: {
          200: {
            description: 'Notice list with read state',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Notice' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Notices'],
        summary: 'Publish Notice Announcement',
        description: 'Requires permission: `notices.write`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: 'School Closed on Independence Day' },
                  body: { type: 'string', example: 'All academic activities will remain suspended on...' },
                  audienceScope: { type: 'string', example: 'institution' },
                },
                required: ['title', 'body'],
              },
            },
          },
        },
        responses: { 201: { description: 'Notice published' } },
      },
    },
    '/api/notices/{id}/read': {
      post: {
        tags: ['Notices'],
        summary: 'Mark Notice as Read by Current User',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 204: { description: 'Marked read' } },
      },
    },

    // -------------------------------------------------------------
    // Assignments Module
    // -------------------------------------------------------------
    '/api/assignments': {
      get: {
        tags: ['Assignments'],
        summary: 'List Class Assignments',
        parameters: [
          { name: 'sectionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Assignment array',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Assignment' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Assignments'],
        summary: 'Create Course Assignment',
        description: 'Requires permission: `assignments.create`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sectionId: { type: 'string', format: 'uuid' },
                  subjectId: { type: 'string', format: 'uuid' },
                  title: { type: 'string', example: 'English Essay: Digital Bangladesh' },
                  description: { type: 'string', example: 'Write a 500-word essay on...' },
                  dueDate: { type: 'string', format: 'date-time' },
                },
                required: ['sectionId', 'subjectId', 'title'],
              },
            },
          },
        },
        responses: { 201: { description: 'Assignment created' } },
      },
    },
    '/api/assignments/{id}': {
      patch: {
        tags: ['Assignments'],
        summary: 'Edit Assignment',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Assignment updated' } },
      },
      delete: {
        tags: ['Assignments'],
        summary: 'Delete Assignment',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 204: { description: 'Assignment deleted' } },
      },
    },
    '/api/assignments/stats': {
      get: {
        tags: ['Assignments'],
        summary: 'Get Assignment Submission & Grading Statistics',
        description: 'Requires permission: `assignments.grade`',
        responses: { 200: { description: 'Statistics summary' } },
      },
    },
    '/api/assignments/{id}/attachments/presigned-url': {
      post: {
        tags: ['Assignments'],
        summary: 'Request S3 / Cloudflare R2 Presigned Upload URL',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fileName: { type: 'string', example: 'lecture-notes.pdf' },
                  contentType: { type: 'string', example: 'application/pdf' },
                },
                required: ['fileName'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Presigned upload URL',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    uploadUrl: { type: 'string' },
                    fileKey: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/assignments/{id}/attachments': {
      post: {
        tags: ['Assignments'],
        summary: 'Attach Uploaded File to Assignment',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fileName: { type: 'string', example: 'worksheet.pdf' },
                  fileKey: { type: 'string' },
                },
                required: ['fileName', 'fileKey'],
              },
            },
          },
        },
        responses: { 201: { description: 'Attachment linked' } },
      },
    },
    '/api/assignments/{id}/submit': {
      post: {
        tags: ['Assignments'],
        summary: 'Submit Assignment Solution (Student)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fileKey: { type: 'string' },
                  studentId: { type: 'string', format: 'uuid', description: 'Optional if authenticated as student' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Assignment submitted' } },
      },
    },
    '/api/assignments/grade': {
      post: {
        tags: ['Assignments'],
        summary: 'Grade Student Submission',
        description: 'Requires permission: `assignments.grade`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  submissionId: { type: 'string', format: 'uuid' },
                  grade: { type: 'string', example: 'A+' },
                  feedback: { type: 'string', example: 'Excellent analysis and clear methodology.' },
                },
                required: ['submissionId', 'grade'],
              },
            },
          },
        },
        responses: { 200: { description: 'Submission graded' } },
      },
    },

    // -------------------------------------------------------------
    // Admissions Module
    // -------------------------------------------------------------
    '/api/admissions': {
      get: {
        tags: ['Admissions'],
        summary: 'List Admission Applications & Inquiries',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['submitted', 'under_review', 'shortlisted', 'admitted', 'rejected'] } },
          { name: 'classId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'Applications array and count',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/AdmissionApplication' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Admissions'],
        summary: 'Submit Admission Inquiry / Application',
        description: 'Requires permission: `admissions.write`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  applicantName: { type: 'string', example: 'Riad Hossain' },
                  guardianName: { type: 'string', example: 'Delwar Hossain' },
                  guardianPhone: { type: 'string', example: '+8801723456789' },
                  guardianEmail: { type: 'string', format: 'email' },
                  classId: { type: 'string', format: 'uuid' },
                  academicYearId: { type: 'string', format: 'uuid' },
                  dateOfBirth: { type: 'string', format: 'date' },
                  gender: { type: 'string', enum: ['male', 'female', 'other'] },
                  previousSchool: { type: 'string', example: 'St. Joseph Higher Secondary School' },
                  applicationFee: { type: 'number', example: 500 },
                  feeStatus: { type: 'string', enum: ['unpaid', 'paid', 'waived'] },
                  notes: { type: 'string' },
                },
                required: ['applicantName', 'guardianName', 'guardianPhone'],
              },
            },
          },
        },
        responses: { 201: { description: 'Application registered' } },
      },
    },
    '/api/admissions/stats': {
      get: {
        tags: ['Admissions'],
        summary: 'Get Admission Pipeline Metrics',
        responses: { 200: { description: 'Count grouped by status and conversion rates' } },
      },
    },
    '/api/admissions/{id}': {
      get: {
        tags: ['Admissions'],
        summary: 'Get Admission Application Detail',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Application details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdmissionApplication' },
              },
            },
          },
          404: { description: 'Application not found' },
        },
      },
      patch: {
        tags: ['Admissions'],
        summary: 'Update Application Status / Fee Status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['submitted', 'under_review', 'shortlisted', 'admitted', 'rejected'] },
                  feeStatus: { type: 'string', enum: ['unpaid', 'paid', 'waived'] },
                  notes: { type: 'string' },
                  classId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Application updated' } },
      },
      delete: {
        tags: ['Admissions'],
        summary: 'Delete Application',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Application deleted' } },
      },
    },
    '/api/admissions/{id}/admit': {
      post: {
        tags: ['Admissions'],
        summary: '1-Click Admit & Auto-Enroll Student',
        description: 'Promotes application to `admitted`, provisions official student record, user account, and section enrollment.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sectionId: { type: 'string', format: 'uuid' },
                  admissionNo: { type: 'string', description: 'Optional custom admission number; auto-generated if omitted' },
                  rollNo: { type: 'string', example: '12' },
                  academicYearId: { type: 'string', format: 'uuid' },
                },
                required: ['sectionId'],
              },
            },
          },
        },
        responses: { 201: { description: 'Student admitted and enrolled successfully' } },
      },
    },
  },
};

