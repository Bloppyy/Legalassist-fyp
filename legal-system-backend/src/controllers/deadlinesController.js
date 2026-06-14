const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');

const WITH_RELATIONS = `
  *,
  case_file:case_files(id, case_number, client_name),
  creator:users!created_by(id, name, role)
`;

const getAll = async (req, res, next) => {
  try {
    const { case_id, upcoming, category } = req.query;

    let query = supabase
      .from('firm_deadlines')
      .select(WITH_RELATIONS)
      .order('deadline_date', { ascending: true });

    if (case_id) query = query.eq('case_id', case_id);
    if (category) query = query.eq('category', category);
    if (upcoming === 'true') {
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

const getOne = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('firm_deadlines')
      .select(WITH_RELATIONS)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return next(createError(404, 'Firm deadline not found'));
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { title, court_name, deadline_date, case_id, remarks,
            category, buffer_days, actual_deadline_date } = req.body;

    const { data, error } = await supabase
      .from('firm_deadlines')
      .insert({
        title,
        court_name: court_name || null,
        deadline_date,
        case_id: case_id || null,
        remarks: remarks || null,
        category: category || null,
        buffer_days: buffer_days || null,
        actual_deadline_date: actual_deadline_date || null,
        created_by: req.user.id,
        is_completed: false,
      })
      .select(WITH_RELATIONS)
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Firm deadline created', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('firm_deadlines')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Firm deadline not found'));

    const { title, court_name, deadline_date, case_id, remarks,
            is_completed, category, buffer_days, actual_deadline_date } = req.body;

    const { data, error } = await supabase
      .from('firm_deadlines')
      .update({
        title, court_name, deadline_date, case_id,
        remarks, is_completed, category,
        buffer_days: buffer_days ?? null,
        actual_deadline_date: actual_deadline_date || null,
      })
      .eq('id', req.params.id)
      .select(WITH_RELATIONS)
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Firm deadline updated');
  } catch (err) {
    next(err);
  }
};

const toggleComplete = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('firm_deadlines')
      .select('id, is_completed')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Firm deadline not found'));

    const { data, error } = await supabase
      .from('firm_deadlines')
      .update({ is_completed: !existing.is_completed })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, data, `Deadline marked ${data.is_completed ? 'completed' : 'incomplete'}`);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('firm_deadlines')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Firm deadline not found'));

    const { error } = await supabase.from('firm_deadlines').delete().eq('id', req.params.id);
    if (error) throw error;
    return sendSuccess(res, null, 'Firm deadline deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, toggleComplete, remove };
