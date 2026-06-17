# LegalAssist FYP — CLAUDE.md

## Project Overview
AI-assisted legal document management and compliance system for Malaysian civil litigation law firms.
Final Year Project (FYP) at Universiti Teknikal Malaysia Melaka (UTeM), BITS programme.

Two frontends: a full-featured **React web app** and a lighter **Flutter mobile app**.
Shared **Node.js + Express backend API** consumed by both frontends.
Target users: law firm interns, junior associates, chambering students, associates, partners, and the office manager (admin).

**FYP phase note:** currently in FYP I (target ~80% system completion for presentation). FYP II follows in ~2 months with full re-evaluation — features explicitly marked "Deferred to FYP II" below should not be built now.

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
| PDF validation      | pdf-parse + pdf-lib (Node.js, deterministic checks — not AI service)       |
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
- All route modules: users, cases, documents, templates, template-categories, firm-deadlines, contacts, notifications, court-guidelines, case-stages, search, evaluation, checklist-templates, case checklists
- JWT auth + role-based authorisation (`authenticate`, `authorize(roles...)`)
- 7-status document workflow: draft → pending_associate → pending_partner → approved → filed → served + rejected
- Word .docx upload via multer → Supabase Storage; text extracted via mammoth
- POST /api/documents/:id/check-compliance (rule-based) + /check-similarity (sentence transformer)
- POST /api/documents/:id/upload-filing-pdf (associate, approved only) — runs 3 deterministic pre-filing checks (size ≤50 MB, pdf copyable, no annotations), stores filing_checks jsonb + final_pdf_url
- POST /api/documents/:id/strip-annotations (associate) — strips Annots from stored PDF via pdf-lib, re-runs checks
- PATCH /api/documents/:id/file now gates on final_pdf_url existing; logs to case_history with pass/fail note
- POST /api/case-stages/:caseId/parse-direction — accepts file OR req.body.text (mobile OCR path)
- GET /api/case-stages/stats (admin), GET /api/search?q=
- GET /api/evaluation/aggregate + POST /api/evaluation/run-batch (admin)
- Daily 8am MYT cron for deadline notifications (web only)
- FCM stubbed in notificationService.js
- case_files.partner_id (new) — dual assignment (associate + partner); returns partner_user join
- documents.tags text[] — tag filter on GET /api/documents?tag=
- documents.final_pdf_url / final_pdf_name / filing_checks (new) — pre-filing validation

### Web App (`/web`) — Complete
- All pages: Login, Dashboard (role-aware), Cases, Case Detail (vertical timeline + history + checklist panel + progress bar), Timeline (/timeline horizontal), Documents (+ Detail with compliance report, similarity score panel, entity extraction, full workflow buttons, pre-filing validation panel), Templates, Guidelines (PDF embed + categories), Contacts, Firm Deadlines, Notifications, Users (admin), Parser Stats (/admin/parser-stats with rule-based vs ML evaluation comparison table), Search, Checklist Templates manager
- Documents linked to cases via case_id; global search bar in header
- Document Detail: when status=approved (associate role), shows Court Filing PDF panel — upload PDF, see 3 check rows (size / copyable / annotations), "Remove Annotations" auto-fix button, acknowledge checkbox if issues, "Mark as Filed" gated on PDF upload + acknowledgement

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

## Client-Stated System Purpose (use directly in FYP report objectives section)

Client articulated the system's purpose in 5 points — each maps cleanly to a built module, making this a directly client-validated objectives section rather than an inferred one:

| # | Client's stated purpose | Built as |
|---|---|---|
| 1 | File management | Case Files + structured storage location + Case Progression Checklist + timeline |
| 2 | Streamline drafts/documents to follow firm standard | Template library + 7-status approval workflow + AI compliance checker |
| 3 | Avoid missing deadlines | Firm Deadlines + Case Stages + daily cron notifications + mobile calendar |
| 4 | Record keeping of files (open and closed) | case_files.status (active/closed) + case_history audit trail |
| 5 | One-stop directory of contacts and guidelines | Contacts module + Court Guidelines (categorised, PDF) |

No orphaned features, no gaps — every existing module traces to one of these five client-stated purposes.

---

## NEW FEATURE: Pre-Filing Validation Checker

**Client-named pain point** (also referenced in the Firm Operations Workflow document): documents are sometimes rejected or cause issues at e-filing because they exceed the court system's 50MB limit, are not "PDF copyable" (i.e. a flattened/scanned PDF rather than text-extractable), or contain leftover annotations/comments. Client wants the system to flag all three before filing.

**Concept:** drafting happens as `.docx` (unchanged). When a document reaches `approved` status, the associate uploads the actual court-ready PDF (exported from the approved Word doc). The system validates it against the three rules and shows pass/fail before allowing the `filed` transition.

### Schema
```sql
alter table public.documents add column final_pdf_url text;
alter table public.documents add column final_pdf_name text;
alter table public.documents add column filing_checks jsonb;
-- filing_checks shape: { size_mb, size_ok, pdf_copyable, copyable_ok, has_annotations, annotations_ok, checked_at }
```

### Validation Rules (deterministic, not AI — implement in Node.js)
- **Size check:** file buffer size in MB, `size_ok = size_mb <= 50`
- **PDF copyable check:** extract text from the PDF (e.g. pdf-parse); if extracted text is near-empty relative to page count (heuristic: average <50 characters per page), the PDF is likely a flattened/scanned image — `copyable_ok = false`
- **Annotation check:** inspect each page for annotation/comment objects (e.g. via pdf-lib or pdfjs-dist reading the page's Annots array); `annotations_ok = false` if any page has annotations

### Behaviour
- New endpoint, associate-only, only callable when document status = `approved`: `POST /api/documents/:id/upload-filing-pdf` — accepts PDF, runs the three checks, stores result in `filing_checks` + `final_pdf_url`/`final_pdf_name`
- `PATCH /api/documents/:id/file` (existing, approved → filed) now requires `final_pdf_url` to be set first
- Web: on the document detail page, once status = `approved`, show an "Upload Filing PDF" panel; after upload, show a checklist UI — three rows (Size, PDF Copyable, No Annotations) each with pass/fail icon and the actual value (e.g. "47.2 MB")
- If any check fails: "Mark as Filed" button still works but requires checking an acknowledgement box ("I acknowledge the above issues and will resolve them before court submission") — this is logged to case_history regardless of pass/fail
- If all checks pass: "Mark as Filed" enabled directly, no acknowledgement needed

### Auto-Fix: Annotation Stripping (FYP I — build now)
When the annotation check fails, show a "Remove Annotations" button next to that row. Clicking it:
- Calls `POST /api/documents/:id/strip-annotations` (associate-only)
- Re-opens the stored final_pdf using pdf-lib, deletes the Annots array from every page, re-saves to the same final_pdf_url (overwrite), re-runs all 3 checks, updates filing_checks
- UI refreshes the checklist row to show pass immediately
- Safe operation — annotations are metadata layered on top of the page, removing them does not alter the rendered/visual content of the document

### Deferred to FYP II (do NOT build yet — noted here for continuity)
Two further auto-fix capabilities were discussed and intentionally deferred to FYP II, where the full system is evaluated again and there is more runway:
- **OCR text-layer fix** for the "PDF copyable" check — when a PDF is flagged as a scanned/flattened image, run OCR (e.g. ocrmypdf/Tesseract in the Python AI service) to overlay an invisible text layer, making it copyable without changing the visible page. Natural fit for the AI service since it's already Python-based. Caveat to note in report if built: OCR text layer may contain occasional misreads since OCR isn't perfect, though the visible page is unchanged.
- **Auto-compression fix** for the size check — downsampling images / stripping duplicate font data (e.g. via Ghostscript or pikepdf) to bring oversized PDFs under 50MB. Deferred due to (a) hosting/infrastructure complexity of running Ghostscript on Render, and (b) risk of degrading scanned exhibit/signature quality below usable for actual court submission. For FYP I, oversized files remain flagged only — associate manually resolves.

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

### API Endpoints (add to existing document workflow endpoints)
```
POST /api/documents/:id/upload-filing-pdf    # associate, status must be approved; runs validation, stores filing_checks
POST /api/documents/:id/strip-annotations    # associate; removes annotations from stored final_pdf, re-validates
```

---

1. **Run new SQL**: `partner_id` column on case_files, and the 3 `final_pdf_url`/`final_pdf_name`/`filing_checks` columns on documents
2. **Pre-Filing Validation Checker** — schema (above), upload-filing-pdf endpoint with 3 deterministic checks, web UI checklist panel on document detail, gate on the file transition with acknowledgement override
3. **Case Progression Checklist** — schema, backend routes, web UI on case detail, template manager, AI matching endpoint + suggestion banner; seed BOTH "Standard Civil Suit (Plaintiff)" AND "Trial Bundle Checklist" templates
4. **Demo seed data script** — enables client review, UAT, and report screenshots; use the real arahan examples and guideline links from the Firm Operations document
5. **Document tags** — small, client-requested
6. **Update case create/edit UI** — capture both `assigned_to` (associate) and new `partner_id`
7. **Seed guidelines** with the 6 real URLs from the Firm Operations document
8. **Deployment** — web → Vercel; backend → Render/Railway; AI service → Render; enables remote UAT with the firm (FYP II requires testing on identified users)
9. **ML training + evaluation** — use the 5 client arahan examples as seed, expand via Option A/B in the ML training note above
10. **Wire /classify into web upload flow** — auto-select document type on upload (small)
11. **FCM push notifications** — low priority

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
