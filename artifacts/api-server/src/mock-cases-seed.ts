// Realistic clinical reasoning cases for the Clinical Cases feature.
// Author-authored content covering the major clinical systems; the admin can
// add/edit these later from the admin panel.

export interface SeedClinicalCase {
  title: string;
  system: string;
  difficulty: "Easy" | "Medium" | "Hard";
  examType: string;
  estimatedMinutes: number;
  relatedSubject: string;
  chiefComplaint: string;
  history: string;
  examination: string;
  investigations: string;
  diagnosisOptions: string[]; // empty = free-text diagnosis
  correctDiagnosis: string;
  explanation: string;
  managementPlan: string;
  keyLearningPoints: string[];
}

export const SEED_CLINICAL_CASES: SeedClinicalCase[] = [
  {
    title: "A 58-year-old with sudden chest pain",
    system: "Cardiology",
    difficulty: "Medium",
    examType: "MBBS",
    estimatedMinutes: 12,
    relatedSubject: "Medicine",
    chiefComplaint: "Crushing central chest pain radiating to the left arm for 40 minutes.",
    history: "The patient, a 58-year-old male smoker with a history of hypertension and dyslipidemia, presents with sudden-onset crushing retrosternal chest pain radiating to the left shoulder and arm, associated with sweating and nausea. Pain started while at rest and is unrelieved by antacids.",
    examination: "Pale and diaphoretic. BP 90/60 mmHg, HR 110 bpm, RR 22/min, SpO2 94% on room air. JVP elevated. Heart sounds muffled; no murmurs. Chest clear. Peripheral pulses weak and thready.",
    investigations: "ECG: ST elevation in leads II, III, aVF with reciprocal depression in I and aVL. Troponin I elevated (5.2 ng/mL). Chest X-ray: normal cardiac silhouette, no pneumothorax.",
    diagnosisOptions: ["Acute inferior STEMI", "Acute pericarditis", "Pulmonary embolism", "Aortic dissection", "Gastroesophageal reflux disease"],
    correctDiagnosis: "Acute inferior STEMI",
    explanation: "The combination of crushing chest pain with radiation to the left arm, sweating, ST elevation in inferior leads (II, III, aVF) and elevated troponin is diagnostic of acute inferior ST-elevation myocardial infarction (STEMI). The right coronary artery most commonly supplies the inferior wall. Hypotension may indicate right ventricular involvement.",
    managementPlan: "Emergent reperfusion (primary PCI within 90 minutes, or fibrinolysis if PCI unavailable). Aspirin 300 mg, P2Y12 inhibitor (ticagrelor), unfractionated heparin, and atropine/inotropic support for hypotension. Admit to CCU, continuous ECG monitoring, and prepare for angiography.",
    keyLearningPoints: [
      "ST elevation in II, III, aVF = inferior STEMI (usually RCA occlusion).",
      "Reciprocal ST depression in aVL supports the diagnosis.",
      "Inferior MI with hypotension suggests right ventricular involvement — avoid nitrates.",
      "Primary PCI is the preferred reperfusion strategy.",
    ],
  },
  {
    title: "A 34-year-old with recurrent abdominal pain and bloating",
    system: "Gastroenterology",
    difficulty: "Easy",
    examType: "MBBS",
    estimatedMinutes: 8,
    relatedSubject: "Medicine",
    chiefComplaint: "Recurrent postprandial bloating, crampy abdominal pain and alternating diarrhea/constipation for 18 months.",
    history: "A 34-year-old female office worker reports intermittent crampy lower abdominal pain relieved by defecation, bloating after meals, and alternating stool frequency. Symptoms worsen with stress. No weight loss, fever, or blood in stool. She has tried multiple over-the-counter remedies without benefit.",
    examination: "Soft abdomen with mild diffuse tenderness, no guarding or rigidity. Bowel sounds normal. No palpable masses or organomegaly.",
    investigations: "Full blood count, ESR, CRP, and celiac serology all normal. Stool for occult blood negative. Colonoscopy with normal mucosa and random biopsies showing no inflammation or granulomas.",
    diagnosisOptions: ["Irritable bowel syndrome", "Inflammatory bowel disease", "Celiac disease", "Colorectal cancer", "Chronic pancreatitis"],
    correctDiagnosis: "Irritable bowel syndrome",
    explanation: "Recurrent abdominal pain related to defecation with altered stool form and frequency, chronic course without alarm features (weight loss, blood, fever, nocturnal symptoms), and negative investigations are classic for irritable bowel syndrome (IBS). Rome IV criteria support the diagnosis. Normal inflammatory markers and colonoscopy exclude IBD, celiac disease, and malignancy.",
    managementPlan: "Reassurance, lifestyle modification (dietary fiber, low-FODMAP trial), stress management. Antispasmodics for pain and laxatives/antidiarrheals as needed. Refer for cognitive behavioral therapy if symptoms are refractory.",
    keyLearningPoints: [
      "IBS is a diagnosis of exclusion based on Rome IV criteria.",
      "Alarm features (weight loss, blood, fever, onset after 50) demand investigation.",
      "Normal inflammatory markers and colonoscopy rule out organic disease.",
      "Low-FODMAP diet and stress reduction are first-line management.",
    ],
  },
  {
    title: "A 24-year-old with sudden severe headache and neck stiffness",
    system: "Neurology",
    difficulty: "Hard",
    examType: "MBBS",
    estimatedMinutes: 14,
    relatedSubject: "Medicine",
    chiefComplaint: "Sudden-onset 'worst headache of my life' with neck stiffness and photophobia for 2 hours.",
    history: "A 24-year-old medical student developed a thunderclap headache while studying, described as the worst headache she has ever had, reaching maximum intensity within seconds. Associated with vomiting, neck stiffness, and photophobia. No fever. No prior headache history. No trauma.",
    examination: "Alert and oriented. Neck rigidity with positive Kernig's and Brudzinski's signs. Fundoscopy: subhyaloid hemorrhage in the right eye. No focal neurological deficits. BP 140/85 mmHg.",
    investigations: "Non-contrast CT head: hyperdense material in the basal cisterns and Sylvian fissures consistent with subarachnoid hemorrhage. Lumbar puncture (if CT negative) would show xanthochromia. CTA: saccular aneurysm at the junction of the anterior communicating artery.",
    diagnosisOptions: ["Subarachnoid hemorrhage", "Bacterial meningitis", "Migraine with aura", "Intracerebral hemorrhage", "Cerebral venous sinus thrombosis"],
    correctDiagnosis: "Subarachnoid hemorrhage",
    explanation: "A thunderclap headache (sudden, maximal at onset) with neck stiffness and photophobia, subhyaloid hemorrhage on fundoscopy, and blood in the basal cisterns on CT is classic for subarachnoid hemorrhage, most commonly from a ruptured berry aneurysm. Meningitis usually has fever and a prodrome. The lack of focal signs and thunderclap onset strongly favor SAH over intracerebral hemorrhage.",
    managementPlan: "Urgent neurosurgical referral. Strict bed rest, blood pressure control (avoid extremes), nimodipine 60 mg 4-hourly to prevent vasospasm, analgesia, and early aneurysm clipping or coiling. Monitor for hydrocephalus and rebleeding.",
    keyLearningPoints: [
      "Thunderclap headache = SAH until proven otherwise.",
      "Non-contrast CT within 6 hours has >95% sensitivity for SAH.",
      "Subhyaloid (preretinal) hemorrhage is a classic fundoscopic finding.",
      "Nimodipine reduces delayed cerebral ischemia from vasospasm.",
    ],
  },
  {
    title: "A 45-year-old with progressive dyspnea and productive cough",
    system: "Respiratory",
    difficulty: "Medium",
    examType: "FCPS Part-1",
    estimatedMinutes: 12,
    relatedSubject: "Medicine",
    chiefComplaint: "Progressive breathlessness and cough with copious purulent sputum for 6 months.",
    history: "A 45-year-old male, chronic smoker (30 pack-years), reports gradual worsening dyspnea on exertion, daily cough with copious mucopurulent sputum, and two chest infections in the past year. He has had 'asthma' inhalers with minimal benefit. No hemoptysis or weight loss.",
    examination: "Barrel-shaped chest, hyperresonant percussion, decreased breath sounds with widespread coarse crackles at both bases. Clubbing present. SpO2 90% on room air.",
    investigations: "CXR: bilateral lower zone tram-track and ring shadows with bronchial wall thickening. Sputum culture: Haemophilus influenzae. Spirometry: FEV1/FVC 0.55, FEV1 48% predicted, bronchodilator response < 12%.",
    diagnosisOptions: ["Bronchiectasis", "COPD", "Cystic fibrosis", "Pulmonary fibrosis", "Tuberculosis"],
    correctDiagnosis: "Bronchiectasis",
    explanation: "Chronic cough with copious purulent sputum, recurrent infections, coarse crackles, clubbing, and tram-track/ring shadows on CXR are classic for bronchiectasis — permanent abnormal dilatation of the bronchi. The lack of significant bronchodilator reversibility and the presence of clubbing and purulent sputum differentiate it from pure COPD. Adult-onset cystic fibrosis is less common and usually presents younger.",
    managementPlan: "Airway clearance (chest physiotherapy, postural drainage), bronchodilators, and targeted antibiotics for acute exacerbations. Influenza and pneumococcal vaccination. Treat underlying cause (e.g., immunoglobulins if deficient). Consider surgical resection for localized severe disease.",
    keyLearningPoints: [
      "Tram-track and ring shadows on CXR indicate bronchial wall thickening.",
      "Clubbing + chronic purulent sputum = consider bronchiectasis.",
      "Spirometry may show airflow obstruction with poor reversibility.",
      "Airway clearance therapy is the cornerstone of management.",
    ],
  },
  {
    title: "A 30-year-old with fatigue, weight gain and cold intolerance",
    system: "Endocrinology",
    difficulty: "Easy",
    examType: "MBBS",
    estimatedMinutes: 8,
    relatedSubject: "Medicine",
    chiefComplaint: "Fatigue, 6 kg weight gain, feeling cold, and constipation for 4 months.",
    history: "A 30-year-old female reports progressive fatigue, weight gain despite normal appetite, cold intolerance, dry skin, hair loss, constipation, and heavy menstrual periods. She feels mentally slow and depressed. No family history of thyroid disease.",
    examination: "Slow speech and delayed relaxation of reflexes (hung-up reflexes). Dry, coarse skin; non-pitting edema of the eyelids; diffuse, non-tender goiter. Pulse 56 bpm, regular. BP 110/70 mmHg.",
    investigations: "TSH markedly elevated (28 mIU/L), free T4 low (0.5 ng/dL). Anti-thyroid peroxidase antibodies strongly positive. Complete blood count shows mild anemia.",
    diagnosisOptions: ["Hypothyroidism (Hashimoto thyroiditis)", "Subclinical hypothyroidism", "Sick euthyroid syndrome", "Pituitary insufficiency", "Depression"],
    correctDiagnosis: "Hypothyroidism (Hashimoto thyroiditis)",
    explanation: "Elevated TSH with low free T4 confirms primary hypothyroidism. The presence of a diffuse goiter, positive anti-TPO antibodies, and classic symptoms (cold intolerance, weight gain, constipation, hung-up reflexes) indicate Hashimoto thyroiditis — the most common cause of primary hypothyroidism in iodine-sufficient regions.",
    managementPlan: "Levothyroxine replacement starting at 50–75 mcg daily (weight-based 1.6 mcg/kg), recheck TSH in 6–8 weeks and titrate. Educate on lifelong therapy and the need to take levothyroxine on an empty stomach. Monitor for symptoms of overtreatment (palpitations, anxiety).",
    keyLearningPoints: [
      "Primary hypothyroidism: high TSH + low free T4.",
      "Hashimoto thyroiditis is confirmed by positive anti-TPO antibodies.",
      "Levothyroxine dose is weight-based and titrated against TSH.",
      "Recheck TSH 6–8 weeks after any dose change.",
    ],
  },
  {
    title: "A 62-year-old with leg swelling and shortness of breath",
    system: "Cardiology",
    difficulty: "Medium",
    examType: "FCPS Part-1",
    estimatedMinutes: 12,
    relatedSubject: "Medicine",
    chiefComplaint: "Bilateral leg swelling, orthopnea, and paroxysmal nocturnal dyspnea for 3 weeks.",
    history: "A 62-year-old male with a history of hypertension and a prior myocardial infarction presents with progressive bilateral pitting ankle edema, two-pillow orthopnea, waking breathless at night, and reduced exercise tolerance. He has gained 5 kg over the last month.",
    examination: "Elevated JVP at 8 cm, bilateral pitting edema to the knees, fine inspiratory crackles at both lung bases, and a displaced, quiet apex beat with an S3 gallop. BP 145/90 mmHg. No murmurs.",
    investigations: "CXR: cardiomegaly with upper lobe blood diversion and Kerley B lines. BNP markedly elevated (1,400 pg/mL). Echocardiogram: dilated left ventricle, ejection fraction 30%, global hypokinesia, moderate mitral regurgitation.",
    diagnosisOptions: ["Heart failure with reduced ejection fraction", "Nephrotic syndrome", "Cirrhosis with ascites", "Chronic venous insufficiency", "Constrictive pericarditis"],
    correctDiagnosis: "Heart failure with reduced ejection fraction",
    explanation: "The triad of orthopnea, PND, elevated JVP, pulmonary edema on CXR, elevated BNP, and a dilated, poorly contracting left ventricle (EF 30%) establishes heart failure with reduced ejection fraction (HFrEF), most likely ischemic in origin given the prior MI and hypertension.",
    managementPlan: "Diuresis (furosemide), ACE inhibitor (or ARNI), beta-blocker, and an aldosterone antagonist — the 'quadruple therapy' of HFrEF. Restrict salt and fluid. Counsel on daily weight monitoring and urgent review for >2 kg gain. Consider device therapy (ICD/CRT) and revascularization assessment.",
    keyLearningPoints: [
      "Orthopnea + PND + elevated JVP + S3 = heart failure.",
      "BNP is a sensitive marker for acute decompensated heart failure.",
      "HFrEF: ACEi/ARNI + beta-blocker + MRA + SGLT2i are guideline-directed.",
      "Daily weight monitoring is key to detecting decompensation early.",
    ],
  },
  {
    title: "A 3-year-old with fever and a barking cough",
    system: "Pediatrics",
    difficulty: "Easy",
    examType: "MBBS",
    estimatedMinutes: 8,
    relatedSubject: "Pediatrics",
    chiefComplaint: "Barking cough, hoarse voice, and noisy breathing for 2 days with low-grade fever.",
    history: "A 3-year-old boy developed a runny nose and low-grade fever, followed by a characteristic barking 'seal-like' cough, hoarse voice, and noisy breathing that is worse at night. He is otherwise well, feeding normally, and has no drooling or difficulty swallowing.",
    examination: "Alert and playing. Inspiratory stridor audible at rest, worse when agitated. Mild suprasternal and intercostal retractions. SpO2 96% on room air. No drooling. Temperature 37.8°C.",
    investigations: "Clinical diagnosis — no investigations required in a typical case. Neck X-ray (only if atypical) may show a 'steeple sign' (subglottic narrowing).",
    diagnosisOptions: ["Acute laryngotracheobronchitis (croup)", "Epiglottitis", "Foreign body aspiration", "Bacterial tracheitis", "Asthma"],
    correctDiagnosis: "Acute laryngotracheobronchitis (croup)",
    explanation: "A barking cough with hoarse voice and inspiratory stridor in a 3-year-old with a preceding viral prodrome is classic croup (laryngotracheobronchitis), most often caused by parainfluenza virus. The absence of drooling, high fever, and toxic appearance help exclude epiglottitis. No choking episode or unilateral findings make foreign body less likely.",
    managementPlan: "Keep the child calm (agitation worsens stridor). Single dose of oral dexamethasone (0.15–0.6 mg/kg) is first-line. Nebulized adrenaline for moderate-to-severe stridor at rest. Observe for 4 hours; admit if persistent stridor at rest or hypoxia.",
    keyLearningPoints: [
      "Croup = barking cough + hoarse voice + inspiratory stridor in a young child.",
      "Dexamethasone is the cornerstone of treatment even in mild disease.",
      "Nebulized adrenaline is for moderate-severe stridor (close observation needed).",
      "Drooling, toxic appearance, and high fever suggest epiglottitis — an emergency.",
    ],
  },
  {
    title: "A 50-year-old with polyuria, polydipsia and blurred vision",
    system: "Endocrinology",
    difficulty: "Easy",
    examType: "USMLE Step 1",
    estimatedMinutes: 8,
    relatedSubject: "Medicine",
    chiefComplaint: "Increased thirst and urination, fatigue, and blurred vision for 2 months.",
    history: "A 50-year-old overweight male with a family history of diabetes reports drinking 4 liters of water daily, frequent urination including nocturia, fatigue, and intermittent blurred vision. He has had recurrent boils on the skin. No polyphagia or weight loss.",
    examination: "BMI 32, acanthosis nigricans in the axillae. Fundoscopy: mild non-proliferative diabetic retinopathy. Blood pressure 150/92 mmHg. Rest of examination unremarkable.",
    investigations: "Random blood glucose 240 mg/dL, HbA1c 8.4%. Fasting glucose 135 mg/dL. Urinalysis: glucosuria, no ketones. Renal function normal.",
    diagnosisOptions: ["Type 2 diabetes mellitus", "Type 1 diabetes mellitus", "Diabetes insipidus", "Chronic kidney disease", "Cushing syndrome"],
    correctDiagnosis: "Type 2 diabetes mellitus",
    explanation: "Older age, obesity, acanthosis nigricans, insidious onset with hyperglycemia and an HbA1c ≥ 6.5% point to type 2 diabetes mellitus. The absence of ketones, no weight loss, and presence of insulin-resistance markers differentiate it from type 1. Diabetes insipidus would have dilute urine and normal glucose.",
    managementPlan: "Metformin first-line plus lifestyle modification (diet, weight loss, exercise). Target HbA1c < 7%. Annual diabetic retinopathy screening, urine albumin-to-creatinine ratio, foot examination, and lipid/BP management. Add a second agent (e.g., SGLT2i or GLP-1 RA) if targets not met.",
    keyLearningPoints: [
      "Diagnosis of diabetes: HbA1c ≥ 6.5%, fasting glucose ≥ 126, or random glucose ≥ 200 with symptoms.",
      "Acanthosis nigricans is a marker of insulin resistance.",
      "Metformin is first-line for type 2 diabetes.",
      "Annual screening for retinopathy, nephropathy, and neuropathy is mandatory.",
    ],
  },
];
