/**
 * RecoveryNotice (#2161): state-driven (renders only on detected state),
 * per-set restore/restart, numeric result feedback, and a non-forcing backup
 * offer (condition 4). Mocks the mode-agnostic service so both modes are
 * covered by construction.
 */

import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import RecoveryNotice from "./RecoveryNotice";

const assessJkzRecovery = vi.fn();
const restoreRecoverySet = vi.fn();
const restartRecoverySet = vi.fn();
const exportBackupNow = vi.fn();
const success = vi.fn();
const info = vi.fn();
const error = vi.fn();

vi.mock("../../lib/content/recovery/jkz-recovery-service", () => ({
    assessJkzRecovery: () => assessJkzRecovery(),
    restoreRecoverySet: (id: string) => restoreRecoverySet(id),
    restartRecoverySet: (id: string) => restartRecoverySet(id),
}));
vi.mock("../../lib/backup/exportBackupNow", () => ({
    exportBackupNow: (id: string) => exportBackupNow(id),
}));
vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "u1"}),
}));
vi.mock("../../utils/notify", () => ({
    notify: {success: (m: string) => success(m), info: (m: string) => info(m), error: (m: string) => error(m)},
}));
vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k, lang: "en", setLang: () => {}}),
}));

const SET = "ja-a1-from-de";
const assessment = (over: Record<string, unknown> = {}) => ({
    affectedSets: [SET],
    applicableCount: 3,
    unmappableCount: 0,
    remapsBySet: {[SET]: [{}, {}, {}]},
    ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    restoreRecoverySet.mockResolvedValue({applied: 3, skipped: 0, unmapped: 0});
    restartRecoverySet.mockResolvedValue(undefined);
    exportBackupNow.mockResolvedValue({status: "saved", filename: "b.alb", records: 10});
});
afterEach(cleanup);

describe("RecoveryNotice (#2161)", () => {
    it("renders nothing when no recoverable state is detected", async () => {
        assessJkzRecovery.mockResolvedValue(null);
        const {container} = render(<RecoveryNotice />);
        await waitFor(() => expect(assessJkzRecovery).toHaveBeenCalled());
        expect(container.querySelector("[data-testid='recovery-notice']")).toBeNull();
    });

    it("shows the notice with a per-set row and its affected count when detected", async () => {
        assessJkzRecovery.mockResolvedValue(assessment());
        render(<RecoveryNotice />);
        expect(await screen.findByTestId("recovery-notice")).toBeTruthy();
        expect(screen.getByTestId(`recovery-set-${SET}`)).toBeTruthy();
        expect(screen.getByText(/3 affected review cards/)).toBeTruthy();
    });

    it("offers a backup export (condition 4) without forcing it", async () => {
        assessJkzRecovery.mockResolvedValue(assessment());
        render(<RecoveryNotice />);
        fireEvent.click(await screen.findByTestId("recovery-notice-backup"));
        await waitFor(() => expect(exportBackupNow).toHaveBeenCalledWith("u1"));
    });

    it("restore relinks and reports the numeric result, then re-assesses", async () => {
        assessJkzRecovery.mockResolvedValueOnce(assessment()).mockResolvedValueOnce(null);
        render(<RecoveryNotice />);
        fireEvent.click(await screen.findByTestId(`recovery-restore-${SET}`));
        await waitFor(() => expect(restoreRecoverySet).toHaveBeenCalledWith(SET));
        await waitFor(() =>
            expect(success).toHaveBeenCalledWith(expect.stringMatching(/Relinked 3 review cards/)),
        );
        await waitFor(() => expect(assessJkzRecovery).toHaveBeenCalledTimes(2));
    });

    it("surfaces the unmappable count when a partial relink leaves some cards", async () => {
        assessJkzRecovery.mockResolvedValueOnce(assessment()).mockResolvedValueOnce(null);
        restoreRecoverySet.mockResolvedValue({applied: 2, skipped: 0, unmapped: 1});
        render(<RecoveryNotice />);
        fireEvent.click(await screen.findByTestId(`recovery-restore-${SET}`));
        await waitFor(() =>
            expect(info).toHaveBeenCalledWith(expect.stringMatching(/1 cards could not be relinked/)),
        );
    });

    it("restart asks for confirmation before deleting (destructive)", async () => {
        assessJkzRecovery.mockResolvedValueOnce(assessment()).mockResolvedValueOnce(null);
        render(<RecoveryNotice />);
        fireEvent.click(await screen.findByTestId(`recovery-restart-${SET}`));
        expect(restartRecoverySet).not.toHaveBeenCalled();
        fireEvent.click(await screen.findByTestId(`recovery-restart-confirm-${SET}`));
        await waitFor(() => expect(restartRecoverySet).toHaveBeenCalledWith(SET));
    });
});
