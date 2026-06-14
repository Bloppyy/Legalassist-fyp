/**
 * Seeds the default "Standard Civil Suit (Plaintiff)" checklist template.
 * Safe to re-run — skips creation if the template already exists by name.
 *
 * Usage:
 *   node src/seed/seedChecklist.js
 */

require('dotenv').config();
const supabase = require('../config/supabase');

const TEMPLATE_NAME = 'Standard Civil Suit (Plaintiff)';

const ITEMS = [
  { order_index: 1,  title: 'Send Letter of Demand',                          expected_role: 'associate' },
  { order_index: 2,  title: 'File Writ of Summons + Statement of Claim',      expected_role: 'associate' },
  { order_index: 3,  title: 'Serve Writ on Defendant',                        expected_role: 'associate' },
  { order_index: 4,  title: 'Receive Memorandum of Appearance',               expected_role: null },
  { order_index: 5,  title: 'Receive Defence',                                expected_role: null },
  { order_index: 6,  title: 'File Reply to Defence (if needed)',              expected_role: 'associate' },
  { order_index: 7,  title: 'Attend Case Management',                         expected_role: 'associate' },
  { order_index: 8,  title: 'Exchange Documents (Discovery)',                  expected_role: 'associate' },
  { order_index: 9,  title: 'File Witness Statements',                        expected_role: 'associate' },
  { order_index: 10, title: 'Pre-Trial Case Management',                      expected_role: 'associate' },
  { order_index: 11, title: 'Trial',                                          expected_role: 'associate' },
  { order_index: 12, title: 'Judgment',                                       expected_role: null },
  { order_index: 13, title: 'Post-judgment actions (execution/appeal assessment)', expected_role: 'associate' },
];

async function run() {
  console.log('Seeding default checklist template…');

  // Check if already seeded
  const { data: existing } = await supabase
    .from('checklist_templates')
    .select('id')
    .eq('name', TEMPLATE_NAME)
    .maybeSingle();

  if (existing) {
    console.log(`Template "${TEMPLATE_NAME}" already exists (id: ${existing.id}) — skipping.`);
    return;
  }

  // Insert template
  const { data: template, error: tErr } = await supabase
    .from('checklist_templates')
    .insert({
      name: TEMPLATE_NAME,
      description: 'Standard steps for a plaintiff civil suit in Malaysian courts (Mahkamah Majistret / Sesyen / Tinggi).',
    })
    .select()
    .single();

  if (tErr) { console.error('Failed to create template:', tErr.message); process.exit(1); }
  console.log(`Created template: ${template.id}`);

  // Insert items
  const items = ITEMS.map(item => ({ ...item, template_id: template.id }));
  const { error: iErr } = await supabase.from('checklist_template_items').insert(items);
  if (iErr) { console.error('Failed to insert items:', iErr.message); process.exit(1); }

  console.log(`Inserted ${items.length} checklist items.`);
  console.log('Done.');
}

run();
