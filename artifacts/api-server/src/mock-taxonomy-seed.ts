// Taxonomy seed data for the in-memory mock database (dev mode).
// IDs are explicit so relational fields (countryId, examSystemId, ...) line up.
// Mirrors the universal exam hierarchy:
//   COUNTRY → EXAM SYSTEM → EXAM → PROGRAM → ACADEMIC YEAR
//   SUBJECT → SYSTEM → TOPIC → SUBTOPIC

export interface SeedCountry {
  id: number;
  code: string;
  name: string;
  flag: string;
  active: boolean;
}

export interface SeedExamSystem {
  id: number;
  name: string;
  countryId: number;
  sortOrder: number;
  active: boolean;
}

export interface SeedExam {
  id: number;
  code: string;
  name: string;
  examSystemId: number;
  countryId: number;
  status: string;
  sortOrder: number;
  active: boolean;
}

export interface SeedProgram {
  id: number;
  code: string;
  name: string;
  examId: number;
  sortOrder: number;
  active: boolean;
}

export interface SeedAcademicYear {
  id: number;
  programId: number;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface SeedSubject {
  id: number;
  code: string;
  name: string;
  shortName: string | null;
  icon: string | null;
  color: string | null;
  description: string | null;
  active: boolean;
}

export interface SeedSystem {
  id: number;
  name: string;
  subjectId: number;
  sortOrder: number;
  active: boolean;
}

export interface SeedTopic {
  id: number;
  name: string;
  systemId: number;
  sortOrder: number;
  active: boolean;
}

export interface SeedSubtopic {
  id: number;
  name: string;
  topicId: number;
  sortOrder: number;
  active: boolean;
}

export const SEED_COUNTRIES: SeedCountry[] = [
  { id: 1, code: "PK", name: "Pakistan", flag: "🇵🇰", active: true },
  { id: 2, code: "GB", name: "United Kingdom", flag: "🇬🇧", active: true },
  { id: 3, code: "US", name: "United States", flag: "🇺🇸", active: true },
  { id: 4, code: "AU", name: "Australia", flag: "🇦🇺", active: true },
  { id: 5, code: "CA", name: "Canada", flag: "🇨🇦", active: true },
];

export const SEED_EXAM_SYSTEMS: SeedExamSystem[] = [
  { id: 1, name: "University Exams", countryId: 1, sortOrder: 1, active: true },
  { id: 2, name: "Professional Exams", countryId: 1, sortOrder: 2, active: true },
  { id: 3, name: "International", countryId: 1, sortOrder: 3, active: true },
];

export const SEED_EXAMS: SeedExam[] = [
  { id: 1, code: "UHS", name: "University of Health Sciences", examSystemId: 1, countryId: 1, status: "available", sortOrder: 1, active: true },
  { id: 2, code: "KMU", name: "Khyber Medical University", examSystemId: 1, countryId: 1, status: "coming_soon", sortOrder: 2, active: true },
  { id: 3, code: "KEMU", name: "King Edward Medical University", examSystemId: 1, countryId: 1, status: "coming_soon", sortOrder: 3, active: true },
  { id: 4, code: "SZABMU", name: "Shaheed Zulfiqar Ali Bhutto Medical University", examSystemId: 1, countryId: 1, status: "coming_soon", sortOrder: 4, active: true },
  { id: 5, code: "NUMS", name: "National University of Medical Sciences", examSystemId: 1, countryId: 1, status: "coming_soon", sortOrder: 5, active: true },
  { id: 6, code: "DUHS", name: "Dow University of Health Sciences", examSystemId: 1, countryId: 1, status: "coming_soon", sortOrder: 6, active: true },
  { id: 7, code: "JSMU", name: "Jinnah Sindh Medical University", examSystemId: 1, countryId: 1, status: "coming_soon", sortOrder: 7, active: true },
  { id: 8, code: "SMBBMU", name: "Shaheed Mohtarma Benazir Bhutto Medical University", examSystemId: 1, countryId: 1, status: "coming_soon", sortOrder: 8, active: true },
  { id: 9, code: "FCPS", name: "FCPS", examSystemId: 2, countryId: 1, status: "coming_soon", sortOrder: 1, active: true },
  { id: 10, code: "JCAT", name: "JCAT", examSystemId: 2, countryId: 1, status: "coming_soon", sortOrder: 2, active: true },
  { id: 11, code: "PGET", name: "PGET", examSystemId: 2, countryId: 1, status: "coming_soon", sortOrder: 3, active: true },
  { id: 12, code: "NLE", name: "NLE", examSystemId: 2, countryId: 1, status: "coming_soon", sortOrder: 4, active: true },
  { id: 13, code: "USMLE", name: "USMLE", examSystemId: 3, countryId: 3, status: "coming_soon", sortOrder: 1, active: true },
  { id: 14, code: "PLAB", name: "PLAB", examSystemId: 3, countryId: 2, status: "coming_soon", sortOrder: 2, active: true },
  { id: 15, code: "AMC", name: "AMC", examSystemId: 3, countryId: 4, status: "coming_soon", sortOrder: 3, active: true },
  { id: 16, code: "UKMLA", name: "UKMLA", examSystemId: 3, countryId: 2, status: "coming_soon", sortOrder: 4, active: true },
  { id: 17, code: "MCCQE", name: "MCCQE", examSystemId: 3, countryId: 5, status: "coming_soon", sortOrder: 5, active: true },
];

export const SEED_PROGRAMS: SeedProgram[] = [
  { id: 1, code: "MBBS", name: "MBBS", examId: 1, sortOrder: 1, active: true },
  { id: 2, code: "BDS", name: "BDS", examId: 1, sortOrder: 2, active: true },
  { id: 3, code: "MBBS", name: "MBBS", examId: 2, sortOrder: 1, active: true },
  { id: 4, code: "FCPS-P1", name: "FCPS Part I", examId: 9, sortOrder: 1, active: true },
  { id: 5, code: "FCPS-P2", name: "FCPS Part II", examId: 9, sortOrder: 2, active: true },
  { id: 6, code: "USMLE-S1", name: "Step 1", examId: 13, sortOrder: 1, active: true },
  { id: 7, code: "USMLE-S2", name: "Step 2 CK", examId: 13, sortOrder: 2, active: true },
  { id: 8, code: "PLAB-1", name: "PLAB 1", examId: 14, sortOrder: 1, active: true },
];

export const SEED_ACADEMIC_YEARS: SeedAcademicYear[] = [
  { id: 1, programId: 1, name: "1st Year", sortOrder: 1, active: true },
  { id: 2, programId: 1, name: "2nd Year", sortOrder: 2, active: true },
  { id: 3, programId: 1, name: "3rd Year", sortOrder: 3, active: true },
  { id: 4, programId: 1, name: "4th Year", sortOrder: 4, active: true },
  { id: 5, programId: 1, name: "Final Year", sortOrder: 5, active: true },
  { id: 6, programId: 2, name: "1st Year", sortOrder: 1, active: true },
  { id: 7, programId: 2, name: "2nd Year", sortOrder: 2, active: true },
  { id: 8, programId: 2, name: "3rd Year", sortOrder: 3, active: true },
  { id: 9, programId: 2, name: "4th Year", sortOrder: 4, active: true },
];

export const SEED_SUBJECTS: SeedSubject[] = [
  { id: 1, code: "ANAT-001", name: "Anatomy", shortName: "Anat", icon: "🦴", color: "#ef4444", description: "Gross anatomy, embryology, histology, neuroanatomy", active: true },
  { id: 2, code: "PHYS-001", name: "Physiology", shortName: "Phys", icon: "❤️", color: "#f97316", description: "Normal function of body systems", active: true },
  { id: 3, code: "BIOC-001", name: "Biochemistry", shortName: "Biochem", icon: "🧬", color: "#eab308", description: "Molecular basis of life and metabolism", active: true },
  { id: 4, code: "PATH-001", name: "Pathology", shortName: "Path", icon: "🔬", color: "#a855f7", description: "Mechanisms of disease", active: true },
  { id: 5, code: "PHAR-001", name: "Pharmacology", shortName: "Pharma", icon: "💊", color: "#3b82f6", description: "Drugs and therapeutics", active: true },
  { id: 6, code: "MED-001", name: "Medicine", shortName: "Med", icon: "🩺", color: "#14b8a6", description: "Internal medicine", active: true },
  { id: 7, code: "PEDS-001", name: "Pediatrics", shortName: "Peds", icon: "🧸", color: "#ec4899", description: "Child health", active: true },
  { id: 8, code: "SURG-001", name: "Surgery", shortName: "Surg", icon: "🔪", color: "#6366f1", description: "Surgical diseases", active: true },
  { id: 9, code: "OBGY-001", name: "Obstetrics & Gynecology", shortName: "OBGYN", icon: "🤰", color: "#f43f5e", description: "Women's health and pregnancy", active: true },
  { id: 10, code: "ENT-001", name: "ENT", shortName: "ENT", icon: "👂", color: "#84cc16", description: "Ear, nose and throat", active: true },
  { id: 11, code: "OPHT-001", name: "Ophthalmology", shortName: "Ophth", icon: "👁️", color: "#06b6d4", description: "Eye diseases", active: true },
  { id: 12, code: "COMM-001", name: "Community Medicine", shortName: "Comm", icon: "🏘️", color: "#10b981", description: "Public health and epidemiology", active: true },
  { id: 13, code: "MICR-001", name: "Microbiology", shortName: "Micro", icon: "🦠", color: "#8b5cf6", description: "Microorganisms and infection", active: true },
  { id: 14, code: "IMMU-001", name: "Immunology", shortName: "Immuno", icon: "🛡️", color: "#f59e0b", description: "The immune system", active: true },
  { id: 15, code: "FORE-001", name: "Forensic Medicine", shortName: "Forensic", icon: "⚖️", color: "#64748b", description: "Legal medicine and toxicology", active: true },
];

export const SEED_SYSTEMS: SeedSystem[] = [
  // Pathology systems
  { id: 1, name: "Hematology", subjectId: 4, sortOrder: 1, active: true },
  { id: 2, name: "Cardiovascular", subjectId: 4, sortOrder: 2, active: true },
  { id: 3, name: "Respiratory", subjectId: 4, sortOrder: 3, active: true },
  { id: 4, name: "Gastrointestinal", subjectId: 4, sortOrder: 4, active: true },
  { id: 5, name: "Renal", subjectId: 4, sortOrder: 5, active: true },
  { id: 6, name: "Endocrine", subjectId: 4, sortOrder: 6, active: true },
  // Pharmacology systems
  { id: 7, name: "Endocrine", subjectId: 5, sortOrder: 1, active: true },
  { id: 8, name: "Infectious Disease", subjectId: 5, sortOrder: 2, active: true },
  // Medicine systems
  { id: 9, name: "Cardiovascular", subjectId: 6, sortOrder: 1, active: true },
  { id: 10, name: "Neurology", subjectId: 6, sortOrder: 2, active: true },
  { id: 11, name: "Gastrointestinal", subjectId: 6, sortOrder: 3, active: true },
  { id: 12, name: "Endocrine", subjectId: 6, sortOrder: 4, active: true },
  { id: 13, name: "Hematology", subjectId: 6, sortOrder: 5, active: true },
  { id: 14, name: "Renal", subjectId: 6, sortOrder: 6, active: true },
  // Anatomy systems
  { id: 15, name: "Musculoskeletal", subjectId: 1, sortOrder: 1, active: true },
  // Pediatrics systems
  { id: 16, name: "Metabolism", subjectId: 7, sortOrder: 1, active: true },
  { id: 17, name: "Respiratory", subjectId: 7, sortOrder: 2, active: true },
  // Biochemistry systems
  { id: 18, name: "Metabolism", subjectId: 3, sortOrder: 1, active: true },
  { id: 19, name: "Neurology", subjectId: 3, sortOrder: 2, active: true },
  // Microbiology systems
  { id: 20, name: "Respiratory", subjectId: 13, sortOrder: 1, active: true },
  { id: 21, name: "Renal", subjectId: 13, sortOrder: 2, active: true },
  // Obstetrics systems
  { id: 22, name: "Reproductive", subjectId: 9, sortOrder: 1, active: true },
  // Surgery systems
  { id: 23, name: "Urology", subjectId: 8, sortOrder: 1, active: true },
  { id: 24, name: "Gastrointestinal", subjectId: 8, sortOrder: 2, active: true },
  // Physiology systems
  { id: 25, name: "Respiratory", subjectId: 2, sortOrder: 1, active: true },
  // Immunology systems
  { id: 26, name: "Immune System", subjectId: 14, sortOrder: 1, active: true },
];

export const SEED_TOPICS: SeedTopic[] = [
  // Hematology (Pathology)
  { id: 1, name: "Anemia", systemId: 1, sortOrder: 1, active: true },
  { id: 2, name: "Bleeding Disorders", systemId: 1, sortOrder: 2, active: true },
  { id: 3, name: "Leukemias", systemId: 1, sortOrder: 3, active: true },
  // Respiratory (Pathology)
  { id: 4, name: "Lung Tumors", systemId: 3, sortOrder: 1, active: true },
  // Cardiovascular (Medicine)
  { id: 5, name: "Ischemic Heart Disease", systemId: 9, sortOrder: 1, active: true },
  { id: 6, name: "Electrolyte Disorders", systemId: 9, sortOrder: 2, active: true },
  // Neurology (Medicine)
  { id: 7, name: "Headache", systemId: 10, sortOrder: 1, active: true },
  // GI (Medicine)
  { id: 8, name: "Liver Disease", systemId: 11, sortOrder: 1, active: true },
  { id: 9, name: "Colorectal Cancer", systemId: 11, sortOrder: 2, active: true },
  // Endocrine (Medicine)
  { id: 10, name: "Adrenal Disorders", systemId: 12, sortOrder: 1, active: true },
  { id: 11, name: "Thyroid Disorders", systemId: 12, sortOrder: 2, active: true },
  // Hematology (Medicine)
  { id: 12, name: "Infectious Mononucleosis", systemId: 13, sortOrder: 1, active: true },
  // Musculoskeletal (Anatomy)
  { id: 13, name: "Peripheral Nerves", systemId: 15, sortOrder: 1, active: true },
  // Metabolism (Pediatrics)
  { id: 14, name: "Inborn Errors of Metabolism", systemId: 16, sortOrder: 1, active: true },
  // Respiratory (Pediatrics)
  { id: 15, name: "Upper Airway Infections", systemId: 17, sortOrder: 1, active: true },
  // Metabolism (Biochemistry)
  { id: 16, name: "Carbohydrate Metabolism", systemId: 18, sortOrder: 1, active: true },
  { id: 17, name: "Vitamin Deficiencies", systemId: 19, sortOrder: 1, active: true },
  // Respiratory (Microbiology)
  { id: 18, name: "Respiratory Infections", systemId: 20, sortOrder: 1, active: true },
  // Renal (Microbiology)
  { id: 19, name: "Urinary Tract Infections", systemId: 21, sortOrder: 1, active: true },
  // Reproductive (OBGYN)
  { id: 20, name: "Hypertensive Disorders of Pregnancy", systemId: 22, sortOrder: 1, active: true },
  // Urology (Surgery)
  { id: 21, name: "Prostate Disease", systemId: 23, sortOrder: 1, active: true },
  // GI (Surgery)
  { id: 22, name: "Pancreatic Disease", systemId: 24, sortOrder: 1, active: true },
  // Respiratory (Physiology)
  { id: 23, name: "Pulmonary Function", systemId: 25, sortOrder: 1, active: true },
  // Immune System (Immunology)
  { id: 24, name: "Immunoglobulins", systemId: 26, sortOrder: 1, active: true },
];

export const SEED_SUBTOPICS: SeedSubtopic[] = [
  { id: 1, name: "Iron Deficiency Anemia", topicId: 1, sortOrder: 1, active: true },
  { id: 2, name: "Megaloblastic Anemia", topicId: 1, sortOrder: 2, active: true },
  { id: 3, name: "Hemolytic Anemia", topicId: 1, sortOrder: 3, active: true },
  { id: 4, name: "Small Cell Carcinoma", topicId: 4, sortOrder: 1, active: true },
  { id: 5, name: "Myocardial Infarction", topicId: 5, sortOrder: 1, active: true },
  { id: 6, name: "Hyperkalemia", topicId: 6, sortOrder: 1, active: true },
  { id: 7, name: "Migraine", topicId: 7, sortOrder: 1, active: true },
  { id: 8, name: "Hepatic Encephalopathy", topicId: 8, sortOrder: 1, active: true },
  { id: 9, name: "Tumor Markers", topicId: 9, sortOrder: 1, active: true },
  { id: 10, name: "Cushing Syndrome", topicId: 10, sortOrder: 1, active: true },
  { id: 11, name: "Antithyroid Drugs", topicId: 11, sortOrder: 1, active: true },
  { id: 12, name: "EBV", topicId: 12, sortOrder: 1, active: true },
  { id: 13, name: "Upper Limb", topicId: 13, sortOrder: 1, active: true },
  { id: 14, name: "Shoulder", topicId: 13, sortOrder: 2, active: true },
  { id: 15, name: "Phenylketonuria", topicId: 14, sortOrder: 1, active: true },
  { id: 16, name: "Croup", topicId: 15, sortOrder: 1, active: true },
  { id: 17, name: "Glycolysis", topicId: 16, sortOrder: 1, active: true },
  { id: 18, name: "Thiamine", topicId: 17, sortOrder: 1, active: true },
  { id: 19, name: "Community-Acquired Pneumonia", topicId: 18, sortOrder: 1, active: true },
  { id: 20, name: "Cystitis", topicId: 19, sortOrder: 1, active: true },
  { id: 21, name: "Preeclampsia", topicId: 20, sortOrder: 1, active: true },
  { id: 22, name: "Benign Prostatic Hyperplasia", topicId: 21, sortOrder: 1, active: true },
  { id: 23, name: "Acute Pancreatitis", topicId: 22, sortOrder: 1, active: true },
  { id: 24, name: "Surfactant", topicId: 23, sortOrder: 1, active: true },
  { id: 25, name: "Passive Immunity", topicId: 24, sortOrder: 1, active: true },
];
