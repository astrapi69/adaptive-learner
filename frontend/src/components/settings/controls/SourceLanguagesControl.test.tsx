import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SourceLanguagesControl from "./SourceLanguagesControl";
import { readAdditionalSourceLanguages } from "../../../lib/content/language/sourceLanguagePref";

afterEach(() => {
  localStorage.clear();
});

describe("SourceLanguagesControl", () => {
  it("disables + checks the app language (de, from the i18n fallback)", () => {
    render(<SourceLanguagesControl />);
    const de = screen.getByTestId("settings-source-language-de");
    expect(de).toBeChecked();
    expect(de).toBeDisabled();
  });

  it("persists an opted-in additional source language", () => {
    render(<SourceLanguagesControl />);
    const en = screen.getByTestId("settings-source-language-en");
    expect(en).not.toBeChecked();
    fireEvent.click(en);
    expect(en).toBeChecked();
    expect(readAdditionalSourceLanguages()).toContain("en");
  });

  it("removes a source language when unticked", () => {
    render(<SourceLanguagesControl />);
    const es = screen.getByTestId("settings-source-language-es");
    fireEvent.click(es);
    expect(readAdditionalSourceLanguages()).toContain("es");
    fireEvent.click(es);
    expect(readAdditionalSourceLanguages()).not.toContain("es");
  });
});
