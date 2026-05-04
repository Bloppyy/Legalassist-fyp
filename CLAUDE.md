# LegalAssist FYP — CLAUDE.md

## Project Overview
AI-assisted legal document management and compliance system for Malaysian civil litigation law firms.
Final Year Project (FYP) at Universiti Teknikal Malaysia Melaka (UTeM), BITS programme.

Two frontends: a full-featured **React web app** and a lighter **Flutter mobile app**.
Shared **Node.js + Express backend API** consumed by both frontends.
Target users: law firm interns, junior associates, chambering students, associates, partners, and the office manager (admin).

**Headline AI features:**
1. **Court Direction Parser** — uploads a court direction document (arahan), NLP extracts next court date, required actions, and parties automatically
2. **Document Compliance Checker** — NLP validates uploaded Word documents against Malaysian civil litigation templates before submission

---

## Tech Stack

| Component          | Technology                                        |
|--------------------|---------------------------------------------------|
| Web frontend       | React.js (`/web`)                                 |
| Mobile frontend    | Flutter (`/mobile`)                               |
| Backend API        | Node.js + Express (`/legal-system-backend`)       |
| Database           | PostgreSQL via Supabase                           |
| Authentication     | Supabase Auth (JWT)                               |
| File storage       | Supabase Storage (private buckets: documents, templates, guidelines, court-directions) |
| AI/NLP service     | Python + FastAPI + spaCy (`/ai-service`)          |
| Push notifications | Firebase Cloud Messaging (Flutter — not yet wired)|
| Version control    | GitHub                                            |
| IDE                | VS Code                                           |

---

## Monorepo Structure
```
root/
├── CLAUDE.md
├── web/                        # React.js frontend
├── mobile/                     # Flutter app
├── legal-system-backend/       # Node.js + Express API
├── ai-service/                 # Python + FastAPI + spaCy
└── README.md
```

---

## User Roles & Permissions

| Role               | Clearance Level | Description                                                                  |
|--------------------|-----------------|------------------------------------------------------------------------------|
| `intern`           | Level 1         | Upload documents, view templates, guidelines, contacts, cases, case timeline |
| `junior_associate` | Level 1         | Same as intern — belongs to one associate via supervisor_id                  |
| `chambering`       | Level 1         | Same as intern — belongs to one associate via supervisor_id                  |
| `associate`        | Level 2         | All Level 1 + create documents, review/escalate/reject, flag filed, add case stages, upload arahan |
| `partner`          | Level 3         | All Level 2 + final approve or reject escalated documents                    |
| `admin`            | Level 4         | Office manager — manage users, templates, contacts, cases, guidelines, flag served |

Level 1 roles (intern, junior_associate, chambering) have identical system permissions.
Each Level 1 user belongs to exactly one associate via `users.supervisor_id`.
An associate can have many Level 1 users under them.

---

## Current Build State

### Backend (`/legal-system-backend`) — Complete
- All 9 route modules: users, cases, documents, templates, template-categories, deadlines, contacts, notifications, court-guidelines
- JWT auth middleware + role-based authorisation (intern/junior_associate/chambering/associate/partner/admin)
- Full 7-status document workflow: draft → pending_associate → pending_partner → approved → filed → served + rejected
- Word .docx file upload via multer → Supabase Storage
- Text extracted from .docx using mammoth on upload for AI processing
- Auto compliance check on document submit (silent, stored in errors_flagged)
- Associate can approve pending_associate documents directly; partner approves pending_partner
- Signed URL generation for all file downloads
- In-app notifications (write to notifications table)
- FCM push notifications stubbed in notificationService.js — not yet wired
- User management with supervisor assignment for Level 1 roles

### Web App (`/web`) — Complete (base)
- All pages functional: Login, Dashboard, Cases (structured storage fields + collapsible history log), Documents (Word upload, full workflow buttons, compliance check, entity extraction, version badge), Templates (file upload + download, category manager), Guidelines (category tabs, PDF iframe embed), Contacts, Deadlines, Notifications, Users (admin with supervisor assignment)
- Auth via Supabase Auth + AuthContext
- Centralised API layer in src/api/
- Role-based UI throughout

### Mobile (`/mobile`) — Complete (base)
- 4 tabs: Deadlines (list + calendar via table_calendar, mark complete/incomplete), Cases, Contacts (tap-to-call via url_launcher), Guidelines (expandable accordion, tappable registry URL, open PDF in browser)
- Templates tab removed as unnecessary on mobile
- Auth via Supabase Auth Flutter SDK + AuthProvider with Provider state management
- All API calls through lib/services/api_service.dart with auto JWT
- Base URL: http://10.0.2.2:5000/api (Android emulator)
- FCM not yet integrated

### AI Service (`/ai-service`) — Complete (base)
- FastAPI + spaCy
- Compliance rules for 5 Malaysian civil litigation document types: Writ of Summons, Statement of Claim, Affidavit, Letter of Demand, Memorandum of Appearance
- Template matcher for auto-detecting document type
- Entity extraction router

---

## What's Left To Build

### High Priority — New Features (FYP innovation)
1. **Court Direction Parser** (AI headline feature)
   - New FastAPI endpoint: POST /parse-direction
   - Input: extracted text from uploaded arahan document
   - Output: next_court_date, required_actions, parties, court_name, confidence score
   - Node.js proxies this through existing aiService.js pattern
   - New backend route: POST /api/case-stages/:caseId/parse-direction
   - On upload, auto-populates a new case stage with parsed fields for user to confirm before saving
   - New Supabase Storage bucket: `court-directions` for arahan file uploads

2. **Case Timeline UI** (Key visual feature)
   - Visual vertical timeline on the Case Detail page
   - Each case stage = one node on the timeline
   - Node design: circle icon coloured by stage_type, connected by vertical line
   - Node states: completed (filled colour), upcoming (outlined), current (pulsing/highlighted)
   - Clicking a node opens a side panel or modal showing full stage details
   - Stage types have distinct colours and icons:
     - court_appearance: blue gavel icon
     - court_direction: orange document icon
     - meeting: green calendar icon
     - filing_deadline: red clock icon
     - year_end_review: purple star icon
     - other: grey info icon
   - Add Stage button for associates to manually add stages
   - Upload Arahan button triggers court direction parser flow
   - Timeline sorted chronologically, most recent at top
   - Completed stages visually muted/greyed
   - Must work alongside existing case history log (history = system audit trail, timeline = case progression)

### Medium Priority
3. **Case stages backend routes** — CRUD for case_stages table, proxy to AI parser
4. **Mobile: case timeline** — scrollable vertical timeline in case detail screen (same node concept, simpler than web)
5. **FCM push notifications** — set up Firebase project, wire firebase_messaging in Flutter, uncomment backend stub

### Low Priority
6. **Compliance score visibility** — deferred, revisit later

---

## Key Design Decisions
- Hard delete throughout (no soft delete)
- RLS off — all auth/role checks at Express middleware
- Documents are Word files uploaded to Supabase Storage, text extracted server-side via mammoth for AI
- FCM push notifications stubbed but not wired — notificationService.js has clear TODOs
- Self-referencing Supabase joins avoided — supervisor name looked up client-side
- Supabase client extracted to web/src/config/supabase.js to break circular import between AuthContext and axios
- Case history = system audit trail (who did what, when) — auto-written by backend
- Case stages/timeline = case progression tracker — manually added by associate or auto-populated by AI parser
- Case summary AI generator dropped — timeline already shows all the same information visually, no duplication needed

---

## Backend — Node.js + Express (`/legal-system-backend`)

### Structure
```
legal-system-backend/
  src/
    config/         # Supabase client initialisation
    routes/         # Express route files per module
    controllers/    # Business logic handlers
    middleware/     # Auth, role check, error handling
    services/       # Supabase calls, FCM stub, AI service proxy
  index.js
  .env
  .gitignore
```

### Conventions
- All Supabase calls go through src/config/supabase.js
- All AI/NLP calls proxied through src/services/aiService.js to Python FastAPI
- Return consistent JSON: { success, data, message, error }
- Use async/await with try/catch throughout
- Auth middleware on all protected routes
- Role middleware per route based on required clearance level
- Never hardcode secrets — .env only, never commit

### Commands
```bash
npm run dev       # nodemon dev server
npm start         # production
```

---

## AI/NLP Service — Python + FastAPI + spaCy (`/ai-service`)

### What's Built
- Compliance checker for 5 Malaysian civil litigation document types
- Template matcher for auto-detecting document type
- Entity extraction router

### What's Being Added
- **Court Direction Parser** — new router at /parse-direction
  - Extracts: next_court_date, required_actions[], parties[], court_name, confidence
  - Handles mixed BM/English court direction text
  - Returns structured JSON — Node.js saves to case_stages table after user confirms

### Structure
```
ai-service/
  main.py
  routers/
    compliance.py       # existing
    entities.py         # existing
    court_directions.py # NEW — arahan parser
  services/
    nlp_pipeline.py
    direction_parser.py # NEW
  models/
    schemas.py
  requirements.txt
```

### Conventions
- Internal microservice only — Node.js calls it, never frontend directly
- Pydantic models for all request/response validation
- Returns confidence scores on all AI outputs
- Malaysian civil litigation context in NLP pipeline

### Commands
```bash
uvicorn main:app --reload
pip install -r requirements.txt
```

---

## Web Frontend — React.js (`/web`)

### Conventions
- Functional components and hooks only
- State: Context API or Zustand
- API calls through src/api/ — never fetch directly from components
- axios with base URL pointing to Node.js backend
- Component pattern: ComponentName/index.jsx + styles.module.css

### Commands
```bash
npm start
npm run build
```

---

## Mobile Frontend — Flutter (`/mobile`)

### Conventions
- All API calls through lib/services/api_service.dart
- State: Provider
- camelCase variables/functions, PascalCase classes, snake_case files

### Commands
```bash
flutter run
flutter build apk --release
flutter analyze
dart format lib/
```

---

## Database — PostgreSQL via Supabase

### Security
- **RLS DISABLED** — all auth/role checks at Node.js middleware layer
- Supabase service role key server-side only, never in frontend
- Parameterised queries always

### Full Current Schema (executed in Supabase — do not recreate any of these)

```sql
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY[
    'intern','junior_associate','chambering','associate','partner','admin'
  ])),
  supervisor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  fcm_token text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE public.template_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT template_categories_pkey PRIMARY KEY (id)
);

CREATE TABLE public.templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  category_id uuid REFERENCES public.template_categories(id),
  content text NOT NULL,
  instructions text,
  file_url text,
  file_name text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT templates_pkey PRIMARY KEY (id)
);

CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  template_id uuid REFERENCES public.templates(id),
  created_by uuid REFERENCES public.users(id),
  reviewed_by uuid REFERENCES public.users(id),
  title text NOT NULL,
  content text NOT NULL,
  file_url text,
  file_name text,
  file_version integer DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY[
    'draft','pending_associate','pending_partner','approved','filed','served','rejected'
  ])),
  errors_flagged jsonb DEFAULT '[]',
  reviewer_comments text,
  escalation_reason text,
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (id)
);

CREATE TABLE public.case_files (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  case_number text NOT NULL UNIQUE,
  file_number text,
  year integer NOT NULL,
  client_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active','closed'])),
  storage_room text,
  storage_box text,
  storage_notes text,
  assigned_to uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT case_files_pkey PRIMARY KEY (id)
);

CREATE TABLE public.case_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  case_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT case_history_pkey PRIMARY KEY (id)
);

CREATE TABLE public.case_stages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  case_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  stage_type text NOT NULL CHECK (stage_type = ANY (ARRAY[
    'court_appearance','court_direction','meeting','filing_deadline','year_end_review','other'
  ])),
  title text NOT NULL,
  stage_date date NOT NULL,
  next_court_date date,
  directions text,
  direction_source text CHECK (direction_source = ANY (ARRAY['website','physical','both'])),
  file_url text,
  file_name text,
  is_completed boolean DEFAULT false,
  ai_parsed boolean DEFAULT false,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT case_stages_pkey PRIMARY KEY (id)
);

CREATE TABLE public.court_deadlines (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  case_id uuid REFERENCES public.case_files(id) ON DELETE CASCADE,
  title text NOT NULL,
  court_name text NOT NULL,
  deadline_date date NOT NULL,
  court_directions text,
  is_completed boolean DEFAULT false,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT court_deadlines_pkey PRIMARY KEY (id)
);

CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  job_title text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  state text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contacts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.court_guidelines (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  content text NOT NULL,
  category text CHECK (category = ANY (ARRAY[
    'court_filing_website','case_management','payment_for_filing','file_new_cases','other'
  ])),
  file_url text,
  file_name text,
  state text,
  registry_url text,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT court_guidelines_pkey PRIMARY KEY (id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  reference_id uuid,
  reference_type text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
```

### Table Summary
| Table                 | Purpose                                                                        |
|-----------------------|--------------------------------------------------------------------------------|
| `users`               | All users — 6 roles, supervisor_id for Level 1 staff                          |
| `template_categories` | Groups templates by type                                                       |
| `templates`           | Word file templates — file_url points to Supabase Storage                     |
| `documents`           | Uploaded Word docs with 7-status workflow including filed/served               |
| `case_files`          | Cases with structured storage location and file_number                         |
| `case_history`        | System audit trail — auto-written by backend on case events                    |
| `case_stages`         | Case progression timeline — manually added or AI-parsed from arahan upload     |
| `court_deadlines`     | Deadlines with court_directions field                                          |
| `contacts`            | Contacts with address field                                                    |
| `court_guidelines`    | Guidelines with category and PDF file support                                  |
| `notifications`       | In-app notifications for web bell icon                                         |

### Key Notes
- `case_stages.ai_parsed` = true when the stage was auto-populated by the court direction parser
- `case_stages.next_court_date` = the next hearing date extracted from arahan (used to auto-create the next court_appearance stage)
- `case_history` is the system audit trail written automatically by backend — do not confuse with `case_stages` which is the case progression timeline managed by users
- `documents.errors_flagged` is jsonb — stores NLP checker output
- `users.fcm_token` stores Flutter device token — updated on mobile login
- `notifications` handles web in-app alerts — FCM handles mobile push (not yet wired)

---

## Case Timeline — Design Spec

The case timeline is a **vertical node-based timeline** on the Case Detail page.

### Visual Design
- Vertical line running top to bottom
- Each case stage = circular node on the line
- Nodes connected by the vertical line
- Most recent stage at top, oldest at bottom
- Node colours by stage_type:
  - `court_appearance` — blue
  - `court_direction` — orange
  - `meeting` — green
  - `filing_deadline` — red
  - `year_end_review` — purple
  - `other` — grey
- Node states:
  - Completed: filled solid colour
  - Upcoming: outlined/hollow with colour border
  - Current (nearest future date): pulsing ring animation
- Completed stages slightly muted/reduced opacity
- Each node shows: stage_type icon + title + date (compact)
- Clicking a node opens a right side panel (web) or bottom sheet (mobile) with full details:
  - Title, date, stage type, directions text, direction source, next court date, who recorded it, file download if arahan was uploaded, ai_parsed badge if AI-generated

### Actions on Timeline
- **Add Stage** button (associate+) — manual form to add a new stage
- **Upload Arahan** button (associate+) — triggers court direction parser:
  1. Upload arahan file (PDF or Word)
  2. Backend extracts text, sends to AI parser
  3. AI returns parsed fields
  4. User sees pre-filled form with parsed data to confirm/edit
  5. On confirm, stage saved with ai_parsed = true
- **Mark Complete** toggle on each node (associate+)

### Difference from Case History
- `case_history` = system audit log (auto-written, not editable) — shows in a collapsible section
- `case_stages` = case progression (user-managed, AI-assisted) — shown as the visual timeline

---

## Document Approval Workflow

Full 7-status lifecycle:
```
draft → pending_associate → pending_partner → approved → filed → served
                          ↘ rejected ↙
```

| Status              | Meaning                                        | Who acts next      |
|---------------------|------------------------------------------------|--------------------|
| `draft`             | Being worked on                                | Intern / Associate |
| `pending_associate` | Submitted for review                           | Associate          |
| `pending_partner`   | Escalated — too complex                        | Partner            |
| `approved`          | Approved, ready to physically file             | Associate          |
| `filed`             | Physically filed in court — system updated     | Admin              |
| `served`            | Physically served to opponent — system updated | Done               |
| `rejected`          | Sent back with comments                        | Original creator   |

### Transition Rules
- Level 1 OR associate: draft → pending_associate
- Associate: pending_associate → pending_partner (escalation_reason required) or rejected
- Partner: pending_partner → approved or rejected
- Associate: approved → filed
- Admin: filed → served
- Rejected: creator reuploads revised Word file → back to draft → resubmit

### API Endpoints
```
PATCH /api/documents/:id/submit
PATCH /api/documents/:id/escalate
PATCH /api/documents/:id/approve
PATCH /api/documents/:id/reject
PATCH /api/documents/:id/file
PATCH /api/documents/:id/serve
POST  /api/documents/:id/reupload
```

---

## Court Direction Parser — AI Feature Spec

### Flow
```
Associate uploads arahan (PDF/Word)
        ↓
Node.js extracts text (mammoth for .docx, pdf-parse for .pdf)
        ↓
Node.js sends text to FastAPI POST /parse-direction
        ↓
spaCy pipeline extracts:
  - next_court_date (date entity)
  - required_actions[] (what must be done by that date)
  - parties[] (plaintiff, defendant, names)
  - court_name (which court issued the direction)
  - confidence score
        ↓
Node.js returns parsed result to frontend
        ↓
Frontend shows pre-filled case stage form for user to confirm/edit
        ↓
User confirms → case stage saved with ai_parsed = true
              → arahan file stored in Supabase Storage court-directions bucket
              → next_court_date auto-creates a new court_appearance stage (optional, user confirms)
```

### API Endpoints
```
POST /api/case-stages                           # Create stage manually
GET  /api/case-stages?case_id=:id              # Get all stages for a case
PATCH /api/case-stages/:id                     # Update a stage
DELETE /api/case-stages/:id                    # Delete a stage
PATCH /api/case-stages/:id/complete            # Toggle is_completed
POST /api/case-stages/:caseId/parse-direction  # Upload arahan → AI parse → return pre-filled data
```

### FastAPI Endpoint
```
POST /parse-direction
Body: { text: string }
Response: {
  next_court_date: string | null,
  required_actions: string[],
  parties: string[],
  court_name: string | null,
  confidence: float
}
```

---

## Supabase Storage Buckets (all created, all private)
| Bucket             | Used for                                      |
|--------------------|-----------------------------------------------|
| `documents`        | Uploaded Word .docx document files            |
| `templates`        | Template Word .docx files                    |
| `guidelines`       | Court guideline PDF files                    |
| `court-directions` | Arahan files uploaded for AI parsing         |

Files served via signed URLs from backend — never expose bucket directly.

---

## Notifications
- **Web**: insert into notifications table — frontend polls or Supabase Realtime
- **Mobile**: FCM push to users.fcm_token (not yet wired)

notification.type values: `document_submitted`, `document_approved`, `document_rejected`, `document_escalated`, `document_filed`, `document_served`, `deadline_reminder`, `stage_added`, `stage_ai_parsed`

---

## Out of Scope
- Attendance and leave management
- Real-time collaborative document editing
- Integration with official Malaysian e-Court system
- Multi-firm portal
- Billing or payment features
- Full BM/EN bilingual UI
- Firm publicity website
- Case summary AI generator (dropped — timeline covers the same information visually)
- Compliance score UI (deferred — revisit after core features complete)
