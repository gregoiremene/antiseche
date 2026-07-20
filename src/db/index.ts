import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DB_NAME = 'antiseche.db';

export const sqliteDb = openDatabaseSync(DB_NAME, {
  // requis par useLiveQuery pour rafraîchir les écrans automatiquement
  enableChangeListener: true,
});

// SQLite désactive les clés étrangères par défaut : sans ça, les `onDelete:
// cascade` du schéma ne s'appliquent pas et on garde des orphelins.
sqliteDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqliteDb, { schema });

export { schema };
