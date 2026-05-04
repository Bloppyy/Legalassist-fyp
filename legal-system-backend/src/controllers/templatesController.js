const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');
const { uploadFile, getSignedUrl, deleteFile } = require('../services/storageService');

const BUCKET = 'templates';

const WITH_RELATIONS = `
  *,
  category:template_categories(id, name),
  creator:users!templates_created_by_fkey(id, name, role)
`;

const getAll = async (req, res, next) => {
  try {
    const { category_id, search } = req.query;
    let query = supabase.from('templates').select(WITH_RELATIONS).order('created_at', { ascending: false });
    if (category_id) query = query.eq('category_id', category_id);
    if (search) query = query.ilike('title', `%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return sendSuccess(res, data);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('templates').select(WITH_RELATIONS).eq('id', req.params.id).single();
    if (error || !data) return next(createError(404, 'Template not found'));
    return sendSuccess(res, data);
  } catch (err) { next(err); }
};

/**
 * GET /api/templates/:id/download — signed URL for the Word file
 */
const download = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('templates').select('file_url, file_name').eq('id', req.params.id).single();
    if (error || !data) return next(createError(404, 'Template not found'));
    if (!data.file_url) return next(createError(404, 'No file attached to this template'));
    const url = await getSignedUrl(BUCKET, data.file_url);
    return sendSuccess(res, { url, file_name: data.file_name });
  } catch (err) { next(err); }
};

/**
 * POST /api/templates — accepts multipart: title, category_id, instructions, file (.docx)
 */
const create = async (req, res, next) => {
  try {
    const { title, category_id, instructions, content } = req.body;
    let fileUrl = null;
    let fileName = null;

    if (req.file) {
      const path = `${Date.now()}_${req.file.originalname}`;
      await uploadFile(BUCKET, path, req.file.buffer, req.file.mimetype);
      fileUrl = path;
      fileName = req.file.originalname;
    }

    const { data, error } = await supabase
      .from('templates')
      .insert({
        title,
        content: content || '',
        category_id: category_id || null,
        instructions: instructions || null,
        file_url: fileUrl,
        file_name: fileName,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Template created', 201);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from('templates').select('id, file_url').eq('id', req.params.id).single();
    if (fetchError || !existing) return next(createError(404, 'Template not found'));

    const { title, content, category_id, instructions } = req.body;
    let fileUrl = existing.file_url;
    let fileName = undefined;

    if (req.file) {
      if (existing.file_url) await deleteFile(BUCKET, existing.file_url);
      const path = `${Date.now()}_${req.file.originalname}`;
      await uploadFile(BUCKET, path, req.file.buffer, req.file.mimetype);
      fileUrl = path;
      fileName = req.file.originalname;
    }

    const updatePayload = { title, content, category_id, instructions, file_url: fileUrl, updated_at: new Date().toISOString() };
    if (fileName !== undefined) updatePayload.file_name = fileName;

    const { data, error } = await supabase.from('templates').update(updatePayload).eq('id', req.params.id).select().single();
    if (error) throw error;
    return sendSuccess(res, data, 'Template updated');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from('templates').select('id, file_url').eq('id', req.params.id).single();
    if (fetchError || !existing) return next(createError(404, 'Template not found'));
    if (existing.file_url) await deleteFile(BUCKET, existing.file_url);
    const { error } = await supabase.from('templates').delete().eq('id', req.params.id);
    if (error) throw error;
    return sendSuccess(res, null, 'Template deleted');
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, download, create, update, remove };
