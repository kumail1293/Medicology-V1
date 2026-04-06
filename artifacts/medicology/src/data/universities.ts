export interface University {
  id: string;
  name: string;
  shortName: string;
  examType: "annual" | "modular";
  city: string;
}

export const universities: University[] = [
  { id: "aku", name: "Aga Khan University", shortName: "AKU", examType: "modular", city: "Karachi" },
  { id: "nums", name: "National University of Medical Sciences", shortName: "NUMS", examType: "modular", city: "Rawalpindi" },
  { id: "duhs", name: "Dow University of Health Sciences", shortName: "DUHS", examType: "annual", city: "Karachi" },
  { id: "uhs", name: "University of Health Sciences", shortName: "UHS", examType: "modular", city: "Lahore" },
  { id: "kmu", name: "Khyber Medical University", shortName: "KMU", examType: "annual", city: "Peshawar" },
  { id: "jsmu", name: "Jinnah Sindh Medical University", shortName: "JSMU", examType: "annual", city: "Karachi" },
  { id: "bumdc", name: "Bahria Medical and Dental University", shortName: "BUMDC", examType: "modular", city: "Karachi" },
  { id: "zu", name: "Ziauddin University", shortName: "ZU", examType: "modular", city: "Karachi" },
  { id: "bmu", name: "Baqai Medical University", shortName: "BMU", examType: "annual", city: "Karachi" },
  { id: "hu", name: "Hamdard University", shortName: "HU", examType: "annual", city: "Karachi" },
  { id: "isra", name: "Isra University", shortName: "ISRA", examType: "annual", city: "Hyderabad" },
  { id: "uol", name: "The University of Lahore", shortName: "UOL", examType: "modular", city: "Lahore" },
  { id: "kemu", name: "King Edward Medical University", shortName: "KEMU", examType: "modular", city: "Lahore" },
];

export function getUniversityById(id: string): University | undefined {
  return universities.find((u) => u.id === id);
}

export function getExamTypeByUniversity(id: string): "annual" | "modular" {
  return getUniversityById(id)?.examType ?? "annual";
}
