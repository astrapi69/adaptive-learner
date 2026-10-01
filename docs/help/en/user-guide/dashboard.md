# The Dashboard

The Dashboard is your home base. It is split into three tabs:

- **Overview** - where you left off and what to do next.
- **Activity** - your learning history and analytics.
- **Missions** - today's missions and your badges.

Overview is the default tab. The active tab is part of the
address (`?tab=activity`, `?tab=missions`), so a bookmark or a
reload opens the same tab again. Below the tabs sits the
**Quick actions** area, which stays visible on every tab.

## Overview

The Overview tab answers "where was I, and what now?". Cards
that have nothing to show stay hidden, so a fresh learner sees a
short page.

- **Continue Learning** - up to three sets you worked on
  recently, newest first. Each row offers one action: resume a
  lesson at the step where you stopped, open the next lesson
  after a finished one, or open review cards that are due. A
  fully completed set is marked as done and ranks below the
  rows that still have something to do. With no recent activity
  the card shows a short empty state.
- **Unlock AI help (optional)** - an invitation to connect your
  own AI provider. It appears only while no API key is
  configured, and **Later** hides it for good.
- **Due for review** - the number of elements due for review
  and how many of them are overdue, with **Open review session**
  and **Quick review**. Hidden when nothing is due.
- **XP & Level** - your level, total XP and a progress bar to
  the next level. Before your first XP it asks you to complete
  a session.
- **Streak** - your current streak, your longest streak and the
  freezes you have available.
- **Arcade** - the entry to the arcade, with your ticket
  balance. The card belongs to the game mode: with the game mode
  off it does not appear; with the game mode on and the arcade
  switch off it explains which switch is off and links to the
  settings.
- **Continue learning** (paused lessons) - lessons you paused,
  most recently paused first. Opening one asks whether to resume
  or start over. Hidden when no lesson is paused.
- **Focus areas** - an analysis of the mistakes you made in
  lessons: your challenge areas, error counts, mastery progress
  and **Start adaptive lesson**. Hidden when there are no errors
  to analyze.
- **Your favorites** - your most recently bookmarked lessons.
  Click one to open it, or remove the bookmark with the X. With
  no favorites yet it tells you to tap the star on a lesson.

## Activity

The Activity tab collects your history and the analytical
charts.

- **Due for review** - the same review card as on the Overview
  tab.
- **Streak** - a seven-day activity strip with a trend against
  the previous week, followed by the activity heatmap: a year of
  days in weekly columns from Monday to Sunday, colored by how
  many sessions you had that day. The heatmap opens on the
  current week.
- **Learning profile** - the radar chart of your six-method
  profile from the assessment, with a line naming your strongest
  method. Without a finished assessment the card offers
  **Continue learning profile** (when you abandoned one) or
  **Create learning profile**.
- **Sessions** - tiles for sessions, minutes, current streak,
  average understanding and average stress.
- **Progress** - a two-line chart of your **understanding** and
  **stress** ratings over your most recent sessions, oldest on
  the left.
- **Method distribution** - one bar per method with the number
  and share of sessions that used it, most-used method first.
- **Tool recommendations** - external tools that suit your
  profile, each with a short "why" in your UI language.
- **Spaced practice** - "do this next" cards per method, driven
  by how long ago you last practiced it (first practice,
  refresh, review, practice, maintain). Dismissing a card hides
  it for the rest of the day.
- **Recent sessions** - your latest sessions with method,
  understanding, stress and duration. Clicking a row opens the
  Progress page.
- **Learning Repository** - a link to the versioned snapshot of
  this project's progress, notes and roadmap.

What to look for in the progress chart: a rising understanding
line is what you want. A flat understanding line with rising
stress is the signal the method-switch heuristic watches for; it
nudges you to switch methods.

## Missions

- **Today's missions** - the daily missions with their progress
  and XP reward. New missions arrive every day. You can turn
  missions off and set their number and difficulty mix in
  Settings > Learning; with missions off the card does not
  appear.
- **Badges** - how many badges you have earned, your most recent
  ones and a pointer to the next badge. **View all badges** opens
  the full gallery. Badges are grouped into the categories
  Getting Started, Consistency, Method Explorer, Depth and
  Polyglot; earned ones are colored, locked ones stay grey.

## XP, level and streak

- **Levels** follow a growing curve:
  `threshold(n) = 50 * n * (n - 1)`, so levels 1 to 5 start at
  0 / 100 / 300 / 600 / 1000 XP.
- **Session XP** - 50 XP base per completed session, plus a
  bonus for every completed cycle and a bonus the first time
  you finish a session in a method. A daily streak multiplier
  adds 25% per streak day, capped at 7 days (2.75x).
- **Streak freezes** - you earn one freeze per 7 streak days and
  can hold up to 3. A freeze pauses your streak on a missed day
  instead of resetting it.
- **Weekend mode** - with weekend mode on (Settings > Learning),
  Saturdays and Sundays do not break your streak.

## Quick actions

Below the tabs, on every tab:

- **Start a new session** - opens the Session page. The button
  shows the method from your learning profile that the session
  starts with. Without an AI key in browser mode the button is
  disabled.
- **Pronunciation Practice** - only for projects with a
  Languages subject.
- **Create a lesson** - opens lesson creation in the content
  area.
- **Learning Path** - opens your learning path.
