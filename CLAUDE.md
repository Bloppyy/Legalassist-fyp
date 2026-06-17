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
- All route modules: users, cases, documents, templates, template-categories, firm-deadlines, contacts, notifications, court-guidelines, case-stages, search, evaluation, checklist-templates, case-checklist
- JWT auth + role-based authorisation (`authenticate`, `authorize(roles...)`)
- 7-status document workflow: draft → pending_associate → pending_partner → approved → filed → served + rejected
- Word .docx upload via multer → Supabase Storage; text extracted via mammoth
- POST /api/documents/:id/check-compliance (rule-based) + /check-similarity (sentence transformer)
- POST /api/documents/:id/classify — calls AI classify, returns predicted_type + confidence
- POST /api/case-stages/:caseId/parse-direction — accepts file OR req.body.text (mobile OCR path)
- Full case checklist API: /api/checklist-templates + /api/cases/:caseId/checklist (apply, tick, skip, add, delete, match-direction)
- case_files.partner_id column + partner_user join in WITH_RELATIONS
- GET /api/case-stages/stats (admin), GET /api/search?q=
- GET /api/evaluation/aggregate + POST /api/evaluation/run-batch (admin)
- Daily 8am MYT cron for deadline notifications (web only)
- FCM stubbed in notificationService.js

### Web App (`/web`) — Complete
- All pages: Login, Dashboard (role-aware), Cases (+ Associate/Partner pickers in create/edit form), Case Detail (vertical timeline + checklist section with progress bar + AI suggestion banner), Timeline (/timeline horizontal), Documents (+ Detail with compliance report, similarity score panel, entity extraction, full workflow buttons; tag chips on list + filter; AI classify banner after upload), Templates, Guidelines (PDF embed + categories), Contacts, Firm Deadlines, Notifications, Users (admin), Parser Stats (/admin/parser-stats), Checklist Templates manager (/checklist-templates)
- Documents linked to cases via case_id; global search bar in header; document tags (text[]) with chip input and filter

### Mobile (`/mobile`) — Complete
- 5 tabs: Deadlines (list + calendar), Cases (detail + read-only vertical timeline + checklist section with progress bar), Documents (own docs only, create draft with .docx upload, submit for review, status badges, download, tags display), Contacts (tap-to-call), Guidelines (PDF viewer)
- Camera OCR scanner: scan FAB on all non-documents tabs → ML Kit on-device text extraction → "Parse as Arahan" (case picker → parse-direction → pre-filled stage form) or "Use as Document Text"
- Production URL: https://legalassist-backend-vifj.onrender.com/api (dev: http://10.0.2.2:5000/api via kReleaseMode)

### AI Service (`/ai-service`) — Complete (model training pending)
- POST /parse-direction — tries ml_parser first, falls back to rule-based; returns parser_used
- POST /compliance/check (rule-based) + /compliance/check-similarity (per-section cosine similarity, 0.45 flag threshold)
- POST /classify — document type auto-classification (predicted_type, confidence, auto_selected ≥0.8)
- POST /checklist/match — matches arahan required_actions against pending checklist item titles (shared sentence transformer)
- POST /entities/extract, POST /templates/match
- POST /evaluate-parser (single doc P/R/F1) + /evaluate-parser/run-batch + GET /evaluate-parser/aggregate
- services/direction_parser.py — rule-based baseline, NEVER MODIFY (FYP comparison baseline)
- services/ml_parser.py — loads training/model-best/, returns None if absent (triggers fallback)
- services/ml_models.py — @lru_cache singleton for paraphrase-multilingual-MiniLM-L12-v2 (shared by similarity_scorer + classifier + checklist matching)

### Deployment — Live
- Backend: https://legalassist-backend-vifj.onrender.com (Render, Node 22)
- AI service: https://legalassist-ai.onrender.com (Render, Python 3.11)
- Web: https://legalassist-7sy4c6isf-bloppyys-projects.vercel.app (Vercel)

### Seed Scripts
- `npm run seed:checklist` — seeds "Standard Civil Suit (Plaintiff)" (15 items) + "Trial Bundle Checklist" (9 items); skips if already exists by name
- `npm run seed:demo` — idempotent demo data (3 cases, contacts, guidelines with real URLs, firm deadlines); requires seed:checklist to run first

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

## Client Document: "Firm Operations Workflow" (received — full case lifecycle reference)

Client provided a detailed written walkthrough of how a real civil suit (writ + statement of claim) progresses end to end, including 5 example arahan in BM (generic/template-style, safe to use — no real client data). This document is authoritative for refining the checklist seed content and confirms several design decisions.

**Full case lifecycle described (drives the revised default checklist below):**
```
Client meeting → Open file (hardcopy, parties, court case no., file ref no.)
→ Assign partner + associate (partner's initials in file reference number)
→ [If Plaintiff] Letter of Demand → if ignored → File Writ + Statement of Claim
→ Court issues case number + 1st case management date
→ 1st case management: direction for Defence OR Memorandum of Appearance (14 days)
→ Draft (chambering/intern) → review (associate) → escalate if needed (partner)
  → track-changed amendments back to drafter → finalise
→ Upload to e-filing (https://efs.kehakiman.gov.my/EFSWeb/) on directed date
→ Serve to other party (email + hand/courier delivery)
→ 2nd case management: direction for Reply to Defence (14 days, if Plaintiff)
→ 3rd case management: "pliding ditutup" — direction for pre-trial bundle:
  Bundle of Pleadings, Bundle of Documents (Parts A/B/C), Agreed Facts,
  Issues to be Tried, List of Witnesses, Witness Statements (2 weeks before trial)
→ Compile bundles, draft witness statements (back-and-forth with client)
→ Trial dates fixed and communicated to client
→ Witness statements filed → no further case management → wait for trial
→ Pre-trial: compile hardcopy checklist (see Trial Bundle Checklist below)
→ Trial → oral trial directions noted by attending lawyer (written submissions
  deadlines, bundle of authorities, proceedings notes deadline, decision date)
→ Decision date → Win: file Order of Court / Lose: consider appeal
→ Execution of order (if won, order filed+sealed) → Close file
```

**Confirms (no action needed):**
- Document workflow exactly matches built system: draft → associate review → partner escalation if needed → revision back to drafter
- `served` status semantics (email + hand/courier delivery) correct as built
- `assigned_to` single-field is *insufficient* — see schema change below

**Schema change — dual assignment:**
```sql
alter table public.case_files add column partner_id uuid references public.users(id) on delete set null;
```
Client confirmed files are assigned to BOTH a partner and an associate (partner's initials appear in the file reference number). `case_files.assigned_to` continues to represent the associate; `partner_id` is new. Update case create/edit UI to capture both.

**New checklist template — Trial Bundle Checklist** (separate concept from case progression — this is "what documents must be physically ready," not "what stage is the case at"). Seed as a second `checklist_templates` row from the document's own table:
1. Bundle of Pleadings
2. Agreed Facts
3. Issues to be Tried
4. Summary of Case
5. Common Bundle of Documents (Part A)
6. Common Bundle of Documents (Part B)
7. Common Bundle of Documents (Part C)
8. List of Witnesses
9. Witness Statements (per witness — add dynamically per case)

**Guidelines seed data — real, safe, client-provided links:**
| Title | URL | category |
|---|---|---|
| Court Filing Website (e-Filing) | https://efs.kehakiman.gov.my/EFSWeb/ | court_filing_website |
| KL Court Directory | https://kl.kehakiman.gov.my/ms/hubungi/direktori | case_management |
| Penang Court Directory | https://pulaupinang.kehakiman.gov.my/ms/hubungi/direktori | case_management |
| Shah Alam High Court (Civil) | https://selangor.kehakiman.gov.my/ms/directory/mahkamah-tinggi-sivil-shah-alam | case_management |
| Malaysian Bar — Find Lawyer/Firm | https://www.malaysianbar.org.my/article/find/legal-directories/lawyer-or-law-firm/lawyer-or-law-firm | other |
| Selangor Land Office | https://klang.selangor.gov.my/ | other |

**5 example arahan (BM, generic/template — safe, no real client data) — use as seed/training base, see ML note below:**
1. *(Defence direction, plaintiff side)* "Defendan diarahkan untuk memfailkan Pembelaan 14 hari dari tarikh hari ini dan serahkan kepada Plaintif pada hari yang sama. Pengurusan kes seterusnya ditetapkan pada 14.06.2026 untuk mengemaskini status pemfailan."
2. *(Reply to defence direction)* "Plaintif diarahkan untuk memfailkan Jawapan kepada Pembelaan 14 hari dari tarikh hari ini dan serahkan kepada Defendan pada tarikh yang sama. Pengurusan kes seterusnya ditetapkan pada 12.07.2026 untuk mengemaskini pemfailan dan untuk arahan-arahan pra-perbicaraan."
3. *(Pre-trial bundle direction)* "Pliding ditutup. Pengurusan kes pra bicara (Aturan 34 kaedah 2 KKM 2012): Sila failkan: 1) Ikatan Pliding 2) Ikatan Dokumen... Pengurusan kes ditangguhkan ke tarikh 13.08.2026 pada masa 9:00AM utk lengkapkan dokumen pra perbicaraan."
4. *(Trial date fixing)* "Dokumen pra-perbicaraan adalah lengkap. Tarikh-tarikh perbicaraan adalah ditetapkan pada 22.03.2027 hingga 26.03.2027. Pihak-pihak sila failkan pernyataan saksi 2 minggu sebelum perbicaraan."
5. *(Post-trial directions)* "Pihak-pihak untuk memfailkan hujahan bertulis dan ikatan autoriti sebelum atau pada 12.06.2027... Keputusan ditetapkan pada 15.07.2027. Pihak-pihak perlu hadir secara fizikal."

**ML training note (sensitivity-safe path):** these 5 examples are generic/template-style, not real case extracts — safe to use directly. Strategy: (1) ask client for more examples in this same generic style covering other stages, rather than real case arahan; (2) synthetically augment these 5 by varying dates/deadlines/court names/party roles to reach the 15-20 target; (3) document this augmentation approach honestly in the FYP report as a response to a real confidentiality constraint — this is a legitimate methodology, not a shortcut.

**Documented limitation (do not build, just note in report):** client describes track-changed amendments going back and forth between reviewer and drafter. System does not support inline document redlining/annotation — flagged as a known limitation / future work item, not a gap to fix now.

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

### Seed: default Malaysian civil suit template (revised against client's full lifecycle doc)
Seed default template "Standard Civil Suit (Plaintiff)" with items in order — note this supersedes the earlier draft; this sequence is taken directly from the client's described workflow:
1. First Client Meeting & Open File
2. Send Letter of Demand
3. File Writ of Summons + Statement of Claim
4. 1st Case Management (await direction)
5. Await Memorandum of Appearance / Draft & File Defence direction received
6. Serve Filed Document (email + hand/courier)
7. 2nd Case Management — File Reply to Defence (if required)
8. 3rd Case Management — Pre-Trial Bundle Direction Received ("pliding ditutup")
9. Compile Pre-Trial Bundles (Pleadings, Documents Parts A/B/C, Agreed Facts, Issues to be Tried, List of Witnesses)
10. Draft & File Witness Statements
11. Trial Dates Fixed
12. Trial
13. Await Court Decision
14. File Order of Court (if won) / Assess Appeal (if lost)
15. Execute Order / Close File

Also seed the second template **"Trial Bundle Checklist"** as specified above (9 items).

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

1. **Run SQL** (once, in Supabase SQL editor): `alter table public.case_files add column partner_id uuid references public.users(id) on delete set null;` — then run `npm run seed:checklist` (to get revised 15-item template + Trial Bundle Checklist) and `npm run seed:demo` to refresh demo data
2. **ML training + evaluation** — use the 5 client arahan examples, augment synthetically to 15–20, train spaCy NER model, compare vs rule-based baseline (core research question)
3. **FCM push notifications** — low priority, already stubbed

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
| case_files | Cases with structured storage location, **partner_id (new)** + assigned_to (associate) |
| case_history | Auto audit trail |
| case_stages | Progression timeline (ai_parsed, confidence) |
| **checklist_templates (new)** | Reusable matter playbooks — seed 2: "Standard Civil Suit (Plaintiff)" + "Trial Bundle Checklist" |
| **checklist_template_items (new)** | Ordered items per template |
| **case_checklist_items (new)** | Instantiated checklist per case |
| firm_deadlines | Practice management reminders |
| contacts | Directory (address field) |
| court_guidelines | Categories + PDF, seed with 6 real client-provided URLs |
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
