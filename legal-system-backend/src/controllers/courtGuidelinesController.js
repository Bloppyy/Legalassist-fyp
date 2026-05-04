const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');
const { uploadFile, getSignedUrl, deleteFile } = require('../services/storageService');

const BUCKET = 'guidelines';

const VALID_CATEGORIES = ['court_filing_website', 'case_management', 'payment_for_filing', 'file_new_cases', 'other'];

/**
 * GET /api/court-guidelines
 * All roles can read. Supports ?state= and ?category= filters.
 */
const getAll = async (req, res, next) => {
  try {
    const { state, category } = req.query;

    let query = supabase
      .from('court_guidelines')
      .select('*')
      .order('order_index', { ascending: true });

    if (state) query = query.eq('state', state);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/court-guidelines/:id
 */
const getOne = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('court_guidelines')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return next(createError(404, 'Court guideline not found'));

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/court-guidelines/:id/download — signed URL for the PDF
 */
const download = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('court_guidelines')
      .select('file_url, file_name')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return next(createError(404, 'Court guideline not found'));
    if (!data.file_url) return next(createError(404, 'No file attached to this guideline'));

    const url = await getSignedUrl(BUCKET, data.file_url);
    return sendSuccess(res, { url, file_name: data.file_name });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/court-guidelines — admin only
 * Accepts multipart: title, content (optional when file provided), category, state, registry_url, order_index, file (PDF)
 */
const create = async (req, res, next) => {
  try {
    const { title, content, category, state, registry_url, order_index } = req.body;
    let fileUrl = null;
    let fileName = null;

    if (req.file) {
      const path = `${Date.now()}_${req.file.originalname}`;
      await uploadFile(BUCKET, path, req.file.buffer, req.file.mimetype);
      fileUrl = path;
      fileName = req.file.originalname;
    }

    const { data, error } = await supabase
      .from('court_guidelines')
      .insert({
        title,
        content: content || '',
        category: category || null,
        state: state || null,
        registry_url: registry_url || null,
        order_index: order_index ?? 0,
        file_url: fileUrl,
        file_name: fileName,
      })
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Court guideline created', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/court-guidelines/:id — admin only
 */
const update = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('court_guidelines')
      .select('id, file_url')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Court guideline not found'));

    const { title, content, category, state, registry_url, order_index } = req.body;
    let fileUrl = existing.file_url;
    let fileName = undefined;

    if (req.file) {
      if (existing.file_url) await deleteFile(BUCKET, existing.file_url);
      const path = `${Date.now()}_${req.file.originalname}`;
      await uploadFile(BUCKET, path, req.file.buffer, req.file.mimetype);
      fileUrl = path;
      fileName = req.file.originalname;
    }

    const updatePayload = { title, content, category, state, registry_url, order_index, file_url: fileUrl, updated_at: new Date().toISOString() };
    if (fileName !== undefined) updatePayload.file_name = fileName;

    const { data, error } = await supabase
      .from('court_guidelines')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Court guideline updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/court-guidelines/:id — admin only
 */
const remove = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('court_guidelines')
      .select('id, file_url')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Court guideline not found'));

    if (existing.file_url) await deleteFile(BUCKET, existing.file_url);

    const { error } = await supabase.from('court_guidelines').delete().eq('id', req.params.id);
    if (error) throw error;

    return sendSuccess(res, null, 'Court guideline deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, download, create, update, remove };
