import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@workspace/db/schema';

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

  const mockData: Record<string, any[]> = {
    users: [],
  };

  const nextId: Record<string, number> = {
    users: 1,
  };

  const getTableName = (table: any): string => {
    if (!table) return '';
    if (typeof table === 'string') return table;
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
    return column.name ?? column.columnName ?? column.fieldName;
  };

  const collectPrimitiveValues = (condition: any, values: any[] = [], seen = new Set()): any[] => {
    if (!condition || seen.has(condition)) return values;
    if (typeof condition !== 'object') {
      if (typeof condition === 'string' || typeof condition === 'number' || typeof condition === 'boolean') {
        values.push(condition);
      }
      return values;
    }
    seen.add(condition);
    if (Array.isArray(condition)) {
      for (const item of condition) collectPrimitiveValues(item, values, seen);
      return values;
    }
    for (const key of Object.keys(condition)) {
      collectPrimitiveValues(condition[key], values, seen);
    }
    return values;
  };

  const parseSqlCondition = (condition: any) => {
    if (!condition || typeof condition !== 'object' || !Array.isArray(condition.queryChunks)) {
      return null;
    }
    let field: string | undefined;
    let value: any;
    for (const chunk of condition.queryChunks) {
      if (!chunk || typeof chunk !== 'object') continue;
      if (!field) {
        const parsedField = getFieldName(chunk);
        if (parsedField) field = parsedField;
      }
      if (value === undefined && chunk.constructor?.name === 'Param' && 'value' in chunk) {
        value = chunk.value;
      }
    }
    return field && value !== undefined ? { field, value } : null;
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

    const sqlCondition = parseSqlCondition(condition);
    if (sqlCondition) {
      const leftValue = row[sqlCondition.field];
      return leftValue === sqlCondition.value;
    }

    if (condition.left !== undefined && condition.right !== undefined) {
      const field = getFieldName(condition.left);
      const value = condition.right?.value ?? condition.right;
      if (field) {
        const leftValue = row[field];
        if (condition.operator === 'ilike' || condition.op === 'ilike') {
          return typeof leftValue === 'string' && typeof value === 'string'
            ? leftValue.toLowerCase().includes(value.toLowerCase().replace(/%/g, ''))
            : false;
        }
        console.log('Mock DB check:', { field, leftValue, value, equal: leftValue === value });
        return leftValue === value;
      }
      return false;
    }

    if (condition.type === 'and' && Array.isArray(condition.conditions)) {
      return condition.conditions.every((c: any) => matchesCondition(row, c, seen));
    }
    if (condition.type === 'or' && Array.isArray(condition.conditions)) {
      return condition.conditions.some((c: any) => matchesCondition(row, c, seen));
    }

    return false;
  };


  const createQuery = (tableName: string, selectSpec?: any) => {
    let rows = mockData[tableName] ?? [];
    let whereCondition: any = undefined;

    const applyFilter = () => {
      if (!whereCondition) return rows;
      const filtered = rows.filter((row) => {
        const match = matchesCondition(row, whereCondition);
        if (tableName === 'users') {
          console.log('Mock user row match:', { email: row.email, match });
        }
        return match;
      });
      if (tableName === 'users') {
        console.log('Mock users filter result count:', filtered.length, 'of', rows.length);
      }
      return filtered;
    };

    const query: any = {
      from: () => query,
      where(condition: any) {
        whereCondition = condition;
        if (tableName === 'users') {
          console.log('Mock query condition for users:', JSON.stringify(condition, null, 2));
          console.log('Condition keys:', Object.keys(condition));
          console.log('Condition type:', typeof condition);
          console.log('Condition constructor:', condition?.constructor?.name);
        }
        return query;
      },
      limit() {
        return query;
      },
      offset() {
        return query;
      },
      orderBy() {
        return query;
      },
      then(cb: any) {
        const result = applyFilter();
        return Promise.resolve(cb(result));
      },
      returning() {
        const result = applyFilter();
        if (selectSpec && typeof selectSpec === 'object' && 'count' in selectSpec) {
          return Promise.resolve([{ count: result.length }]);
        }
        return Promise.resolve(result);
      },
    };

    return query;
  };

  const mockSelect = (selectSpec?: any) => ({
    from: (table: any) => createQuery(getTableName(table), selectSpec),
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
            return Promise.resolve([]).then(cb);
          },
        };
      },
    };
  };

  db = {
    select: mockSelect,
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