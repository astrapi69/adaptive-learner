import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exportMock = vi.fn();
const saveBackupToDiskMock = vi.fn();

vi.mock("../../../storage", () => ({
  getStorage: () => ({ backup: { export: exportMock } }),
}));
vi.mock("../../../lib/learning/learnerState", () => ({ readLearnerState: () => ({ userId: "u1" }) }));
vi.mock("../../../utils/backup-download", () => ({
  saveBackupToDisk: (...args: unknown[]) => saveBackupToDiskMock(...args),
  backupFilename: () => "adaptive-learner-backup-x.json",
}));
vi.mock("../../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

import SelectiveExportSection from "./SelectiveExportSection";

function fullPayload() {
  return {
    format: "adaptive-learner-backup",
    version: "1.3.0",
    created_at: "2026-06-15T00:00:00Z",
    user_id: "u1",
    storage_mode: "dexie",
    data: {
      users: [{ id: "u1" }],
      subjects: [{ id: "s1" }],
      tags: [{ id: "t1" }],
      learning_projects: [{ id: "p1" }],
    },
    stats: { total_records: 4, tables: {}, content_sets: 0 },
  };
}

describe("SelectiveExportSection", () => {
  beforeEach(() => {
    exportMock.mockReset().mockResolvedValue(fullPayload());
    saveBackupToDiskMock.mockReset().mockResolvedValue({ method: "download", filename: "x" });
  });

  it("renders all category groups and the master toggle", () => {
    render(<SelectiveExportSection />);
    expect(screen.getByTestId("data-export-select-all")).toBeInTheDocument();
    expect(screen.getByTestId("data-export-group-content")).toBeInTheDocument();
    expect(screen.getByTestId("data-export-cat-projects")).toBeInTheDocument();
    expect(screen.getByTestId("data-export-cat-ai_config")).toBeInTheDocument();
  });

  it("creates a full backup with the full filename", async () => {
    render(<SelectiveExportSection />);
    fireEvent.click(screen.getByTestId("data-export-full"));
    await waitFor(() => expect(saveBackupToDiskMock).toHaveBeenCalled());
    const [, filename] = saveBackupToDiskMock.mock.calls[0];
    expect(filename).toBe("adaptive-learner-backup-x.json");
  });

  it("exports only the selected tables in the importable format", async () => {
    render(<SelectiveExportSection />);
    // Start from a known selection: select-all, then deselect, then pick subjects.
    fireEvent.click(screen.getByTestId("data-export-select-all")); // -> all
    fireEvent.click(screen.getByTestId("data-export-select-all")); // -> none
    fireEvent.click(screen.getByTestId("data-export-cat-subjects"));
    fireEvent.click(screen.getByTestId("data-export-selective"));
    await waitFor(() => expect(saveBackupToDiskMock).toHaveBeenCalled());
    const [payload, filename, backupType] = saveBackupToDiskMock.mock.calls[0];
    expect(filename).toMatch(/^adaptive-learner-export-\d{4}-\d{2}-\d{2}\.alb$/);
    expect(backupType).toBe("selective");
    expect(Object.keys(payload.data).sort()).toEqual(["subjects", "users"]);
    expect(payload.format).toBe("adaptive-learner-backup");
  });

  it("disables the selective export when nothing is selected", () => {
    render(<SelectiveExportSection />);
    fireEvent.click(screen.getByTestId("data-export-select-all")); // all
    fireEvent.click(screen.getByTestId("data-export-select-all")); // none
    expect(screen.getByTestId("data-export-selective")).toBeDisabled();
  });
});
