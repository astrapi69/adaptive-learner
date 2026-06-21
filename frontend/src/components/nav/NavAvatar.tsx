/**
 * NavAvatar — the learner's profile picture in the top Navigation bar
 * (#508), beside the XP badge.
 *
 * App-specific glue around the presentational ``shared/InitialsAvatar``:
 * it resolves the active learner, reads the name + the avatar from
 * whichever storage backing is active (ApiStorage / DexieStorage), and
 * renders the saved picture (or the generated initials when none is
 * set). The whole avatar links to Settings, where the picture is
 * managed. Refreshes on route change + tab focus so a freshly-saved
 * picture shows without a reload.
 *
 * Renders nothing until a learner exists, so it never flashes on a
 * fresh / anonymous install.
 */

import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import InitialsAvatar from "../../shared/media/InitialsAvatar";
import { useI18n } from "../../hooks/ui/useI18n";
import { readLearnerState } from "../../lib/learning/learnerState";
import { PROFILE_UPDATED_EVENT } from "../../lib/learning/profileSignal";
import { getStorage } from "../../storage";

const SIZE = 28;

export default function NavAvatar() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [name, setName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    const userId = readLearnerState().userId;
    if (!userId) {
      setName(null);
      return;
    }
    let cancelled = false;
    async function refresh() {
      try {
        const [user, settings] = await Promise.all([
          getStorage().users.get(userId!),
          getStorage().settings.get(userId!),
        ]);
        if (cancelled) return;
        setName(user.name);
        setAvatar(settings.avatar ?? null);
      } catch {
        // Chrome-only adornment — never surface a read failure.
      }
    }
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    // Live update when Settings saves a new name / picture (#579).
    window.addEventListener(PROFILE_UPDATED_EVENT, onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(PROFILE_UPDATED_EVENT, onFocus);
    };
  }, [pathname]);

  if (!name) return null;

  const label = t("nav.profile", "Your profile");
  return (
    <NavLink
      to="/settings?tab=general"
      className="nav-avatar inline-flex items-center"
      data-testid="nav-avatar"
      title={label}
      aria-label={label}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          aria-hidden="true"
          className="rounded-full object-cover"
          style={{ width: SIZE, height: SIZE }}
          data-testid="nav-avatar-image"
        />
      ) : (
        <InitialsAvatar name={name} size={SIZE} testId="nav-avatar-initials" />
      )}
    </NavLink>
  );
}
