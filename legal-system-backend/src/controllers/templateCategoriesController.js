const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');

/**
 * GET /api/template-categories
 * All roles can read.
 */
const getAll = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('template_categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/template-categories/:id
 * Includes all templates in that category.
 */
const getOne = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('template_categories')
      .select('*, templates(id, title, instructions, created_at)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return next(createError(404, 'Template category not found'));

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/template-categories
 * Admin only.
 */
const create = async (req, res, next) => {
  try {
    const { name } = req.body;

    const { data, error } = await supabase
      .from('template_categories')
      .insert({ name })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return next(createError(409, 'Category name already exists'));
      throw error;
    }

    return sendSuccess(res, data, 'Template category created', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/template-categories/:id
 * Admin only.
 */
const update = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('template_categories')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Template category not found'));

    const { name } = req.body;

    const { data, error } = await supabase
      .from('template_categories')
      .update({ name })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return next(createError(409, 'Category name already exists'));
      throw error;
    }

    return sendSuccess(res, data, 'Template category updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/template-categories/:id
 * Admin only. Templates in this category will have category_id set to null (ON DELETE SET NULL).
 */
const remove = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('template_categories')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Template category not found'));

    const { error } = await supabase.from('template_categories').delete().eq('id', req.params.id);
    if (error) throw error;

    return sendSuccess(res, null, 'Template category deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, remove };
