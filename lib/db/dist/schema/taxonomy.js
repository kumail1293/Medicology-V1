import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
// ============================================================================
// Exam taxonomy — the universal hierarchy that underpins Medicology:
//
//   COUNTRY → EXAM SYSTEM → EXAM → PROGRAM → ACADEMIC YEAR
//   SUBJECT → SYSTEM → TOPIC → SUBTOPIC
//
// Questions reference this hierarchy via optional relational IDs (hybrid
// mode) while legacy free-text columns (subject, topic, universityTag, ...)
// are kept in sync automatically. QIDs are the immutable public identifier.
// ============================================================================
export const countriesTable = pgTable("countries", {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // e.g. "PK", "GB", "US"
    name: text("name").notNull(), // e.g. "Pakistan"
    flag: text("flag"), // emoji flag, e.g. "🇵🇰"
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const examSystemsTable = pgTable("exam_systems", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(), // e.g. "University Exams", "Professional Exams", "International"
    countryId: integer("country_id")
        .notNull()
        .references(() => countriesTable.id),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const examsTable = pgTable("exams", {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // e.g. "UHS", "KMU", "FCPS", "USMLE"
    name: text("name").notNull(), // e.g. "University of Health Sciences"
    examSystemId: integer("exam_system_id")
        .notNull()
        .references(() => examSystemsTable.id),
    countryId: integer("country_id")
        .notNull()
        .references(() => countriesTable.id),
    status: text("status").$type().notNull().default("coming_soon"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const programsTable = pgTable("programs", {
    id: serial("id").primaryKey(),
    code: text("code").notNull(), // e.g. "MBBS", "BDS", "FCPS-P1"
    name: text("name").notNull(), // e.g. "MBBS", "BDS", "FCPS Part I"
    examId: integer("exam_id")
        .notNull()
        .references(() => examsTable.id),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const academicYearsTable = pgTable("academic_years", {
    id: serial("id").primaryKey(),
    programId: integer("program_id")
        .notNull()
        .references(() => programsTable.id),
    name: text("name").notNull(), // e.g. "1st Year", "Final Year"
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const subjectsTable = pgTable("subjects", {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // e.g. "PATH-001"
    name: text("name").notNull(), // e.g. "Pathology"
    shortName: text("short_name"), // e.g. "Path"
    icon: text("icon"),
    color: text("color"),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const systemsTable = pgTable("systems", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(), // e.g. "Hematology"
    subjectId: integer("subject_id")
        .notNull()
        .references(() => subjectsTable.id),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const topicsTable = pgTable("topics", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(), // e.g. "Anemia"
    systemId: integer("system_id")
        .notNull()
        .references(() => systemsTable.id),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const subtopicsTable = pgTable("subtopics", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(), // e.g. "Iron Deficiency Anemia"
    topicId: integer("topic_id")
        .notNull()
        .references(() => topicsTable.id),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
// ---------------------------------------------------------------- Zod schemas
export const insertCountrySchema = createInsertSchema(countriesTable).omit({
    id: true,
    createdAt: true,
});
export const insertExamSystemSchema = createInsertSchema(examSystemsTable).omit({
    id: true,
    createdAt: true,
});
export const insertExamSchema = createInsertSchema(examsTable).omit({
    id: true,
    createdAt: true,
});
export const insertProgramSchema = createInsertSchema(programsTable).omit({
    id: true,
    createdAt: true,
});
export const insertAcademicYearSchema = createInsertSchema(academicYearsTable).omit({ id: true, createdAt: true });
export const insertSubjectSchema = createInsertSchema(subjectsTable).omit({
    id: true,
    createdAt: true,
});
export const insertSystemSchema = createInsertSchema(systemsTable).omit({
    id: true,
    createdAt: true,
});
export const insertTopicSchema = createInsertSchema(topicsTable).omit({
    id: true,
    createdAt: true,
});
export const insertSubtopicSchema = createInsertSchema(subtopicsTable).omit({
    id: true,
    createdAt: true,
});
export const EXAM_STATUSES = [
    "planned",
    "coming_soon",
    "beta",
    "available",
    "paused",
    "archived",
];
