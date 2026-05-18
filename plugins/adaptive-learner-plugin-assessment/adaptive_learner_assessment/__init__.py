"""Adaptive Learner assessment plugin (Phase 3-A).

12 questions in DE + EN, each carrying a weight contribution to one
or more of the six learning methods. The plugin exposes:

- ``GET  /api/plugins/assessment/questions?lang=…`` — localised
  question pack for the onboarding wizard.
- ``POST /api/plugins/assessment/evaluate`` — accepts the user's
  answers, computes a :class:`LearningProfile` row, persists it,
  returns it.
- ``GET  /api/plugins/assessment/profile/{project_id}`` — latest
  profile for the project (404 if never assessed).

The Phase-2 hookspecs ``get_assessment_questions(lang)`` +
``calculate_profile(answers)`` are also implemented so the session
plugin (Phase 3-C) can fetch the same question pack via pluggy
instead of going through HTTP.
"""

__version__ = "0.4.0"
