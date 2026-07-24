<!-- Translation: AI-generated, pending native review -->

# Yapay zeka entegrasyonu

Adaptive Learner, her öğrenme konuşmasını gidiş-dönüş başına
en fazla **üç** yapay zeka çağrısından geçirir - akışa alınan
yanıt, adım değerlendiricisi ve (7. adımda) konu geçiş
değerlendiricisi. Üç sağlayıcı hazır olarak gelir; yeni
sağlayıcılar `ai_complete*` kanca ailesi aracılığıyla eklenir.

## ai_complete kancası

```python
# backend/app/hookspecs.py
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Return the assistant text, or None if this plugin doesn't handle ``model``."""
```

`firstresult=True`, pluggy'nin ilk None olmayan dönüşte
durduğu anlamına gelir. Her sağlayıcı eklentisi `model` ön
ekini kontrol eder ve modelin sahibiyse asistan metnini döndürür:

```python
@hookimpl
def ai_complete(
    self, messages, model, api_key, max_tokens
) -> str | None:
    if not model.startswith("claude-"):
        return None
    # ... call Anthropic API, return the text ...
```

Üç eklenti mevcuttur: `ai-anthropic` (claude-*), `ai-openai`
(gpt-*), `ai-gemini` (gemini-*).

## Async + akış varyantları

```python
@hookspec(firstresult=True)
async def ai_complete_async(messages, model, api_key, max_tokens) -> str:
    """Awaitable; same shape as ai_complete. v1.5.0+."""

@hookspec(firstresult=True)
def ai_complete_stream(messages, model, api_key, max_tokens):
    """Returns an async iterator of text deltas. v1.6.0+."""
```

`ai_complete_async`, adım değerlendirmesi + konu geçişinin
`asyncio.gather` aracılığıyla eş zamanlı olarak başlatılması
için oturum rotası tarafından adım 6→7 döngü sınırında kullanılır
(`app.yaml`'da `async_evaluation: true`).

`ai_complete_stream`, `start` / `chunk` / `done` olayları yayan
akışa alınan SSE uç noktası `POST /api/plugins/session/{id}/message/stream`'i
besler.

## Sağlayıcı seçim mantığı (v1.20.0)

Oturum rotasının `_resolve_active_key()` işlevi, üç katmanlı zinciri
yürüyen `services/settings.resolve_api_key(db, user_id, provider)`
işlevini çağırır:

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` env değişkeni.
2. `~/.config/adaptive_learner/secrets.yaml` içinde
   `ai.<provider>.api_key`.
3. Fernet ile şifresi çözülmüş `UserSettings.api_key_<provider>`.
4. `None` - çağrı arayüze `ai_error` gösterir.

`resolve_default_model(db, user_id, provider)`, model geçersiz
kılma için aynı zinciri yürütür (env > yaml > arayüz geçersiz
kılma > `DEFAULT_MODELS[provider]`).

Ardından `ai_complete*` çözümlenen değerlerle tetiklenir. Eşleşen
sağlayıcının eklentisi metni döndürür; diğerleri None döndürür
(firstresult ilk çarpmada durur).

## Çift istemli mimari (v0.5.0) + otomatik döngü (v1.4.0)

`user` rolü için her `POST /api/plugins/session/{id}/message`,
en fazla üç yapay zeka çağrısı yapar:

1. **Öğrenme yanıtı** - `ai_complete_stream` aracılığıyla akışa
   alınır. Sistem istemi `build_prompt(project, profile, method,
   cycle_step, lang)` tarafından 42 hücreli matriksten oluşturulur.
   `max_tokens=1024`. SSE `start` / `chunk` / `done` olayları
   yayar.
2. **Adım değerlendiricisi** - yapay zekadan alışverişi okuyup
   bir JSON kararı (`advance`, `confidence`, `reason`,
   `suggested_step`) yaymasını isteyen ayrı bir sistem istemi
   (`EVALUATION_SYSTEM_PROMPT`). `max_tokens=256`. Değerlendiricinin
   kararı `cycle_step` ilerlemesini yönetir (`confidence ≥ 0,6`
   ile geçit).
3. **Konu geçişi** - yalnızca 7. adımda. Üçüncü bir yapay zeka
   çağrısı, konunun bütünleştirilip bütünleştirilmediğini ve yeni
   bir alt konuda yeni bir döngü başlatılıp başlatılmayacağını
   değerlendirir. Oturum başına `max_cycles=5` sınırı.

Değerlendirici ayrıştırılamaz JSON döndürürse, deterministik +1
geri dönüş devreye girer (7'de sınırlandırılır) ve `fallback_used=True`
kaydedilir.

Döngü sınırı (adım 6 → 7), `asyncio.gather` aracılığıyla adım
değerlendirmesi + konu geçişini eş zamanlı olarak tetikler (~T₂
gecikme tasarrufu). Mesaj yanıtının `timings` bloğunda döndürülür
(`learning_ms`, `evaluation_ms`, `topic_transition_ms`, `total_ms`,
`parallel_saved_ms`).

## 42 hücreli istem matrisi

`plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py`,
`dict[method, dict[step, dict[lang, str]]]` tutar - altı yöntem,
yedi adım, iki dil, 84 hücre. Her hücre, yapay zekanın rolünü +
adımın görevini belirleyen 1-2 cümledir. Derleme zamanında bir
bağlam bloğu ("Öğrenme projesi: 'X' | Hedef: 'Y'. Profil ipucu:
…") eklenir.

Dexie modu için istemler olduğu gibi
`frontend/src/data/session-prompts.json` dosyasına aktarılır ve
`frontend/src/storage/prompts.ts` tarafından yüklenir. Aynı metin,
aynı bağlam bloğu biçimi - hiçbir kayma mümkün değildir.

## Yeni sağlayıcı ekleme

1. `plugins/adaptive-learner-plugin-ai-newprovider/` oluşturun.
2. `ai_complete` hookimpl'ini uygulayın: model ön ekini kontrol
   edin, sağlayıcının HTTP API'sini çağırın, metni döndürün.
3. Sağlayıcının ön ekini `ai_orchestration.py`'deki `DEFAULT_MODELS`'a
   ucuz bir varsayılan model ile ekleyin.
4. Sağlayıcı adını `app/schemas/__init__.py`'deki `AIProvider`
   enum'una ekleyin.
5. `frontend/src/lib/constants.ts`'deki `AI_PROVIDERS`'a ekleyin.
6. Dexie modu paritesi için: `frontend/src/storage/ai-providers.ts`'e
   bir istemci ekleyin ve `aiComplete()` işlevinden ona yönlendirin.

Her sağlayıcı eklentisi, hookimpl + sağlayıcı çağrısını yalıtılmış
olarak test eder - bir şablon için
`plugins/adaptive-learner-plugin-ai-anthropic/tests/` bakın (sağlayıcı
HTTP çağrısı taklit edilir).

## Tarayıcı doğrudan çağrılar (Dexie modu)

Dexie modunda yapay zeka çağrısı eklenti sisteminden geçmez.
`storage/ai-providers.ts` HTTP isteğini doğrudan yapar. Anthropic,
CORS ön uçuşunu geçmek için `anthropic-dangerous-direct-browser-access:
true` başlığını gerektirir; OpenAI ve Gemini doğrudan tarayıcı
çağrılarını kutudan çıkar şekilde kabul eder.

Çift istemli mantık her iki modda da aynıdır -
`storage/session-flow.ts`, `aiComplete()` işlevini iki kez çağırır ve
değerlendiricinin JSON'ını arka ucun yaptığıyla aynı şekilde ayrıştırır.

## Güven eşiği

`backend/config/app.yaml`'ın
`session.step_evaluation.confidence_threshold`'u (varsayılan 0,6),
gerçek (geri dönüş olmayan) bir değerlendirici kararının gerçekten
döngü adımını hareket ettirip ettirmeyeceğine ilişkin geçit işlevi
görür. Daha muhafazakar olmak için daha yükseğe, daha hevesli
olmak için daha aşağıya ayarlayın. Geri dönüş kararları (ayrıştırma
hataları) her zaman +1 ilerlemeyi uygular.

Dexie portu bunu `storage/session-flow.ts`'de sabit kodlanmış 0,6
ile yansıtır. Gelecekteki bir aşama bunu Ayarlar arayüzünde
gösterecektir.

## Diğer yapay zeka yüzeyleri (salt okunur özet)

Aynı yapay zeka sağlayıcı eklentilerini `ai_complete*` aracılığıyla
kullanan çeşitli oturum dışı özellikler:

- **Konuşma analizörü** (Aşama 12 / v0.9.0+) -
  `frontend/src/chat_import/analysis.ts`, içe aktarılan dökümleri
  2 mesaj örtüşmesiyle 16K karakter parçalara ayırır, parça başına
  `ai_complete` tetikler, sonuçları birleştirir. Konu / zayıflıklar /
  error_patterns / recommended_method / vocabulary çıkarır
  (v1.20.0'dan beri). Toleranslı JSON ayrıştırıcı Haiku sınıfı
  davranış bozukluklarını işler.
- **Anki çıkarma** (Aşama 30 / v1.17.0) - `plugins/.../anki/
  card_extraction.py`, bir oturumdan veya konuşmadan flash kart
  adaylarını çıkarır; `analysis_result.vocabulary` doldurulduğunda
  kelime hazinesi yolu ek yapay zeka çağrısı olmadan istemci
  tarafında çalışır.
- **NotebookLM çalışma soruları + kılavuzu** (Aşama 32 / v1.19.0)
  - `plugins/.../notebooklm/question_generator.py` + `study_guide.py`;
  toleranslı JSON ayrıştırıcı; kullanıcı tarafından düzenlenen
  sorular yeniden oluşturmayı atlar.
- **Telaffuz yargıcı** (Aşama 31 / v1.18.0) -
  `plugins/.../pronunciation.py`, hedef ifadeler oluşturur + öğrenci
  ses benzerliğini değerlendirir (uygunluk Diller konu taksonomisi
  tarafından geçit uygulanır).
