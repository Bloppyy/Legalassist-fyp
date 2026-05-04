const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');
const { uploadFile, getSignedUrl, deleteFile } = require('../services/storageService');
const aiService = require('../services/aiService');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const BUCKET = 'court-directions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const extractTextFromDocx = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch { return ''; }
};

const extractTextFromPdf = async (buffer) => {
  try {
    const result = await pdfParse(buffer);
    return result.text.trim();
  } catch { return ''; }
};

// ---------------------------------------------------------------------------
// GET /api/case-stages?case_id=:id
// ---------------------------------------------------------------------------

const getAll = async (req, res, next) => {
  try {
    const { case_id } = req.query;
    if (!case_id) return next(createError(400, 'case_id is required'));

    const { data, error } = await supabase
      .from('case_stages')
      .select('*, recorder:users!case_stages_recorded_by_fkey(id, name)')
      .eq('case_id', case_id)
      .order('stage_date', { ascending: false });

    if (error) throw error;
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/case-stages
// ---------------------------------------------------------------------------

const create = async (req, res, next) => {
  try {
    const { case_id, stage_type, title, stage_date, next_court_date,
            directions, direction_source, is_completed, ai_parsed } = req.body;

    const { data, error } = await supabase
      .from('case_stages')
      .insert({
        case_id,
        stage_type,
        title,
        stage_date,
        next_court_date: next_court_date || null,
        directions: directions || null,
        direction_source: direction_source || null,
        is_completed: is_completed ?? false,
        ai_parsed: ai_parsed ?? false,
        recorded_by: req.user.id,
      })
      .select('*, recorder:users!case_stages_recorded_by_fkey(id, name)')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Stage created', 201);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/case-stages/:id
// ---------------------------------------------------------------------------

const update = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('case_stages')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Stage not found'));

    const { stage_type, title, stage_date, next_court_date,
            directions, direction_source } = req.body;

    const { data, error } = await supabase
      .from('case_stages')
      .update({
        stage_type, title, stage_date,
        next_court_date: next_court_date || null,
        directions: directions || null,
        direction_source: direction_source || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*, recorder:users!case_stages_recorded_by_fkey(id, name)')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Stage updated');
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/case-stages/:id
// ---------------------------------------------------------------------------

const remove = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('case_stages')
      .select('id, file_url')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Stage not found'));

    if (existing.file_url) await deleteFile(BUCKET, existing.file_url);

    const { error } = await supabase.from('case_stages').delete().eq('id', req.params.id);
    if (error) throw error;

    return sendSuccess(res, null, 'Stage deleted');
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/case-stages/:id/complete  — toggle is_completed
// ---------------------------------------------------------------------------

const toggleComplete = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('case_stages')
      .select('id, is_completed')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Stage not found'));

    const { data, error } = await supabase
      .from('case_stages')
      .update({ is_completed: !existing.is_completed, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/case-stages/:caseId/parse-direction
// Upload arahan → extract text → AI parse → return pre-filled data (no save)
// ---------------------------------------------------------------------------

const parseDirection = async (req, res, next) => {
  try {
    if (!req.file) return next(createError(400, 'Arahan file is required'));

    const { caseId } = req.params;

    // Verify case exists
    const { data: caseFile, error: caseError } = await supabase
      .from('case_files')
      .select('id')
      .eq('id', caseId)
      .single();

    if (caseError || !caseFile) return next(createError(404, 'Case not found'));

    // Extract text based on file type — reuse mammoth pattern from documents flow
    const mime = req.file.mimetype;
    let text = '';

    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || mime === 'application/msword') {
      text = await extractTextFromDocx(req.file.buffer);
    } else if (mime === 'application/pdf') {
      text = await extractTextFromPdf(req.file.buffer);
    }

    if (!text) return next(createError(422, 'Could not extract text from file'));

    // Upload file to court-directions bucket
    const storagePath = `${Date.now()}_${req.file.originalname}`;
    await uploadFile(BUCKET, storagePath, req.file.buffer, mime);

    // Send to AI parser
    const parsed = await aiService.parseDirection(text);

    return sendSuccess(res, {
      ...parsed,
      file_url: storagePath,
      file_name: req.file.originalname,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/case-stages/:id/download — signed URL for arahan file
// ---------------------------------------------------------------------------

const download = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('case_stages')
      .select('file_url, file_name')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return next(createError(404, 'Stage not found'));
    if (!data.file_url) return next(createError(404, 'No file attached to this stage'));

    const url = await getSignedUrl(BUCKET, data.file_url);
    return sendSuccess(res, { url, file_name: data.file_name });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, create, update, remove, toggleComplete, parseDirection, download };
