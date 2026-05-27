/**
 * Topic folder slug helper (Phase 49C / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python ``_topic_folder_name`` helper at
 * ``plugins/.../learning-repo/adaptive_learner_learning_repo/
 * meta/readme.py:69``. Same numbered-phase folder name per
 * Article-3 convention.
 *
 * Form: ``NN_slug`` where ``NN`` is the zero-padded order
 * and ``slug`` is the lowercased title with non-alphanumeric
 * chars collapsed to underscores. Runs of underscores
 * collapse; leading/trailing underscores strip; empty slug
 * defaults to "topic".
 *
 * Lifted to its own module so the README renderer's topic
 * links (49C) and the topic-folder generator (49D) use
 * exactly the same string.
 */

export function topicFolderName(order: number, title: string): string {
    // Replace each char: alphanumeric stays (lowercased),
    // everything else becomes ``_``. Matches Python's
    // ``c.lower() if c.isalnum() else "_"``. Note: Python's
    // ``isalnum`` is Unicode-aware (returns True for letters
    // in any script); JavaScript's default char-class isn't.
    // The slug helper here matches Python by using the same
    // Unicode property tests via the ``u`` regex flag on
    // ``\p{L}\p{N}``.
    const chars = Array.from(title).map((c) =>
        /\p{L}|\p{N}/u.test(c) ? c.toLowerCase() : "_",
    );
    let slug = chars.join("").replace(/^_+|_+$/g, "");
    while (slug.includes("__")) {
        slug = slug.replaceAll("__", "_");
    }
    if (slug === "") {
        slug = "topic";
    }
    const padded = order.toString().padStart(2, "0");
    return `${padded}_${slug}`;
}
