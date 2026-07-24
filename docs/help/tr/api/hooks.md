<!-- Translation: AI-generated, pending native review -->

# Hook spesifikasyonları

10 hookspec `backend/app/hookspecs.py` içinde yaşar. Her
hookspec çağırma sözleşmesini tanımlar; eklentiler bunları
`@hookimpl` ile uygular. Üçü, v1.5.0 ve v1.6.0 boyunca aşamalı
olarak sunulan AI çağrısı varyantlarıdır (senkron / async /
akış); geri kalanlar v0.2.0'dan bu yana değişmemiştir.

## get_assessment_questions

```python
@hookspec
def get_assessment_questions(lang: str) -> list[dict] | None:
    """İstenen dil için soru paketini döndür.

    Uygulayan: değerlendirme eklentisi.
    Mod: liste (firstresult değil). Rota şu anda ilk eklentinin
    sonucunu kullanır; gelecekteki bir "çoklu soru paketi"
    özelliği, sağlayıcıların adlandırılmış paketler kaydetmesine
    izin verebilir.
    """
```

Dönüş şekli:

```python
[
  {
    "id": "q01",
    "type": "single" | "multi",
    "text": "...",
    "answers": [
      {"id": "a", "text": "...", "weights": {"deductive": 1.0}},
      ...
    ]
  },
  ...
]
```

## calculate_profile

```python
@hookspec(firstresult=True)
def calculate_profile(answers: list[dict]) -> dict[str, float]:
    """Ham cevapları 6 yöntemli profile topla.

    Uygulayan: değerlendirme eklentisi.
    firstresult: tam olarak bir eklenti profili hesaplar.
    """
```

Girdi `answers` şekli:

```python
[
  {"question_id": "q01", "answer_ids": ["a", "b"]},  # çoklu
  {"question_id": "q02", "answer_id": "c"},          # tekli
  ...
]
```

Dönüş: altı yöntem anahtarıyla `dict[method, float]`.

## create_session_prompt

```python
@hookspec(firstresult=True)
def create_session_prompt(
    project: dict,
    profile: dict,
    method: str,
    step: int,
    lang: str,
) -> str:
    """Bir (yöntem, adım, dil) hücresi için sistem istemini oluştur.

    Uygulayan: oturum eklentisi.
    firstresult: tam olarak bir eklenti istemi oluşturur.
    """
```

Dönüş: `system` rolü mesajı olarak gönderilmeye hazır bir dize.
Oturum eklentisinin uygulaması 42 hücreli `_PROMPTS` sözlüğünden
okur ve bir bağlam bloğu ekler.

## ai_complete

```python
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """AI sağlayıcısını çağır, asistan metnini döndür.

    Uygulayan: ai-anthropic, ai-openai, ai-gemini.
    firstresult: eşleşen sağlayıcı eklentisi metni döndürür;
    diğerleri None döndürür.
    """
```

Her sağlayıcı eklentisi `model` önekini kontrol eder
(`claude-*`, `gpt-*`, `gemini-*`) ve modele sahipse asistan
metnini döndürür. Eşleşmeyen eklentiler None döndürerek
firstresult'un bir sonrakine geçmesine izin verir.

`messages` şekli (OpenAI tarzı):

```python
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."},
  {"role": "user", "content": "..."},
]
```

Sağlayıcı eklentileri bu şekli kendi API'lerine normalleştirir
(Anthropic `system`'i ayırır; Gemini bunu katlar).

## ai_complete_async (v1.5.0+)

```python
@hookspec(firstresult=True)
async def ai_complete_async(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str:
    """ai_complete'in beklenilebilir varyantı.

    Uygulayan: ai-anthropic, ai-openai, ai-gemini.
    Adım 6 -> 7 döngü sınırında kullanılır; adım değerlendirmesi +
    konu geçişinin asyncio.gather aracılığıyla eş zamanlı
    tetiklenmesi için (~T_2 gecikme tasarrufu).
    """
```

Orkestratör yardımcısı `call_ai_complete_async` bu hook'u tercih
eder; uygulanmadığında `asyncio.to_thread` içinde sarılmış
`ai_complete`'e geri döner.

## ai_complete_stream (v1.6.0+)

```python
@hookspec(firstresult=True)
def ai_complete_stream(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> AsyncIterator[str]:
    """Metin deltalarının async yineleyicisini döndür.

    Uygulayan: ai-anthropic, ai-openai, ai-gemini; her biri
    sağlayıcı SDK'sının yerel async akışını kullanır.
    ``POST /api/plugins/session/{id}/message/stream``'i
    (SSE: ``start`` / ``chunk`` / ``done`` olayları yayar)
    destekler.
    """
```

## recommend_method_switch

```python
@hookspec
def recommend_method_switch(
    history: list[dict],
    profile: dict,
) -> dict | None:
    """Bir geçiş önerisi veya None döndür.

    Uygulayan: oturum eklentisi.
    Mod: liste. Eklentiler bireysel öneriler döndürür;
    gelecekteki bir hakem en yüksek güvenilirlikli None olmayan
    olanı seçer.
    """
```

Dönüş şekli:

```python
{
  "recommended": True,
  "to_method": "dialogic",
  "reason": "Three sessions of stagnant understanding.",
  "confidence": 0.75,  # isteğe bağlı
}
```

Geçiş gerekmediğinde `None` (veya `{"recommended": False}`)
döndürün.

## on_session_complete

```python
@hookspec
def on_session_complete(
    session: dict,
    rating: dict,
) -> None:
    """Yan etki hook'u: oturum sonlandırıldığında tetiklenir.

    Uygulayan: takip eklentisi (ProgressCommit yazar).
    Mod: liste. Her abone çalışır; hatalar yakalanır ve
    kaydedilir ama oturum sonunu geri almaz.
    """
```

Bu hook'taki hatalar YAYILMAMALIDIR - `backend/app/main.py`
içindeki `_fire_on_session_complete` sarmalayıcısı onları
yakalar ve kaydeder.

## get_progress_summary

```python
@hookspec
def get_progress_summary(
    project_id: str,
    db: Session,
) -> dict | None:
    """İlerleme özetinin bir ad alanı dilimini döndür.

    Uygulayan: takip eklentisi ("tracking" ad alanı dilimini
    döndürür).
    Mod: liste. Dilimler rotada sığ olarak birleştirilir.
    """
```

Her eklenti, benzersiz bir ad alanıyla anahtarlanmış bir dict
döndürür. Takip eklentisi
`{"tracking": {...}, "step_evaluation": {...}}` döndürür.
Gelecekteki bir durgunluk algılama eklentisi
`{"stagnation": {...}}` vb. döndürebilir.

## get_tool_recommendations

```python
@hookspec
def get_tool_recommendations(
    profile: dict,
    lang: str,
    limit: int = 5,
) -> list[dict] | None:
    """Sıralı dış araç önerilerini döndür.

    Uygulayan: araçlar eklentisi.
    Mod: liste. Rota şu anda ilk eklentinin sonucunu kullanır;
    gelecekteki çok kaynaklı bir öneri sistemi birleştirebilir.
    """
```

Dönüş şekli:

```python
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "...",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

## firstresult vs liste modu

| Hookspec | Mod | Neden |
|---|---|---|
| get_assessment_questions | liste (etkin firstresult) | Şu anda bir paket; gelecekte adlandırılmış paketler kaydedilebilir |
| calculate_profile | firstresult | Tam olarak bir algoritma |
| create_session_prompt | firstresult | Tam olarak bir istem oluşturucu |
| ai_complete | firstresult | Eşleşen sağlayıcı çağrıya sahip |
| recommend_method_switch | liste | Birden fazla eklenti önerebilir |
| on_session_complete | liste | Yan etkiler yayılır |
| get_progress_summary | liste | Ad alanı dilimleri birleşir |
| get_tool_recommendations | liste (etkin firstresult) | Şu anda bir kaynak |

Şu anda firstresult gibi davranan `list` modları kasıtlıdır:
sözleşme çok eklentili uzantıya açıktır ama v0.7.0 uygulaması
yalnızca ilkini kullanır.
