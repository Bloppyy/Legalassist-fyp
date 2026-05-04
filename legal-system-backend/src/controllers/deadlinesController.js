const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');

const WITH_RELATIONS = `
  *,
  case_file:case_files(id, case_number, client_name),
  creator:users!court_deadlines_created_by_fkey(id, name, role)
`;

/**
 * GET /api/deadlines
 * All authenticated users can view court deadlines.
 * Supports ?case_id= and ?upcoming=true (deadline_date >= today).
 */
const getAll = async (req, res, next) => {
  try {
    const { case_id, upcoming } = req.query;

    let query = supabase
      .from('court_deadlines')
      .select(WITH_RELATIONS)
      .order('deadline_date', { ascending: true });

    if (case_id) {
      query = query.eq('case_id', case_id);
    }

    if (upcoming === 'true') {
      // deadline_date is a DATE column — compare against today's date string
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('deadline_date', today);
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/deadlines/:id
 */
const getOne = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('court_deadlines')
      .select(WITH_RELATIONS)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return next(createError(404, 'Court deadline not found'));

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/deadlines
 * Any authenticated user can create a court deadline.
 */
const create = async (req, res, next) => {
  try {
    const { title, court_name, deadline_date, case_id, court_directions } = req.body;

    const { data, error } = await supabase
      .from('court_deadlines')
      .insert({
        title,
        court_name,
        deadline_date,
        case_id: case_id || null,
        court_directions: court_directions || null,
        created_by: req.user.id,
        is_completed: false,
      })
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Court deadline created', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/deadlines/:id
 * Update a court deadline.
 */
const update = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('court_deadlines')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Court deadline not found'));

    const { title, court_name, deadline_date, case_id, court_directions, is_completed } = req.body;

    const { data, error } = await supabase
      .from('court_deadlines')
      .update({ title, court_name, deadline_date, case_id, court_directions, is_completed })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Court deadline updated');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/deadlines/:id/toggle-complete
 * Quickly toggle is_completed without sending the full record.
 */
const toggleComplete = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('court_deadlines')
      .select('id, is_completed')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Court deadline not found'));

    const { data, error } = await supabase
      .from('court_deadlines')
      .update({ is_completed: !existing.is_completed })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, data, `Deadline marked as ${data.is_completed ? 'completed' : 'incomplete'}`);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/deadlines/:id
 */
const remove = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('court_deadlines')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Court deadline not found'));

    const { error } = await supabase.from('court_deadlines').delete().eq('id', req.params.id);
    if (error) throw error;

    return sendSuccess(res, null, 'Court deadline deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, toggleComplete, remove };
