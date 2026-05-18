import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Curriculum from "./Curriculum";
import type {Curriculum as CurriculumT, LearningTopic} from "../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

const apiList = vi.fn();
const apiCreate = vi.fn();
const apiListTopics = vi.fn();
const apiCreateTopic = vi.fn();
const apiUpdateTopic = vi.fn();
const apiRemoveTopic = vi.fn();
const apiListLessons = vi.fn();
const apiCreateLesson = vi.fn();
const apiUpdateLesson = vi.fn();
const apiRemoveLesson = vi.fn();
vi.mock("../api/client", async () => {
    const actual = await vi.importActual<typeof import("../api/client")>(
        "../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            curricula: {
                list: (...args: unknown[]) => apiList(...args),
                create: (...args: unknown[]) => apiCreate(...args),
                get: vi.fn(),
                update: vi.fn(),
                remove: vi.fn(),
                listTopics: (...args: unknown[]) => apiListTopics(...args),
                createTopic: (...args: unknown[]) => apiCreateTopic(...args),
                listLessons: (...args: unknown[]) => apiListLessons(...args),
                createLesson: (...args: unknown[]) => apiCreateLesson(...args),
            },
            topics: {
                get: vi.fn(),
                update: (...args: unknown[]) => apiUpdateTopic(...args),
                remove: (...args: unknown[]) => apiRemoveTopic(...args),
            },
            lessons: {
                get: vi.fn(),
                update: (...args: unknown[]) => apiUpdateLesson(...args),
                remove: (...args: unknown[]) => apiRemoveLesson(...args),
            },
        },
    };
});

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("../utils/notify", () => ({
    notify: {
        error: (m: string) => toastError(m),
        success: (m: string) => toastSuccess(m),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

const CURRICULUM: CurriculumT = {
    id: "c1",
    user_id: "u1",
    title: "Calculus",
    description: null,
    language: "en",
    created_at: "2026-05-18T00:00:00Z",
    updated_at: "2026-05-18T00:00:00Z",
};

const ROOT_TOPIC: LearningTopic = {
    id: "t1",
    curriculum_id: "c1",
    parent_id: null,
    title: "Limits",
    description: null,
    order_index: 0,
    created_at: "2026-05-18T00:00:00Z",
    updated_at: "2026-05-18T00:00:00Z",
};

function renderCurriculum() {
    return render(
        <MemoryRouter>
            <Curriculum />
        </MemoryRouter>,
    );
}

describe("Curriculum page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiList.mockReset();
        apiCreate.mockReset();
        apiListTopics.mockReset();
        apiCreateTopic.mockReset();
        apiUpdateTopic.mockReset();
        apiRemoveTopic.mockReset();
        apiListLessons.mockReset();
        apiCreateLesson.mockReset();
        apiUpdateLesson.mockReset();
        apiRemoveLesson.mockReset();
        // Default: no lessons in the selected curriculum. Per-test
        // override when the lesson surface is the subject of the
        // assertion.
        apiListLessons.mockResolvedValue([]);
        toastError.mockReset();
        toastSuccess.mockReset();
        localStorage.clear();
        localStorage.setItem("adaptive-learner.user_id", "u1");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("redirects to /onboarding when user_id is missing", async () => {
        localStorage.removeItem("adaptive-learner.user_id");
        renderCurriculum();
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {replace: true});
        });
    });

    it("renders the empty-curriculum prompt when no curricula exist", async () => {
        apiList.mockResolvedValue([]);
        renderCurriculum();
        await screen.findByTestId("curriculum");
        expect(screen.getByTestId("curriculum-no-selection")).toBeInTheDocument();
    });

    it("creates a new curriculum and selects it", async () => {
        apiList.mockResolvedValue([]);
        apiCreate.mockResolvedValue(CURRICULUM);
        apiListTopics.mockResolvedValue([]);
        renderCurriculum();
        await screen.findByTestId("curriculum");
        fireEvent.change(screen.getByTestId("curriculum-new-title"), {
            target: {value: "Calculus"},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("curriculum-create"));
        });
        await waitFor(() => expect(apiCreate).toHaveBeenCalled());
        // After create, the topics-empty surface shows for the
        // freshly selected curriculum.
        await screen.findByTestId("curriculum-empty");
        expect(toastSuccess).toHaveBeenCalled();
    });

    it("renders the topic tree for the loaded curriculum", async () => {
        apiList.mockResolvedValue([CURRICULUM]);
        apiListTopics.mockResolvedValue([ROOT_TOPIC]);
        renderCurriculum();
        await screen.findByTestId("curriculum");
        await screen.findByTestId("topic-tree");
        expect(screen.getByTestId("topic-node-t1")).toBeInTheDocument();
    });

    it("Add root topic opens the dialog and creates with parent_id=null", async () => {
        apiList.mockResolvedValue([CURRICULUM]);
        apiListTopics.mockResolvedValueOnce([]); // initial load
        apiListTopics.mockResolvedValueOnce([ROOT_TOPIC]); // after create
        apiCreateTopic.mockResolvedValue(ROOT_TOPIC);
        renderCurriculum();
        await screen.findByTestId("curriculum");
        fireEvent.click(screen.getByTestId("curriculum-add-root"));
        await screen.findByTestId("add-topic-dialog");
        fireEvent.change(screen.getByTestId("add-topic-input"), {
            target: {value: "Limits"},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("add-topic-submit"));
        });
        await waitFor(() => {
            expect(apiCreateTopic).toHaveBeenCalledWith("c1", {
                title: "Limits",
                parent_id: null,
            });
        });
    });

    it("Rename calls PATCH /topics/{id} with the new title", async () => {
        apiList.mockResolvedValue([CURRICULUM]);
        apiListTopics.mockResolvedValueOnce([ROOT_TOPIC]);
        apiListTopics.mockResolvedValueOnce([{...ROOT_TOPIC, title: "Renamed"}]);
        apiUpdateTopic.mockResolvedValue({...ROOT_TOPIC, title: "Renamed"});
        renderCurriculum();
        await screen.findByTestId("topic-node-t1");
        fireEvent.click(screen.getByTestId("topic-rename-t1"));
        await screen.findByTestId("add-topic-dialog");
        fireEvent.change(screen.getByTestId("add-topic-input"), {
            target: {value: "Renamed"},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("add-topic-submit"));
        });
        await waitFor(() => {
            expect(apiUpdateTopic).toHaveBeenCalledWith("t1", {title: "Renamed"});
        });
    });

    it("Delete confirms then DELETEs the topic", async () => {
        apiList.mockResolvedValue([CURRICULUM]);
        apiListTopics.mockResolvedValueOnce([ROOT_TOPIC]);
        apiListTopics.mockResolvedValueOnce([]);
        apiRemoveTopic.mockResolvedValue(undefined);
        const confirmStub = vi.fn().mockReturnValue(true);
        (window as unknown as {confirm: typeof confirmStub}).confirm = confirmStub;

        renderCurriculum();
        await screen.findByTestId("topic-node-t1");
        await act(async () => {
            fireEvent.click(screen.getByTestId("topic-delete-t1"));
        });
        expect(confirmStub).toHaveBeenCalled();
        await waitFor(() => {
            expect(apiRemoveTopic).toHaveBeenCalledWith("t1");
        });
    });

    it("Delete cancellation does NOT call the API", async () => {
        apiList.mockResolvedValue([CURRICULUM]);
        apiListTopics.mockResolvedValueOnce([ROOT_TOPIC]);
        const confirmStub = vi.fn().mockReturnValue(false);
        (window as unknown as {confirm: typeof confirmStub}).confirm = confirmStub;

        renderCurriculum();
        await screen.findByTestId("topic-node-t1");
        fireEvent.click(screen.getByTestId("topic-delete-t1"));
        expect(confirmStub).toHaveBeenCalled();
        expect(apiRemoveTopic).not.toHaveBeenCalled();
    });

    it("renders an error state when /curricula list fails", async () => {
        const {ApiError} = await import("../api/client");
        apiList.mockRejectedValue(new ApiError(500, "DB down"));
        renderCurriculum();
        await screen.findByTestId("curriculum-error");
        expect(screen.getByTestId("curriculum-error").textContent).toContain("DB down");
    });
});
