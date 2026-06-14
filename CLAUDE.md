# LegalAssist FYP — CLAUDE.md

## Project Overview
AI-assisted legal document management and compliance system for Malaysian civil litigation law firms.
Final Year Project (FYP) at Universiti Teknikal Malaysia Melaka (UTeM), BITS programme.

Two frontends: a full-featured **React web app** and a lighter **Flutter mobile app**.
Shared **Node.js + Express backend API** consumed by both frontends.
Target users: law firm interns, junior associates, chambering students, associates, partners, and the office manager (admin).

**AI Features (4 total):**
1. **Court Direction Parser** — extracts next court date, required actions, parties, court name from arahan (file upload or camera OCR). Rule-based spaCy working; ML infrastructure complete, model training pending client documents.
2. **Document Compliance Checker** — rule-based section check + sentence transformer per-section similarity scoring (both working, shown on document detail page).
3. **Document Auto-Classification** — POST /classify working (sentence transformer vs template embeddings); not yet wired to frontend upload flow.
4. **Checklist Item Matching (NEW)** — when an arahan is parsed, semantically match its required actions against pending case checklist items and suggest which to mark done / which is next. Reuses the shared sentence transformer.

**Research Question:**
*Does a fine-tuned transformer model outperform a rule-based NLP approach for extracting structured information from Malaysian civil litigation court directions?*

**Key insight from client (latest interview):** arahan are short and concise — mostly ONE sentence. This means: annotation is fast, fine-tuning on short text is feasible with 15–20 examples + augmentation, and the rule-based baseline may perform strongly — making the comparison a genuinely interesting result either way.

---

## Tech Stack

| Component          | Technology                                                                 |
|--------------------|----------------------------------------------------------------------------|
| Web frontend       | React.js + Vite (`/web`)                                                   |
| Mobile frontend    | Flutter (`/mobile`)                                                        |
| Backend API        | Node.js + Express (`/legal-system-backend`)                                |
| Database           | PostgreSQL via Supabase                                                    |
| Authentication     | Supabase Auth (JWT)                                                        |
| File storage       | Supabase Storage (private buckets: documents, templates, guidelines, court-directions) |
| AI/NLP service     | Python + FastAPI + spaCy + sentence-transformers (`/ai-service`)           |
| OCR (mobile)       | google_mlkit_text_recognition (on-device, Flutter)                         |
| Push notifications | Firebase Cloud Messaging (stubbed, not wired)                              |

---

## User Roles & Permissions

| Role               | Level | Description                                                                        |
|--------------------|-------|------------------------------------------------------------------------------------|
| `intern`           | 1     | Upload documents, view templates, guidelines, contacts, cases, timeline, tick checklist items |
| `junior_associate` | 1     | Same as intern — belongs to one associate via supervisor_id                        |
| `chambering`       | 1     | Same as intern — belongs to one associate via supervisor_id                        |
| `associate`        | 2     | All Level 1 + create documents, review/escalate/reject, flag filed, add case stages, upload arahan, manage checklists |
| `partner`          | 3     | All Level 2 + final approve or reject escalated documents                          |
| `admin`            | 4     | Manage users, templates, contacts, cases, guidelines, flag served, manage checklist templates |

canWrite in frontend = ['associate', 'partner', 'admin']

---

## Current Build State (everything here is DONE and working — do not rebuild)

### Backend (`/legal-system-backend`) — Complete
- All route modules: users, cases, documents, templates, template-categories, firm-deadlines, contacts, notifications, court-guidelines, case-stages, search, evaluation
- JWT auth + role-based authorisation (`authenticate`, `authorize(roles...)`)
- 7-status document workflow: draft → pending_associate → pending_partner → approved → filed → served + rejected
- Word .docx upload via multer → Supabase Storage; text extracted via mammoth
- POST /api/documents/:id/check-compliance (rule-based) + /check-similarity (sentence transformer)
- POST /api/case-stages/:caseId/parse-direction — accepts file OR req.body.text (mobile OCR path)
- GET /api/case-stages/stats (admin), GET /api/search?q=
- GET /api/evaluation/aggregate + POST /api/evaluation/run-batch (admin)
- Daily 8am MYT cron for deadline notifications (web only)
- FCM stubbed in notificationService.js

### Web App (`/web`) — Complete
- All pages: Login, Dashboard (role-aware), Cases, Case Detail (vertical timeline + history), Timeline (/timeline horizontal), Documents (+ Detail with compliance report, similarity score panel, entity extraction, full workflow buttons), Templates, Guidelines (PDF embed + categories), Contacts, Firm Deadlines, Notifications, Users (admin), Parser Stats (/admin/parser-stats with rule-based vs ML evaluation comparison table), Search
- Documents linked to cases via case_id; global search bar in header

### Mobile (`/mobile`) — Complete
- 5 tabs: Deadlines (list + calendar), Cases (detail + read-only vertical timeline), Documents (own docs only, create draft with .docx upload, submit for review, status badges, download), Contacts (tap-to-call), Guidelines (PDF viewer)
- Camera OCR scanner: scan FAB on all non-documents tabs → ML Kit on-device text extraction → "Parse as Arahan" (case picker → parse-direction → pre-filled stage form) or "Use as Document Text"
- Base URL: http://10.0.2.2:5000/api

### AI Service (`/ai-service`) — Complete (model training pending)
- POST /parse-direction — tries ml_parser first, falls back to rule-based; returns parser_used
- POST /compliance/check (rule-based) + /compliance/check-similarity (per-section cosine similarity, 0.45 flag threshold)
- POST /classify — document type auto-classification (predicted_type, confidence, auto_selected ≥0.8)
- POST /entities/extract, POST /templates/match
- POST /evaluate-parser (single doc P/R/F1) + /evaluate-parser/run-batch + GET /evaluate-parser/aggregate
- services/direction_parser.py — rule-based baseline, NEVER MODIFY (FYP comparison baseline)
- services/ml_parser.py — loads training/model-best/, returns None if absent (triggers fallback)
- services/ml_models.py — @lru_cache singleton for paraphrase-multilingual-MiniLM-L12-v2 (shared by similarity_scorer + classifier — reuse this for checklist matching)

---

## Latest Client Feedback (drives current work)

| Feedback | Action |
|---|---|
| "Nak tahu progression of normal case" + wants an ordered checklist of things to do per case | **BUILD: Case Progression Checklist** (see spec below) |
| "Nak tahu sample data in real life situation" | **BUILD: realistic demo seed script** |
| "Macam mana tagging document" | **BUILD: document tags** |
| "Overall summary of case file → tak perlu" | Confirms case summary AI stays dropped ✅ |
| Arahan is short, mostly 1 sentence | ML annotation/training note (above) ✅ |
| Court system already assigns arahan to firm | Confirms scope boundary — we process arahan, not receive them ✅ |
| Associates informally decide who handles which case | assigned_to field already covers this lightly ✅ |

---

## NEW FEATURE: Case Progression Checklist (Matter Playbook)

**Concept:** A predefined, ordered list of steps a case is expected to go through (e.g. Letter of Demand → File Writ → Serve → Memorandum of Appearance → Defence → Case Management → Witness Statements → Trial). Admin/associates define reusable templates; when a case is created (or later), a template is applied and its items are copied to the case. Case members tick items off. Case detail shows a progress bar (e.g. 6/14 done).

Market reference: equivalent to Clio Matter Templates / Litify Matter Plans — none localised for Malaysian civil procedure (innovation justification for FYP report).

### New Tables (SQL to run)
```sql
create table public.checklist_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

create table public.checklist_template_items (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  title text not null,
  order_index integer not null,
  expected_role text,
  notes text
);

create table public.case_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.case_files(id) on delete cascade,
  title text not null,
  order_index integer not null,
  status text not null default 'pending' check (status in ('pending','done','skipped')),
  completed_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  linked_stage_id uuid references public.case_stages(id) on delete set null,
  notes text
);

alter table public.documents add column tags text[] default '{}';
```

### Behaviour
- Admin + associate can create/edit checklist templates (template manager page or section)
- Applying a template to a case copies items into case_checklist_items (a case can have a checklist applied once; re-applying replaces pending items only — keep done/skipped)
- Any staff member on the system can tick items done; completed_by + completed_at recorded
- Items can be manually added/edited/reordered/skipped per case (associate+)
- Case detail page: checklist section with progress bar, ordered items, tick boxes, who/when on done items
- Optionally link an item to a case_stage (linked_stage_id) — e.g. the "File witness statements" item links to the stage created from the arahan that ordered it

### AI Integration — Checklist Item Matching
When an arahan is parsed (existing parse-direction flow), after the stage form is confirmed:
- Send the parsed required_actions[] + the case's pending checklist item titles to a new AI endpoint
- POST /checklist/match on FastAPI: encodes both with the shared sentence transformer (ml_models.py singleton), returns best-matching pending item + similarity score per action
- If similarity ≥ 0.6: frontend shows a suggestion banner — "This direction appears to match checklist item 'File witness statements'. Mark as done / Link to stage / Dismiss"
- User always confirms — never auto-tick
- Store nothing new in DB beyond the normal item update (status, completed_by, linked_stage_id)

### API Endpoints (backend)
```
GET    /api/checklist-templates                      # list (all staff)
POST   /api/checklist-templates                      # create (associate+)
PUT    /api/checklist-templates/:id                  # update name/description (associate+)
DELETE /api/checklist-templates/:id                  # delete (admin)
POST   /api/checklist-templates/:id/items            # add item (associate+)
PUT    /api/checklist-templates/:id/items/:itemId    # edit item (associate+)
DELETE /api/checklist-templates/:id/items/:itemId    # remove item (associate+)

GET    /api/cases/:caseId/checklist                  # get case checklist (all staff)
POST   /api/cases/:caseId/checklist/apply-template   # apply template (associate+)
POST   /api/cases/:caseId/checklist/items            # add manual item (associate+)
PATCH  /api/cases/:caseId/checklist/items/:itemId    # tick done/skip/edit/reorder (done = all staff; edit/skip = associate+)
DELETE /api/cases/:caseId/checklist/items/:itemId    # delete item (associate+)
POST   /api/cases/:caseId/checklist/match-direction  # proxy to FastAPI /checklist/match (associate+)
```

### Seed: default Malaysian civil suit template
Seed one default template "Standard Civil Suit (Plaintiff)" with items in order:
1. Send Letter of Demand
2. File Writ of Summons + Statement of Claim
3. Serve Writ on Defendant
4. Receive Memorandum of Appearance
5. Receive Defence
6. File Reply to Defence (if needed)
7. Attend Case Management
8. Exchange Documents (Discovery)
9. File Witness Statements
10. Pre-Trial Case Management
11. Trial
12. Judgment
13. Post-judgment actions (execution/appeal assessment)

---

## NEW: Document Tags
- `documents.tags text[]` column (in SQL above)
- Web: tag chips input on document create/edit; tag chips shown on list + detail; tag filter dropdown on documents list
- Backend: accept tags array on create/update; GET /api/documents?tag= filter
- Mobile: display-only (show tags on document detail bottom sheet)

---

## NEW: Demo Seed Data Script
Create `legal-system-backend/src/seed/demoSeed.js`, runnable via `npm run seed:demo`:
- 3 cases at different life stages:
  - Case A (new): just created, checklist applied, 1 item done, 1 upcoming stage
  - Case B (mid-litigation): 6–8 stages incl. several court_direction stages (1-sentence BM/EN arahan text), documents at draft / pending_associate / approved / filed statuses, checklist ~50% done, deadlines upcoming
  - Case C (closed): full stage history, all checklist items done, documents served
- Realistic Malaysian names (redacted-style), case numbers like "GUAMAN SIVIL NO. BA-22NCvC-XX-XX/2025", courts (Mahkamah Majistret/Sesyen/Tinggi)
- A handful of contacts (runner, court registrar, courier, interpreter), guidelines per category, 5 templates, firm deadlines across categories
- Idempotent: wipe-and-reseed demo rows only (mark seeded rows, e.g. case_number prefix DEMO-)

---

## What's Left To Build (priority order)

1. **Case Progression Checklist** — schema, backend routes, web UI on case detail, template manager, AI matching endpoint + suggestion banner
2. **Demo seed data script** — enables client review, UAT, and report screenshots
3. **Document tags** — small, client-requested
4. **Deployment** — web → Vercel; backend → Render/Railway; AI service → Render; enables remote UAT with the firm (FYP II requires testing on identified users)
5. **ML training + evaluation** — PENDING client arahan documents (infrastructure already complete)
6. **Wire /classify into web upload flow** — auto-select document type on upload (small)
7. **FCM push notifications** — low priority

## NOT doing (confirmed)
- LLM chatbot / "ask about your case" — dilutes research focus, hallucination risk, mention as future work only
- Client-facing portal / e-signing — different user base
- Market-readiness work (multi-tenancy, billing, onboarding) — zero FYP grade value; commercial potential framed in report instead

---

## Key Architectural Decisions
- Hard delete throughout; RLS off (auth at Express middleware)
- Documents are Word files; text extracted server-side via mammoth
- case_history = auto audit trail; case_stages = user-managed progression timeline; case_checklist_items = expected future steps (the checklist is the plan, the timeline is the record)
- firm_deadlines = practice management reminders, separate from case events
- direction_parser.py rule-based baseline NEVER modified (FYP comparison)
- ml_parser returns None when no model → transparent fallback to rule-based
- Shared sentence transformer singleton in ml_models.py — reuse for checklist matching, do NOT load a second model instance
- parse-direction accepts file OR text (mobile OCR path)
- own=true query param filters documents by creator (mobile)

---

## Database Tables (current + new)

| Table | Purpose |
|---|---|
| users | All staff — 6 roles, supervisor_id for Level 1 |
| template_categories / templates | Word file templates |
| documents | 7-status workflow, case_id link, **tags (new)** |
| case_files | Cases with structured storage location |
| case_history | Auto audit trail |
| case_stages | Progression timeline (ai_parsed, confidence) |
| **checklist_templates (new)** | Reusable matter playbooks |
| **checklist_template_items (new)** | Ordered items per template |
| **case_checklist_items (new)** | Instantiated checklist per case |
| firm_deadlines | Practice management reminders |
| contacts | Directory (address field) |
| court_guidelines | Categories + PDF |
| notifications | Web in-app alerts |

New notification types to add: `checklist_item_done`, `checklist_suggestion`

---

## Client Documents Still Needed (unchanged)

| Document type | Quantity | Purpose |
|---|---|---|
| Arahan (mostly 1-sentence) | 15–20 | ML parser training + ground truth |
| Completed legal documents (5 types) | 20–30 | Compliance ML evaluation |
| Blank firm templates | 5 | Similarity scoring reference |
| Physical/handwritten arahan photos | 3–5 | OCR testing |

All redacted: [NAME], [IC_NUMBER], [ADDRESS].

---

## Running the System

**AI Service:** `cd ai-service && uvicorn main:app --reload --port 8000`
**Backend:** `cd legal-system-backend && npm start` (port 5000)
**Web:** `cd web && npm run dev` (port 5173, Vite)
**Mobile:** `cd mobile && flutter run` (base URL hardcoded to http://10.0.2.2:5000/api)

**Env vars:** Backend `.env` needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, AI_SERVICE_URL (default http://localhost:8000). Web uses Supabase anon key. AI service needs none.

## Out of Scope
- Attendance/leave, real-time collaborative editing, e-Court integration, multi-firm portal, billing, full BM/EN UI, firm website, case summary AI (client confirmed: tak perlu), LLM chatbot
