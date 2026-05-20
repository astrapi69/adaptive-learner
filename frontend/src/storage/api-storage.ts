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
    },

    assessment: {
        questions: (lang) => api.assessment.questions(lang),
        evaluate: (body) => api.assessment.evaluate(body),
        profile: (projectId) => api.assessment.profile(projectId),
    },

    session: {
        start: (body) => api.session.start(body),
        message: (sessionId, body) => api.session.message(sessionId, body),
        rate: (sessionId, body) => api.session.rate(sessionId, body),
        end: (sessionId) => api.session.end(sessionId),
        switchRecommendation: (sessionId) =>
            api.session.switchRecommendation(sessionId),
        acceptSwitch: (sessionId, body) =>
            api.session.acceptSwitch(sessionId, body),
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
    },

    system: {
        info: () => api.system.info(),
    },
};
