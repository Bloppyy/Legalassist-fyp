# LegalAssist FYP — Context Handoff for Claude Web

**Project:** Final Year Project (FYP) at UTeM (BITS programme)
**Student:** Harith Sharizal (harithsharizal@gmail.com)
**Phase:** FYP II — system is feature-complete. All planned features built, ML training and evaluation done with valid methodology. Only remaining item is FCM push notifications (low priority, explicitly skipped).

---

## What the system is

AI-assisted legal document management and compliance system for Malaysian civil litigation law firms. Two frontends (React web + Flutter mobile) share a Node.js/Express backend API. A Python FastAPI microservice handles all AI/NLP work.

**Research question:**
*Does a fine-tuned transformer model outperform a rule-based NLP approach for extracting structured information from Malaysian civil litigation court directions (arahan)?*

**Answer (confirmed, results committed, valid methodology):**
Yes. ML macro F1 = **0.750** vs rule-based **0.461**, evaluated via leave-one-base-group-out cross-validation on 15 evaluable documents with zero train/test leakage. The previous number (0.853, June 18) was invalid — the model was evaluated on its own training data. That has been fixed and the corrected results are committed.

---

## Tech stack

| Component | Technology |
|---|---|
| Web frontend | React.js + Vite (`/web`) |
| Mobile frontend | Flutter (`/mobile`) |
| Backend API | Node.js + Express (`/legal-system-backend`) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT) |
| File storage | Supabase Storage (private buckets: documents, templates, guidelines, court-directions) |
| AI/NLP service | Python + FastAPI + spaCy + sentence-transformers (`/ai-service`) |
| PDF validation | pdf-parse + pdf-lib (Node.js, deterministic — not AI) |
| OCR (mobile) | google_mlkit_text_recognition (on-device Flutter) |
| Deployment | Backend + AI service → Render (auto-deploy from main); Web → Vercel (auto-deploy from main) |

---

## User roles

| Role | Level | Key permissions |
|---|---|---|
| `intern` | 1 | Upload docs, view everything, tick checklist items |
| `junior_associate` | 1 | Same as intern |
| `chambering` | 1 | Same as intern |
| `associate` | 2 | Create docs, review/escalate/reject, flag filed, add case stages, upload arahan, manage checklists, upload filing PDF |
| `partner` | 3 | Final approve or reject escalated documents |
| `admin` | 4 | Manage users, templates, contacts, cases, guidelines, checklist templates, view parser stats, run evaluation |

Frontend shorthand: `canWrite = ['associate', 'partner', 'admin']`

Three-layer role protection: JWT signing → `authorize(roles...)` middleware → DB CHECK constraint.

---

## Backend — ALL routes (feature-complete)

Entry point: `legal-system-backend/src/index.js`. All routes registered there.
Auth: `middleware/auth.js` — `authenticate` (JWT verify) + `authorize(...roles)` (role check).

### `/api/users`
- GET list (admin), GET single, POST create (admin), PUT update (admin), DELETE (admin)
- Role field protected — users cannot self-assign roles

### `/api/cases`
- Full CRUD for case files
- Fields: `case_number`, `file_number`, `client_name`, `status` (active/closed), `assigned_to` (associate uuid), `partner_id` (partner uuid — NEW), `intake_brief` (text — NEW), `party_role` (plaintiff/defendant/other CHECK constraint — NEW), `court_name`, `storage_location`
- Case history auto-written on every meaningful change

### `/api/documents`
- Full CRUD + file upload (multer → Supabase Storage, .docx only for main docs)
- `tags text[]` field — accept on create/update, filterable via `?tag=`
- `own=true` query param — filters to creator only (mobile use)
- Status transitions: `PATCH /:id/submit`, `/escalate`, `/approve`, `/reject`, `/file`, `/serve`
- `POST /:id/reupload` — replace .docx file
- `GET /:id/download` — signed URL
- `POST /:id/check-compliance` — rule-based compliance check (proxies to AI service)
- `POST /:id/check-similarity` — per-section cosine similarity (proxies to AI service)
- `GET /:id/entities` — entity extraction (proxies to AI service)
- `POST /:id/classify` — auto-classify document type (proxies to AI service)
- `POST /:id/upload-filing-pdf` — associate-only, status must be `approved`; accepts PDF, runs 3 validation checks (size ≤50MB, PDF copyable, no annotations), stores result in `filing_checks` JSONB + `final_pdf_url`/`final_pdf_name`
- `POST /:id/strip-annotations` — associate-only; removes annotation layer from stored PDF via pdf-lib, re-runs all 3 checks, updates `filing_checks`
- `markFiled` gate: if `filing_checks` has any failure AND `req.body.acknowledge_issues` is not `true` → 400 error. Audit log only writes "acknowledged pre-filing issues" when `acknowledge_issues` was actually sent as `true`. **Do not revert this gate — it was a critical bug fix.**

### `/api/templates` + `/api/template-categories`
- Full CRUD for Word template files and their categories

### `/api/firm-deadlines`
- Full CRUD for practice management reminders

### `/api/contacts`
- Full CRUD for firm directory (runner, registrar, courier, etc.)

### `/api/notifications`
- GET list for current user, PATCH mark read, GET unread count
- Types include: `deadline_reminder`, `document_submitted`, `document_approved`, `document_rejected`, `document_filed`, `document_served`, `checklist_item_done`, `checklist_suggestion`
- Daily 8am MYT cron job sends deadline reminders (`jobs/deadlineNotifier.js`)

### `/api/court-guidelines`
- Full CRUD for court guidelines (categories + PDF links)
- 6 real Malaysian court URLs seeded (e-filing, KL/Penang/Shah Alam courts, Malaysian Bar, Selangor Land Office)

### `/api/case-stages`
- `GET /` — list stages for a case
- `POST /:caseId/parse-direction` — accepts multipart file OR `req.body.text` (mobile OCR path); proxies to AI service; writes stage to DB with `ai_parsed=true`, `confidence`, extracted fields
- `GET /stats` — admin; total/ai_parsed/manual counts and percentages (used by parser-stats page)

### `/api/search`
- `GET ?q=` — full-text search across cases, documents, contacts, templates

### `/api/evaluation`
- `GET /aggregate` — admin; returns stored `training/evaluation_results/results.json` via AI service
- `POST /run-batch` — admin; triggers AI service to re-run batch evaluation and overwrite `results.json`

### `/api/checklist-templates`
- `GET /` — list all templates (all staff)
- `POST /` — create (associate+)
- `PUT /:id` — update name/description (associate+)
- `DELETE /:id` — delete (admin)
- `POST /:id/items` — add item (associate+)
- `PUT /:id/items/:itemId` — edit item (associate+)
- `DELETE /:id/items/:itemId` — remove item (associate+)

### `/api/cases/:caseId/checklist`
- `GET /` — get case checklist with all items (all staff)
- `POST /apply-template` — copy template items to case (associate+); re-applying replaces pending items only, keeps done/skipped
- `POST /items` — add manual item (associate+)
- `PATCH /items/:itemId` — tick done (all staff) / skip / edit / reorder (associate+); records `completed_by` + `completed_at`
- `DELETE /items/:itemId` — delete (associate+)
- `POST /match-direction` — proxies to AI service `/checklist/match`; returns best-matching pending item per action with similarity score

---

## AI Service — ALL endpoints (feature-complete)

Entry point: `ai-service/main.py`. Background thread preloads models at startup so port binds immediately (fixes Render port-scan timeout).

Health check: `GET /` — returns `{ status: "ok"|"warming_up", model_ready: bool }`

### `/parse-direction`
- `POST` — tries ML parser first (`ml_parser.predict()`), falls back to rule-based if model unavailable or returns None
- Returns: `next_court_date`, `required_actions[]`, `parties[]`, `court_name`, `confidence` (0–1 float), `parser_used` ("ml" or "rule_based")
- Accepts raw text string

### `/compliance/check`
- `POST` — rule-based section presence check against document type requirements
- Returns per-section pass/fail

### `/compliance/check-similarity`
- `POST` — per-section cosine similarity scoring using shared sentence transformer
- 0.45 similarity threshold flags a section as potentially non-compliant
- Returns per-section similarity scores

### `/classify`
- `POST` — document type auto-classification using sentence transformer vs template embeddings
- Returns `predicted_type`, `confidence`, `auto_selected` (true if confidence ≥0.80)

### `/entities/extract`
- `POST` — entity extraction from document text

### `/templates/match`
- `POST` — match document text against template library

### `/checklist/match`
- `POST` — given `required_actions[]` from a parsed arahan + `pending_items[]` (case checklist titles), encodes both with shared sentence transformer, returns best-matching item per action with similarity score
- 0.60 threshold — frontend shows suggestion banner if any match exceeds this
- Uses the same `@lru_cache` singleton as compliance similarity and classifier — no second model loaded

### `/evaluate-parser`
- `POST` — evaluate both parsers on a single document against provided ground truth; returns per-field P/R/F1

### `/evaluate-parser/run-batch`
- `POST` — evaluates both parsers across all 17 annotated arahan files; writes result to `training/evaluation_results/results.json`
- **NOTE:** On Render, model is unavailable (weights gitignored), so batch only produces rule-based column. ML column comes from the committed `results.json` (CV-corrected).

### `/evaluate-parser/aggregate`
- `GET` — returns stored `training/evaluation_results/results.json`

---

## AI Service — model architecture and training

**Rule-based parser** (`services/direction_parser.py`):
- spaCy + dateutil + regex patterns
- **FROZEN — never modify.** It is the FYP comparison baseline. Any change invalidates the research.
- Known weakness: date regex uses `[/\-]` separators, not `.` — misses `DD.MM.YYYY` format used in all Malaysian court arahan → F1=0 on next_court_date

**ML parser** (`services/ml_parser.py`):
- `bert-base-multilingual-cased` fine-tuned for NER (BIO labeling: NEXT_COURT_DATE, COURT_NAME, PARTY, REQUIRED_ACTION)
- Loads from `training/model-best/` via HuggingFace pipeline (`@lru_cache` singleton)
- Returns `None` if model absent → transparent fallback to rule-based
- `predict()` → uses cached singleton; `predict_with_pipeline(text, ner)` → uses arbitrary pipeline (needed by CV harness)
- `_entities_to_response(entities)` — pure conversion function shared by both entry points

**Shared sentence transformer** (`services/ml_models.py`):
- `paraphrase-multilingual-MiniLM-L12-v2`, `@lru_cache` singleton
- Used by: compliance similarity scorer, document classifier, checklist matcher
- Do not load a second instance anywhere

**Training data** (`training/annotated_arahan/`):
- 17 JSON files: 5 base client examples + 12 augmented variants
- Each file has: `text`, `labels`, `spans`, `group_id`, `cv_excluded`, `source_id` fields
- `group_id` links each file to its base example group (added by `training/backfill_lineage.py`)
- `cv_excluded=True` on `arahan_aug_011` (Memorandum of Appearance) and `arahan_aug_012` (Witness Statement) — invented scenarios not derived from client examples; kept in training only, never in test folds
- Groups: base_001 group (defence direction) = base_001 + aug_001 + aug_002; similarly for base_002–005

**Training** (`training/train_parser.py`):
- `run_training(train_data, dev_data, output_dir, epochs, ...)` — core loop, called by both `train()` and the CV harness
- `train(epochs)` — plain CLI trainer; 80/20 random split, saves best to `model-best/` and final to `model-last/`; behavior unchanged after refactor
- Model weights in `training/model-best/` and `training/model-last/` — **gitignored** (~700MB)
- Best dev F1 achieved during training: 0.870 (Aug 5 regression check run)

**CV evaluation** (`training/cv_evaluate.py`):
- Leave-one-base-group-out cross-validation: 5 folds, one per base example
- Each fold's test set = base + its 2 augmented variants (3 docs), never in that fold's training
- `cv_excluded` docs always in training, never in test — enforced by data field, not hardcoded IDs
- Rule-based evaluated on same 15 docs for matched N
- Writes results to `training/evaluation_results/cv_results.json`
- Fold scratch models written to `training/cv_models/` — **gitignored**; does NOT touch `model-best/` or `model-last/`

**Evaluation results (CV-corrected, final — use these in the report):**

| Field | Rule-Based P | R | F1 | ML P | R | F1 |
|---|---|---|---|---|---|---|
| Next Court Date | 1.0 | 0.0 | **0.0** | 0.80 | 0.80 | **0.80** |
| Court Name | 0.93 | 0.93 | **0.93** | 0.93 | 0.93 | **0.93** |
| Parties | 0.13 | 1.0 | **0.13** | 0.87 | 1.0 | **0.87** |
| Required Actions | 0.90 | 0.80 | **0.78** | 0.53 | 0.40 | **0.40** |
| **Macro F1** | | | **0.461** | | | **0.750** |

ML per-fold macro F1: [1.0, 1.0, 0.50, 0.67, 0.58] — mean **0.750 ± std 0.211**

Committed files:
- `training/evaluation_results/results.json` — CV-corrected numbers in `AggregateEvaluationResponse` schema (what parser-stats page reads via `/api/evaluation/aggregate`)
- `training/evaluation_results/cv_results.json` — full CV output including per-fold breakdown and methodology note

**Key findings for Chapter 6:**
- Rule-based F1=0 on next_court_date: regex pattern `[/\-]` doesn't match `DD.MM.YYYY` dots used in all Malaysian arahan. ML learned this format from examples → F1=0.80 on unseen data.
- Parties: rule-based precision=0.13 (too many false positives, recall=1.0); ML precision=0.87 (precise and complete).
- Court name: tied at 0.93 — both approaches handle Malaysian court names equally.
- Required actions: rule-based wins (0.78 vs 0.40) — action keyword patterns are semantically precise; ML struggles to span full sentences correctly on unseen data.
- High fold variance (std=0.21): folds 1-2 (defence/reply directions, structurally similar) scored 1.0; folds 3-5 (pre-trial bundle, trial date, post-trial — more distinctive) scored 0.50–0.67. Expected with N=3 per fold — document as data-size limitation.

---

## Web App — ALL pages (feature-complete)

### Auth
- `/login` — Supabase Auth email/password

### Dashboard (`/`)
- Role-aware widget cards: upcoming deadlines, pending documents, recent notifications, quick links

### Cases (`/cases`)
- List with search/filter; NEW case button (associate+)
- Case create/edit form captures: `case_number`, `file_number`, `client_name`, `court_name`, `storage_location`, `status`, `assigned_to` (associate picker), `partner_id` (partner picker — NEW), `intake_brief` textarea (NEW), `party_role` select plaintiff/defendant/other (NEW)

### Case Detail (`/cases/:id`)
- `intake_brief` displayed prominently at top (editable by associate+)
- `partner_id` shown alongside `assigned_to`
- **Vertical timeline** — case stages in chronological order; "Add Stage" button (associate+); "Parse Arahan" FAB uploads file or pastes text → AI pre-fills form with confidence badge ("AI Pre-filled · 87% confidence"); on save, fire-and-forget match-direction call triggers checklist suggestion banner if similarity ≥0.60
- **Case history** — audit trail of all status changes and AI events
- **Checklist section** — progress bar (e.g. "6/14 done"), ordered items with tick boxes; who/when on completed items; "Apply Template" dropdown; "Add Item" manually; associate+ can skip/edit/reorder

### Timeline (`/timeline`)
- Horizontal timeline view across all cases

### Documents (`/documents`)
- List with tag filter dropdown; "New Document" button (associate+)
- Tags shown as chips on each row

### Document Detail (`/documents/:id`)
- Full document info + tag chips
- **7-status workflow buttons** — each transition gated by role and current status:
  - Submit (draft → pending_associate)
  - Escalate to partner / Reject back to draft (associate, pending_associate)
  - Approve / Reject (partner, pending_partner)
  - Mark as Filed (associate, approved) — gated by filing checks
  - Mark as Served (associate+, filed)
- **Compliance report panel** — rule-based section check results
- **Similarity score panel** — per-section cosine similarity scores with 0.45 threshold flag
- **Entity extraction panel** — extracted entities from document text
- **Auto-classify banner** — shown after document creation with predicted type + confidence
- **Pre-filing validation panel** — shown when status=`approved`:
  - "Upload Filing PDF" button → runs 3 checks → shows results table:
    - Size: actual MB, pass/fail (≤50MB)
    - PDF Copyable: pass/fail (text-extractable vs scanned image)
    - No Annotations: pass/fail
  - If all pass: "Mark as Filed" enabled directly
  - If any fail: acknowledgement checkbox required before "Mark as Filed" activates; failure logged to case_history truthfully
  - "Remove Annotations" button (if annotation check fails) → strips annotation layer, re-runs checks, refreshes UI

### Templates (`/templates`)
- List + upload + download + delete (associate+)

### Guidelines (`/court-guidelines`)
- Categorised list with PDF embed viewer; 6 real Malaysian court URLs seeded

### Contacts (`/contacts`)
- Directory with tap-to-call on mobile; full CRUD (admin+)

### Firm Deadlines (`/firm-deadlines`)
- Practice management reminders with category filter; full CRUD (associate+)

### Notifications (`/notifications`)
- In-app alert list; mark read; unread badge in header

### Users (`/users`) — admin only
- User management: create, role assignment, supervisor assignment

### Parser Stats (`/admin/parser-stats`) — admin only
- AI parse rate bar charts (AI-parsed vs manual)
- Average confidence gauge
- Extracted field coverage bars (next_court_date, required_actions)
- **Rule-Based vs ML comparison table** — P/R/F1 per field + macro F1; reads from committed CV-corrected `results.json`; "Run Evaluation" button triggers fresh batch (note: on Render, only rule-based column regenerates since model weights not deployed)

### Search
- Global search bar in header → `/search` results page across cases, documents, contacts, templates

---

## Mobile App — feature-complete

5 tabs:
1. **Deadlines** — list + calendar view of firm deadlines
2. **Cases** — case list + read-only vertical timeline per case
3. **Documents** — own docs only (`own=true`); create draft (.docx upload), submit for review, status badges, download
4. **Contacts** — directory with tap-to-call
5. **Guidelines** — PDF viewer

**Camera OCR scanner** — FAB on all non-documents tabs:
- Opens camera → ML Kit on-device text extraction
- Two options after scan: "Parse as Arahan" (case picker → parse-direction API → pre-filled stage form) OR "Use as Document Text"
- Mobile OCR path sends `req.body.text` (string) to parse-direction endpoint; this is why the endpoint accepts both file upload and text

Base URL hardcoded: `http://10.0.2.2:5000/api`
Document tags: display-only (shown on document detail bottom sheet)

---

## Database schema (all migrations applied)

```
users                   — all staff; 6 roles; supervisor_id for Level 1 roles
template_categories     — document template categories
templates               — Word .docx template files
documents               — 7-status workflow; tags text[]; final_pdf_url, final_pdf_name, filing_checks JSONB
case_files              — cases; assigned_to (associate); partner_id (NEW); intake_brief text (NEW); party_role CHECK(plaintiff/defendant/other) (NEW)
case_history            — auto audit trail; every status change, action, AI event written here
case_stages             — user-managed timeline entries; ai_parsed bool; confidence float; linked arahan text
checklist_templates     — reusable matter playbooks; 3 seeded
checklist_template_items — ordered items per template
case_checklist_items    — instantiated checklist per case; status pending/done/skipped; completed_by; completed_at; linked_stage_id
firm_deadlines          — practice management reminders by category
contacts                — firm directory with address field
court_guidelines        — categorised links + PDF storage; 6 real Malaysian court URLs seeded
notifications           — web in-app alerts; types include checklist_item_done, checklist_suggestion
```

`filing_checks` JSONB shape: `{ size_mb, size_ok, pdf_copyable, copyable_ok, has_annotations, annotations_ok, checked_at }`

---

## Seed data (all committed and idempotent)

**Checklist templates** (`src/seed/seedChecklist.js`, run via `node src/seed/seedChecklist.js`):
1. "Standard Civil Suit (Plaintiff)" — 15 items, full lifecycle from first client meeting to close file
2. "Standard Civil Suit (Defendant)" — 14 items, starts from filing Memorandum of Appearance
3. "Trial Bundle Checklist" — 9 items (Bundle of Pleadings, Agreed Facts, Issues to be Tried, etc.)

**Demo data** (`src/seed/demoSeed.js`, run via `npm run seed:demo`):
- 3 demo cases with DEMO- prefixed case numbers, idempotent wipe-and-reseed
- Case A (new): checklist applied, 1 item done, 1 upcoming stage
- Case B (mid-litigation): 6–8 stages including court_direction AI-parsed stages, documents at various statuses, checklist ~50% done
- Case C (closed): full stage history, all checklist items done, all documents served
- Realistic Malaysian names, case numbers in format "GUAMAN SIVIL NO. BA-22NCvC-XX-XX/2025", Mahkamah Majistret/Sesyen/Tinggi
- Supporting contacts, guidelines, templates, firm deadlines

**Court guidelines** — 6 real client-provided Malaysian court URLs seeded directly in the database.

---

## All bug fixes applied (do not revert any of these)

1. **markFiled false audit trail (CRITICAL):** `markFiled` now reads `req.body.acknowledge_issues` and checks `filing_checks` before proceeding. Gate: `hasIssues && !acknowledge_issues → 400`. Audit log only writes "acknowledged pre-filing issues" when the flag was actually `true`. Previously the audit log wrote this claim regardless.

2. **acknowledge_issues never sent to backend:** `fileDocument(id, data)` in `web/src/api/documents.js` now accepts `data` param. `Detail.jsx` passes `{ acknowledge_issues: filingAcknowledged }`.

3. **Save button stuck "Saving..." after parse-direction:** `matchDirection()` in `CaseTimeline.jsx` is fire-and-forget (`.then().catch()`, not `await`) — `finally { setFormSaving(false) }` runs immediately after saving the stage, not waiting for AI.

4. **Confidence badge not showing:** `aiConfidence` state added to `CaseTimeline.jsx`, set from `parsed.confidence`, reset on form open/close. Displayed in badge: "AI Pre-filled · 87% confidence".

5. **Checklist suggestion banner never appeared:** Filter in `Detail.jsx` used non-existent `is_match` field. Fixed to `matches.filter(m => m.matched_item_id)`.

6. **Render cold-start: models not loaded on health check visit:** `main.py` now starts a background thread at module level that calls `_load_nlp()` and `get_sentence_model()`. Port binds immediately; models warm concurrently. Health check returns `model_ready: false` until warm. Previous fix attempt (`@app.on_event("startup")`) blocked port binding and caused Render port-scan timeout.

7. **AI service hanging indefinitely on slow starts:** 90-second `AbortController` timeout on all AI calls in `services/aiService.js`. User-facing error: "AI service is warming up (Render free tier). Wait 30 seconds then try again."

8. **ML evaluation leakage (CRITICAL for FYP report):** `_run_batch_evaluation()` was evaluating the fine-tuned model on all 17 documents including ~13 it trained on. The 1.0/1.0/1.0 scores were memorization, not generalization. Fixed by: (a) extracting `run_training()` from `train_parser.py`, (b) extracting `_entities_to_response()` and adding `predict_with_pipeline()` to `ml_parser.py`, (c) hoisting `_aggregate()` to module scope in `evaluation.py`, (d) adding `backfill_lineage.py` to stamp group_id/cv_excluded on annotated files, (e) creating `cv_evaluate.py` (5-fold LOGOCV harness). Corrected results committed to `results.json` and `cv_results.json`.

---

## Key architectural decisions (do not change)

- **Hard delete throughout** — no soft delete
- **RLS off** — auth enforced at Express middleware level only
- **direction_parser.py FROZEN** — never modify; it is the FYP comparison baseline; any change invalidates the whole comparison
- **ml_parser returns None when model absent** → transparent fallback to rule-based; `parser_used` field in response tells which ran
- **Shared sentence transformer singleton** — `ml_models.py @lru_cache`; used by compliance similarity, classifier, and checklist matcher; do not load a second instance
- **Documents are .docx** — text extracted server-side via mammoth; PDFs only appear in the pre-filing validation flow (`final_pdf_url`)
- **case_history = audit trail** (immutable record of what happened); **case_stages = timeline** (what the user tracks as milestones); **case_checklist_items = the plan** (expected future steps)
- **filing_checks as JSONB** — atomic result stored together, extensible without migration, never queried by individual field
- **parse-direction accepts file OR text** — multipart file upload (web) OR `req.body.text` string (mobile OCR path)
- **model-best/ and model-last/ gitignored** — ~700MB; Render deploys with rule-based fallback; committed `results.json` supplies the ML evaluation numbers for parser-stats page without needing the model at runtime

---

## What is NOT done (only one item)

**FCM push notifications** — `notificationService.js` has a stub. Would need `firebase-admin` package, a service account key stored in env, and `fcm_token` column on users table. Explicitly deprioritised — in-app web notifications work fine for UAT and demo.

Everything else in the CLAUDE.md feature list is complete and committed.

---

## Running locally

```bash
# AI service (port 8000)
cd ai-service && uvicorn main:app --reload --port 8000

# Backend API (port 5000)
cd legal-system-backend && npm start

# Web frontend (port 5173)
cd web && npm run dev

# Mobile (Android emulator, base URL hardcoded to http://10.0.2.2:5000/api)
cd mobile && flutter run
```

Backend `.env` needs: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `AI_SERVICE_URL` (default `http://localhost:8000`).

---

## Deployment

- `web/vercel.json` — Vercel config (auto-deploy from main branch)
- `render.yaml` — Render config (backend + AI service, auto-deploy from main branch)
- Model weights gitignored — Render AI service runs rule-based fallback in production
- `training/evaluation_results/results.json` IS committed — contains CV-corrected numbers (ML=0.750, rule-based=0.461); parser-stats page on Render shows these valid numbers
- `training/evaluation_results/cv_results.json` IS committed — full CV breakdown with methodology note, per-fold F1, and std

---

## What NOT to build (confirmed out of scope)

- LLM chatbot / "ask about your case" — dilutes research focus, hallucination risk
- Client-facing portal, e-signing
- Inline document redlining / track-changes — documented as known limitation in report
- Multi-tenancy, billing, onboarding
- OCR text-layer fix for scanned PDFs — deferred (FYP II)
- Auto-compression for oversized PDFs — deferred (FYP II)
- Defendant-side checklist template beyond what's seeded — already seeded and done
- Case summary AI — client confirmed "tak perlu"
