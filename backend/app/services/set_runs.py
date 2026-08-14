"""SetRun service - Durchgang (run/pass) lifecycle (EXP-051 / #2125).

Owns the "start a new run" transition and the lazy materialisation of the
implicit first run. Persistence goes through
:class:`~app.repositories.set_runs_repo.SetRunsRepository`.

Model recap (EXP-051):

- Each ``(user, set)`` has at most ONE active run (``closed_at IS NULL``).
- Starting a new run is one atomic transaction: close the active run,
  open the next (``run_id + 1``). The ``element_errors`` rows are NOT
  touched — the closed run's rows stay frozen under their ``run_id``;
  new attempts write fresh rows under the new run.
- A pre-EXP-051 user has element-error rows (all ``run_id = 1``) but no
  ``set_runs`` row. The first write lazily materialises the implicit
  active run 1; a restart materialises it as CLOSED then opens run 2.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.models import SetRun
from app.repositories.set_runs_repo import SetRunsRepository


def _utcnow() -> datetime:
    return datetime.now(UTC)


def ensure_active_run(
    repo: SetRunsRepository,
    user_id: str,
    set_id: str,
    *,
    now: datetime | None = None,
) -> int:
    """Return the active ``run_id`` for ``(user, set)``, lazily creating the
    implicit run 1 when the set has no ``set_runs`` row yet.

    Called on the WRITE path (recording an attempt) so every set the learner
    has worked on carries a ``set_runs`` row. Flushes the new row so it is
    visible within the transaction; the caller owns the commit.
    """
    active = repo.get_active(user_id, set_id)
    if active is not None:
        return int(active.run_id)
    clock = now if now is not None else _utcnow()
    # No open run. Normally that means the set has never been touched under
    # the run model — open run 1. Defensively, if only CLOSED runs exist
    # (an abnormal state), open the run after the highest.
    max_run = repo.max_run_id(user_id, set_id)
    run_id = 1 if max_run is None else int(max_run) + 1
    row = SetRun(
        user_id=user_id,
        set_id=set_id,
        run_id=run_id,
        started_at=clock,
        closed_at=None,
    )
    repo.add(row)
    repo.flush()
    return run_id


def start_new_run(
    repo: SetRunsRepository,
    user_id: str,
    set_id: str,
    *,
    content_version: str | None = None,
    now: datetime | None = None,
) -> SetRun:
    """Start a fresh Durchgang: close the active run and open the next, in one
    transaction. Returns the newly opened run row.

    When no active run exists yet (a set worked under the implicit run 1, or
    never worked at all), the prior run is materialised as CLOSED first so
    the run history is complete, then the next run is opened. The returned
    run is always the new active one.
    """
    clock = now if now is not None else _utcnow()
    active = repo.get_active(user_id, set_id)
    if active is not None:
        active.closed_at = clock
        next_run_id = int(active.run_id) + 1
    else:
        max_run = repo.max_run_id(user_id, set_id)
        if max_run is None:
            # No run row at all: the set was worked under the implicit run 1
            # (or never worked). Materialise run 1 as CLOSED so the history
            # shows it, then open run 2. Its ``started_at`` predates the
            # feature and is not recoverable, so it is stamped at close time
            # (best effort); the Fehlerhistorie can refine it later from the
            # element-error timestamps.
            repo.add(
                SetRun(
                    user_id=user_id,
                    set_id=set_id,
                    run_id=1,
                    started_at=clock,
                    closed_at=clock,
                )
            )
            next_run_id = 2
        else:
            # Runs exist but none is open (abnormal - a run was closed
            # without opening a successor). Do NOT re-materialise the
            # highest run (its row already exists); just open the next.
            next_run_id = int(max_run) + 1
    new_run = SetRun(
        user_id=user_id,
        set_id=set_id,
        run_id=next_run_id,
        content_version_at_start=content_version,
        started_at=clock,
        closed_at=None,
    )
    repo.add(new_run)
    repo.commit()
    return new_run


def list_runs(
    repo: SetRunsRepository,
    user_id: str,
    set_id: str,
) -> list[SetRun]:
    """Return every recorded run of ``(user, set)``, oldest first.

    The Fehlerhistorie reads this to enumerate the runs (each with its
    start/close time), then reads each run's rows via
    ``element_errors.list_for_user(..., run_id=N)``.
    """
    return repo.list_for_set(user_id, set_id)
