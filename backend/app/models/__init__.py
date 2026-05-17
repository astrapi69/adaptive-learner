"""Domain models for Adaptive Learner.

Skeleton state (Phase 1A): empty. The Bibliogon EXAMPLE-DOMAIN models
(Book, Chapter, Article, Author, ...) have been removed.

Phase 1B introduces the adaptive-learning domain
(User, LearningProject, LearningProfile, LearningTopic, Curriculum,
Lesson, LearningSession, SessionMessage, SessionRating, SessionNote,
ProgressCommit, MethodSwitch, UserSettings). See
``docs/adaptive-learner-project-reference.md``.

Models register themselves with :data:`app.database.Base.metadata` on
import. Until a model lands, ``Base.metadata`` is empty and
``init_db`` stamps an empty schema.
"""

from app.database import Base

__all__ = ["Base"]
