declare module 'sql.js/dist/sql-asm.js' {
  import type { Database, SqlJsStatic } from 'sql.js';
  export type { Database, SqlJsStatic };
  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
