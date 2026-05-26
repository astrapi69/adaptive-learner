/**
 * ApiStorage — IStorageService backed by the FastAPI backend.
 *
 * This is a thin pass-through to ``api.*`` in ``api/client.ts``.
 * Every method delegates 1:1; no behavioural change vs. v0.6.0.
 *
 * The single point of indirection lets pages depend on
 * IStorageService instead of the api object directly, which makes
 * the DexieStorage swap (10F) a single line in the factory.
 */

import {api} from "../api/client";
import type {IStorageService} from "./types";

export const apiStorage: IStorageService = {
    mode: "api",

    health: () => api.health(),

    i18n: {
        get: (lang) => api.i18n.get(lang),
    },

    users: {
        create: (body) => api.users.create(body),
        get: (userId) => api.users.get(userId),
        update: (userId, body) => api.users.update(userId, body),
        projects: {
            list: (userId) => api.users.projects.list(userId),
            create: (userId, body) => api.users.projects.create(userId, body),
        },
        findMostRecent: async () => {
            // Phase 41B: identity.yaml is the recovery channel in API
            // mode. ``api.identity.get`` returns null on 404 so we
            // pass through without an explicit catch.
            const payload = await api.identity.get();
            if (payload === null) {
                return null;
            }
            return {
                userId: payload.user_id,
                projectId: payload.active_project_id,
                language: payload.language,
            };
        },
    },

    projects: {
        get: (projectId) => api.projects.get(projectId),
        update: (projectId, body) => api.projects.update(projectId, body),
    },

    settings: {
        get: (userId) => api.settings.get(userId),
        update: (userId, body) => api.settings.update(userId, body),
        setApiKey: (userId, body) => api.settings.setApiKey(userId, body),
        deleteApiKey: (userId, provider) =>
            api.settings.deleteApiKey(userId, provider),
        getApp: () => api.settings.getApp(),
        getAvailableModels: (userId, provider) =>
            api.settings.getAvailableModels(userId, provider),
    },

    assessment: {
        questions: (lang) => api.assessment.questions(lang),
        evaluate: (body) => api.assessment.evaluate(body),
        profile: (projectId) => api.assessment.profile(projectId),
    },

    session: {
        start: (body) => api.session.start(body),
        message: (sessionId, body) => api.session.message(sessionId, body),
        streamMessage: (sessionId, body, handlers) =>
            api.session.streamMessage(sessionId, body, handlers),
        rate: (sessionId, body) => api.session.rate(sessionId, body),
        end: (sessionId) => api.session.end(sessionId),
        switchRecommendation: (sessionId) =>
            api.session.switchRecommendation(sessionId),
        acceptSwitch: (sessionId, body) =>
            api.session.acceptSwitch(sessionId, body),
        // Phase 36 Bug 4 — HTTP shape lives under /imports/, not
        // /session/, because the lookup is "did THIS conversation
        // start a session?". Same answer either way.
        getActiveForConversation: (conversationId) =>
            api.imports.getActiveSession(conversationId),
        // Phase 38 Bug 7 — resume path: fetch the existing
        // session record + chat history so Session.tsx can
        // re-render the prior conversation instead of starting
        // a fresh one.
        get: (sessionId) => api.session.get(sessionId),
        getMessages: (sessionId) => api.session.getMessages(sessionId),
    },

    tracking: {
        progress: (projectId) => api.tracking.progress(projectId),
        commits: (projectId) => api.tracking.commits(projectId),
    },

    tools: {
        recommendations: (projectId, lang) =>
            api.tools.recommendations(projectId, lang),
        spaced: (projectId, lang) => api.tools.spaced(projectId, lang),
    },

    curricula: {
        list: (userId) => api.curricula.list(userId),
        create: (userId, body) => api.curricula.create(userId, body),
        get: (curriculumId) => api.curricula.get(curriculumId),
        update: (curriculumId, body) =>
            api.curricula.update(curriculumId, body),
        remove: (curriculumId) => api.curricula.remove(curriculumId),
        // Phase 36 Bug 3 — HTTP shape lives under /imports/, not
        // /curricula/, because the lookup is "what did THIS
        // conversation produce?". Same answer either way.
        getForConversation: (conversationId) =>
            api.imports.getCurriculum(conversationId),
        listTopics: (curriculumId) =>
            api.curricula.listTopics(curriculumId),
        createTopic: (curriculumId, body) =>
            api.curricula.createTopic(curriculumId, body),
        listLessons: (curriculumId) =>
            api.curricula.listLessons(curriculumId),
        createLesson: (curriculumId, body) =>
            api.curricula.createLesson(curriculumId, body),
    },

    topics: {
        get: (topicId) => api.topics.get(topicId),
        update: (topicId, body) => api.topics.update(topicId, body),
        remove: (topicId) => api.topics.remove(topicId),
    },

    lessons: {
        get: (lessonId) => api.lessons.get(lessonId),
        update: (lessonId, body) => api.lessons.update(lessonId, body),
        remove: (lessonId) => api.lessons.remove(lessonId),
    },

    plugins: {
        manifests: () => api.plugins.manifests(),
        health: () => api.plugins.health(),
        errors: () => api.plugins.errors(),
    },

    imports: {
        list: (userId) => api.imports.list(userId),
        create: (userId, body) => api.imports.create(userId, body),
        get: (conversationId) => api.imports.get(conversationId),
        update: (conversationId, body) => api.imports.update(conversationId, body),
        remove: (conversationId) => api.imports.remove(conversationId),
        saveAnalysis: (conversationId, analysis) =>
            api.imports.saveAnalysis(conversationId, analysis),
        analyze: (conversationId) => api.imports.analyze(conversationId),
    },

    system: {
        info: () => api.system.info(),
    },

    backup: {
        export: (userId) => api.backup.export(userId),
        import: (userId, payload) => api.backup.import(userId, payload),
        stats: (userId) => api.backup.stats(userId),
    },

    export: {
        progress: (userId, lang) => api.export.progress(userId, lang),
        session: (sessionId, lang) => api.export.session(sessionId, lang),
        curriculum: (curriculumId, lang) =>
            api.export.curriculum(curriculumId, lang),
    },

    subjects: {
        list: () => api.subjects.list(),
        get: (subjectId) => api.subjects.get(subjectId),
        create: (body) => api.subjects.create(body),
        update: (subjectId, body) => api.subjects.update(subjectId, body),
        remove: (subjectId) => api.subjects.remove(subjectId),
    },

    tags: {
        list: (userId) => api.tags.list(userId),
        create: (userId, body) => api.tags.create(userId, body),
        update: (tagId, body) => api.tags.update(tagId, body),
        remove: (tagId) => api.tags.remove(tagId),
    },

    projectTaxonomy: {
        listSubjects: (projectId) => api.projectTaxonomy.listSubjects(projectId),
        assignSubject: (projectId, subjectId) =>
            api.projectTaxonomy.assignSubject(projectId, subjectId),
        unassignSubject: (projectId, subjectId) =>
            api.projectTaxonomy.unassignSubject(projectId, subjectId),
        listTags: (projectId) => api.projectTaxonomy.listTags(projectId),
        assignTag: (projectId, tagId) =>
            api.projectTaxonomy.assignTag(projectId, tagId),
        unassignTag: (projectId, tagId) =>
            api.projectTaxonomy.unassignTag(projectId, tagId),
    },

    gamification: {
        getState: (userId) => api.gamification.getState(userId),
        awardAssessment: (userId) => api.gamification.awardAssessment(userId),
        awardImport: (userId) => api.gamification.awardImport(userId),
        listBadges: (userId) => api.gamification.listBadges(userId),
        evaluateBadges: (userId) => api.gamification.evaluateBadges(userId),
        getStreak: (userId) => api.gamification.getStreak(userId),
        getStreakHeatmap: (userId, days) =>
            api.gamification.getStreakHeatmap(userId, days),
        setWeekendMode: (userId, enabled) =>
            api.gamification.setWeekendMode(userId, enabled),
        resetProgress: (userId) => api.gamification.resetProgress(userId),
    },

    anki: {
        list: (userId, filters) => api.anki.list(userId, filters),
        create: (userId, body) => api.anki.create(userId, body),
        update: (cardId, body) => api.anki.update(cardId, body),
        remove: async (cardId) => {
            await api.anki.remove(cardId);
        },
        extractFromSession: (sessionId) =>
            api.anki.extractFromSession(sessionId),
        extractFromConversation: (conversationId) =>
            api.anki.extractFromConversation(conversationId),
        markExported: (cardIds) => api.anki.markExported(cardIds),
    },

    pronunciation: {
        eligibility: (projectId) => api.pronunciation.eligibility(projectId),
        phrase: (args) => api.pronunciation.phrase(args),
        judge: (args) => api.pronunciation.judge(args),
    },

    notebooklm: {
        listQuestions: (userId, filters) =>
            api.notebooklm.listQuestions(userId, filters),
        createQuestion: (userId, body) =>
            api.notebooklm.createQuestion(userId, body),
        updateQuestion: (questionId, body) =>
            api.notebooklm.updateQuestion(questionId, body),
        deleteQuestion: async (questionId) => {
            await api.notebooklm.deleteQuestion(questionId);
        },
        generateFromSession: (sessionId) =>
            api.notebooklm.generateFromSession(sessionId),
        generateFromProject: (projectId) =>
            api.notebooklm.generateFromProject(projectId),
        studyGuide: (projectId) => api.notebooklm.studyGuide(projectId),
    },

    // --- Content-Loader (Phase 43 / EXP-002) -----------------------------

    contentLoader: {
        listSets: () => api.contentLoader.listSets(),
        downloadSet: (source, setId) =>
            api.contentLoader.downloadSet(source, setId),
        listLessons: (source, setId) =>
            api.contentLoader.listLessons(source, setId),
        getLesson: (source, setId, filename) =>
            api.contentLoader.getLesson(source, setId, filename),
    },

    // Phase 41F Danger Zone: typed-confirm reset. ApiStorage hands
    // the token straight to the backend; the 400 gate lives server-
    // side (services/reset_service.CONFIRMATION_TOKEN).
    reset: (confirmation) => api.reset(confirmation),
};
