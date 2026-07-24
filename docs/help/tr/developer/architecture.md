<!-- Translation: AI-generated, pending native review -->

# Mimari

Adaptive Learner, 4 katmanlı, eklenti güdümlü bir uygulamadır.

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend           React 19 + TypeScript 6 + Vite 8 +       │
│                    Vitest 4 + Dexie 4 (IndexedDB) + TipTap  │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ /api/*
┌─────────────────────────────────────────────────────────────┐
│ Backend            FastAPI ^0.136 + SQLAlchemy ^2.0 +       │
│                    Pydantic v2 + Alembic + Fernet           │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ hookspecs
┌─────────────────────────────────────────────────────────────┐
│ PluginForge        ^0.10.0 (external PyPI; identity-gated   │
│                    via target_application)                  │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ entry_points
┌─────────────────────────────────────────────────────────────┐
│ Plugins            10 packages under plugins/               │
│                    (ai-{anthropic,openai,gemini}, assessment,│
│                    session, tracking, tools, gamification,  │
│                    anki, notebooklm)                        │
└─────────────────────────────────────────────────────────────┘
```

Yeni özellikler, çekirdeğe dokunan şeyler dışında (kullanıcılar
/ projeler / ayarlar / müfredat / konular / dersler / yedek /
senkronizasyon / sistem / içe aktarma) DAIMA bir eklentiye aittir.

## Çift depolama (v0.7.0)

Frontend'in, destek deposunun seçildiği tek bir dikişi vardır:
`getStorage(): IStorageService`. İki uygulama tek bir sözleşmeyi
karşılar:

- **`apiStorage`** (varsayılan): FastAPI arka ucuyla konuşan
  `api/client.ts` etrafında ince bir sarmalayıcı.
- **`dexieStorage`** (yerel-öncelikli): `storage/ai-providers.ts`
  aracılığıyla tarayıcıdan doğrudan AI çağrıları yaparak tüm 25
  SQLAlchemy modelini yansıtan tam IndexedDB yığını.

`IStorageService`, 22 ad alanını açığa çıkarır (users, projects,
settings, assessment, session with streaming, tracking, tools,
curricula, topics, lessons, plugins, system, backup, export,
subjects, tags, projectTaxonomy, imports, gamification, anki,
pronunciation, notebooklm). Her iki depo da her yöntemi uygular.

Factory, `localStorage["adaptive-learner.storage_mode"]`'u, ardından
`VITE_STORAGE_MODE`'u (GH Pages derlemesi tarafından ayarlanan)
okur ve varsayılan olarak `api`'ye döner. Modları değiştirmek
canlı takas değildir: Ayarlar sayfası seçimi kalıcı olarak
kaydeder ve yeniden yükleme gerektiğini bildiren bir bildirim
gösterir.

## Üç katmanlı sırlar (v1.20.0 / Aşama 34)

```
env vars            > secrets.yaml         > Fernet DB column
ADAPTIVE_LEARNER_*    ~/.config/...yaml      api_key_<provider>
```

Her AI çağrısı, `services/settings.resolve_api_key` aracılığıyla
zinciri yürütür:

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` env değişkeni.
2. `~/.config/adaptive_learner/secrets.yaml` içinde
   `ai.<provider>.api_key`.
3. Fernet ile şifresi çözülmüş DB sütunu.
4. `None` - AI çağrısı arayüze bir hata gösterir.

Kaynak atıfı, `UserSettingsOut.key_source_*` üzerinde
(`env` / `secrets_yaml` / `settings` / `none` enum) yaşar.
Ayarlar arayüzü, kaynak env veya secrets_yaml olduğunda
Kaydet / Kaldır'ı devre dışı bırakır.

Aynı zincir, sağlayıcı başına `default_model` geçersiz kılmalarına
da uygulanır; `secrets.yaml`, Aşama 34 tasarımı uyarınca
arayüz geçersiz kılmasını geçersiz kılar (dosya yapılandırması,
güç kullanıcıları için arayüzü yener).

## Eklenti yapısı

```
plugins/adaptive-learner-plugin-<name>/
  adaptive_learner_<name>/
    plugin.py     # <Name>Plugin(BasePlugin), hook implementations
    routes.py     # FastAPI router (delegates to service functions)
    <module>.py   # business logic
  tests/
    test_*.py     # pytest tests
  pyproject.toml  # entry point: [project.entry-points."adaptive_learner.plugins"]
```

- Eklenti sınıfı `BasePlugin`'den (pluginforge) miras alır.
- İş mantığı, routes.py'de DEĞİL, kendi modüllerinde yaşar.
- routes.py yalnızca temsil eden FastAPI uç noktalarını içerir.
- Hook spec'leri `backend/app/hookspecs.py`'de yaşar.
- Eklenti bağımlılıkları sınıf özelliği olarak: `depends_on =
  ["session"]`.
- Tüm eklentiler ücretsizdir (MIT). Lisanslama altyapısı
  mevcuttur ancak etkin değildir (`LICENSING_ENABLED = False`).

## Hook'lar (`backend/app/hookspecs.py`'deki 8 spec)

| Hook | Ne Zaman | İlk sonuç? |
|---|---|---|
| `get_assessment_questions(lang)` | Değerlendirme sayfası yüklemesi | evet |
| `calculate_profile(answers)` | Değerlendirme gönderme | evet |
| `create_session_prompt(...)` | Her sohbet dönüşü | evet |
| `ai_complete(messages, model, api_key, max_tokens)` | Standart AI çağrısı | evet (sağlayıcı, model önekine göre yönlendirir) |
| `ai_complete_async(...)` | Paralel döngü sınırı değerlendirmesi (v1.5.0) | evet |
| `ai_complete_stream(...)` | Akışlı oturum yanıtı (v1.6.0) | evet |
| `recommend_method_switch(...)` | Gösterge Tablosu + Oturum | evet |
| `on_session_complete(session, rating)` | Oturum sonu | yayın |
| `get_progress_summary(project_id)` | Gösterge Tablosu widget'ları | yayın |
| `get_tool_recommendations(profile, lang)` | Gösterge Tablosu araçları | yayın |

## Veri akışı

```
UI (React) → IStorageService
            → (API mode) FastAPI router → service → SQLAlchemy → SQLite
            → (Dexie mode) Dexie table → IndexedDB
            ↓
            AI orchestrator → resolve_api_key (env > yaml > DB)
                            → pluginforge → provider plugin's ai_complete*
                            → Anthropic / OpenAI / Gemini SDK
```

Tek yönlü. Yönlendiricilerden doğrudan DB erişimi yok (servisler
SQLAlchemy işine sahiptir). Arka uçta frontend kodu yok.

## Hata yönetimi

```
Frontend       ApiError (status + detail) → toast for the user
API client     HTTP error → converted to ApiError
Router         Thin, catches nothing. Global exception handler maps.
Service        Throws AdaptiveLearnerError subclasses
Plugin         Throws PluginError(plugin_name, message)
External       ExternalServiceError(service, message) for provider SDKs
```

Servisler ASLA `HTTPException` fırlatmaz; yönlendiriciler HİÇBİR
ŞEY yakalamaz. `main.py`'deki global istisna işleyicisi, alan
hatalarını HTTP durum kodlarına eşler. Tam desen için
`.claude/rules/code-hygiene.md`'ye bakın.

## Kalıcılık

- Arka uç: SQLAlchemy + SQLite. `backend/migrations/versions/`
  içinde Alembic migrasyonları.
- Senkronizasyon yüzeyi: 28 tablo (v1.19.0 temeli). Yalnızca ekleme
  geçmişi satırları (oturumlar, mesajlar, derecelendirmeler, ilerleme
  commitler'i, adım değerlendirmeleri, yöntem geçişleri, içe aktarılan
  konuşmalar, içe aktarılan mesajlar, anki kartları, çalışma soruları)
  artı değiştirilebilir ayarlar + müfredat satırları.
- Yedek biçimi: JSON; API anahtarları dışa aktarmada çıkarılır;
  geri yükleme bir birleştirmedir.
- Test yalıtımı: üretim veri dizinleri
  `.adaptive-learner-production` işaretçisi taşır; bir test bunu
  görürse, çalıştırma `pytest.exit(returncode=2)` ile iptal edilir.

## Tema

5 tema (Classic, Cool Modern, Nord, Notebook, Studio) ×
açık/koyu = 10 varyant. Tamamen CSS değişkenleri; Tailwind yok.
`frontend/src/styles/global.css`'de özel özellikler. Yeni UI
öğeleri değişken setini KULLANMAK ZORUNDADIR.

## Mobil / PWA

`@media (max-width: 768px)`, kanonik mobil geçiş noktasıdır
(hamburger çekmecesi, 44×44 dokunmatik hedefler, yığılmış düzenler).
`@media (max-width: 360px)`, aşırı dar güvenlik ağıdır.
Masaüstü stilleri ≥769px değişmez.

Servis çalışanı (Workbox via vite-plugin-pwa): GET `/api/`'de
4s zaman aşımı, 24h LRU, 60 girdi sınırıyla NetworkFirst.
Mutasyona uğrayan `/api/`, NetworkOnly'dir.
