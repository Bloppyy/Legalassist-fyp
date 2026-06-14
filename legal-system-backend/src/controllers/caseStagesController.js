const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');
const { uploadFile, getSignedUrl, deleteFile } = require('../services/storageService');
const aiService = require('../services/aiService');
const { extractTextFromDocx, extractTextFromPdf } = require('../utils/extractText');

const BUCKET = 'court-directions';

// ---------------------------------------------------------------------------
// GET /api/case-stages?case_id=:id
// ---------------------------------------------------------------------------

const getAll = async (req, res, next) => {
  try {
    const { case_id, upcoming_days } = req.query;
    if (!case_id && !upcoming_days) return next(createError(400, 'case_id or upcoming_days is required'));

    let query = supabase
      .from('case_stages')
      .select('*, recorder:users!case_stages_recorded_by_fkey(id, name), case_file:case_files!case_stages_case_id_fkey(id, case_number, client_name)');

    if (upcoming_days) {
      const today = new Date().toISOString().split('T')[0];
      const future = new Date();
      future.setDate(future.getDate() + parseInt(upcoming_days, 10));
      const futureStr = future.toISOString().split('T')[0];
      query = query
        .gte('stage_date', today).lte('stage_date', futureStr)
        .eq('is_completed', false)
        .order('stage_date', { ascending: true })
        .order('created_at', { ascending: true });
    } else {
      query = query
        .eq('case_id', case_id)
        .order('stage_date', { ascending: false })
        .order('created_at', { ascending: true });
    }

    const { data, error } = await query;
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
    const { case_id, stage_type, title, stage_date, court_name, next_court_date,
            directions, direction_source, is_completed, ai_parsed, confidence } = req.body;

    const { data, error } = await supabase
      .from('case_stages')
      .insert({
        case_id,
        stage_type,
        title,
        stage_date,
        court_name: court_name || null,
        next_court_date: next_court_date || null,
        directions: directions || null,
        direction_source: direction_source || null,
        is_completed: is_completed ?? false,
        ai_parsed: ai_parsed ?? false,
        confidence: confidence ?? null,
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

    const { stage_type, title, stage_date, court_name, next_court_date,
            directions, direction_source } = req.body;

    const { data, error } = await supabase
      .from('case_stages')
      .update({
        stage_type, title, stage_date,
        court_name: court_name || null,
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
    const { caseId } = req.params;

    const { data: caseFile, error: caseError } = await supabase
      .from('case_files')
      .select('id')
      .eq('id', caseId)
      .single();

    if (caseError || !caseFile) return next(createError(404, 'Case not found'));

    let text = '';
    let storagePath = null;
    let fileName = null;

    if (req.file) {
      // File upload path — extract text from Word/PDF
      const mime = req.file.mimetype;
      if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          || mime === 'application/msword') {
        text = await extractTextFromDocx(req.file.buffer);
      } else if (mime === 'application/pdf') {
        text = await extractTextFromPdf(req.file.buffer);
      }
      if (!text) return next(createError(422, 'Could not extract text from file'));

      storagePath = `${Date.now()}_${req.file.originalname}`;
      await uploadFile(BUCKET, storagePath, req.file.buffer, mime);
      fileName = req.file.originalname;
    } else if (req.body?.text?.trim()) {
      // OCR text path — text sent directly from mobile camera scan
      text = req.body.text.trim();
    } else {
      return next(createError(400, 'Arahan file or text is required'));
    }

    const parsed = await aiService.parseDirection(text);

    return sendSuccess(res, {
      ...parsed,
      file_url: storagePath,
      file_name: fileName,
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

// ---------------------------------------------------------------------------
// GET /api/case-stages/stats — admin only, AI parser evaluation metrics
// ---------------------------------------------------------------------------

const getStats = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('case_stages')
      .select('ai_parsed, confidence, next_court_date, directions');

    if (error) throw error;

    const total = data.length;
    const aiParsed = data.filter(s => s.ai_parsed).length;
    const manual = total - aiParsed;
    const withConfidence = data.filter(s => s.confidence != null);
    const avgConfidence = withConfidence.length
      ? withConfidence.reduce((sum, s) => sum + s.confidence, 0) / withConfidence.length
      : null;
    const withNextDate = data.filter(s => s.next_court_date != null).length;
    const withDirections = data.filter(s => s.directions && s.directions.trim()).length;

    return sendSuccess(res, {
      total,
      ai_parsed: aiParsed,
      manual,
      ai_parsed_pct: total > 0 ? Math.round((aiParsed / total) * 100) : 0,
      avg_confidence: avgConfidence != null ? Math.round(avgConfidence * 100) / 100 : null,
      with_next_court_date: withNextDate,
      with_directions: withDirections,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, create, update, remove, toggleComplete, parseDirection, download, getStats };
