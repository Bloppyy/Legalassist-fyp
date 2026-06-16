const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');
const { notifyDocumentStatus } = require('../services/notificationService');
const { uploadFile, getSignedUrl, deleteFile } = require('../services/storageService');
const aiService = require('../services/aiService');
const { extractTextFromDocx } = require('../utils/extractText');

const BUCKET = 'documents';

const WITH_RELATIONS = `
  *,
  creator:users!documents_created_by_fkey(id, name, email, role),
  reviewer:users!documents_reviewed_by_fkey(id, name, email, role),
  template:templates(id, title),
  case_file:case_files!documents_case_id_fkey(id, case_number, client_name)
`;

const fetchDocument = async (id) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) throw createError(404, 'Document not found');
  return data;
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

const getAll = async (req, res, next) => {
  try {
    const { status, template_id, case_id, own, tag } = req.query;
    const { role, id: userId } = req.user;
    const level1 = ['intern', 'junior_associate', 'chambering'];

    let query = supabase
      .from('documents')
      .select(WITH_RELATIONS)
      .order('created_at', { ascending: false });

    if (level1.includes(role) || own === 'true') {
      query = query.eq('created_by', userId);
    }
    if (status) query = query.eq('status', status);
    if (template_id) query = query.eq('template_id', template_id);
    if (case_id) query = query.eq('case_id', case_id);
    if (tag) query = query.contains('tags', [tag]);

    const { data, error } = await query;
    if (error) throw error;
    return sendSuccess(res, data);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(WITH_RELATIONS)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return next(createError(404, 'Document not found'));

    const level1 = ['intern', 'junior_associate', 'chambering'];
    if (level1.includes(req.user.role) && data.created_by !== req.user.id) {
      return next(createError(403, 'Access denied'));
    }
    return sendSuccess(res, data);
  } catch (err) { next(err); }
};

/**
 * POST /api/documents
 * Accepts multipart/form-data: title, template_id (optional), content (optional), file (.docx, optional).
 * Level 1 users and associates can create documents.
 */
const create = async (req, res, next) => {
  try {
    const { title, template_id, content, case_id, tags } = req.body;
    let fileUrl = null;
    let fileName = null;
    let storedContent = content || '';

    if (req.file) {
      const path = `${Date.now()}_${req.file.originalname}`;
      await uploadFile(BUCKET, path, req.file.buffer, req.file.mimetype);
      fileUrl = path;
      fileName = req.file.originalname;
      const extracted = await extractTextFromDocx(req.file.buffer);
      storedContent = extracted || `(Word document: ${fileName})`;
    }

    if (!storedContent) storedContent = '';

    const parsedTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
        ? tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

    const { data, error } = await supabase
      .from('documents')
      .insert({
        title,
        content: storedContent,
        file_url: fileUrl,
        file_name: fileName,
        file_version: 1,
        template_id: template_id || null,
        case_id: case_id || null,
        created_by: req.user.id,
        status: 'draft',
        tags: parsedTags,
      })
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Document created', 201);
  } catch (err) { next(err); }
};

/**
 * PUT /api/documents/:id
 * Update title/content (metadata only). Owner only, draft or rejected status only.
 */
const update = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    if (doc.created_by !== req.user.id) return next(createError(403, 'Access denied'));
    if (!['draft', 'rejected'].includes(doc.status)) {
      return next(createError(400, 'Only draft or rejected documents can be edited'));
    }

    const { title, content, tags } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (tags !== undefined) {
      updates.tags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
          ? tags.split(',').map(t => t.trim()).filter(Boolean)
          : [];
    }
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Document updated');
  } catch (err) { next(err); }
};

/**
 * POST /api/documents/:id/reupload
 * Owner reuploads a revised Word file. Increments file_version.
 * Only allowed when status is draft or rejected.
 */
const reupload = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    if (doc.created_by !== req.user.id) return next(createError(403, 'Access denied'));
    if (!['draft', 'rejected'].includes(doc.status)) {
      return next(createError(400, 'Can only reupload a draft or rejected document'));
    }
    if (!req.file) return next(createError(400, 'A Word file is required'));

    // Delete previous file if one exists
    if (doc.file_url) await deleteFile(BUCKET, doc.file_url);

    const newVersion = (doc.file_version || 1) + 1;
    const path = `${Date.now()}_v${newVersion}_${req.file.originalname}`;
    await uploadFile(BUCKET, path, req.file.buffer, req.file.mimetype);

    const extractedText = await extractTextFromDocx(req.file.buffer);
    const updatedContent = extractedText || `(Word document v${newVersion}: ${req.file.originalname})`;

    const { data, error } = await supabase
      .from('documents')
      .update({
        file_url: path,
        file_name: req.file.originalname,
        file_version: newVersion,
        content: updatedContent,
        errors_flagged: [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, data, `Document reuploaded (version ${newVersion})`);
  } catch (err) { next(err); }
};

/**
 * GET /api/documents/:id/download
 * Returns a signed URL to download the document file.
 */
const download = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    const level1 = ['intern', 'junior_associate', 'chambering'];
    if (level1.includes(req.user.role) && doc.created_by !== req.user.id) {
      return next(createError(403, 'Access denied'));
    }
    if (!doc.file_url) return next(createError(404, 'No file attached to this document'));

    const url = await getSignedUrl(BUCKET, doc.file_url);
    return sendSuccess(res, { url, file_name: doc.file_name });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    if (doc.created_by !== req.user.id) return next(createError(403, 'Access denied'));
    if (doc.status !== 'draft') return next(createError(400, 'Only draft documents can be deleted'));

    if (doc.file_url) await deleteFile(BUCKET, doc.file_url);
    const { error } = await supabase.from('documents').delete().eq('id', req.params.id);
    if (error) throw error;
    return sendSuccess(res, null, 'Document deleted');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Approval workflow
// ---------------------------------------------------------------------------

const submit = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    if (doc.created_by !== req.user.id) return next(createError(403, 'You do not own this document'));
    if (!['draft', 'rejected'].includes(doc.status)) {
      return next(createError(400, `Cannot submit a document with status "${doc.status}"`));
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'pending_associate', submitted_at: now, updated_at: now })
      .eq('id', doc.id)
      .select()
      .single();
    if (error) throw error;

    const { data: associates } = await supabase.from('users').select('id').eq('role', 'associate');
    if (associates?.length) {
      await Promise.all(associates.map(a => notifyDocumentStatus(a.id, doc.id, doc.title, 'pending_associate')));
    }

    // Auto-run compliance check silently — failure must not block the submit
    if (doc.content && !doc.content.startsWith('(Word document')) {
      try {
        const matchResult = await aiService.matchTemplate(doc.content);
        const docType = matchResult.best_match || 'general';
        const complianceResult = await aiService.checkCompliance(doc.content, docType);
        await supabase.from('documents')
          .update({ errors_flagged: complianceResult.issues })
          .eq('id', doc.id);
      } catch { /* AI service unavailable — skip */ }
    }

    return sendSuccess(res, data, 'Document submitted for review');
  } catch (err) { next(err); }
};

const escalate = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    if (doc.status !== 'pending_associate') {
      return next(createError(400, `Cannot escalate a document with status "${doc.status}"`));
    }

    const { escalation_reason } = req.body;
    if (!escalation_reason?.trim()) return next(createError(400, 'escalation_reason is required'));

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'pending_partner', reviewed_by: req.user.id, escalation_reason: escalation_reason.trim(), updated_at: now })
      .eq('id', doc.id)
      .select()
      .single();
    if (error) throw error;

    const { data: partners } = await supabase.from('users').select('id').eq('role', 'partner');
    if (partners?.length) {
      await Promise.all(partners.map(p => notifyDocumentStatus(p.id, doc.id, doc.title, 'pending_partner')));
    }
    return sendSuccess(res, data, 'Document escalated to partner');
  } catch (err) { next(err); }
};

const approve = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    const role = req.user.role;

    if (role === 'associate' && doc.status !== 'pending_associate') {
      return next(createError(400, `Cannot approve a document with status "${doc.status}"`));
    }
    if (role === 'partner' && doc.status !== 'pending_partner') {
      return next(createError(400, `Cannot approve a document with status "${doc.status}"`));
    }
    if (role !== 'associate' && role !== 'partner') {
      return next(createError(403, 'Forbidden'));
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'approved', reviewed_by: req.user.id, reviewed_at: now, updated_at: now })
      .eq('id', doc.id)
      .select()
      .single();
    if (error) throw error;

    await notifyDocumentStatus(doc.created_by, doc.id, doc.title, 'approved');
    return sendSuccess(res, data, 'Document approved');
  } catch (err) { next(err); }
};

const reject = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    const { role } = req.user;
    const { reviewer_comments } = req.body;

    if (!reviewer_comments?.trim()) return next(createError(400, 'reviewer_comments is required when rejecting'));

    const allowedFrom = { associate: 'pending_associate', partner: 'pending_partner' };
    if (doc.status !== allowedFrom[role]) {
      return next(createError(400, `A ${role} cannot reject a document with status "${doc.status}"`));
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'rejected', reviewed_by: req.user.id, reviewer_comments: reviewer_comments.trim(), reviewed_at: now, updated_at: now })
      .eq('id', doc.id)
      .select()
      .single();
    if (error) throw error;

    await notifyDocumentStatus(doc.created_by, doc.id, doc.title, 'rejected');
    return sendSuccess(res, data, 'Document rejected');
  } catch (err) { next(err); }
};

/**
 * PATCH /api/documents/:id/file
 * Associate flags an approved document as physically filed in court.
 */
const markFiled = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    if (doc.status !== 'approved') {
      return next(createError(400, `Cannot mark as filed — document status is "${doc.status}"`));
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'filed', updated_at: now })
      .eq('id', doc.id)
      .select()
      .single();
    if (error) throw error;

    await notifyDocumentStatus(doc.created_by, doc.id, doc.title, 'filed');
    return sendSuccess(res, data, 'Document marked as filed');
  } catch (err) { next(err); }
};

/**
 * PATCH /api/documents/:id/serve
 * Admin flags a filed document as served to the opponent.
 */
const markServed = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    if (doc.status !== 'filed') {
      return next(createError(400, `Cannot mark as served — document status is "${doc.status}"`));
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'served', updated_at: now })
      .eq('id', doc.id)
      .select()
      .single();
    if (error) throw error;

    await notifyDocumentStatus(doc.created_by, doc.id, doc.title, 'served');
    return sendSuccess(res, data, 'Document marked as served');
  } catch (err) { next(err); }
};

const checkCompliance = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    const level1 = ['intern', 'junior_associate', 'chambering'];
    if (level1.includes(req.user.role) && doc.created_by !== req.user.id) {
      return next(createError(403, 'Access denied'));
    }

    let { document_type } = req.body ?? {};
    if (!document_type) {
      const matchResult = await aiService.matchTemplate(doc.content);
      document_type = matchResult.best_match || 'general';
    }

    const complianceResult = await aiService.checkCompliance(doc.content, document_type);

    const { data, error } = await supabase
      .from('documents')
      .update({ errors_flagged: complianceResult.issues, updated_at: new Date().toISOString() })
      .eq('id', doc.id)
      .select()
      .single();
    if (error) throw error;

    return sendSuccess(
      res,
      { document: data, compliance: complianceResult },
      complianceResult.compliant ? 'Document passed compliance check' : 'Compliance issues found'
    );
  } catch (err) {
    if (err.message?.includes('AI service error') || err.cause?.code === 'ECONNREFUSED') {
      return next(createError(503, 'AI service is unavailable'));
    }
    next(err);
  }
};

const checkSimilarity = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    const level1 = ['intern', 'junior_associate', 'chambering'];
    if (level1.includes(req.user.role) && doc.created_by !== req.user.id) {
      return next(createError(403, 'Access denied'));
    }
    if (!doc.content || doc.content.startsWith('(Word document')) {
      return next(createError(400, 'Document text not available for similarity scoring'));
    }

    let { document_type } = req.body ?? {};
    if (!document_type) {
      const matchResult = await aiService.matchTemplate(doc.content);
      document_type = matchResult.best_match || 'general';
    }

    const result = await aiService.similarityCheckCompliance(doc.content, document_type);
    return sendSuccess(res, result);
  } catch (err) {
    if (err.message?.includes('AI service error') || err.cause?.code === 'ECONNREFUSED') {
      return next(createError(503, 'AI service is unavailable'));
    }
    next(err);
  }
};

const getEntities = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    const level1 = ['intern', 'junior_associate', 'chambering'];
    if (level1.includes(req.user.role) && doc.created_by !== req.user.id) {
      return next(createError(403, 'Access denied'));
    }
    if (!doc.content || doc.content.startsWith('(Word document')) {
      return next(createError(400, 'Document text not available for entity extraction'));
    }
    const result = await aiService.extractEntities(doc.content);
    return sendSuccess(res, result);
  } catch (err) {
    if (err.message?.includes('AI service error') || err.cause?.code === 'ECONNREFUSED') {
      return next(createError(503, 'AI service is unavailable'));
    }
    next(err);
  }
};

const classifyDocument = async (req, res, next) => {
  try {
    const doc = await fetchDocument(req.params.id);
    if (!doc.content || doc.content.startsWith('(Word document')) {
      return next(createError(400, 'Document text not available for classification'));
    }
    const result = await aiService.classifyDocument(doc.content);
    return sendSuccess(res, result);
  } catch (err) {
    if (err.message?.includes('AI service error') || err.cause?.code === 'ECONNREFUSED') {
      return next(createError(503, 'AI service is unavailable'));
    }
    next(err);
  }
};

module.exports = {
  getAll, getOne, create, update, reupload, download, remove,
  submit, escalate, approve, reject, markFiled, markServed, checkCompliance, checkSimilarity, getEntities, classifyDocument,
};
