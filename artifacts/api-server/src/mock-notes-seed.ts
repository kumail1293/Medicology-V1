// Seed study notes for the Notes Library so the page has content in dev.
// Keys mirror the studyNotesTable columns; ids are assigned by the mock DB.

export const SEED_STUDY_NOTES = [
  {
    title: "Cardiac Action Potential — The 5 Phases Made Simple",
    slug: "cardiac-action-potential-phases",
    subject: "Physiology",
    content: `# Cardiac Action Potential

The cardiac action potential has **5 phases** (0–4). Memorize the ion movements, not just the names.

## Phase 0 — Rapid depolarization
- **Na⁺ channels open** (fast, voltage-gated) → Na⁺ rushes in
- Upstroke is steep; caused by \`INa\`

## Phase 1 — Early repolarization
- Na⁺ channels inactivate
- **Transient K⁺ efflux** (\`Ito\`) + Cl⁻ entry

## Phase 2 — Plateau (the hallmark of cardiac muscle)
- **Ca²⁺ enters** via L-type channels (\`ICa-L\`)
- K⁺ efflux balances Ca²⁺ entry → membrane stays near 0 mV
- This is why cardiac muscle cannot tetanize — the refractory period lasts almost the whole contraction

## Phase 3 — Rapid repolarization
- Ca²⁺ channels close
- **K⁺ efflux** via delayed rectifier (\`IKr\`, \`IKs\`)

## Phase 4 — Resting membrane potential
- \`IK1\` keeps it at ~ −90 mV
- **Pacemaker cells** (SA node) lack phase 1–2; they use funny current \`If\` and T-type Ca²⁺ for spontaneous depolarization

> **High-yield trap:** Phase 2 (plateau) is unique to cardiac muscle and is driven by *calcium*, not sodium.`,
    tags: '["cardiology", "physiology", "action-potential", "high-yield"]',
    status: "published",
    featured: true,
  },
  {
    title: "Upper vs Lower Motor Neuron Lesions — UMN/LMN Mnemonic",
    slug: "umn-lmn-lesion-mnemonic",
    subject: "Neurology",
    content: `# UMN vs LMN Lesions

Compare by **tone, reflexes, and Babinski**.

| Feature | UMN | LMN |
|---|---|---|
| Tone | Spastic (hypertonia) | Flaccid (hypotonia) |
| Reflexes | Hyperreflexia | Hyporeflexia/areflexia |
| Babinski | Extensor (↑) | Flexor (absent) |
| Fasciculations | Absent | **Present** |
| Wasting | Mild (disuse) | Severe |
| Site | Cortex → corticospinal tract | Anterior horn → nerve |

**Mnemonic — "SPAS-TIC":**
- **S**pastic, **P**lantar extensor (Babinski up), **A**bsent fasciculations, **S**evere? No — that's LMN wasting.

**Remember:** UMN = *up* going tone + up going toe. LMN = *low* tone + fasciculations (lower motor neuron = muscle twitches).

> **Classic example:** Stroke (UMN) → spastic hemiparesis. Polio (LMN) → flaccid weakness with fasciculations.`,
    tags: '["neurology", "mnemonic", "high-yield"]',
    status: "published",
    featured: false,
  },
  {
    title: "Antibiotics by Mechanism of Action — Complete Cheat Sheet",
    slug: "antibiotics-mechanism-cheat-sheet",
    subject: "Pharmacology",
    content: `# Antibiotics by Mechanism

## Cell wall synthesis inhibitors
- **β-lactams** (penicillins, cephalosporins, carbapenems) — block transpeptidase (PBPs)
- **Vancomycin** — blocks peptidoglycan cross-linking (Gram + only)
- **Bacitracin** — blocks dephosphorylation of bactoprenol

## Protein synthesis inhibitors — "30S vs 50S"
- **30S:** Aminoglycosides (bactericidal, tRNA misreading), Tetracyclines (bacteriostatic, tRNA binding)
- **50S:** Macrolides (translocation), Clindamycin (translocation), Chloramphenicol (peptidyl transferase), Linezolid (initiation), Streptogramins

## Nucleic acid synthesis
- **Quinolones** — DNA gyrase / topoisomerase IV
- **Rifampin** — DNA-dependent RNA polymerase
- **Metronidazole** — forms reactive radicals, damages DNA (anaerobes only)
- **Sulfonamides + Trimethoprim** — folate antagonists (PABA → DHF → THF)

## Cell membrane
- **Polymyxins** — disrupt Gram − outer membrane (last resort, nephrotoxic)

> **Trap:** Aminoglycosides are *bactericidal* despite being 30S inhibitors — most 30S/50S inhibitors are bacteriostatic.`,
    tags: '["pharmacology", "antibiotics", "cheat-sheet"]',
    status: "published",
    featured: false,
  },
  {
    title: "Cranial Nerves — Function, Foramina & Mnemonics",
    slug: "cranial-nerves-foramina",
    subject: "Anatomy",
    content: `# Cranial Nerves

## Mnemonic for names: "Oh Oh Oh To Touch And Feel Very Green Vegetables AH"
1. **O**lfactory
2. **O**ptic
3. **O**culomotor
4. **T**rochlear
5. **T**rigeminal
6. **A**bducens
7. **F**acial
8. **V**estibulocochlear
9. **G**lossopharyngeal
10. **V**agus
11. **A**ccessory (Spinal)
12. **H**ypoglossal

## Mnemonic for function: "Some Say Marry Money But My Brother Says Big Brains Matter More"
- S = Sensory (I, II, VIII)
- M = Motor (III, IV, VI, XI, XII)
- B = Both (V, VII, IX, X)

## Key foramina (high-yield)
| Nerve | Foramen |
|---|---|
| V1 (ophthalmic) | Superior orbital fissure |
| V2 (maxillary) | Foramen rotundum |
| V3 (mandibular) | Foramen ovale |
| VII | Stylomastoid foramen |
| IX | Jugular foramen |
| X | Jugular foramen |
| XII | Hypoglossal canal |

> **Trap:** The *only* cranial nerve that exits the skull via the **hypoglossal canal** is CN XII — everything else in the "jugular" group (IX, X, XI) uses the jugular foramen.`,
    tags: '["anatomy", "cranial-nerves", "mnemonic"]',
    status: "published",
    featured: false,
  },
  {
    title: "Liver Function Tests — Pattern Recognition",
    slug: "liver-function-test-patterns",
    subject: "Biochemistry",
    content: `# LFT Pattern Recognition

## Hepatocellular injury (viral, alcoholic, ischemic)
- **↑↑ AST/ALT** (ALT > AST in viral; **AST > ALT, often 2:1** in alcoholic liver disease)
- Bilirubin ↑ (both direct/indirect, mixed)
- ALP normal or mildly ↑
- PT ↑ (severe)

## Cholestasis (biliary obstruction, PBC, drug-induced)
- **↑↑ ALP + GGT** (GGT confirms biliary source)
- Direct (conjugated) bilirubin ↑
- AST/ALT normal or mildly ↑
- ↑ Bile acids, pruritus

## Synthetic failure (cirrhosis)
- **↓ Albumin** (half-life ~20 days — falls slowly)
- **↑ PT / INR** (falls quickly — reflects acute synthetic function)
- ALT/AST may be *normal* in end-stage (burnt-out liver)

## Isolated hyperbilirubinemia
- Unconjugated only → Gilbert (mild, UGT1A1), Crigler-Najjar
- Conjugated only → Dubin-Johnson, Rotor

> **Trap:** In *acute* liver failure the PT/INR rises before bilirubin — the PT is the best early marker of synthetic dysfunction.`,
    tags: '["biochemistry", "liver", "patterns"]',
    status: "published",
    featured: false,
  },
  {
    title: "Acid-Base Disorders — The 4-Step Approach",
    slug: "acid-base-4-step-approach",
    subject: "Medicine",
    content: `# Acid-Base in 4 Steps

## Step 1 — Is the patient acidemic or alkalemic?
Look at **pH**: < 7.35 acidemia, > 7.45 alkalemia.

## Step 2 — What's the primary disorder?
- pH ↓ + HCO₃ ↓ → **Metabolic acidosis**
- pH ↓ + CO₂ ↑ → **Respiratory acidosis**
- pH ↑ + HCO₃ ↑ → **Metabolic alkalosis**
- pH ↑ + CO₂ ↓ → **Respiratory alkalosis**

## Step 3 — Compensation appropriate?
| Disorder | Expected compensation |
|---|---|
| Metabolic acidosis | pCO₂ = 1.5(HCO₃) + 8 ± 2 (Winter's) |
| Metabolic alkalosis | pCO₂ ↑ 0.7 mmHg per 1 mEq HCO₃ |
| Respiratory acidosis (acute) | HCO₃ ↑ 1 per 10 CO₂ |
| Respiratory acidosis (chronic) | HCO₃ ↑ 4 per 10 CO₂ |

## Step 4 — Anion gap?
**AG = Na⁺ − (Cl⁻ + HCO₃⁻)**, normal 8–12.

**MUDPILES** (high anion gap): Methanol, Uremia, DKA, Paraldehyde, INH, Lactic acidosis, Ethylene glycol, Salicylates.

> **Trap:** A *normal* anion gap acidosis is almost always **diarrhea** (GI HCO₃ loss) or **renal tubular acidosis** — think hyperchloremia.`,
    tags: '["medicine", "acid-base", "step-by-step"]',
    status: "published",
    featured: false,
  },
  {
    title: "Gram Staining — The Complete Guide with Organism Table",
    slug: "gram-staining-complete-guide",
    subject: "Microbiology",
    content: `# Gram Staining

## The 4 steps
1. **Crystal violet** (primary stain) → all cells purple
2. **Iodine** (mordant) → forms CV-I complex
3. **Alcohol/acetone** (decolorizer) → Gram − lose the stain
4. **Safranin** (counterstain) → Gram − turn pink/red

**Gram + = thick peptidoglycan** (retains CV). **Gram − = thin PG + outer membrane** (loses CV, takes safranin).

## High-yield Gram + cocci
- **Staph aureus** — clusters, catalase +, coagulase +
- **Strep pyogenes** — chains, β-hemolytic, bacitracin sensitive
- **Strep pneumoniae** — lancet-shaped pairs, optochin sensitive, bile soluble
- **Enterococcus** — PYR +, grows in 6.5% NaCl

## High-yield Gram −
- **E. coli** — lactose +, IMViC + +
- **Klebsiella** — mucoid capsule, lactose +
- **Pseudomonas** — oxidase +, grape-like odor, green pigment
- **Neisseria** — coffee-bean diplococci (meningitidis, gonorrhoeae)
- **Haemophilus** — requires X + V factors (chocolate agar)

> **Trap:** *Mycoplasma* has no cell wall → **not visible on Gram stain** at all. *Nocardia* is partially acid-fast.`,
    tags: '["microbiology", "gram-stain", "high-yield"]',
    status: "published",
    featured: false,
  },
  {
    title: "Innate vs Adaptive Immunity — First-Line Defenses",
    slug: "innate-vs-adaptive-immunity",
    subject: "Immunology",
    content: `# Innate vs Adaptive Immunity

## Innate (nonspecific, immediate, no memory)
- **Barriers:** skin, mucosa, cilia, gastric acid, commensals
- **Cells:** neutrophils (first responders), macrophages, NK cells, dendritic cells
- **Soluble:** complement (classical/lectin/alternative), interferons, acute phase proteins
- **Response time:** minutes–hours

## Adaptive (specific, delayed, memory)
- **Humoral:** B cells → plasma cells → antibodies (IgG, IgM, IgA, IgE, IgD)
- **Cell-mediated:** CD4+ helper T cells, CD8+ cytotoxic T cells
- **Response time:** days (primary), hours (secondary — memory cells)

## The bridge
- **Dendritic cells** are the professional APCs that link innate → adaptive
- **Complement** opsonizes (C3b) and forms MAC (C5b-9) for lysis

## Immunoglobulin memory aid — "GAMED"
- **IgG** — most abundant, crosses placenta, secondary response
- **IgA** — mucosal (secretory, dimer)
- **IgM** — pentamer, primary response, complement fixing
- **IgE** — allergies, parasites (mast cell degranulation)
- **IgD** — B cell surface receptor

> **Trap:** *IgM* is the first antibody in the primary response; *IgG* dominates the secondary response and is the only Ig that crosses the placenta.`,
    tags: '["immunology", "immunity", "high-yield"]',
    status: "published",
    featured: false,
  },
  {
    title: "Diabetes Mellitus — Diagnostic Criteria & Complications",
    slug: "diabetes-diagnostic-criteria",
    subject: "Medicine",
    content: `# Diabetes Mellitus

## Diagnosis (any ONE of the following, confirmed on repeat)
- **Fasting plasma glucose ≥ 126 mg/dL** (8 h fast)
- **2-h OGTT ≥ 200 mg/dL** (75 g glucose)
- **HbA1c ≥ 6.5%**
- Random glucose ≥ 200 mg/dL + classic symptoms (polyuria, polydipsia, weight loss)

**Prediabetes:** FPG 100–125, OGTT 140–199, HbA1c 5.7–6.4%

## Type 1 vs Type 2
| Feature | T1DM | T2DM |
|---|---|---|
| Onset | Acute, young | Insidious, older/obese |
| Body habitus | Thin | Overweight |
| Ketosis | Common (DKA) | Rare (HHS) |
| Autoantibodies | Present (GAD, IA-2) | Absent |
| Insulin | Absolutely deficient | Relative deficiency + resistance |
| First-line | Insulin | Metformin |

## Chronic complications
- **Microvascular:** retinopathy, nephropathy, neuropathy
- **Macrovascular:** CAD, stroke, PAD
- **Diabetic foot** — neuropathic + ischemic → ulceration, Charcot joint

> **Trap:** In **HHS**, glucose is *very* high (often > 600) but **no ketones** — distinguish from DKA (ketones + acidosis).`,
    tags: '["medicine", "diabetes", "endocrinology"]',
    status: "published",
    featured: false,
  },
  {
    title: "Vitamin Deficiencies — The Master Table",
    slug: "vitamin-deficiency-master-table",
    subject: "Biochemistry",
    content: `# Vitamin Deficiencies — Master Table

## Fat-soluble (A, D, E, K) — "ADEK"
| Vitamin | Deficiency | Key fact |
|---|---|---|
| A (retinol) | Night blindness, xerophthalmia, keratomalacia | Stored in liver; excess → teratogenic |
| D | Rickets (children), osteomalacia (adults) | Requires sunlight + renal/liver hydroxylation |
| E (tocopherol) | Hemolytic anemia (neonates), ataxia | Antioxidant |
| K | Bleeding (↑ PT/INR) | Made by gut flora; warfarin inhibits recycling |

## Water-soluble
| Vitamin | Deficiency | Key fact |
|---|---|---|
| B1 (thiamine) | Beriberi (wet/dry), Wernicke-Korsakoff | Alcoholics; give before glucose |
| B3 (niacin) | Pellagra — "4 Ds" (dermatitis, diarrhea, dementia, death) | Tryptophan precursor |
| B9 (folate) | Megaloblastic anemia, neural tube defects | Needs B12 to be used |
| B12 (cobalamin) | Pernicious anemia, subacute combined degeneration | Needs intrinsic factor |
| C | Scurvy (gum bleeding, poor wound healing) | Collagen hydroxylation |

> **Trap:** B12 deficiency causes *neurological* symptoms (subacute combined degeneration — posterior + lateral columns); folate deficiency does NOT. Always check B12 before treating with folate.`,
    tags: '["biochemistry", "vitamins", "master-table"]',
    status: "published",
    featured: false,
  },
  {
    title: "Approach to Chest Pain — The 4 Life-Threats First",
    slug: "approach-to-chest-pain",
    subject: "Medicine",
    content: `# Approach to Chest Pain

Rule out the **4 life-threatening causes first**:

1. **ACS** (MI/UA) — crushing, radiation to arm/jaw, diaphoresis; ECG + troponin
2. **Pulmonary embolism** — sudden dyspnea, pleuritic pain, tachycardia, hypoxia; Wells score → D-dimer/CTPA
3. **Aortic dissection** — tearing pain radiating to back, pulse/BP asymmetry, widened mediastinum
4. **Tension pneumothorax** — sudden pain + dyspnea, deviated trachea, absent breath sounds, hyperresonance; **immediate needle decompression**

## Then the common causes
- **Pericarditis** — positional, relieved by leaning forward, PR elevation + diffuse ST elevation, friction rub
- **GERD** — burning, postprandial, worse supine
- **Costochondritis** — reproducible tenderness
- **Anxiety/panic** — atypical, associated hyperventilation

## Red flags requiring admission
- Hemodynamic instability
- New ECG changes / troponin elevation
- Hypoxia
- Risk factors (age, DM, smoking, FHx)

> **Trap:** The first ECG in ACS can be *normal* — a normal ECG does not rule out MI. Serial troponins are mandatory.`,
    tags: '["medicine", "chest-pain", "approach"]',
    status: "published",
    featured: false,
  },
  {
    title: "Renal Physiology — Clearance, GFR & the Nephron",
    slug: "renal-physiology-clearance",
    subject: "Physiology",
    content: `# Renal Physiology

## GFR & clearance
- **GFR** = Kf × (Pgc − Pbs − πgc)
- **Normal GFR ≈ 125 mL/min** (180 L/day filtered)
- **Clearance** = (U × V) / P — the volume of plasma cleared per unit time
- **Inulin** is the gold standard for GFR (freely filtered, not reabsorbed/secreted)
- **PAH** clearance ≈ renal plasma flow (secreted)

## Filtration fraction
- FF = GFR / RPF ≈ 125/625 = **0.2 (20%)**

## Nephron segments — what's reabsorbed where
| Segment | Reabsorbs |
|---|---|
| Proximal tubule | 65% Na⁺, most HCO₃⁻, glucose, amino acids, water |
| Loop of Henle | 25% Na⁺ (NKCC2, thick ascending), Ca²⁺/Mg²⁺ |
| Distal tubule | 5% Na⁺ (NCC), Ca²⁺ (PTH) |
| Collecting duct | Na⁺ (ENaC, aldosterone), water (ADH, aquaporins), K⁺/H⁺ |

> **Trap:** The *thick ascending limb* is impermeable to water — that's why it's the **diluting segment**. The *collecting duct* is where ADH and aldosterone act.`,
    tags: '["physiology", "renal", "high-yield"]',
    status: "published",
    featured: false,
  },
];
