# LegalAssist FYP — CLAUDE.md

## Project Overview
AI-assisted legal document management and compliance system for Malaysian civil litigation law firms.
Final Year Project (FYP) at Universiti Teknikal Malaysia Melaka (UTeM), BITS programme.

Two frontends: a full-featured **React web app** and a lighter **Flutter mobile app**.
Shared **Node.js + Express backend API** consumed by both frontends.
Target users: law firm interns, junior associates, chambering students, associates, partners, and the office manager (admin).

**FYP phase note:** currently in **FYP II** — system is fully deployed (web → Vercel, backend → Render, AI service → Render Docker). All FYP I features are complete. ML training is done. Remaining work: FCM push notifications, PDF auto-compression, UAT with firm users, report writing, compliance ML evaluation (needs more client documents).

**AI Features (4 total — all DONE):**
1. **Court Direction Parser** — BERT NER pipeline (HuggingFace), trained on 17 annotated arahan (5 base + 12 synthetic augmentations). LOGOCV macro F1: ML 0.750 vs rule-based 0.461 (N=15, no leakage). Rule-based spaCy fallback when model absent. Both file upload and mobile OCR text paths working.
2. **Document Compliance Checker** — rule-based section check + sentence transformer per-section similarity scoring (both working, shown on document detail page).
3. **Document Auto-Classification** — POST /classify wired into web upload flow; auto-selects document type at ≥0.8 confidence.
4. **Checklist Item Matching** — POST /checklist/match on FastAPI; shared sentence transformer singleton; suggestion banner in Case Detail after arahan is parsed. User always confirms — never auto-ticks.

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

### AI Service (`/ai-service`) — Complete (ML trained)
- POST /parse-direction — tries ml_parser first, falls back to rule-based; returns parser_used
- POST /compliance/check (rule-based) + /compliance/check-similarity (per-section cosine similarity, 0.45 flag threshold)
- POST /classify — document type auto-classification (predicted_type, confidence, auto_selected ≥0.8); wired into web upload flow
- POST /entities/extract, POST /templates/match
- POST /evaluate-parser (single doc P/R/F1) + /evaluate-parser/run-batch + GET /evaluate-parser/aggregate
- POST /checklist/match — shared sentence transformer, returns best-match item + similarity per required_action
- POST /ocr/add-text-layer — Tesseract OCR via ocrmypdf, adds invisible text layer (eng+msa)
- services/direction_parser.py — rule-based baseline, NEVER MODIFY (FYP comparison baseline)
- services/ml_parser.py — HuggingFace BERT NER, trained model in training/model-best/ (gitignored); returns None if absent (triggers fallback)
- services/ml_models.py — @lru_cache singleton for paraphrase-multilingual-MiniLM-L12-v2 (shared by similarity_scorer, classifier, checklist matcher — do NOT load a second instance)
- Deployed via Docker on Render (Dockerfile installs tesseract-ocr, tesseract-ocr-msa, ghostscript)

---

## Latest Client Feedback (all implemented)

| Feedback | Status |
|---|---|
| "Nak tahu progression of normal case" + wants an ordered checklist of things to do per case | ✅ Case Progression Checklist — built, seeded with "Standard Civil Suit (Plaintiff)" + "Trial Bundle Checklist" templates |
| "Nak tahu sample data in real life situation" | ✅ Demo seed script — `npm run seed:demo`, 3 cases at different stages |
| "Macam mana tagging document" | ✅ Document tags — tag chips on create/edit/list; filter by tag |
| "Overall summary of case file → tak perlu" | ✅ Case summary AI stays dropped |
| Arahan is short, mostly 1 sentence | ✅ Used in ML training: 17 examples (5 base + 12 augmented), BERT, dev F1 = 0.786 |
| Court system already assigns arahan to firm | ✅ Scope boundary confirmed — we process arahan, not receive them |
| Associates informally decide who handles which case | ✅ assigned_to (associate) + partner_id fields on case_files |

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

**Schema change — case brief + party role (missed on first pass, document's opening line):**
```sql
alter table public.case_files add column intake_brief text;
alter table public.case_files add column party_role text check (party_role in ('plaintiff', 'defendant', 'other'));
```
Document's very first line: "First client meeting – get the brief facts, give initial advice (example of a case brief)" — this happens BEFORE the file is formally opened. `intake_brief` captures these facts + initial advice; shown at top of Case Detail page, editable by associate+. `party_role` captures whether the firm represents plaintiff or defendant — the document explicitly branches the workflow on this ("If we are the Plaintiff... If we act for the Defendant...") which is also why the seeded checklist is specifically "Standard Civil Suit (**Plaintiff**)" — a defendant-side case follows a different sequence (build that template in FYP II, just capture the field now). Set both fields on case create/edit form, near case_number/file_number.

**Schema change — dual assignment:**
```sql
alter table public.case_files add column partner_id uuid references public.users(id) on delete set null;
alter table public.case_files add column intake_brief text;
alter table public.case_files add column party_role text check (party_role in ('plaintiff', 'defendant', 'other'));
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

**ML training (DONE):** Used 5 base examples + 12 synthetic augmentations (varying dates/deadlines/court names/party roles) = 17 total annotated arahan. BERT NER pipeline (HuggingFace), best dev F1 = 0.786 at epoch 7. LOGOCV evaluation (N=15, no leakage): ML macro F1 = 0.750 ± 0.21, rule-based = 0.461 on same data. Synthetic augmentation methodology documented in FYP report as a legitimate response to the client confidentiality constraint — not a shortcut.

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

### OCR Text-Layer Fix (BUILT — FYP II deferral lifted)
The OCR fix was originally deferred but has been implemented in FYP II:
- **ai-service/Dockerfile** — Docker-based deploy replacing Python buildpack; installs `tesseract-ocr`, `tesseract-ocr-msa` (Malay), `ghostscript` as system binaries
- **ai-service/routers/ocr.py** — `POST /ocr/add-text-layer`; uses `ocrmypdf --skip-text --language eng+msa`; adds invisible text layer, never alters the visible page
- **legal-system-backend routes** — `POST /api/documents/:id/apply-ocr` (associate-only); downloads stored PDF, sends to AI service, overwrites, re-validates, logs to case_history
- **web Detail.jsx** — "Fix with OCR" button next to the PDF Copyable row; resets `filingAcknowledged` after success (same rule as annotation-strip: any handler producing new filing_checks must reset acknowledgement)
- **render.yaml** — AI service block changed to `runtime: docker` / `dockerfilePath: ./Dockerfile`; `PYTHON_VERSION` env var removed (Python version now in Dockerfile FROM line)
- **ai-service/.dockerignore** — excludes `training/model-best/` and `training/model-last/` from build context; on Render this is moot (gitignored = not in repo), but prevents 5GB local context bloat

Caveat to note in report: OCR text layer may contain occasional misreads — Tesseract accuracy on Malaysian BM/EN mixed text is high but not perfect. The visible page is unchanged; only the searchable/copyable layer is affected.

### Auto-compression (BUILT — FYP II)
- **`POST /ocr/compress`** in AI service — Ghostscript `/ebook` preset (150 dpi image downsample + duplicate font strip). Returns the smaller of compressed vs original, so a PDF that is already well-compressed never grows.
- **`POST /api/documents/:id/compress-pdf`** backend — same pattern as apply-ocr: downloads final_pdf, sends to AI service, overwrites, re-validates filing_checks, writes to case_history.
- **Web** — "Compress PDF" button appears next to the Size row when `!checks.size_ok`; re-runs all 3 checks on success, resets acknowledgement gate.
- Caveat in report: Ghostscript /ebook may visibly reduce quality of scanned exhibits at high zoom. Associate should verify the compressed PDF is still acceptable before court submission.

---

## DONE: Case Progression Checklist (Matter Playbook)

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

## DONE: Document Tags
- `documents.tags text[]` column (in SQL above)
- Web: tag chips input on document create/edit; tag chips shown on list + detail; tag filter dropdown on documents list
- Backend: accept tags array on create/update; GET /api/documents?tag= filter
- Mobile: display-only (show tags on document detail bottom sheet)

---

## DONE: Demo Seed Data Script
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

## FYP II Status

### Completed (do not rebuild)
1. ✅ Schema: `partner_id`, `intake_brief`, `party_role` on case_files; `final_pdf_url`, `final_pdf_name`, `filing_checks`, `tags` on documents; checklist tables
2. ✅ Pre-Filing Validation Checker — upload-filing-pdf endpoint, annotation strip, OCR text-layer fix; full web UI checklist panel with acknowledgement gate
3. ✅ Case Progression Checklist — backend routes, web UI, template manager, AI suggestion banner; seeded "Standard Civil Suit (Plaintiff)" + "Standard Civil Suit (Defendant)" + "Trial Bundle Checklist"
4. ✅ Demo seed data script — `npm run seed:demo`, 3 DEMO- cases at different stages
5. ✅ Document tags — tag chips, filter by tag on list page
6. ✅ Case create/edit UI — partner_id, intake_brief, party_role fields; intake_brief shown at top of Case Detail
7. ✅ Guidelines seeded with 6 real client-provided URLs
8. ✅ Deployment — web on Vercel, backend on Render, AI service on Render (Docker); all live
9. ✅ ML training — BERT NER, 17 annotated arahan, dev F1 = 0.786; LOGOCV evaluation done (ML 0.750 vs rule-based 0.461)
10. ✅ /classify wired into web upload flow — auto-selects document type on upload
11. ✅ UI/UX audit — ProtectedRoute auth bypass fix, busyDoc pattern, toast system, debounced search, colSpan fixes, court_filing deadline category

### FYP II Remaining
1. **FCM push notifications** — wire the stub in `notificationService.js`; mobile registers FCM token on login; notify on deadline, checklist suggestion, document status changes
2. ✅ **PDF auto-compression** — `POST /ocr/compress` in AI service (Ghostscript /ebook preset); `POST /api/documents/:id/compress-pdf` backend; "Compress PDF" button in Size row of filing panel, re-validates and resets acknowledgement gate
3. **UAT with firm users** — structured testing sessions with intern, associate, partner; task completion rates + SUS questionnaire; document in report
4. **Compliance ML evaluation** — needs 20–30 completed legal documents from client across 5 document types
5. **Report writing** — methodology chapter, ML evaluation results, LOGOCV analysis, system screenshots, limitations

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
| documents | 7-status workflow, case_id link, tags, final_pdf_url, final_pdf_name, filing_checks |
| case_files | Cases with structured storage location, partner_id, intake_brief, party_role, assigned_to (associate) |
| case_history | Auto audit trail |
| case_stages | Progression timeline (ai_parsed, confidence) |
| checklist_templates | Reusable matter playbooks — seeded: "Standard Civil Suit (Plaintiff)", "Standard Civil Suit (Defendant)", "Trial Bundle Checklist" |
| checklist_template_items | Ordered items per template |
| case_checklist_items | Instantiated checklist per case |
| firm_deadlines | Practice management reminders |
| contacts | Directory (address field) |
| court_guidelines | Categories + PDF, seed with 6 real client-provided URLs |
| notifications | Web in-app alerts |

New notification types to add: `checklist_item_done`, `checklist_suggestion`

---

## Client Documents Status

| Document type | Status | Notes |
|---|---|---|
| Arahan (1-sentence) | ✅ Done — 17 examples (5 base + 12 synthetic) | ML training complete |
| Completed legal documents (5 types) | ⏳ Still needed — 20–30 | Required for compliance ML evaluation in FYP II |
| Blank firm templates | ⏳ Still needed — 5 | For similarity scoring reference |
| Physical/handwritten arahan photos | ⏳ Still needed — 3–5 | For OCR testing validation |

All documents must be redacted: [NAME], [IC_NUMBER], [ADDRESS].

---

## Running the System

**AI Service:** `cd ai-service && uvicorn main:app --reload --port 8000`
**Backend:** `cd legal-system-backend && npm start` (port 5000)
**Web:** `cd web && npm run dev` (port 5173, Vite)
**Mobile:** `cd mobile && flutter run` (base URL hardcoded to http://10.0.2.2:5000/api)

**Env vars:** Backend `.env` needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, AI_SERVICE_URL (default http://localhost:8000). Web uses Supabase anon key. AI service needs none.

**Production:** Web → Vercel (auto-deploy from main). Backend + AI service → Render (Docker for AI service). AI service URL is hardcoded in render.yaml's AI_SERVICE_URL env var on the backend service.



## Out of Scope
- Attendance/leave, real-time collaborative editing, e-Court integration, multi-firm portal, billing, full BM/EN UI, firm website, case summary AI (client confirmed: tak perlu), LLM chatbot
