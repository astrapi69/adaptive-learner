/**
 * Secrets never cross the LAN sync wire (#3854).
 *
 * Browser mode keeps the AI provider keys in the clear, and the sync
 * transport is plain ``http`` on the local network. The secret
 * definitions are the backup's (``EXCLUDED_USER_SETTINGS_FIELDS``,
 * ``SECRET_TABLES``): both surfaces carry the learner's data to another
 * device and neither carries a key. The ``api_key_backups`` table is
 * left out of ``SYNC_TABLES`` altogether; this module handles the key
 * fields on ``user_settings``.
 *
 * Both lists name what is excluded, so a new secret nobody adds to them
 * is synced (#3854, findings).
 */

import { EXCLUDED_USER_SETTINGS_FIELDS } from "../backup/backup-tables";

const SETTINGS_TABLE = "user_settings";

/** Whether rows of ``table`` carry secret fields at all. */
export function hasSyncSecrets(table: string): boolean {
  return table === SETTINGS_TABLE;
}

/**
 * Return ``record`` without its secret fields. Only ``user_settings``
 * rows carry any; a record of any other table comes back unchanged.
 * Never mutates the input.
 */
export function stripSyncSecrets(
  table: string,
  record: Record<string, unknown>,
): Record<string, unknown> {
  if (!hasSyncSecrets(table)) return record;
  return Object.fromEntries(
    Object.entries(record).filter(
      ([field]) => !EXCLUDED_USER_SETTINGS_FIELDS.has(field),
    ),
  );
}

/**
 * Prepare a pulled row for writing over the local one: whatever secret
 * fields the sender included are dropped, and this browser's own values
 * are carried over, so a pull neither erases a key nor replaces it with
 * the sender's (a desktop holds ciphertext). Without a local row the
 * result has no secret field.
 */
export function keepLocalSecrets(
  table: string,
  pulled: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const stripped = stripSyncSecrets(table, pulled);
  if (!hasSyncSecrets(table) || existing === undefined) return stripped;
  const localSecrets = Object.fromEntries(
    Object.entries(existing).filter(([field]) =>
      EXCLUDED_USER_SETTINGS_FIELDS.has(field),
    ),
  );
  return { ...stripped, ...localSecrets };
}
