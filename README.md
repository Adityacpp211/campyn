# CAMPÈS (Campès ERP)

<div align="center">

```
  ██████╗ █████╗ ███╗   ███╗██████╗ ███████╗███████╗
 ██╔════╝██╔══██╗████╗ ████║██╔══██╗██╔════╝██╔════╝
 ██║     ███████║██╔████╔██║██████╔╝█████╗  ███████╗
 ██║     ██╔══██║██║╚██╔╝██║██╔═══╝ ██╔══╝  ╚════██║
 ╚██████╗██║  ║██║██║ ╚═╝ ██║██║     ███████╗███████║
  ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝╚══════╝
```

### *Système d'Information Universitaire & Gestion Académique*
**An elite, monolithic enterprise operating system for higher education institutions.**  
*Engineered from first principles with cryptographic audit trails, strict tenant isolation, immutable evaluation ledgers, and zero mock data.*

---

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x%20%7C%20PGlite-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Express.js](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React 19](https://img.shields.io/badge/React-19.x-20232a?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-87%20Passed-22c55e?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Security Audited](https://img.shields.io/badge/Security-RBAC%20%2B%20ABAC%20%2B%20SHA--256-blueviolet?style=for-the-badge)](#-security--cryptographic-integrity)

</div>

---

## ⚜️ Aperçu (Overview)

**CAMPÈS** (*pronounced kahm-PAYS*, derived from Occitan & French academic roots for *campus ground*) is a production-grade Higher Education ERP. 

Unlike traditional fragmented academic tools that rely on fragile client-side state, simulated datasets, and loose role conventions, **CAMPÈS** enforces **PostgreSQL as the single and infallible source of truth**. Every mutation traverses a deterministic pipeline:

```mermaid
graph LR
    UI[Frontend Client] -->|Bearer JWT + Tenant Context| API[Express API Gateway]
    API --> RateLimiter[Rate Limiter & Helmet]
    RateLimiter --> RBAC[RBAC / ABAC Security Gate]
    RBAC --> TenantIso[Tenant Isolation Layer]
    TenantIso --> Service[Domain Service Engine]
    Service --> Tx[ACID Transaction Scope]
    Tx --> Repo[PostgreSQL Repository]
    Tx --> Audit[SHA-256 Tamper-Evident Ledger]
    Repo --> DB[(PostgreSQL Engine)]
    Audit --> DB
```

---

## ⚡ Architecture Highlights & Pillars

### 1. 🗄️ Relational Core (Zero Mock Data)
The entire application lifecycle is backed by **18 normalized PostgreSQL tables**. There are zero in-memory fallback arrays, no mock student generators, and no silent client fallbacks:
* **Academic Hierarchy**: Institutions $\rightarrow$ Campuses $\rightarrow$ Departments $\rightarrow$ Programs $\rightarrow$ Academic Years $\rightarrow$ Semesters $\rightarrow$ Sections $\rightarrow$ Courses.
* **Identity Dossiers**: Comprehensive records including biodata, guardian particulars, attendance aggregates, GPA/CGPA history, fee dues, and activity timelines.
* **Faculty Rosters**: Departmental bindings, workload metrics, and course assignment matrices.

### 2. 🛡️ Fortress-Grade Security & Isolation
* **Multi-Tenant Isolation**: Requests are scoped to institutional boundaries. Any attempt at cross-institutional query poisoning or header spoofing is rejected with a `TENANT_ISOLATION_VIOLATION` (403).
* **RBAC & ABAC Access Control**: 14 hierarchical roles (`SUPER_ADMIN`, `COLLEGE_ADMIN`, `PRINCIPAL`, `HOD`, `FACULTY`, `STUDENT`, `ACCOUNTANT`, `EXAM_CELL`, `AUDITOR`, etc.) backed by fine-grained permissions.
* **IDOR Prevention**: Student dossiers and faculty records enforce ownership validation (`assertStudentSelfAccess`), preventing horizontal privilege escalation.
* **Production Fail-Fast**: The engine refuses to boot in production unless high-entropy `JWT_SECRET`, `AUDIT_SALT`, and `DATABASE_URL` are provided.

### 3. ⛓️ Cryptographic Tamper-Evident Audit Ledger
Every high-impact state change (grade modification, section transfer, fee reversal, attendance lock) is chained into a cryptographic ledger.
* Each entry computes:
  $$\text{Hash}_i = \text{SHA-256}\left(\text{Hash}_{i-1} \parallel \text{ActorID} \parallel \text{Action} \parallel \text{Entity} \parallel \text{EntityID} \parallel \text{OldJSON} \parallel \text{NewJSON} \parallel \text{Reason} \parallel \text{Timestamp} \parallel \text{Salt}\right)$$
* The cryptographic chain can be audited at runtime via `GET /api/v1/audit/verify-chain`, detecting any out-of-band direct database tampering immediately.

### 4. ⏱️ Operations Engine
* **Conflict-Free Timetable Scheduler**: Real-time server-side conflict detection preventing double-booking of physical rooms or instructional faculty.
* **Attendance State Machine**: Session creation $\rightarrow$ roster marking $\rightarrow$ cryptographic lock $\rightarrow$ formal correction ticket $\rightarrow$ administrative approval.
* **Governance Approval Matrix**: Formal two-tier workflow for regularization tickets, grade disputes, and institutional financial adjustments.

---

## 🎨 Visual Design Philosophy: Quiet Luxury

CAMPÈS embodies a **high-density, monochromatic command interface** inspired by precision industrial instrumentation:

* **Monochromatic Hierarchy**: A spectrum of pure carbon blacks (`#000000`, `#0A0A0A`, `#111111`) paired with cold technical borders (`#2A2A2A`) and crisp high-contrast typography.
* **Functional Accents**: Color is reserved strictly for semantic feedback:
  * 🟢 **Confirmed / Validated**: `#2E7D32`
  * 🟡 **Pending Decision / Warning**: `#ED6C02`
  * 🔴 **Breached / High Risk / Overdue**: `#D32F2F`
  * 🔵 **Institutional Notice / Info**: `#0288D1`
* **Zero Cognitive Distraction**: Eliminates toy gradients and animations in favor of dense data tables, keyboard shortcuts (`⌘K` Command Palette), and immediate response states.

---

## 📂 Repository Structure

```
CAMPYN_APP/
├── database/
│   ├── migrations/             # Versioned DDL SQL migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_security_constraints.sql
│   │   ├── 003_auth_sessions_and_tokens.sql
│   │   └── 004_academic_core.sql
│   └── schema.sql              # Master consolidated PostgreSQL schema
├── server/                     # Backend Architecture (Express 5 + TypeScript)
│   ├── config.ts               # Environment validation & fail-fast configuration
│   ├── index.ts                # Express application & route mounts (/api/v1 & /api)
│   ├── db/
│   │   ├── index.ts            # PostgreSQL Pool & embedded development engine
│   │   ├── migrate.ts          # Idempotent migration runner
│   │   └── seed.ts             # Deterministic relational seed engine
│   ├── controllers/            # Request handlers & HTTP serialization
│   ├── middleware/             # Security, Auth, RBAC, Tenant Isolation, ErrorHandler
│   ├── repositories/           # Direct parameterized SQL execution
│   ├── routes/                 # Versioned REST endpoints
│   ├── services/               # Business logic, audit logging, & transactions
│   └── validators/             # Zod validation schemas
├── src/                        # Frontend Architecture (React 19 + TypeScript + Vite)
│   ├── components/             # Reusable UI primitives, command palette, layouts
│   ├── features/               # Domain views (Students, Attendance, Timetable, etc.)
│   ├── hooks/                  # API hooks with loading, error, and mutation state
│   ├── services/               # Centralized API client & RBAC authorization
│   └── types/                  # Shared domain interfaces
├── tests/                      # Automated Test Suite (74 integration & unit tests)
│   ├── academic_core.test.ts
│   ├── attendance_lifecycle.test.ts
│   ├── audit.test.ts
│   ├── auth_sessions.test.ts
│   ├── security_idor.test.ts
│   ├── tenant_isolation.test.ts
│   ├── timetable_conflicts.test.ts
│   ├── v3_migration.test.ts    # Proof of zero-mock architecture
│   └── ...
└── docs/                       # Migration architecture documentation
    └── FRONTEND_DATA_MIGRATION.md
```

---

## 🚀 Quickstart & Installation

### Prérequis (Prerequisites)
* **Node.js**: v18.0.0+ (Tested on Node v25.x)
* **npm**: v9.0.0+
* **PostgreSQL** *(optional for local dev)*: Uses embedded zero-dependency PGlite engine locally; external PostgreSQL required in production.

### 1. Clone & Install
```bash
git clone https://github.com/Adityacpp211/CAMPYN-.git
cd CAMPYN_APP
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=3001
NODE_ENV=development

# Production requirements:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/campes_db
# JWT_SECRET=your-cryptographically-secure-jwt-secret-key-min-32-chars
# AUDIT_SALT=your-cryptographically-secure-audit-salt-key-min-32-chars
```

### 3. Initialize Database & Seed
Run database migrations and populate deterministic relational seed data:
```bash
# Apply schema migrations
npm run migrate

# Seed institutions, faculty, students, academic structures, and audit ledger
npm run seed
```

### 4. Run the Platform

#### Option A: Web Application
Open two terminal windows:
```bash
# Terminal 1: Launch Backend Engine (Port 3001)
npm run dev:server

# Terminal 2: Launch Web Frontend (Port 5173)
npm run dev
```

#### Option B: Windows Native Desktop App (.exe)
Run the dedicated desktop window process:
```bash
npm run dev:desktop
```
To generate a standalone Windows installer / portable executable:
```bash
npm run build:desktop
```
*The packaged Windows executable will be generated in `dist-electron/`.*

#### Option C: Android Mobile Application (APK)
CAMPÈS is fully configured with Capacitor for native mobile deployment:
```bash
# 1. Build and synchronize frontend assets into Android native project
npm run build:mobile

# 2. Open project directly in Android Studio
npx cap open android

# 3. Or build the debug APK directly from command line
npm run build:apk
```
*The generated APK will be at `android/app/build/outputs/apk/debug/app-debug.apk` ready to install on any Android phone or tablet.*

---

## 🧪 Automated Testing & Verification

The repository enforces end-to-end integration and security suites verifying database transactions, IDOR prevention, RBAC authorization, and cryptographic hash verification:

```bash
npm test
```

### Verified Test Matrix (13 Suites / 87 Tests Passing)
```
 ✓ tests/auth_sessions.test.ts (7 tests)
 ✓ tests/v3_migration.test.ts (17 tests)
 ✓ tests/phase4_operational.test.ts (13 tests)
 ✓ tests/academic_core.test.ts (11 tests)
 ✓ tests/attendance_lifecycle.test.ts (6 tests)
 ✓ tests/timetable_conflicts.test.ts (7 tests)
 ✓ tests/auth.test.ts (5 tests)
 ✓ tests/security_idor.test.ts (5 tests)
 ✓ tests/tenant_isolation.test.ts (3 tests)
 ✓ tests/faculty_assignment.test.ts (3 tests)
 ✓ tests/transactions.test.ts (3 tests)
 ✓ tests/rbac.test.ts (4 tests)
 ✓ tests/audit.test.ts (3 tests)

 Test Files  13 passed (13)
      Tests  87 passed (87)
```

---

## 🔑 Default Development Credentials

> [!WARNING]
> The credentials below are configured exclusively for **local development and automated test validation**. The production seed runner strictly requires `INITIAL_ADMIN_PASSWORD` to be explicitly provided.

| Role | Username / Email | Password | Primary Clearance |
|---|---|---|---|
| **College Administrator** | `admin.vance@campus.edu` | `Password@123` | Institutional Master Management |
| **Faculty (HOD)** | `s.jenkins@campus.edu` | `Password@123` | Department Courses, Timetable & Attendance |
| **Faculty (Instructor)** | `r.chen.fac@campus.edu` | `Password@123` | Session Attendance & Continuous Assessment |
| **Student** | `m.chen@campus.edu` | `Password@123` | Self Profile, Timetable, Dues & Grades |

---

## 📡 Core API Specification Summary

| Method | Endpoint | Description | Guard |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Issues authenticated cryptographic JWT token | Public (Rate Limited) |
| `GET` | `/api/v1/auth/session` | Resolves active user session, role & permissions | Bearer JWT |
| `GET` | `/api/v1/students` | Server-side paginated & filtered student directory | `students.read` |
| `GET` | `/api/v1/students/:id` | Student detailed dossier (IDOR protected) | `students.read` or Self |
| `PATCH` | `/api/v1/students/:id` | Update profile information with audit record | `students.update` |
| `GET` | `/api/v1/faculty` | Faculty roster with course load & designations | `faculty.read` |
| `GET` | `/api/v1/academics/departments` | Full institutional departments list | Institutional Tenant |
| `GET` | `/api/v1/attendance/sessions` | Lecture attendance sessions with lock status | `attendance.read` |
| `POST` | `/api/v1/attendance/sessions` | Batch marks students present/absent/late | `attendance.record` |
| `GET` | `/api/v1/timetable` | Dynamic schedule with server conflict markers | `timetable.read` |
| `GET` | `/api/v1/approvals` | Pending governance workflow tickets | `approvals.manage` |
| `POST` | `/api/v1/approvals/:id/resolve` | Decides request (approves/rejects with audit) | `approvals.manage` |
| `GET` | `/api/v1/audit/verify-chain` | Cryptographic SHA-256 ledger integrity audit | `audit.read` |
| `GET` | `/api/v1/dashboard/stats` | Aggregated executive KPIs and metrics | Bearer JWT |

---

## ⚖️ License & Intellectual Property

This project is distributed under the **MIT License**. See `LICENSE` for details. Built for educational institutions seeking uncompromising speed, rigorous data engineering, and architectural integrity.
