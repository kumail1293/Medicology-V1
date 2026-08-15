// ============================================================================
// Bulk import templates.
//
// Generates a downloadable .xlsx workbook with two sheets:
//   • "Template" — every supported column as headers, one fully-filled
//     example row per question type (SBA, Best-of-five, True/False,
//     Assertion/Reason, EMQ, Image-based, Clinical vignette, Case-based),
//     then blank rows to fill in. The `type` query param filters the
//     example rows so admins can grab a per-type template.
//   • "Guide" — where to put what: column-by-column instructions, per-type
//     layout requirements, statuses, difficulty and FAQ.
// ============================================================================

import XLSX from 'xlsx';
import { QUESTION_TYPES } from '@workspace/db';

// Column order for the template (matches HEADER_ALIASES in importer.ts).
export const TEMPLATE_COLUMNS: { header: string; required: boolean; example: string; note: string }[] = [
  { header: 'Question Type', required: false, example: 'SBA', note: 'sba | best_of_five | true_false | assertion_reason | emq | image_based | clinical_vignette | case_based (blank = SBA)' },
  { header: 'QID', required: false, example: '', note: 'Optional. Leave blank to auto-generate. Format QID-MED-###########' },
  { header: 'Question', required: true, example: 'A 45-year-old man presents with crushing retrosternal chest pain…', note: 'The stem. Rich text (bold, lists) allowed.' },
  { header: 'Option A', required: true, example: 'Left anterior descending artery', note: 'Choice A. True/False: put True here.' },
  { header: 'Option B', required: true, example: 'Right coronary artery', note: 'Choice B. True/False: put False here.' },
  { header: 'Option C', required: false, example: 'Left circumflex artery', note: 'Choice C (required for 4–5 option MCQs).' },
  { header: 'Option D', required: false, example: 'Left main coronary artery', note: 'Choice D (required for 4–5 option MCQs).' },
  { header: 'Option E', required: false, example: '', note: 'Optional 5th choice.' },
  { header: 'Correct Answer', required: true, example: 'B', note: 'A–E, or True/False for true_false questions.' },
  { header: 'Assertion', required: false, example: '', note: 'Only for assertion_reason: the assertion statement.' },
  { header: 'Reason', required: false, example: '', note: 'Only for assertion_reason: the reason statement.' },
  { header: 'Explanation', required: false, example: 'Inferior wall MI is most commonly caused by RCA occlusion…', note: 'The full explanation (recommended).' },
  { header: 'Why Correct', required: false, example: '', note: 'Short “why this option is correct” line (exam engine).' },
  { header: 'Why Wrong', required: false, example: '', note: 'Short “why the distractors are wrong” line.' },
  { header: 'Exam Pearl', required: false, example: '', note: 'High-yield pearl shown after answering (💎).' },
  { header: 'Common Trap', required: false, example: '', note: 'Common misconception warning (⚠️).' },
  { header: 'Subject', required: true, example: 'Medicine', note: 'Must exist in the taxonomy (or auto-create if enabled).' },
  { header: 'System', required: false, example: 'Cardiovascular', note: 'Body system (taxonomy).' },
  { header: 'Topic', required: true, example: 'Ischemic Heart Disease', note: 'Topic (taxonomy).' },
  { header: 'Subtopic', required: false, example: 'Myocardial Infarction', note: 'Subtopic (taxonomy).' },
  { header: 'University / Exam', required: false, example: 'UHS', note: 'Exam body or university code (e.g. UHS, KMU, USMLE).' },
  { header: 'Exam Type', required: false, example: 'MBBS Final Year', note: 'Free-text exam label (legacy field).' },
  { header: 'Program', required: false, example: 'MBBS', note: 'Program (taxonomy).' },
  { header: 'Year', required: false, example: 'Final Year', note: 'Academic year (taxonomy).' },
  { header: 'Difficulty', required: false, example: 'medium', note: 'easy | medium | hard (blank = platform default).' },
  { header: 'Status', required: false, example: '', note: 'draft | pending_review | published (blank = import default; published may be forced to pending_review by settings).' },
  { header: 'Tags', required: false, example: 'cardiology, MI, emergency', note: 'Comma or semicolon separated.' },
  { header: 'Image URL', required: false, example: '', note: 'Optional image for image_based / any question.' },
  { header: 'References', required: false, example: '', note: 'Source book / reference.' },
];

// One example row per question type (values aligned with TEMPLATE_COLUMNS).
const EXAMPLE_ROWS: Record<string, string[]> = {
  sba: [
    'SBA', '', 'A 45-year-old man presents with crushing retrosternal chest pain radiating to the left arm. ECG shows ST-segment elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?',
    'Left anterior descending artery', 'Right coronary artery', 'Left circumflex artery', 'Left main coronary artery', '',
    'B', '', '', 'Inferior wall MI (ST elevation in II, III, aVF) is most commonly caused by occlusion of the right coronary artery (RCA), which supplies the inferior wall of the heart.',
    'RCA supplies the inferior wall — ST elevation in II, III, aVF points to RCA occlusion.',
    'The LAD supplies the anterior wall; LCx supplies the lateral wall.', 'Inferior MI = RCA until proven otherwise.', 'Never pick LAD for inferior wall ST elevation.',
    'Medicine', 'Cardiovascular', 'Ischemic Heart Disease', 'Myocardial Infarction', 'UHS', 'MBBS Final Year', 'MBBS', 'Final Year', 'medium', '', 'cardiology, MI, emergency', '', '',
  ],
  best_of_five: [
    'Best of Five', '', 'A 30-year-old woman with fatigue and weight gain. TSH is 12 mIU/L and free T4 is low. What is the most appropriate next step?',
    'Start levothyroxine', 'Repeat thyroid function tests in 6 weeks', 'Start carbimazole', 'Radioactive iodine ablation', 'Refer for thyroidectomy',
    'A', '', '', 'Overt hypothyroidism with a raised TSH and low free T4 is treated with levothyroxine replacement.',
    'Raised TSH + low free T4 = overt primary hypothyroidism → replace with levothyroxine.', 'Subclinical hypothyroidism (normal T4) would be rechecked, not treated here.', 'Overt hypothyroidism is treated, not observed.', 'Carbimazole is for hyperthyroidism.',
    'Medicine', 'Endocrine', 'Thyroid Disorders', 'Hypothyroidism', 'UHS', 'MBBS Final Year', 'MBBS', 'Final Year', 'easy', '', 'thyroid, hypothyroidism', '', '',
  ],
  true_false: [
    'True/False', '', 'The right coronary artery supplies the inferior wall of the heart.',
    'True', 'False', '', '', '', 'True', '', '', 'The RCA runs in the right atrioventricular groove and gives off the posterior descending artery, supplying the inferior wall.',
    '', '', '', '', 'Medicine', 'Cardiovascular', 'Ischemic Heart Disease', 'Myocardial Infarction', 'UHS', 'MBBS Final Year', 'MBBS', 'Final Year', 'medium', '', 'cardiology', '', '',
  ],
  assertion_reason: [
    'Assertion/Reason', '', 'Assertion: The RCA is the most common culprit in inferior wall myocardial infarction. Reason: The RCA supplies the inferior wall of the heart.',
    '', '', '', '', '', 'A', 'The RCA is the most common culprit in inferior wall myocardial infarction.', 'The RCA supplies the inferior wall of the heart.',
    'Both the assertion and the reason are true, and the reason correctly explains the assertion.',
    '', '', '', '', 'Medicine', 'Cardiovascular', 'Ischemic Heart Disease', 'Myocardial Infarction', 'UHS', 'MBBS Final Year', 'MBBS', 'Final Year', 'hard', '', '', '', '',
  ],
  emq: [
    'EMQ', '', 'For each patient below, choose the most likely diagnosis from the options.',
    'Pulmonary embolism', 'Acute myocardial infarction', 'Aortic dissection', 'Pneumothorax', 'Pericarditis',
    'A', '', '', 'A sudden tearing chest pain radiating to the back in a hypertensive patient is aortic dissection until proven otherwise.',
    '', '', '', '', 'Medicine', 'Cardiovascular', 'Vascular Disease', 'Aortic Dissection', 'UHS', 'MBBS Final Year', 'MBBS', 'Final Year', 'hard', '', 'aortic dissection', '', '',
  ],
  image_based: [
    'Image-Based', '', 'A 60-year-old smoker presents with a chest X-ray showing a 3 cm cavitating lesion in the right upper lobe. What is the most likely diagnosis?',
    'Tuberculosis', 'Lung abscess', 'Squamous cell carcinoma', 'Wegener granulomatosis', 'Aspergilloma',
    'C', '', '', 'Cavitating upper-lobe lesions in a smoker are most likely squamous cell carcinoma; TB is the key differential.',
    '', '', '', '', 'Medicine', 'Respiratory', 'Lung Tumours', 'Cavitating Lesions', 'UHS', 'MBBS Final Year', 'MBBS', 'Final Year', 'hard', '', 'lung, cavitation', 'https://example.com/cxr-cavity.jpg', '',
  ],
  clinical_vignette: [
    'Clinical Vignette', '', 'A 24-year-old medical student develops a pruritic, maculopapular rash on the hands after wearing latex gloves. Which hypersensitivity reaction is most likely?',
    'Type I', 'Type II', 'Type III', 'Type IV', '',
    'D', '', '', 'Contact dermatitis from latex is a type IV (delayed) hypersensitivity reaction mediated by T cells.',
    '', '', '', '', 'Medicine', 'Immunology', 'Hypersensitivity', 'Type IV Reactions', 'UHS', 'MBBS Final Year', 'MBBS', 'Final Year', 'easy', '', 'latex, dermatitis', '', '',
  ],
  case_based: [
    'Case-Based', '', 'A 55-year-old diabetic man is found unresponsive with a blood glucose of 28 mmol/L and ketones in the urine. After fluid resuscitation and insulin, which electrolyte should be monitored most closely?',
    'Sodium', 'Potassium', 'Calcium', 'Magnesium', 'Phosphate',
    'B', '', '', 'Insulin drives potassium intracellularly, so severe hypokalemia can develop during DKA treatment — potassium must be monitored and replaced.',
    '', '', '', '', 'Medicine', 'Endocrine', 'Diabetic Emergencies', 'DKA', 'UHS', 'MBBS Final Year', 'MBBS', 'Final Year', 'medium', '', 'DKA, potassium', '', '',
  ],
};

const TYPE_LABELS: Record<string, string> = {
  sba: 'Single Best Answer (SBA)',
  best_of_five: 'Best of Five',
  true_false: 'True / False',
  assertion_reason: 'Assertion / Reason',
  emq: 'Extended Matching (EMQ)',
  image_based: 'Image-Based',
  clinical_vignette: 'Clinical Vignette',
  case_based: 'Case-Based',
};

const GUIDE_ROWS: [string, string][] = [
  ['Medicology — Bulk Question Import Guide', ''],
  ['', ''],
  ['1. How to use this template', 'Fill one row per question. Keep the header row exactly as-is — the importer maps columns by header name (case/punctuation-insensitive). Delete the example rows before uploading, or keep them to see the format.'],
  ['', ''],
  ['2. Required columns', 'Question, Subject, Topic + whatever each type needs: 4–5 options + Correct Answer (A–E) for SBA/Best-of-five/EMQ/Image/Vignette/Case; Option A (True) + Option B (False) + True/False answer for True-False; Assertion + Reason + Correct Answer (A–E) for Assertion/Reason.'],
  ['', ''],
  ['3. Question Type values', QUESTION_TYPES.join(', ') + '. Friendly names are also accepted: "Single Best Answer", "MCQ", "True/False", "TF", "Assertion/Reason", "AR", "Extended Matching", "Image", "Clinical Vignette", "Case-Based". Blank = SBA.'],
  ['', ''],
  ['4. Correct Answer', 'Use the option LETTER (A–E) for standard MCQs and Assertion/Reason. For True/False use True or False (T/F also accepted).'],
  ['', ''],
  ['5. Taxonomy columns', 'Subject and Topic are required; System, Subtopic, University/Exam, Program and Year are optional. Names must match existing taxonomy entries, or enable "auto-create missing subjects/topics" during import.'],
  ['', ''],
  ['6. Status', 'Leave blank to use the admin default (pending_review by default). If the platform requires review before publishing, any "published" status is downgraded to pending_review — imported questions always pass through the Review Queue.'],
  ['', ''],
  ['7. Structured explanations (optional)', 'Why Correct, Why Wrong, Exam Pearl and Common Trap feed the exam engine\'s feedback panel after answering.'],
  ['', ''],
  ['8. Images', 'Put the image URL in the Image URL column (e.g. /api/storage/uploads/xxx.png or a full https URL).'],
  ['', ''],
  ['9. After importing', 'Rows that pass validation are inserted with the configured status. You can edit any imported question with the full question editor from Admin → Questions → Review Queue before it is published.'],
  ['', ''],
  ['10. QIDs', 'Leave blank to auto-generate. If you supply QIDs they must be unique and follow QID-MED-###########.'],
];

export function buildImportTemplateWorkbook(type?: string): Buffer {
  const selected = type && QUESTION_TYPES.includes(type as any) ? type : undefined;

  const templateRows: any[] = [TEMPLATE_COLUMNS.map((c) => c.header)];
  for (const t of QUESTION_TYPES) {
    if (selected && t !== selected) continue;
    const example = EXAMPLE_ROWS[t] ?? [];
    // Pad/trim to column width so every row lines up with the headers.
    const padded = TEMPLATE_COLUMNS.map((_, i) => example[i] ?? '');
    templateRows.push(padded);
  }
  // A few blank rows to fill in.
  for (let i = 0; i < 5; i++) templateRows.push(TEMPLATE_COLUMNS.map(() => ''));

  const templateSheet = XLSX.utils.aoa_to_sheet(templateRows);
  templateSheet['!cols'] = TEMPLATE_COLUMNS.map((c) => ({ wch: Math.max(c.header.length + 2, 18) }));

  const guideSheet = XLSX.utils.aoa_to_sheet(GUIDE_ROWS);
  guideSheet['!cols'] = [{ wch: 45 }, { wch: 110 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, templateSheet, 'Template');
  XLSX.utils.book_append_sheet(wb, guideSheet, 'Guide');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export { TYPE_LABELS };
