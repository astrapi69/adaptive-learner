import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SecretInput } from "./SecretInput";

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

/** A controlled host so the input value updates on change. */
function Host() {
  const [value, setValue] = useState("");
  return (
    <SecretInput
      value={value}
      onChange={(e) => setValue(e.target.value)}
      data-testid="secret"
      aria-label="Secret"
    />
  );
}

describe("SecretInput", () => {
  it("is a text input, never a password field (no password-manager autofill)", () => {
    render(<Host />);
    const input = screen.getByTestId("secret");
    expect(input).toHaveAttribute("type", "text");
    expect(input).not.toHaveAttribute("type", "password");
  });

  it("opts out of every common password manager", () => {
    render(<Host />);
    const input = screen.getByTestId("secret");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("autocapitalize", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("data-1p-ignore"); // 1Password
    expect(input).toHaveAttribute("data-lpignore", "true"); // LastPass
    expect(input).toHaveAttribute("data-bwignore", "true"); // Bitwarden
    expect(input).toHaveAttribute("data-form-type", "other"); // Dashlane
  });

  it("is not wrapped in a <form>", () => {
    render(<Host />);
    expect(screen.getByTestId("secret").closest("form")).toBeNull();
  });

  it("masks the value by default and reveals it on toggle", () => {
    render(<Host />);
    const input = screen.getByTestId("secret");
    fireEvent.change(input, { target: { value: "sk-secret-123" } });
    expect((input as HTMLInputElement).value).toBe("sk-secret-123");

    // Masked by default: the reveal toggle offers "Show value".
    const toggle = screen.getByRole("button", { name: "Show value" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(input.className).toContain("[-webkit-text-security:disc]");

    // Click reveals: the toggle flips and the masking class is gone.
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: "Hide value" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("secret").className).not.toContain(
      "[-webkit-text-security:disc]",
    );
  });

  it("disables the reveal toggle when the input is disabled", () => {
    render(
      <SecretInput value="x" onChange={() => {}} data-testid="s" disabled />,
    );
    expect(screen.getByTestId("s")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show value" })).toBeDisabled();
  });

  it("keeps the reveal toggle out of the tab order", () => {
    render(<Host />);
    expect(screen.getByRole("button", { name: "Show value" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
