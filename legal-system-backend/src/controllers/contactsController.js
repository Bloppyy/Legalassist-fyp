const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');

/**
 * GET /api/contacts
 * Shared directory — all roles can view.
 * Supports ?search= (name, email, phone, address) and ?state=
 */
const getAll = async (req, res, next) => {
  try {
    const { search, state } = req.query;

    let query = supabase
      .from('contacts')
      .select('*')
      .order('name', { ascending: true });

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%`
      );
    }

    if (state) {
      query = query.eq('state', state);
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/contacts/:id
 */
const getOne = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return next(createError(404, 'Contact not found'));

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/contacts
 * Associate, partner, admin only — interns use the directory but don't manage it.
 */
const create = async (req, res, next) => {
  try {
    const { name, job_title, phone, email, address, state, notes } = req.body;

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        name,
        job_title,
        phone,
        email: email || null,
        address: address || null,
        state: state || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Contact created', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/contacts/:id
 * Associate, partner, admin only.
 */
const update = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Contact not found'));

    const { name, job_title, phone, email, address, state, notes } = req.body;

    const { data, error } = await supabase
      .from('contacts')
      .update({ name, job_title, phone, email, address, state, notes, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Contact updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/contacts/:id
 * Partner, admin only.
 */
const remove = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Contact not found'));

    const { error } = await supabase.from('contacts').delete().eq('id', req.params.id);
    if (error) throw error;

    return sendSuccess(res, null, 'Contact deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, remove };
