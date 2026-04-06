import { useState } from "react";
import { X, Search, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

interface LabValue {
  name: string;
  range: string;
  unit: string;
  note?: string;
}

interface LabCategory {
  label: string;
  values: LabValue[];
}

const LAB_DATA: LabCategory[] = [
  {
    label: "Hematology",
    values: [
      { name: "Hemoglobin (M)", range: "13.5–17.5", unit: "g/dL" },
      { name: "Hemoglobin (F)", range: "12.0–15.5", unit: "g/dL" },
      { name: "Hematocrit (M)", range: "41–53", unit: "%" },
      { name: "Hematocrit (F)", range: "36–46", unit: "%" },
      { name: "WBC", range: "4.5–11.0", unit: "×10³/μL" },
      { name: "Platelets", range: "150–400", unit: "×10³/μL" },
      { name: "MCV", range: "80–100", unit: "fL" },
      { name: "MCH", range: "27–33", unit: "pg" },
      { name: "MCHC", range: "32–36", unit: "g/dL" },
      { name: "Reticulocytes", range: "0.5–1.5", unit: "%" },
      { name: "ESR (M)", range: "0–15", unit: "mm/hr" },
      { name: "ESR (F)", range: "0–20", unit: "mm/hr" },
      { name: "PT", range: "11–13", unit: "sec" },
      { name: "INR", range: "0.8–1.2", unit: "" },
      { name: "aPTT", range: "25–35", unit: "sec" },
      { name: "Thrombin Time", range: "15–20", unit: "sec" },
      { name: "Fibrinogen", range: "200–400", unit: "mg/dL" },
    ],
  },
  {
    label: "Basic Metabolic",
    values: [
      { name: "Sodium (Na⁺)", range: "136–145", unit: "mEq/L" },
      { name: "Potassium (K⁺)", range: "3.5–5.0", unit: "mEq/L" },
      { name: "Chloride (Cl⁻)", range: "98–106", unit: "mEq/L" },
      { name: "Bicarbonate (HCO₃⁻)", range: "22–28", unit: "mEq/L" },
      { name: "BUN", range: "7–20", unit: "mg/dL" },
      { name: "Creatinine (M)", range: "0.7–1.2", unit: "mg/dL" },
      { name: "Creatinine (F)", range: "0.5–1.0", unit: "mg/dL" },
      { name: "Glucose (fasting)", range: "70–99", unit: "mg/dL" },
      { name: "Calcium (Ca²⁺)", range: "8.5–10.2", unit: "mg/dL" },
      { name: "Magnesium (Mg²⁺)", range: "1.5–2.5", unit: "mg/dL" },
      { name: "Phosphate (PO₄³⁻)", range: "2.5–4.5", unit: "mg/dL" },
      { name: "Anion Gap", range: "8–12", unit: "mEq/L" },
    ],
  },
  {
    label: "Liver Function",
    values: [
      { name: "Total Bilirubin", range: "0.1–1.2", unit: "mg/dL" },
      { name: "Direct Bilirubin", range: "0.0–0.3", unit: "mg/dL" },
      { name: "AST", range: "10–40", unit: "U/L" },
      { name: "ALT", range: "7–56", unit: "U/L" },
      { name: "ALP", range: "44–147", unit: "U/L" },
      { name: "GGT", range: "8–61", unit: "U/L" },
      { name: "Albumin", range: "3.5–5.0", unit: "g/dL" },
      { name: "Total Protein", range: "6.3–8.2", unit: "g/dL" },
    ],
  },
  {
    label: "Cardiac Markers",
    values: [
      { name: "Troponin I", range: "< 0.04", unit: "ng/mL" },
      { name: "Troponin T", range: "< 0.01", unit: "ng/mL" },
      { name: "CK-MB", range: "0–5", unit: "ng/mL" },
      { name: "BNP", range: "< 100", unit: "pg/mL" },
      { name: "NT-proBNP", range: "< 125", unit: "pg/mL" },
      { name: "CRP", range: "< 1.0", unit: "mg/L" },
      { name: "LDH", range: "140–280", unit: "U/L" },
    ],
  },
  {
    label: "Thyroid",
    values: [
      { name: "TSH", range: "0.4–4.0", unit: "mU/L" },
      { name: "Free T4", range: "0.8–1.8", unit: "ng/dL" },
      { name: "Free T3", range: "2.3–4.2", unit: "pg/mL" },
      { name: "Total T4", range: "5.0–12.0", unit: "μg/dL" },
    ],
  },
  {
    label: "Lipids",
    values: [
      { name: "Total Cholesterol", range: "< 200", unit: "mg/dL" },
      { name: "LDL", range: "< 130", unit: "mg/dL" },
      { name: "HDL (M)", range: "> 40", unit: "mg/dL" },
      { name: "HDL (F)", range: "> 50", unit: "mg/dL" },
      { name: "Triglycerides", range: "< 150", unit: "mg/dL" },
    ],
  },
  {
    label: "ABG / Pulmonary",
    values: [
      { name: "pH", range: "7.35–7.45", unit: "" },
      { name: "PaO₂", range: "75–100", unit: "mmHg" },
      { name: "PaCO₂", range: "35–45", unit: "mmHg" },
      { name: "HCO₃⁻ (arterial)", range: "22–26", unit: "mEq/L" },
      { name: "O₂ Saturation", range: "95–100", unit: "%" },
    ],
  },
  {
    label: "Endocrine",
    values: [
      { name: "Cortisol (AM)", range: "6–23", unit: "μg/dL" },
      { name: "Insulin (fasting)", range: "2.6–24.9", unit: "μU/mL" },
      { name: "HbA1c", range: "< 5.7", unit: "%" },
      { name: "Testosterone (M)", range: "270–1070", unit: "ng/dL" },
      { name: "Estradiol (F)", range: "15–350", unit: "pg/mL" },
      { name: "LH", range: "1.8–8.6", unit: "mIU/mL" },
      { name: "FSH", range: "1.5–12.4", unit: "mIU/mL" },
    ],
  },
  {
    label: "Vitamins & Minerals",
    values: [
      { name: "Vitamin B12", range: "200–900", unit: "pg/mL" },
      { name: "Folate", range: "2.5–20", unit: "ng/mL" },
      { name: "Vitamin D (25-OH)", range: "20–50", unit: "ng/mL" },
      { name: "Iron", range: "60–170", unit: "μg/dL" },
      { name: "Ferritin (M)", range: "12–300", unit: "ng/mL" },
      { name: "Ferritin (F)", range: "12–150", unit: "ng/mL" },
      { name: "TIBC", range: "250–370", unit: "μg/dL" },
    ],
  },
];

interface LabValuesProps {
  onClose: () => void;
}

export function LabValues({ onClose }: LabValuesProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = LAB_DATA.map((cat) => ({
    ...cat,
    values: cat.values.filter(
      (v) =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.unit.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.values.length > 0);

  const displayed = activeCategory
    ? filtered.filter((c) => c.label === activeCategory)
    : filtered;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-white rounded-t-2xl">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          <span className="font-bold">Lab Reference Values</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 border-b border-border bg-muted/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lab value..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn("px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
              activeCategory === null ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}
          >
            All
          </button>
          {LAB_DATA.map((c) => (
            <button
              key={c.label}
              onClick={() => setActiveCategory(activeCategory === c.label ? null : c.label)}
              className={cn("px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                activeCategory === c.label ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {displayed.map((cat) => (
          <div key={cat.label}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">{cat.label}</h3>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {cat.values.map((v) => (
                    <tr key={v.name} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2 font-medium">{v.name}</td>
                      <td className="px-3 py-2 text-primary font-semibold text-right">{v.range}</td>
                      <td className="px-3 py-2 text-muted-foreground text-right">{v.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {displayed.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No results found</div>
        )}
      </div>
    </div>
  );
}
