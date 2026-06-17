import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaResource } from "../../lib/content/media-loader";
import type { ContentLesson } from "../../storage/types";
import LessonResources from "./LessonResources";

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

const domainMedia = vi.hoisted(() => ({ value: [] as MediaResource[] }));
vi.mock("../../lib/content/media-loader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/content/media-loader")>();
  return {
    ...actual,
    fetchMediaResources: vi.fn(async () => domainMedia.value),
  };
});

function lesson(overrides: Partial<ContentLesson>): ContentLesson {
  return {
    id: "l1",
    title: "Lesson 1",
    estimated_minutes: 5,
    cards: [],
    steps: [],
    domain: "ai",
    ...overrides,
  };
}

afterEach(() => {
  domainMedia.value = [];
  vi.clearAllMocks();
});

describe("LessonResources", () => {
  it("renders nothing when there are no resources at either level", async () => {
    const { container } = render(<LessonResources lesson={lesson({})} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("shows domain-level media under the main heading when no lesson resources exist", async () => {
    domainMedia.value = [
      {
        type: "youtube",
        title: "Neural nets",
        url: "https://www.youtube.com/watch?v=aircAruvnKk",
        domain: "ai",
      },
    ];
    render(<LessonResources lesson={lesson({})} />);
    await waitFor(() =>
      expect(screen.getByTestId("lesson-resources")).toBeInTheDocument(),
    );
    expect(screen.getByText("Neural nets")).toBeInTheDocument();
    // No secondary "more on domain" block when only one source feeds it.
    expect(screen.queryByTestId("lesson-resources-domain")).toBeNull();
  });

  it("shows lesson resources first and domain media as a secondary block", async () => {
    domainMedia.value = [
      {
        type: "article",
        title: "Domain article",
        url: "https://en.wikipedia.org/wiki/Artificial_intelligence",
        domain: "ai",
      },
    ];
    render(
      <LessonResources
        lesson={lesson({
          resources: [
            {
              type: "youtube",
              title: "Lesson video",
              url: "https://youtu.be/aircAruvnKk",
            },
          ],
        })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("lesson-resources-domain")).toBeInTheDocument(),
    );
    expect(screen.getByText("Lesson video")).toBeInTheDocument();
    expect(screen.getByText("Domain article")).toBeInTheDocument();
  });

  it("dedupes a domain entry that also appears as a lesson resource", async () => {
    const url = "https://youtu.be/aircAruvnKk";
    domainMedia.value = [
      { type: "youtube", title: "Same", url, domain: "ai" },
    ];
    render(
      <LessonResources
        lesson={lesson({
          resources: [{ type: "youtube", title: "Same", url }],
        })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("lesson-resources")).toBeInTheDocument(),
    );
    // Only the primary copy renders; no secondary block (the single domain
    // entry was deduped away).
    expect(screen.queryByTestId("lesson-resources-domain")).toBeNull();
    expect(screen.getAllByText("Same")).toHaveLength(1);
  });

  it("groups resources by type", async () => {
    domainMedia.value = [
      {
        type: "youtube",
        title: "V",
        url: "https://youtu.be/aircAruvnKk",
        domain: "ai",
      },
      {
        type: "article",
        title: "A",
        url: "https://en.wikipedia.org/wiki/Artificial_intelligence",
        domain: "ai",
      },
    ];
    render(<LessonResources lesson={lesson({})} />);
    await waitFor(() =>
      expect(
        screen.getByTestId("lesson-resources-group-youtube"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId("lesson-resources-group-article"),
    ).toBeInTheDocument();
  });
});
