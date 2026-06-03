import {
  and as drizzleAnd,
  desc as drizzleDesc,
  eq as drizzleEq,
  ilike as drizzleIlike,
  inArray as drizzleInArray,
  or as drizzleOr,
  sql as drizzleSql,
} from 'drizzle-orm';

// Monorepo package boundaries can produce incompatible Drizzle generic instances at type level.
// These aliases keep runtime behavior unchanged while normalizing route-side typing.
export const eq: (left: any, right: any) => any = drizzleEq as any;
export const and: (...conditions: any[]) => any = drizzleAnd as any;
export const or: (...conditions: any[]) => any = drizzleOr as any;
export const ilike: (left: any, right: any) => any = drizzleIlike as any;
export const inArray: (left: any, values: any[]) => any = drizzleInArray as any;
export const desc: (value: any) => any = drizzleDesc as any;
export const sql: any = drizzleSql;
