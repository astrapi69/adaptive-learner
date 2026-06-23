/**
 * Lesson-result share-image generator (#1073).
 *
 * Renders a 1200×630 (OG-ratio) PNG card of a completed lesson — app name,
 * lesson title, stars, score, and optional level/XP — for image-capable share
 * targets (Instagram / Twitter / a chat). Pure data output, not a themeable UI
 * surface: it reads the active theme's tokens from the document root so the
 * card matches the current theme, and falls back to neutral brand colors when
 * a token (or the canvas API) is unavailable. It NEVER renders personal data —
 * only the lesson title + aggregate score, same contract as the share text.
 *
 * Fail-soft: returns ``null`` when there is no DOM / canvas / 2d context /
 * ``toBlob`` (SSR, happy-dom, older browsers). Callers fall back to a
 * text-only share, so the image is a pure enhancement.
 *
 * @example
 * const blob = await renderLessonShareImage(result, t);
 * if (blob) files = [new File([blob], "result.png", {type: "image/png"})];
 */

import type {LessonShareResult} from "./lesson-share";

/** Minimal ``t`` shape (no i18n hook dependency). */
type Translate = (key: string, fallback?: string) => string;

const WIDTH = 1200;
const HEIGHT = 630;

/** Read a CSS custom property off the document root, or a fallback. */
function token(name: string, fallback: string): string {
    if (typeof document === "undefined") return fallback;
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    return value || fallback;
}

/** Draw the 0-3 star row centered at ``cy``. */
function drawStars(
    ctx: CanvasRenderingContext2D,
    stars: number,
    cx: number,
    cy: number,
    earned: string,
    dim: string,
): void {
    const glyphs = "★★★".split("");
    ctx.font = "64px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const gap = 76;
    const startX = cx - gap;
    glyphs.forEach((glyph, i) => {
        ctx.fillStyle = i < stars ? earned : dim;
        ctx.fillText(glyph, startX + i * gap, cy);
    });
}

/**
 * Render the share card to a PNG blob, or ``null`` when the environment
 * cannot produce one. Colors come from the active theme tokens with neutral
 * fallbacks.
 *
 * @param result - The completed-lesson result.
 * @param t - The i18n lookup for the card's labels.
 */
export async function renderLessonShareImage(
    result: LessonShareResult,
    t: Translate,
): Promise<Blob | null> {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.toBlob !== "function") return null;

    const bg = token("--bg-surface", "#0f172a");
    const fg = token("--fg-primary", "#f8fafc");
    const muted = token("--fg-muted", "#94a3b8");
    const accent = token("--accent", "#2dd4bf");
    const star = token("--star", "#fbbf24");

    // Background + accent header band.
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, WIDTH, 12);

    ctx.textAlign = "center";

    // Brand + "lesson complete" eyebrow.
    ctx.fillStyle = accent;
    ctx.font = "bold 40px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("🎓 Adaptive Learner", WIDTH / 2, 60);

    ctx.fillStyle = muted;
    ctx.font = "28px sans-serif";
    ctx.fillText(
        t("share.result.image_complete", "Lesson complete!"),
        WIDTH / 2,
        120,
    );

    // Lesson title (truncated to fit one line).
    ctx.fillStyle = fg;
    ctx.font = "bold 56px sans-serif";
    ctx.textBaseline = "middle";
    let title = result.lessonTitle;
    while (ctx.measureText(title).width > WIDTH - 120 && title.length > 4) {
        title = title.slice(0, -2);
    }
    if (title !== result.lessonTitle) title = `${title}…`;
    ctx.fillText(title, WIDTH / 2, 220);

    // Stars + score.
    drawStars(ctx, result.stars, WIDTH / 2, 320, star, muted);

    ctx.fillStyle = fg;
    ctx.font = "bold 96px sans-serif";
    ctx.fillText(`${result.scorePct}%`, WIDTH / 2, 430);

    ctx.fillStyle = muted;
    ctx.font = "32px sans-serif";
    ctx.fillText(
        t("share.result.image_score", "{correct} of {total} correct")
            .replace("{correct}", String(result.correct))
            .replace("{total}", String(result.total)),
        WIDTH / 2,
        500,
    );

    if (typeof result.level === "number") {
        const xpPart =
            typeof result.xp === "number"
                ? ` · ${result.xp} ${t("gamification.xp", "XP")}`
                : "";
        ctx.fillText(
            `${t("gamification.level", "Level")} ${result.level}${xpPart}`,
            WIDTH / 2,
            548,
        );
    }

    // Footer URL.
    ctx.fillStyle = accent;
    ctx.font = "28px sans-serif";
    ctx.fillText("astrapi69.github.io/adaptive-learner", WIDTH / 2, 595);

    return await new Promise<Blob | null>((resolve) => {
        try {
            canvas.toBlob((blob) => resolve(blob), "image/png");
        } catch {
            resolve(null);
        }
    });
}
