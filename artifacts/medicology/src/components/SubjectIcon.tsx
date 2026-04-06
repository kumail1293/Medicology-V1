import React from 'react';

interface IconProps { className?: string; size?: number; }

export function AnatomyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="6.2" x2="12" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="14" x2="9" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="14" x2="15" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function PhysiologyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <polyline points="2,12 5,12 7,7 9,17 11,9 13,15 15,12 18,12 22,12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function BiochemistryIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M9 3h6l1 5H8L9 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 8l-3 12h14L16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export function PathologyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="14.5" y1="14.5" x2="21" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="10" y1="4" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7.5 2h5v2h-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

export function PharmacologyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="10" width="16" height="7" rx="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="10" x2="12" y2="17" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="8" y="6" width="8" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

export function MicrobiologyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="3" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="19" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5.6" y1="5.6" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="17" y1="17" x2="18.4" y2="18.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18.4" y1="5.6" x2="17" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="7" y1="17" x2="5.6" y2="18.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function ForensicIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 7 L3 12 Q6 14 9 12 L6 7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M18 7 L21 12 Q18 14 15 12 L18 7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function CommunityMedIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="5" cy="9" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="19" cy="9" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M9 14c0-1.66 1.34-3 3-3s3 1.34 3 3v4H9v-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M2 18v-2c0-1.1.9-2 2-2h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 18v-2c0-1.1-.9-2-2-2h-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function MedicineIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5 6.5C5 5.12 6.12 4 7.5 4S10 5.12 10 6.5c0 2.5-2.5 4-2.5 4S5 9 5 6.5z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7.5 10.5 Q9 13 12 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 14c3 1 5 3.5 5 6v1H7v-1c0-2.5 2-5 5-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="17" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="17" y1="5.5" x2="17" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="14.5" y1="8" x2="19.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function SurgeryIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 20 L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M16 8 L20 4 L21 5 L17 9 z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <circle cx="7" cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="9" y1="15" x2="12" y2="18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function GynaeIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="9" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="13.5" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="17" x2="15" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8.5" cy="7.5" r="1.2" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="15.5" cy="7.5" r="1.2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

export function PediatricsIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 10h8l1 8H7l1-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <line x1="10" y1="10" x2="9" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="14" y1="10" x2="15" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M9 13 Q12 11 15 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function ENTIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M8 4 C4 4 4 10 6 12 C8 14 8 17 8 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 4 C12 4 14 7 12 11 C10 13 10 15 12 17 Q14 19 12 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="17" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M17 10 v5 M15 13 h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export function OphthalmologyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12 C5 7 9 5 12 5 C15 5 19 7 22 12 C19 17 15 19 12 19 C9 19 5 17 2 12z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="1.3" fill="currentColor"/>
    </svg>
  );
}

export function DermatologyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="14" width="18" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="5" y="10" width="14" height="4" rx="2" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="7" y="7" width="10" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="9" cy="16.5" r="1" fill="currentColor" opacity="0.5"/>
      <circle cx="14" cy="16.5" r="1" fill="currentColor" opacity="0.5"/>
    </svg>
  );
}

export function PsychiatryIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3 C8 3 5 6 5 10 C5 12.5 6.5 14.5 8.5 15.5 L8.5 18 L15.5 18 L15.5 15.5 C17.5 14.5 19 12.5 19 10 C19 6 16 3 12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="9" y1="18" x2="15" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="20" x2="14" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 10 Q12 8 15 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function RadiologyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <ellipse cx="12" cy="10" rx="4" ry="5" stroke="currentColor" strokeWidth="1.3"/>
      <line x1="8" y1="17" x2="16" y2="17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="10" y1="19" x2="14" y2="19" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="12" y1="5" x2="12" y2="15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

export const SUBJECT_ICONS: Record<string, React.ComponentType<IconProps>> = {
  "Anatomy": AnatomyIcon,
  "Physiology": PhysiologyIcon,
  "Biochemistry": BiochemistryIcon,
  "Pathology": PathologyIcon,
  "Pharmacology": PharmacologyIcon,
  "Microbiology": MicrobiologyIcon,
  "Forensic Medicine": ForensicIcon,
  "Community Medicine": CommunityMedIcon,
  "Medicine": MedicineIcon,
  "Surgery": SurgeryIcon,
  "Gynecology & Obstetrics": GynaeIcon,
  "Pediatrics": PediatricsIcon,
  "ENT": ENTIcon,
  "Ophthalmology": OphthalmologyIcon,
  "Dermatology": DermatologyIcon,
  "Psychiatry": PsychiatryIcon,
  "Radiology": RadiologyIcon,
};

export function SubjectIcon({ name, className, size }: { name?: string | null } & IconProps) {
  if (!name) return <span className={className} style={{ fontSize: size }}>?</span>;
  const Icon = SUBJECT_ICONS[name];
  if (!Icon) return <span className={className} style={{ fontSize: size }}>{name[0]}</span>;
  return <Icon className={className} size={size} />;
}
