import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MigrationWelcomeDialog, {
  type MigrationWelcomeLabels,
} from "./MigrationWelcomeDialog";

const labels: MigrationWelcomeLabels = {
  title: "Bring your data",
  body: "Used it online?",
  hint: "Create a backup there.",
  importLabel: "Import backup",
  importing: "Restoring…",
  openOnline: "Open online version",
  startFresh: "Start without data",
  close: "Close",
};

function setup(over: Partial<React.ComponentProps<typeof MigrationWelcomeDialog>> = {}) {
  const onImport = vi.fn();
  const onOpenOnline = vi.fn();
  const onStartFresh = vi.fn();
  render(
    <MigrationWelcomeDialog
      open
      labels={labels}
      onImport={onImport}
      onOpenOnline={onOpenOnline}
      onStartFresh={onStartFresh}
      {...over}
    />,
  );
  return { onImport, onOpenOnline, onStartFresh };
}

describe("MigrationWelcomeDialog", () => {
  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByTestId("migration-welcome")).not.toBeInTheDocument();
  });

  it("shows the title, body, and three actions when open", () => {
    setup();
    expect(screen.getByText("Bring your data")).toBeInTheDocument();
    expect(screen.getByTestId("migration-import")).toBeInTheDocument();
    expect(screen.getByTestId("migration-open-online")).toBeInTheDocument();
    expect(screen.getByTestId("migration-start-fresh")).toBeInTheDocument();
  });

  it("fires each action callback", () => {
    const { onImport, onOpenOnline, onStartFresh } = setup();
    fireEvent.click(screen.getByTestId("migration-import"));
    fireEvent.click(screen.getByTestId("migration-open-online"));
    fireEvent.click(screen.getByTestId("migration-start-fresh"));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onOpenOnline).toHaveBeenCalledTimes(1);
    expect(onStartFresh).toHaveBeenCalledTimes(1);
  });

  it("disables actions and shows the importing label while restoring", () => {
    setup({ importing: true });
    expect(screen.getByTestId("migration-import")).toBeDisabled();
    expect(screen.getByTestId("migration-open-online")).toBeDisabled();
    expect(screen.getByText("Restoring…")).toBeInTheDocument();
  });
});
