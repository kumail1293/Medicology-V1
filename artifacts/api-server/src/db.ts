import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@workspace/db/schema';
import { SEED_QUESTIONS } from './mock-seed.js';
import {
  SEED_COUNTRIES,
  SEED_EXAM_SYSTEMS,
  SEED_EXAMS,
  SEED_PROGRAMS,
  SEED_ACADEMIC_YEARS,
  SEED_SUBJECTS,
  SEED_SYSTEMS,
  SEED_TOPICS,
  SEED_SUBTOPICS,
} from './mock-taxonomy-seed.js';

// Check if we should use SQLite (for development)
const useSQLite = process.env.DATABASE_URL?.startsWith('sqlite:') ||
                  process.env.USE_SQLITE === 'true' ||
                  !process.env.DATABASE_URL;

let db: any;

if (useSQLite) {
  // For development without native SQLite bindings:
  // Create a mock database that provides a minimal Drizzle-compatible interface.
  // This lets auth and admin routes work locally without requiring a real DB.
  console.log('📊 Using mock database for development (data not persisted)');

  const now = new Date();
  const mockData: Record<string, any[]> = {
    users: [],
    // Seed sample questions so practice/exam/daily flows have content in dev.
    // Each seeded question gets a stable public QID.
    questions: SEED_QUESTIONS.map((q, i) => ({
      id: i + 1,
      qid: `QID-MED-${String(i + 1).padStart(9, '0')}`,
      status: 'published',
      publishedAt: now,
      ...q,
      createdAt: now,
      updatedAt: now,
    })),
    // Seed the exam taxonomy hierarchy (countries → exams → programs → years,
    // and subjects → systems → topics → subtopics) so the exam explorer and
    // admin taxonomy UI have content in dev.
    countries: SEED_COUNTRIES.map((c) => ({ ...c, createdAt: now })),
    exam_systems: SEED_EXAM_SYSTEMS.map((es) => ({ ...es, createdAt: now })),
    exams: SEED_EXAMS.map((e) => ({ ...e, createdAt: now })),
    programs: SEED_PROGRAMS.map((p) => ({ ...p, createdAt: now })),
    academic_years: SEED_ACADEMIC_YEARS.map((y) => ({ ...y, createdAt: now })),
    subjects: SEED_SUBJECTS.map((s) => ({ ...s, createdAt: now })),
    systems: SEED_SYSTEMS.map((s) => ({ ...s, createdAt: now })),
    topics: SEED_TOPICS.map((t) => ({ ...t, createdAt: now })),
    subtopics: SEED_SUBTOPICS.map((st) => ({ ...st, createdAt: now })),
  };

  const nextId: Record<string, number> = {
    users: 1,
    questions: SEED_QUESTIONS.length + 1,
    countries: SEED_COUNTRIES.length + 1,
    exam_systems: SEED_EXAM_SYSTEMS.length + 1,
    exams: SEED_EXAMS.length + 1,
    programs: SEED_PROGRAMS.length + 1,
    academic_years: SEED_ACADEMIC_YEARS.length + 1,
    subjects: SEED_SUBJECTS.length + 1,
    systems: SEED_SYSTEMS.length + 1,
    topics: SEED_TOPICS.length + 1,
    subtopics: SEED_SUBTOPICS.length + 1,
  };

  const getTableName = (table: any): string => {
    if (!table) return '';
    if (typeof table === 'string') return table;
    // drizzle-orm >= 0.41 stores the table name under this symbol
    const drizzleName = table[Symbol.for('drizzle:Name')];
    if (typeof drizzleName === 'string' && drizzleName) return drizzleName;
    if (typeof table.name === 'string') return table.name;
    if (typeof table.tableName === 'string') return table.tableName;
    if (typeof table.toString === 'function') {
      const asString = table.toString();
      if (typeof asString === 'string' && asString.includes('Table')) {
        return asString.replace(/.*Table\("([^)]+)"\).*/, '$1');
      }
    }
    return '';
  };

  const getFieldName = (column: any): string | undefined => {
    if (!column) return undefined;
    if (typeof column === 'string') return column;
    // drizzle columns expose the DB column name (e.g. "is_active") via .name,
    // but mock rows are keyed by the TS property name (e.g. "isActive").
    // Resolve the TS key through the column's owning table so filters match.
    try {
      const table = column.table;
      const cols = table?.[Symbol.for('drizzle:Columns')];
      if (cols) {
        const entry = Object.entries(cols).find(([, c]) => c === column);
        if (entry) return entry[0];
      }
    } catch {}
    return column.name ?? column.columnName ?? column.fieldName;
  };

  /**
   * Recursively evaluate a drizzle SQL condition tree against a mock row.
   *
   * drizzle-orm >= 0.41 builds every condition (eq/ilike/inArray/and/or) as a
   * nested tree of `SQL` objects whose `queryChunks` are StringChunk (operators
   * and " and "/" or " separators), column objects, Param/Array value holders.
   * This walks that tree and returns true/false for a single row.
   */
  const evalChunks = (row: any, chunks: any[]): boolean => {
    // Split the chunk stream on " and "/" or " separators into comparison
    // groups; a nested SQL chunk is evaluated recursively. Each group records
    // the joiner that preceded it so OR groups combine correctly.
    const groups: Array<{ joiner: 'and' | 'or'; value: boolean }> = [];
    let pendingJoiner: 'and' | 'or' = 'and';
    let current: any = null;

    const push = (value: boolean) => {
      groups.push({ joiner: pendingJoiner, value });
      pendingJoiner = 'and';
    };
    const flushCurrent = () => {
      if (current) {
        if (!current.field) {
          current = null;
          return;
        }
        const rowValue = row[current.field];
        const values = current.values ?? [];
        let result: boolean;
        if (current.op === 'ilike') {
          const needle = String(values[0] ?? '').toLowerCase().replace(/%/g, '');
          result = typeof rowValue === 'string' && rowValue.toLowerCase().includes(needle);
        } else if (current.op === 'in') {
          result = values.includes(rowValue);
        } else {
          result = rowValue === values[0];
        }
        push(result);
        current = null;
      }
    };

    for (const chunk of chunks) {
      if (chunk === null || chunk === undefined) continue;

      // Raw string value: ilike params inline as a primitive String chunk.
      if (typeof chunk === 'string') {
        if (!current) current = { field: undefined, op: undefined, values: [] };
        current.values = [chunk];
        continue;
      }
      if (typeof chunk !== 'object') continue;

      // Nested SQL: a sub-condition (eq/ilike/inArray/and/or).
      if (Array.isArray(chunk.queryChunks)) {
        flushCurrent();
        push(evalChunks(row, chunk.queryChunks));
        continue;
      }

      // inArray(col, [...]) emits an array of Param chunks.
      if (Array.isArray(chunk)) {
        if (!current) current = { field: undefined, op: undefined, values: [] };
        current.values = chunk
          .filter((p: any) => p && p.constructor?.name === 'Param' && 'value' in p)
          .map((p: any) => p.value);
        current.op = 'in';
        continue;
      }

      const type = chunk.constructor?.name;

      if (type === 'StringChunk') {
        const text = (chunk.value || []).join('').trim();
        if (text === 'and' || text === 'or') {
          flushCurrent();
          pendingJoiner = text;
        } else if (text === '=' || text === 'ilike' || text === 'in') {
          if (!current) current = { field: undefined, op: undefined, values: [] };
          current.op = text;
        }
        // "(" / ")" / "" are structural noise; ignore.
        continue;
      }

      if (type === 'Param') {
        if (!current) current = { field: undefined, op: undefined, values: [] };
        current.values = [chunk.value];
        continue;
      }

      // Column object (PgText, PgSerial, ...) — resolve to the TS property name.
      const field = getFieldName(chunk);
      if (field) {
        if (!current) current = { field: undefined, op: undefined, values: [] };
        current.field = field;
        continue;
      }
    }
    flushCurrent();

    if (groups.length === 0) return true;

    // AND groups together; a group whose joiner is "or" is satisfied if any
    // of the OR-chained groups matched. Since the joiner lives on the group
    // that follows it, fold OR chains right-to-left.
    let result = true;
    let i = groups.length - 1;
    while (i >= 0) {
      let orChain = groups[i].value;
      while (i > 0 && groups[i].joiner === 'or') {
        i--;
        orChain = orChain || groups[i].value;
      }
      result = result && orChain;
      i--;
    }
    return result;
  };

  const matchesCondition = (row: any, condition: any, seen = new Set()): boolean => {
    if (condition === null || condition === undefined) return true;
    if (seen.has(condition)) return false;
    seen.add(condition);

    if (typeof condition !== 'object') {
      return Object.values(row).some((rowValue) =>
        typeof rowValue === 'string' && typeof condition === 'string'
          ? rowValue.toLowerCase() === condition.toLowerCase()
          : rowValue === condition
      );
    }

    if (Array.isArray(condition)) {
      return condition.every((c) => matchesCondition(row, c, seen));
    }

    // Drizzle SQL condition tree (eq/ilike/inArray/and/or in drizzle >= 0.41).
    if (Array.isArray(condition.queryChunks)) {
      return evalChunks(row, condition.queryChunks);
    }

    // Legacy shapes: and()/or() with explicit type + conditions list.
    if (condition.type === 'and' && Array.isArray(condition.conditions)) {
      return condition.conditions.every((c: any) => matchesCondition(row, c, seen));
    }
    if (condition.type === 'or' && Array.isArray(condition.conditions)) {
      return condition.conditions.some((c: any) => matchesCondition(row, c, seen));
    }

    return false;
  };


  const createQuery = (tableName: string, selectSpec?: any, distinct = false) => {
    let rows = mockData[tableName] ?? [];
    let whereCondition: any = undefined;

    const applyFilter = () => {
      if (!whereCondition) return rows;
      return rows.filter((row) => matchesCondition(row, whereCondition));
    };

    // selectDistinct projects only the requested columns and removes duplicates
    // (used by /api/questions/meta/filters for subject/system/university lists).
    const project = (result: any[]) => {
      if (selectSpec && typeof selectSpec === 'object' && !('count' in selectSpec)) {
        const keys = Object.keys(selectSpec);
        const projected = result.map((row) => {
          const out: any = {};
          for (const key of keys) {
            const column = selectSpec[key];
            const field = getFieldName(column);
            out[key] = row[field ?? key];
          }
          return out;
        });
        if (distinct) {
          const seen = new Set<string>();
          return projected.filter((row) => {
            const sig = JSON.stringify(row);
            if (seen.has(sig)) return false;
            seen.add(sig);
            return true;
          });
        }
        return projected;
      }
      return result;
    };

    let limitValue: number | undefined;
    let offsetValue: number | undefined;

    const query: any = {
      from: () => query,
      where(condition: any) {
        whereCondition = condition;
        return query;
      },
      limit(n: number) {
        limitValue = Number(n);
        return query;
      },
      offset(n: number) {
        offsetValue = Number(n);
        return query;
      },
      orderBy() {
        return query;
      },
      then(cb: any) {
        const result = applyFilter();
        if (selectSpec && typeof selectSpec === 'object' && 'count' in selectSpec) {
          return Promise.resolve(cb([{ count: result.length }]));
        }
        return Promise.resolve(cb(project(paginate(result))));
      },
      returning() {
        const result = applyFilter();
        if (selectSpec && typeof selectSpec === 'object' && 'count' in selectSpec) {
          return Promise.resolve([{ count: result.length }]);
        }
        return Promise.resolve(project(paginate(result)));
      },
    };

    // Apply LIMIT/OFFSET after filtering; the count subquery uses a fresh query
    // so it always counts the full filtered set.
    const paginate = (result: any[]) => {
      let out = result;
      if (offsetValue !== undefined) out = out.slice(offsetValue);
      if (limitValue !== undefined) out = out.slice(0, limitValue);
      return out;
    };

    return query;
  };

  const mockSelect = (selectSpec?: any) => ({
    from: (table: any) => createQuery(getTableName(table), selectSpec),
  });

  const mockSelectDistinct = (selectSpec?: any) => ({
    from: (table: any) => createQuery(getTableName(table), selectSpec, true),
  });

  const mockInsert = (table: any) => {
    const tableName = getTableName(table);
    return {
      values: (values: any) => ({
        returning: () => {
          const newRow = {
            id: nextId[tableName] ?? 1,
            ...values,
          };
          if (!mockData[tableName]) {
            mockData[tableName] = [];
          }
          mockData[tableName].push(newRow);
          nextId[tableName] = (nextId[tableName] ?? 1) + 1;
          return Promise.resolve([newRow]);
        },
        then(cb: any) {
          // Awaiting `db.insert(...).values(...)` without `.returning()` must
          // also insert — real Drizzle persists on `values()` and routes like
          // practice/bookmarks/import rely on that.
          const newRow = {
            id: nextId[tableName] ?? 1,
            ...values,
          };
          if (!mockData[tableName]) {
            mockData[tableName] = [];
          }
          mockData[tableName].push(newRow);
          nextId[tableName] = (nextId[tableName] ?? 1) + 1;
          return Promise.resolve(mockData[tableName]).then(cb);
        },
      }),
    };
  };

  const mockUpdate = (table: any) => {
    const tableName = getTableName(table);
    let updateValues: any = {};
    let whereCondition: any;

    return {
      set(values: any) {
        updateValues = values;
        return {
          where(condition: any) {
            whereCondition = condition;
            return {
              returning: () => {
                const rows = mockData[tableName] ?? [];
                const updated: any[] = [];
                for (const row of rows) {
                  if (matchesCondition(row, whereCondition)) {
                    Object.assign(row, updateValues);
                    updated.push({ ...row });
                  }
                }
                return Promise.resolve(updated);
              },
              then(cb: any) {
                return Promise.resolve(this.returning()).then(cb);
              },
            };
          },
        };
      },
    };
  };

  const mockDelete = (table: any) => {
    const tableName = getTableName(table);
    let whereCondition: any;
    return {
      where(condition: any) {
        whereCondition = condition;
        return {
          returning: () => {
            const rows = mockData[tableName] ?? [];
            const remaining = rows.filter((row) => !matchesCondition(row, whereCondition));
            mockData[tableName] = remaining;
            return Promise.resolve([]);
          },
          then(cb: any) {
            // Awaiting `db.delete().where(...)` directly must also perform the
            // deletion (routes use both `await` and `.returning()` forms).
            return Promise.resolve(this.returning()).then(cb);
          },
        };
      },
    };
  };

  db = {
    select: mockSelect,
    selectDistinct: mockSelectDistinct,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: mockSelect,
  } as any;
} else {
  // PostgreSQL setup for production
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  db = drizzle(pool, { schema });
  console.log('📊 Using PostgreSQL database');
}

// NOTE: Workspace package resolution can load duplicate Drizzle types in this monorepo.
// Casting keeps runtime behavior intact while avoiding false-positive cross-package TS conflicts.
export { db };

export async function testConnection() {
  try {
    if (useSQLite) {
      console.log('✅ Mock database ready for development');
    } else {
      // Test PostgreSQL connection
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
      });
      const client = await pool.connect();
      client.release();
      await pool.end();
      console.log('✅ PostgreSQL database connected successfully');
    }
  } catch (err) {
    console.error('❌ Database connection failed');
    if (!useSQLite) {
      console.error('📚 PostgreSQL setup: Check that your DATABASE_URL in .env points to a valid PostgreSQL database');
    }
    process.exit(1);
  }
}