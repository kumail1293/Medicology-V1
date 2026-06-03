import * as schema from "./schema/index.js";
export declare const pool: import("pg").Pool;
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: import("pg").Pool;
};
export * from "./schema/index.js";
//# sourceMappingURL=index.d.ts.map