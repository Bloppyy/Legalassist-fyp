const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');

const usersRouter = require('./routes/users');
const casesRouter = require('./routes/cases');
const documentsRouter = require('./routes/documents');
const templatesRouter = require('./routes/templates');
const templateCategoriesRouter = require('./routes/templateCategories');
const deadlinesRouter = require('./routes/deadlines');
const contactsRouter = require('./routes/contacts');
const notificationsRouter = require('./routes/notifications');
const courtGuidelinesRouter = require('./routes/courtGuidelines');
const caseStagesRouter = require('./routes/caseStages');
const searchRouter = require('./routes/search');
const evaluationRouter = require('./routes/evaluation');
const checklistTemplatesRouter = require('./routes/checklistTemplates');
const caseChecklistRouter = require('./routes/caseChecklist');
const deadlineNotifier = require('./jobs/deadlineNotifier');

const app = express();

// ── Core middleware ───────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ success: true, message: 'Legal System API is running' });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/users', usersRouter);
app.use('/api/cases', casesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/template-categories', templateCategoriesRouter);
app.use('/api/firm-deadlines', deadlinesRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/court-guidelines', courtGuidelinesRouter);
app.use('/api/case-stages', caseStagesRouter);
app.use('/api/search', searchRouter);
app.use('/api/evaluation', evaluationRouter);
app.use('/api/checklist-templates', checklistTemplatesRouter);
app.use('/api/cases/:caseId/checklist', caseChecklistRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, data: null, message: 'Route not found', error: null });
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  deadlineNotifier.register();
});
