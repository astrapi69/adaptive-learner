"""Speech-recording router (engine#68 idea 3: speak-and-record).

  GET    /api/users/{user_id}/speech-recordings/{src}/{set}/{lesson}/{exercise}
                                                            → one or 404
  PUT    /api/users/{user_id}/speech-recordings            → upsert (re-record overwrites)
  DELETE /api/users/{user_id}/speech-recordings/{src}/{set}/{lesson}/{exercise}
                                                            → remove, or 404

Routes mirror the ``/users/{user_id}/lesson-progress`` shape (source slug
``owner--name``, slash → ``--``). Trivial CRUD - no service layer, the
router calls the repository directly (unlike lesson-progress, there is no
merge / lifecycle logic to own).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.deps import get_speech_recording_repo
from app.exceptions import NotFoundError
from app.models import SpeechRecording
from app.repositories.speech_recording_repo import SpeechRecordingRepository
from app.schemas import SpeechRecordingOut, SpeechRecordingUpsert

router = APIRouter(prefix="/users", tags=["speech-recordings"])


def _unslug(source_slug: str) -> str:
    return source_slug.replace("--", "/")


@router.get(
    "/{user_id}/speech-recordings/{source_slug}/{set_id}/{lesson_filename}/{exercise_id}",
    response_model=SpeechRecordingOut,
)
def get_speech_recording(
    user_id: str,
    source_slug: str,
    set_id: str,
    lesson_filename: str,
    exercise_id: str,
    repo: SpeechRecordingRepository = Depends(get_speech_recording_repo),
) -> SpeechRecordingOut:
    """Return the learner's recorded clip for one exercise (404 if none)."""
    row = repo.find(
        user_id=user_id,
        source=_unslug(source_slug),
        set_id=set_id,
        lesson_filename=lesson_filename,
        exercise_id=exercise_id,
    )
    if row is None:
        raise NotFoundError(
            f"No speech recording for {_unslug(source_slug)}/{set_id}/"
            f"{lesson_filename}/{exercise_id}",
        )
    return SpeechRecordingOut.model_validate(row)


@router.put(
    "/{user_id}/speech-recordings",
    response_model=SpeechRecordingOut,
)
def upsert_speech_recording(
    user_id: str,
    payload: SpeechRecordingUpsert,
    repo: SpeechRecordingRepository = Depends(get_speech_recording_repo),
) -> SpeechRecordingOut:
    """Save (or overwrite) the learner's recorded clip for one exercise."""
    row = repo.find(
        user_id=user_id,
        source=payload.source,
        set_id=payload.set_id,
        lesson_filename=payload.lesson_filename,
        exercise_id=payload.exercise_id,
    )
    if row is None:
        row = SpeechRecording(
            user_id=user_id,
            source=payload.source,
            set_id=payload.set_id,
            lesson_filename=payload.lesson_filename,
            exercise_id=payload.exercise_id,
            audio_base64=payload.audio_base64,
            mime_type=payload.mime_type,
            duration_ms=payload.duration_ms,
        )
        repo.add(row)
    else:
        row.audio_base64 = payload.audio_base64
        row.mime_type = payload.mime_type
        row.duration_ms = payload.duration_ms
    repo.commit()
    repo.refresh(row)
    return SpeechRecordingOut.model_validate(row)


@router.delete(
    "/{user_id}/speech-recordings/{source_slug}/{set_id}/{lesson_filename}/{exercise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_speech_recording(
    user_id: str,
    source_slug: str,
    set_id: str,
    lesson_filename: str,
    exercise_id: str,
    repo: SpeechRecordingRepository = Depends(get_speech_recording_repo),
) -> None:
    """Delete the learner's recorded clip for one exercise (404 if none)."""
    row = repo.find(
        user_id=user_id,
        source=_unslug(source_slug),
        set_id=set_id,
        lesson_filename=lesson_filename,
        exercise_id=exercise_id,
    )
    if row is None:
        raise NotFoundError(
            f"No speech recording for {_unslug(source_slug)}/{set_id}/"
            f"{lesson_filename}/{exercise_id}",
        )
    repo.delete(row)
    repo.commit()
