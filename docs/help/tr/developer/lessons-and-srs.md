<!-- Translation: AI-generated, pending native review -->

# Dersler + SRS iç yapısı

Bu sayfa, v1.27.0–v1.31.0 içerik dersi + SRS özellik yığınının
arka uç, frontend ve iki eklenti arasında nasıl bağlandığını
belgelemektedir. Kullanıcıya yönelik genel bakış için
[`user-guide/lessons.md`](../user-guide/lessons.md)'ye bakın.

---

## Mimari genel bakış

```
┌──────────────────────────────────────────────────────────┐
│ Frontend: lesson viewer + review session                 │
│   pages/Lesson.tsx  ──→  ExerciseDispatcher  ──→  one of │
│   pages/Review.tsx           ↓               4 exercise  │
│                              ↓               components  │
│                              ↓                           │
│                   recordStepResult                       │
│                              ↓                           │
│                  elementErrors.recordBulk                │
│                              ↓                           │
└──────────────────────────────────────────────────────────┘
                              ↓
                   IStorageService boundary
                              ↓
   ┌─────────────────────┐      ┌─────────────────────────┐
   │ ApiStorage          │      │ DexieStorage            │
   │                     │      │                         │
   │ POST /api/users/    │      │ element-errors-dexie.ts │
   │   {id}/element-     │      │   mirrors the backend   │
   │   errors            │      │   service 1:1 against   │
   │                     │      │   IndexedDB             │
   └─────────────────────┘      └─────────────────────────┘
            ↓
   ┌──────────────────────────────────────────────────────┐
   │ Backend                                              │
   │                                                      │
   │  app/services/element_errors.py                      │
   │    - upsert transition matrix                        │
   │    - MASTERY_THRESHOLD = 3                           │
   │                                                      │
   │  app/services/element_srs.py                         │
   │    - 1d/3d/7d band scheduler                         │
   │    - overdue → error_count → last_error_at sort      │
   │                                                      │
   │  app/services/lesson_progress.py                     │
   │    - upsert_progress with mark_completed flip        │
   │      triggers lesson_session_unification             │
   │                                                      │
   │  app/services/lesson_session_unification.py          │
   │    - find_or_create_content_pseudo_project (lazy)    │
   │    - record_lesson_completion_session                │
   │    - fires on_session_complete via manager._pm.hook  │
   └──────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────────────────────┐
            │ Gamification plugin             │
            │   on_session_complete dispatch  │
            │     method == "content"  →      │
            │       award_xp_for_lesson_      │
            │       session (lesson formula)  │
            │     else →                      │
            │       award_xp_for_session      │
            │       (chat formula, unchanged) │
            │   badge_service.evaluate_user   │
            │     → 4 new lesson predicates   │
            └─────────────────────────────────┘
```

---

## Element düzeyinde hata takibi (v1.30.0 / Aşama 46B)

### Model

``app/models/__init__.py:ElementError`` ile
``(user_id, set_id, lesson_id, exercise_id, element_key)``
üzerinde bileşik UNIQUE kısıtlaması.

```python
class ElementError(Base):
    user_id: str           # FK → users.id (CASCADE)
    set_id: str            # content set id (string, not FK)
    lesson_id: str         # content lesson id (string, not FK)
    exercise_id: str       # exercise id within the lesson
    element_key: str       # the specific word/pair/phrase
    element_type: str      # "vocabulary" | "grammar_rule"
    user_answer: str
    correct_answer: str
    error_count: int       # incremented on each wrong attempt
    correct_streak: int    # incremented on correct, reset on wrong
    last_error_at: datetime | None
    last_attempt_at: datetime
    mastered: bool         # True iff correct_streak ≥ 3
    mastered_at: datetime | None
```

``learning_sessions``'dan tasarım gereği ayrıştırılmıştır (FK
yok) - içerik dersleri, ilişkisel birleştirme yoluyla değil,
dize ile içerik seti / ders kimliklerine başvurur.

### Upsert geçiş matrisi

``app/services/element_errors.py:upsert_element_error``,
tek mutasyon kaynağıdır. Davranış:

| Tetikleyici | Eylem |
|---|---|
| İlk görme (doğru) | Satır EKLE, ``correct_streak=1`` |
| İlk görme (yanlış) | Satır EKLE, ``error_count=1`` |
| Mevcut satır, doğru deneme | ``correct_streak += 1``; seri ``MASTERY_THRESHOLD``'a (3) ulaşırsa ``mastered=True``'ya çevir |
| Mevcut satır, ustalaşılmamış satırda yanlış deneme | ``error_count += 1``, ``correct_streak = 0`` |
| Mevcut satır, **ustalaşılmış** satırda yanlış deneme | indir: ``mastered=False``, ``mastered_at=None``, ``correct_streak=0``, ``error_count += 1`` |

Ustalık eşiği, kod düzeyi bir sabittir
(``MASTERY_THRESHOLD = 3``); **D4** kararı uyarınca SRS
semantiğine özgüdür, yapılandırma düğmesi değildir.

### Dexie aynası

``frontend/src/storage/element-errors-dexie.ts``, arka uç
servisini IndexedDB'ye karşı 1:1 yansıtır.

---

## SRS zamanlaması (v1.30.0 / Aşama 46C)

### Aralık politikası

``app/services/element_srs.py:next_review_due_at``, ustalaşılmamış
bir satırın sonraki incelemesini tahmin eder:

| ``correct_streak`` | Aralık |
|---|---|
| 0 | ``last_attempt_at``'dan 1 gün sonra |
| 1 | 3 gün |
| 2 | 7 gün |
| ≥ 3 | ustalaşıldı - kuyruktan hariç |

### Öncelik sıralaması

İnceleme kuyruğu uç noktası şöyle sıralar:

1. **Önce gecikmiş** (``next_review_due_at < now``,
   ``next_review_due_at > now``'dan önce gelir)
2. **Hata sayısı azalan** (daha fazla hata = daha yüksek öncelik)
3. **Son hata önce** (en son başarısızlık daha eskiden önce gelir)

### Uç nokta

``GET /api/users/{user_id}/element-errors/review-queue``,
önceliklendirilmiş kuyruğu döndürür.

---

## LessonProgress ↔ LearningSession birleştirme (v1.31.0 / Aşama 46F)

### Karar

Her içerik dersi tamamlanması artık bir ``LearningSession`` satırı
yazar; böylece mevcut oyunlaştırma + takip + seri makinesi yeni
hook'lar olmadan bunu alır.

Üç karar şekli yönlendirir:

- **D1 (tembel sözde proje)**: ``kind="content"``'e sahip bir
  "İçerik Dersleri" ``LearningProject``, ilk ders tamamlanmasında
  otomatik olarak oluşturulur. Kullanıcı başına bir tane.
- **D2 (``method="content"`` 7. değer)**: birleştirme yolu için
  özellikle ``LearningSession.method``'un geçerli değerleri
  kümesine eklendi.
- **D5 (yeniden kullan, genişletme)**: yeni hookspec yok.
  ``record_lesson_completion_session``, mevcut
  ``on_session_complete`` hook'unu ``manager._pm.hook`` aracılığıyla
  tetikler.

### Şema değişikliği

```python
# app/models/__init__.py - Phase 46F.1
LEARNING_PROJECT_KIND_STANDARD = "standard"
LEARNING_PROJECT_KIND_CONTENT = "content"

class LearningProject(Base):
    ...
    kind: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=LEARNING_PROJECT_KIND_STANDARD,
        server_default=LEARNING_PROJECT_KIND_STANDARD,
    )
```

---

## Ders-formülü XP kuralı (v1.31.0 / Aşama 46E.1)

``adaptive_learner_gamification.xp_service`` şunları kazanır:

- ``compute_stars(correct, total)`` - %50 / %75 / %90 bantlarıyla
  0-3 yıldız puan.
- ``calculate_lesson_session_xp(*, stars, first_attempt, streak_days)``
  - saf hesaplayıcı. 30 taban + yıldız başına 10 + aynı sohbet
  formülüyle seri çarpanı.
- ``award_xp_for_lesson_session(db, *, session)`` - formülü uygulayan
  kalıcılık sarmalayıcısı.

Dağıtım, ``GamificationPlugin.on_session_complete``'de
``session["method"]``'a göre gerçekleşir.

---

## Ders rozetleri (v1.31.0 / Aşama 46E.2)

``adaptive_learner_gamification.badge_service._EVALUATORS``'a dört
yeni yüklem eklendi:

| Anahtar | Yüklem | Yardımcı |
|---|---|---|
| ``first_lesson`` | ``_completed_lesson_count >= 1`` | ``LessonProgress.status="completed"`` sayar |
| ``lessons_10`` | ``_completed_lesson_count >= 10`` | aynı |
| ``three_star_streak`` | ``_last_n_lessons_all_three_star(n=3)`` | son 3 tamamlanan ``LessonProgress``'i okur |
| ``review_master`` | ``_mastered_elements_count >= 50`` | ``ElementError.mastered=True`` sayar |

---

## Depolama modu uyarıları

Element takip + SRS zinciri **her iki** depolama modunda da aynı
şekilde çalışır. Ders oturumu birleştirme + oyunlaştırma yan
etkileri **yalnızca API modundadır**. Dexie modunda ders
tamamlanması hâlâ ``LessonProgress`` yazar, hâlâ ``ElementError``
satırları kaydeder ve hâlâ inceleme kuyruğunu yönlendirir - ancak
``LearningSession`` yazma + ``on_session_complete`` hook'u hiçbir
zaman tetiklenmez (arka uç yok, hook yok).

---

## Sonraki nereden bakılır

- ``backend/app/services/element_errors.py`` - upsert geçiş matrisi.
- ``backend/app/services/element_srs.py`` - zamanlayıcı.
- ``backend/app/services/lesson_session_unification.py`` -
  sözde proje + hook tetikleme.
- ``plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/xp_service.py`` -
  ``calculate_lesson_session_xp`` + dağıtım.
- ``frontend/src/lib/learning-project.ts`` - sözde proje
  filtre yardımcısı.

---

## Token-diff + cloze + düzeltme turu (v1.35.0 / Aşama 52)

Pasif tekrarı aktif öğrenmeye dönüştüren üç katmanlı ekleme:

**Token-diff + DiffHighlight** - Free_text ve word_tiles yanlış
cevapları artık sonuç paragrafının hemen altında
`<DiffHighlight tokens={tokenDiff(input, canonical)} />` oluşturur.
Algoritma `frontend/src/lib/exercises/token-diff.ts`'de - saf
kelime düzeyinde LCS, NFC normalleştirilmiş.

**Cloze alıştırma türü (şema 1.1)** - beşinci ExerciseType: görünür
`___` işaretçileriyle boşluk doldurma. İki oluşturma modu: `type`
(varsayılan, `<input>`) ve `select` (`distractors`'dan seçeneklerle
`<select>`).

**Cloze oluşturucu** - `generateClozeFromError(error,
sourceExercise, sourceCard)`, bir ElementError'dan bir cloze adımı
sentezler. Deterministik: aynı girişler → bayt özdeş çıktı. AI
yok, rastgelelik yok, async yok.

**Ders sonu düzeltme turu** - `<CorrectionBlock />`, puan /
döküm ile eylem düğmeleri arasında `LessonSummary` içinde monte
edilir. Monte edildiğinde, az önce bitirilen ders için ElementError
satırlarını okur, ustalaşılmamış her başarısızlık için bir cloze
oluşturur (5 sınırı) ve kullanıcıyı bunlar aracılığıyla yürütür.

**İnceleme oturumlarında cloze (Aşama 52G)** -
`synthesizeReviewLesson`'ın per-item dalı (`_buildReviewStep`) şimdi seçer:

- free_text veya word_tiles kaynağı → cloze dene, tekrara geri dön
- matching, picture_choice, cloze → her zaman tekrar et
