/**
 * useInviteCodes — coach-side state for one content repo's invitation codes
 * (#1093). Loads the repo's ``codes/*.json`` via the per-repo token, and
 * exposes generate + deactivate actions. Token-required: a repo with no stored
 * token cannot host codes (the coach writes them with their own credentials).
 */

import { useCallback, useEffect, useState } from "react";

import {
  generateInviteCode,
  type InviteCodeFile,
} from "../../../lib/content/invites/invite-codes";
import {
  deactivateInviteCode,
  listInviteCodes,
  writeInviteCode,
} from "../../../lib/content/invites/invite-store";

/** Options for {@link UseInviteCodes.generate}. */
export interface GenerateInput {
  /** Optional custom prefix (e.g. ``"DEUTSCH"``). */
  prefix?: string;
  /** Intended max redemptions (advisory in Dexie mode). */
  maxUses: number;
  /** Inclusive expiry date ``YYYY-MM-DD`` or empty for none. */
  expires: string;
  /** Free-text note (e.g. a class name). */
  note: string;
}

export interface UseInviteCodes {
  /** The repo's codes, newest first. */
  codes: InviteCodeFile[];
  loading: boolean;
  /** A generate / deactivate call is in flight. */
  working: boolean;
  /** Last error message (load or action), or null. */
  error: string | null;
  /** Generate + persist a new code; returns it (or null on failure). */
  generate: (input: GenerateInput) => Promise<InviteCodeFile | null>;
  /** Deactivate an existing code (blocks new redemptions). */
  deactivate: (code: string) => Promise<boolean>;
  /** Re-read the codes from the repo. */
  reload: () => Promise<void>;
}

/**
 * @param source ``owner/repo`` of the coach repo.
 * @param branch Branch the code files live on.
 * @param token Per-repo token (empty disables loading + actions).
 * @param nowIso Injectable clock (tests); defaults to the real time.
 */
export function useInviteCodes(
  source: string,
  branch: string,
  token: string,
  nowIso: () => string = () => new Date().toISOString(),
): UseInviteCodes {
  const [codes, setCodes] = useState<InviteCodeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortNewest = (list: InviteCodeFile[]): InviteCodeFile[] =>
    [...list].sort((a, b) => (a.created < b.created ? 1 : -1));

  const reload = useCallback(async () => {
    if (!token.trim()) {
      setCodes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listInviteCodes(source, branch, token);
      setCodes(sortNewest(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [source, branch, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const generate = useCallback(
    async (input: GenerateInput): Promise<InviteCodeFile | null> => {
      if (!token.trim()) return null;
      setWorking(true);
      setError(null);
      try {
        const file: InviteCodeFile = {
          code: generateInviteCode({ prefix: input.prefix }),
          repo: source,
          branch,
          max_uses: Math.max(0, Math.floor(input.maxUses)),
          expires: input.expires.trim() || null,
          note: input.note.trim(),
          created: nowIso(),
        };
        await writeInviteCode(source, branch, token, file);
        setCodes((prev) => sortNewest([file, ...prev]));
        return file;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setWorking(false);
      }
    },
    [source, branch, token, nowIso],
  );

  const deactivate = useCallback(
    async (code: string): Promise<boolean> => {
      if (!token.trim()) return false;
      setWorking(true);
      setError(null);
      try {
        const updated = await deactivateInviteCode(source, branch, token, code);
        if (updated) {
          setCodes((prev) =>
            prev.map((c) => (c.code === updated.code ? updated : c)),
          );
        }
        return Boolean(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setWorking(false);
      }
    },
    [source, branch, token],
  );

  return { codes, loading, working, error, generate, deactivate, reload };
}
