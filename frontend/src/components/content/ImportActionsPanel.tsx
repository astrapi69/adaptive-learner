/**
 * Import-tab actions panel (#1253).
 *
 * Hosts the two blocks moved out of "Meine Inhalte" during the content
 * IA redesign:
 *   1. the five import/creation action buttons
 *      ({@link ContentActionButtons}), and
 *   2. the standalone **"My Lessons"** section
 *      ({@link MyLessonsSection}) — the user-generated / adaptive sets
 *      with their full action set (Play / Edit / Export / Export-as-set /
 *      Share / Delete / Generate-exercises).
 *
 * Self-contained: it owns the set data ({@link useContentSetsData}), the
 * set-level handlers ({@link useContentSetActions}), and the community
 * share flow ({@link useContentSharing}) plus the modals those drive
 * ({@link ImportLessonModal}, {@link ContentShareDialog},
 * {@link DeleteLessonModal}). Behaviour-preserving: every button and
 * every "My Lessons" action works exactly as it did on the Content page,
 * just relocated.
 *
 * EXP-026 folded user lessons stay on the Content tree (they are part of
 * browsing downloaded content), so this panel renders the full
 * user-generated set list — no fold computation here.
 */

import { useState } from "react";
import { useNavigate } from "react-router";

import ContentActionButtons from "./browser/ContentActionButtons";
import DeleteLessonFromSetModal from "./lessons/DeleteLessonFromSetModal";
import BulkDeleteLessonsModal from "./lessons/BulkDeleteLessonsModal";
import MyLessonsSection from "./lessons/MyLessonsSection";
import ImportLessonModal from "./lessons/ImportLessonModal";
import CombineLessonsDialog from "./lessons/CombineLessonsDialog";
import ContentShareDialog from "./share/ContentShareDialog";
import DeleteLessonModal from "./lessons/DeleteLessonModal";
import { useContentSetsData } from "../../hooks/content/useContentSetsData";
import { useContentSetActions } from "../../hooks/content/useContentSetActions";
import { useCombineLessons } from "../../hooks/content/combine";
import { useContentSharing } from "../../hooks/content/useContentSharing";
import { useApiKeyStatus } from "../../hooks/settings/useApiKeyStatus";
import {
  listContributions,
  recordContribution,
} from "../../lib/content/placement/contribution-history";
import { USER_GENERATED_SOURCE } from "../../storage/types";

/** Community contribution target repo (manual maintainer review). */
const COMMUNITY_REPO = "astrapi69/adaptive-learner-content";
const COMMUNITY_BRANCH = "main";
/** "Share with Community" opens a GitHub pull request against the content
 *  repo. Mirrors the Content-page flag so the two stay in lock-step. */
const COMMUNITY_SHARING_ENABLED = true;

/** The Import-tab actions + My-Lessons panel. */
export default function ImportActionsPanel() {
  const navigate = useNavigate();
  const data = useContentSetsData();
  const { sets, setSets, setPerSetState, loadSets } = data;
  const { hasKey, activeProvider } = useApiKeyStatus();

  const [showImport, setShowImport] = useState(false);

  const actions = useContentSetActions({ navigate, setSets, setPerSetState });
  const share = useContentSharing({ sets, fetchSetLessons: actions.fetchSetLessons });

  const recordShare = (url: string, title: string) => {
    if (!share.shareTarget) return;
    recordContribution({
      lesson_id: share.shareTarget.id,
      title,
      shared_at: new Date().toISOString(),
      github_url: url,
      status: "submitted",
    });
    // Refresh the cached list so the Content tab's "My Contributions"
    // section reflects the new entry on its next mount.
    listContributions();
  };

  const userSets = sets.filter((s) => s.source === USER_GENERATED_SOURCE);
  const downloadedSets = sets.filter((s) => s.source !== USER_GENERATED_SOURCE);

  const combine = useCombineLessons({
    userSets,
    fetchSetLessons: actions.fetchSetLessons,
    reload: loadSets,
  });

  return (
    <section data-testid="import-actions-panel">
      <ContentActionButtons onImportLesson={() => setShowImport(true)} navigate={navigate} />

      {userSets.length > 0 && (
        <MyLessonsSection
          userSets={userSets}
          communitySharingEnabled={COMMUNITY_SHARING_ENABLED}
          onOpen={(e) => void actions.handleOpenLesson(e)}
          onEdit={actions.handleEditUserSet}
          onExportJson={(e) => void actions.handleExportJson(e)}
          onExportSet={(e) => void actions.handleExportSet(e)}
          onShare={(e) => void share.handleShare(e)}
          onDelete={actions.setDeleteTarget}
          onPlayLessonFile={(e, filename) => actions.openLessonFile(e.source, e.id, filename)}
          onEditLessonFile={(e, filename) => actions.handleEditUserSet(e, filename)}
          onRequestDeleteLesson={actions.setDeleteLessonTarget}
          onRequestBulkDeleteLesson={actions.setBulkDeleteLessonsTarget}
          selectMode={combine.selectMode}
          selectedCount={combine.selectedCount}
          isSelected={combine.isSelected}
          onToggleSelectMode={combine.toggleSelectMode}
          onToggleSelect={combine.toggleSelect}
          onOpenCombine={combine.openDialog}
        />
      )}

      <CombineLessonsDialog
        open={combine.dialogOpen}
        selectedCount={combine.selectedCount}
        languages={combine.languages}
        existingTargets={combine.existingTargets}
        combining={combine.combining}
        onCancel={combine.closeDialog}
        onConfirm={(decision) => void combine.combine(decision)}
      />

      <ImportLessonModal
        open={showImport}
        existingSetIds={new Set(userSets.map((s) => s.id))}
        onCancel={() => setShowImport(false)}
        onImported={() => {
          setShowImport(false);
          void loadSets();
        }}
      />

      <ContentShareDialog
        share={share}
        knownSets={downloadedSets}
        repo={COMMUNITY_REPO}
        branch={COMMUNITY_BRANCH}
        hasKey={hasKey}
        activeProvider={activeProvider ?? null}
        navigate={navigate}
        onEditUserSet={actions.handleEditUserSet}
        onShared={recordShare}
      />

      <DeleteLessonModal
        target={actions.deleteTarget}
        deleting={actions.deleting}
        onCancel={() => actions.setDeleteTarget(null)}
        onConfirm={actions.handleDeleteUserSet}
      />

      <DeleteLessonFromSetModal
        target={actions.deleteLessonTarget}
        deleting={actions.deletingLesson}
        plan={actions.deleteLessonPlan}
        onCancel={() => actions.setDeleteLessonTarget(null)}
        onConfirm={(deleteProgress) => void actions.handleConfirmDeleteLesson(deleteProgress)}
      />

      {/* #2065 — destructive confirmation for removing several lessons of a
          set at once. ``emptiesSet`` drives the "whole set will be deleted"
          copy when the selection covers every lesson (the hook makes the
          authoritative decision from the live lesson list). */}
      <BulkDeleteLessonsModal
        count={actions.bulkDeleteLessonsTarget?.filenames.length ?? 0}
        emptiesSet={
          actions.bulkDeleteLessonsTarget
            ? actions.bulkDeleteLessonsTarget.filenames.length >=
              (actions.bulkDeleteLessonsTarget.entry.lesson_count ?? 0)
            : false
        }
        deleting={actions.bulkDeletingLessons}
        plan={actions.bulkDeleteLessonsPlan}
        onCancel={() => actions.setBulkDeleteLessonsTarget(null)}
        onConfirm={(deleteProgress) =>
          void actions.handleConfirmBulkDeleteLessons(deleteProgress)
        }
      />
    </section>
  );
}
