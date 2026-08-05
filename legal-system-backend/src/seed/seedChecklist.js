require('dotenv').config();
const supabase = require('../config/supabase');

const TEMPLATES = [
  {
    name: 'Standard Civil Suit (Plaintiff)',
    description: 'Standard steps for a plaintiff civil suit in Malaysian courts — from first client meeting to file closure. Based on actual firm workflow.',
    items: [
      { order_index: 1,  title: 'First Client Meeting & Open File',                                         expected_role: 'associate' },
      { order_index: 2,  title: 'Send Letter of Demand',                                                    expected_role: 'associate' },
      { order_index: 3,  title: 'File Writ of Summons + Statement of Claim',                               expected_role: 'associate' },
      { order_index: 4,  title: '1st Case Management (await direction)',                                    expected_role: 'associate' },
      { order_index: 5,  title: 'Await Memorandum of Appearance / Draft & File Defence direction received', expected_role: null },
      { order_index: 6,  title: 'Serve Filed Document (email + hand/courier)',                              expected_role: 'associate' },
      { order_index: 7,  title: '2nd Case Management — File Reply to Defence (if required)',                expected_role: 'associate' },
      { order_index: 8,  title: '3rd Case Management — Pre-Trial Bundle Direction Received ("pliding ditutup")', expected_role: 'associate' },
      { order_index: 9,  title: 'Compile Pre-Trial Bundles (Pleadings, Documents Parts A/B/C, Agreed Facts, Issues to be Tried, List of Witnesses)', expected_role: 'associate' },
      { order_index: 10, title: 'Draft & File Witness Statements',                                         expected_role: 'associate' },
      { order_index: 11, title: 'Trial Dates Fixed',                                                       expected_role: null },
      { order_index: 12, title: 'Trial',                                                                   expected_role: 'associate' },
      { order_index: 13, title: 'Await Court Decision',                                                    expected_role: null },
      { order_index: 14, title: 'File Order of Court (if won) / Assess Appeal (if lost)',                  expected_role: 'associate' },
      { order_index: 15, title: 'Execute Order / Close File',                                              expected_role: 'associate' },
    ],
  },
  {
    name: 'Standard Civil Suit (Defendant)',
    description: 'Standard steps for a defendant civil suit in Malaysian courts — from receiving the writ to file closure. Based on actual firm workflow.',
    items: [
      { order_index: 1,  title: 'First Client Meeting & Open File',                                                    expected_role: 'associate' },
      { order_index: 2,  title: 'File Memorandum of Appearance (within 14 days of being served)',                      expected_role: 'associate' },
      { order_index: 3,  title: '1st Case Management (await direction for Defence)',                                   expected_role: 'associate' },
      { order_index: 4,  title: 'Draft & File Defence (14 days from direction)',                                       expected_role: 'associate' },
      { order_index: 5,  title: 'Serve Defence on Plaintiff (email + hand/courier, same day as filing)',               expected_role: 'associate' },
      { order_index: 6,  title: '2nd Case Management (await further directions)',                                      expected_role: 'associate' },
      { order_index: 7,  title: '3rd Case Management — Pre-Trial Bundle Direction Received ("pliding ditutup")',       expected_role: 'associate' },
      { order_index: 8,  title: 'Compile Pre-Trial Bundles (Pleadings, Documents Parts A/B/C, Agreed Facts, Issues to be Tried, List of Witnesses)', expected_role: 'associate' },
      { order_index: 9,  title: 'Draft & File Witness Statements',                                                    expected_role: 'associate' },
      { order_index: 10, title: 'Trial Dates Fixed',                                                                  expected_role: null },
      { order_index: 11, title: 'Trial',                                                                              expected_role: 'associate' },
      { order_index: 12, title: 'Await Court Decision',                                                               expected_role: null },
      { order_index: 13, title: 'File Order of Court (if won) / Assess Appeal (if lost)',                             expected_role: 'associate' },
      { order_index: 14, title: 'Execute Order / Close File',                                                         expected_role: 'associate' },
    ],
  },
  {
    name: 'Trial Bundle Checklist',
    description: 'Documents that must be physically compiled and ready before trial — applied separately from the main case progression checklist.',
    items: [
      { order_index: 1, title: 'Bundle of Pleadings',                                        expected_role: 'associate' },
      { order_index: 2, title: 'Agreed Facts',                                               expected_role: 'associate' },
      { order_index: 3, title: 'Issues to be Tried',                                         expected_role: 'associate' },
      { order_index: 4, title: 'Summary of Case',                                            expected_role: 'associate' },
      { order_index: 5, title: 'Common Bundle of Documents (Part A)',                        expected_role: 'associate' },
      { order_index: 6, title: 'Common Bundle of Documents (Part B)',                        expected_role: 'associate' },
      { order_index: 7, title: 'Common Bundle of Documents (Part C)',                        expected_role: 'associate' },
      { order_index: 8, title: 'List of Witnesses',                                          expected_role: 'associate' },
      { order_index: 9, title: 'Witness Statements (per witness — add dynamically per case)', expected_role: 'associate' },
    ],
  },
];

async function seedTemplate(tpl) {
  const { data: existing } = await supabase
    .from('checklist_templates')
    .select('id')
    .eq('name', tpl.name)
    .maybeSingle();

  if (existing) {
    console.log(`  "${tpl.name}" already exists — skipping.`);
    return;
  }

  const { data: template, error: tErr } = await supabase
    .from('checklist_templates')
    .insert({ name: tpl.name, description: tpl.description })
    .select()
    .single();

  if (tErr) { console.error(`  Failed to create "${tpl.name}":`, tErr.message); process.exit(1); }

  const items = tpl.items.map(item => ({ ...item, template_id: template.id }));
  const { error: iErr } = await supabase.from('checklist_template_items').insert(items);
  if (iErr) { console.error(`  Failed to insert items for "${tpl.name}":`, iErr.message); process.exit(1); }

  console.log(`  Created "${tpl.name}" with ${items.length} items (id: ${template.id})`);
}

async function run() {
  console.log('Seeding checklist templates…');
  for (const tpl of TEMPLATES) await seedTemplate(tpl);
  console.log('Done.');
}

run();
