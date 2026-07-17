export const MIGRATION_0002_SQL = `
-- Voice ID columns are added via alter[] in nativeClient (ALTER TABLE ADD COLUMN).
SELECT 1;
`;
