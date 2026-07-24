<!-- Translation: AI-generated, pending native review -->

# Eklenti uç noktaları

Her eklentinin rotaları `/api/plugins/{plugin-name}/` altına
monte edilir.

## Değerlendirme eklentisi

```
GET /api/plugins/assessment/questions?lang=en
```

12 soruluk paketi, `text` istenen dile çözümlenmiş olarak
döndürür. Her cevap, yöntem başına ağırlıkları taşır.

```json
[
  {
    "id": "q01",
    "type": "multi",
    "text": "How do you approach a new topic?",
    "answers": [
      {
        "id": "a",
        "text": "I read the rules and theory first.",
        "weights": {"deductive": 1.0}
      },
      ...
    ]
  },
  ...
]
```

```
POST /api/plugins/assessment/evaluate
```

Gövde:

```json
{
  "project_id": "p1",
  "answers": [
    {"question_id": "q01", "answer_ids": ["a", "b"]},
    {"question_id": "q02", "answer_id": "c"},
    ...
  ]
}
```

Hem tekli seçim (`answer_id: string`) hem de çoklu seçim
(`answer_ids: string[]`) şekilleri kabul edilir. Oluşturulan
LearningProfile'ı döndürür:

```json
{
  "id": "pr1",
  "user_id": "abc-123",
  "project_id": "p1",
  "deductive": 0.4167,
  "inductive": 0.1833,
  "error_based": 0.0833,
  "dialogic": 0.0833,
  "contextual": 0.0833,
  "ai_adaptive": 0.1500,
  "assessed_at": "2026-05-19T12:00:00+00:00",
  "version": 1,
  "dominant_method": "deductive"
}
```

```
GET /api/plugins/assessment/profile/{project_id}
```

Proje için en son LearningProfile'ı döndürür.

## Oturum eklentisi

```
POST /api/plugins/session/start
```

Gövde:

```json
{
  "project_id": "p1",
  "method": "deductive",
  "cycle_step": 1,
  "lang": "en"
}
```

`method`, `cycle_step`, `lang` isteğe bağlıdır. Oluşturulan
oturumu + oluşturulan sistem istemini döndürür:

```json
{
  "session": {
    "id": "s1",
    "project_id": "p1",
    "method": "deductive",
    "started_at": "2026-05-19T12:00:00+00:00",
    "ended_at": null,
    "cycle_step": 1,
    "status": "active"
  },
  "system_prompt": "You are a deductive learning companion. ..."
}
```

```
POST /api/plugins/session/{session_id}/message
```

Gövde:

```json
{"role": "user", "content": "I'd like to start with the present tense."}
```

Sunucu kullanıcı mesajını kaydeder, `ai_complete`'i tetikler,
asistan yanıtını kalıcı kılar, adım değerlendiriciyi çalıştırır
ve bileşik yanıtı döndürür:

```json
{
  "user_message": {"id": "m1", "session_id": "s1", "role": "user", "content": "...", "created_at": "..."},
  "assistant_message": {"id": "m2", "session_id": "s1", "role": "assistant", "content": "...", "created_at": "..."},
  "ai_error": null,
  "session": {"...": "cycle_step ilerledikten sonra oturum satırı"},
  "step_evaluation": {
    "advance": true,
    "confidence": 0.85,
    "reason": "Learner clearly grasped the input.",
    "suggested_step": 2,
    "fallback_used": false,
    "applied": true,
    "from_step": 1
  }
}
```

```
POST /api/plugins/session/{session_id}/rate
```

Gövde:

```json
{
  "understanding": 4,
  "stress": 2,
  "method_fit": 5,
  "notes": "Felt productive."
}
```

SessionRating satırı kaydeder. Satırı döndürür.

```
POST /api/plugins/session/{session_id}/end
```

Oturumu kapatır. `on_session_complete`'i tetikler (takip eklentisi
bir ProgressCommit yazar). Döndürür:

```json
{"session": {"...": "status='completed' ve ended_at ayarlı oturum"}}
```

```
GET /api/plugins/session/switch-recommendation/{session_id}
```

Döndürür:

```json
{"recommended": false, "to_method": null, "reason": null}
```

Veya durgunluk algılandığında:

```json
{"recommended": true, "to_method": "dialogic", "reason": "Three sessions of flat understanding + high stress."}
```

```
POST /api/plugins/session/{session_id}/switch
```

Gövde:

```json
{"to_method": "dialogic", "reason": "Felt right."}
```

`session.method`'u günceller, MethodSwitch denetim satırı yazar,
güncellenen oturumu döndürür.

## Takip eklentisi

```
GET /api/plugins/tracking/progress/{project_id}
```

Ad alanıyla ayrılmış özeti döndürür; `tracking` dilimi
toplayıcının çıktısını taşır:

```json
{
  "tracking": {
    "total_sessions": 7,
    "total_minutes": 195,
    "streak_days": 3,
    "sessions_per_method": {"deductive": 4, "inductive": 2, "dialogic": 1},
    "method_distribution": [...],
    "recent_understanding": [0.6, 0.8, 0.8, 0.8, 1.0],
    "recent_stress": [0.4, 0.4, 0.2, 0.2, 0.2],
    "mean_understanding": 0.8,
    "mean_stress": 0.3,
    "recent_sessions": [...]
  },
  "step_evaluation": {
    "total_evaluations": 28,
    "average_confidence": 0.78,
    "advance_count": 21,
    "repeat_count": 5,
    "backward_count": 2,
    "fallback_count": 1,
    "evaluations_per_step": {"1": 7, "2": 6, ...},
    "time_seconds_per_step": {"1": 180.5, ...}
  }
}
```

```
GET /api/plugins/tracking/commits/{project_id}
```

Proje için tüm ProgressCommit satırlarını kronolojik sırayla
döndürür.

## Araçlar eklentisi

```
GET /api/plugins/tools/recommendations/{project_id}?lang=en
```

Projenin profiline uygunluğa göre sıralanmış 5 katalog aracını
döndürür:

```json
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "Spaced-repetition flashcards - great for cementing rules and error-corrections long-term.",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

```
GET /api/plugins/tools/spaced/{project_id}?lang=en
```

Yakınlık tarafından yönlendirilen aralıklı tekrar eylem kartlarını
döndürür:

```json
[
  {
    "id": "sr-deductive-first",
    "method": "deductive",
    "interval_days": 1,
    "action": "session",
    "title": "First practice in deduction.",
    "urgency": 0.5
  },
  ...
]
```

## Oturum eklentisi - akış + telaffuz (v1.6.0+, v1.18.0+)

```
POST /api/plugins/session/{id}/message/stream  (SSE)
```

`/message` ile aynı gövde şekli; üç SSE olay türü yayar:

- `start` - yük `{user_message}` (artık kalıcı kullanıcı dönüşü).
- `chunk` - yük `{delta}` (AI sağlayıcısının akışından gelen bir
  veya birden fazla metin parçası).
- `done` - yük, senkron `/message` yanıtıyla özdeş: asistan mesajı
  + cycle_step + zamanlamalar + isteğe bağlı döngü geçiş kartı.

```
GET  /api/plugins/session/pronunciation/eligibility/{project_id}
POST /api/plugins/session/pronunciation/phrase
POST /api/plugins/session/pronunciation/judge
```

Telaffuz uygunluğu, projenin konu taksonomiyle sınırlandırılır
(Diller / Sprachen kökü için ataları yürütür). Yargıç uç noktası
`{matches, score, feedback, missed_sounds}` döndürür.

## Oyunlaştırma eklentisi (v1.16.0+)

```
GET  /api/plugins/gamification/xp/{user_id}
POST /api/plugins/gamification/xp/{user_id}/award
POST /api/plugins/gamification/xp/{user_id}/award-assessment
POST /api/plugins/gamification/xp/{user_id}/award-import
GET  /api/plugins/gamification/badges
GET  /api/plugins/gamification/badges/{user_id}
POST /api/plugins/gamification/badges/{user_id}/evaluate
GET  /api/plugins/gamification/streak/{user_id}
GET  /api/plugins/gamification/streak/{user_id}/heatmap
POST /api/plugins/gamification/streak/{user_id}/weekend-mode
POST /api/plugins/gamification/reset/{user_id}
```

`/streak/{user_id}/heatmap`, son 365 gün için
`[{date, count}, ...]` döndürür ([7, 730] arasında sınırlar).
Sıfırlama uç noktası çift onay alır, ardından `user_xp` +
`user_badges` + `user_streaks` satırlarını siler.

## Anki eklentisi (v1.17.0+)

```
GET    /api/plugins/anki/cards/{user_id}
POST   /api/plugins/anki/cards
PATCH  /api/plugins/anki/cards/{id}
DELETE /api/plugins/anki/cards/{id}
POST   /api/plugins/anki/cards/extract/session/{id}
POST   /api/plugins/anki/cards/extract/conversation/{id}
POST   /api/plugins/anki/cards/mark-exported
```

AI çıkarımı kullanıcı tarafından tetiklenir. Konuşma çıkarımı
yolu, analiz zaten sözcük dizisini doldurduğunda ekstra bir AI
çağrısı olmadan cloze kartları üretmek için `analysis_result.vocabulary`'yi
de okur (v1.20.0'dan itibaren).

## NotebookLM eklentisi (v1.19.0+)

```
GET    /api/plugins/notebooklm/questions/{user_id}
POST   /api/plugins/notebooklm/questions
PATCH  /api/plugins/notebooklm/questions/{id}
DELETE /api/plugins/notebooklm/questions/{id}
POST   /api/plugins/notebooklm/generate-from-session/{id}
POST   /api/plugins/notebooklm/generate-from-project/{id}
POST   /api/plugins/notebooklm/study-guide/{project_id}
```

`/study-guide/{project_id}`, `text/markdown` döndürür (içerik
~30K karaktere kırpılmış tek büyük AI çağrısı). Kullanıcı
düzenlemeleri `edited=True`'ya çevirir, böylece AI yeniden
çalıştırıcısı bunları atlar.

## Eklenti keşfi

```
GET /api/plugins/manifests
GET /api/plugins/health
GET /api/plugins/errors
```

Her biri eklenti adıyla anahtarlanmış bir harita döndürür.
Etkinleştirme durumu + yükleme hatası görünürlüğü için
Ayarlar > Eklentiler arayüzü tarafından kullanılır.
