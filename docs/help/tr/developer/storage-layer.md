<!-- Translation: AI-generated, pending native review -->

# Depolama katmanı

v0.7.0 depolama katmanı (`frontend/src/storage/`), frontend'e
tek bir sözleşmenin arkasında iki değiştirilebilir arka uç sağlar.
Sözleşme, Aşamalar 7–34 boyunca 22 ad alanına büyümüştür.

## IStorageService

`frontend/src/storage/types.ts`, her depolama uygulamasının
karşıladığı arayüzü tanımlar. Bu, `api/client.ts` içindeki
`api.*` ad alanlarını birebir yansıtır:

```typescript
export interface IStorageService {
  readonly mode: StorageMode;
  health(): Promise<HealthInfo>;
  // Çekirdek
  i18n: II18nNamespace;
  users: IUsersNamespace;
  projects: IProjectsNamespace;
  settings: ISettingsNamespace;   // key_source_* dahil get/set
  assessment: IAssessmentNamespace;
  session: ISessionNamespace;     // streamMessage() dahil
  tracking: ITrackingNamespace;
  tools: IToolsNamespace;
  curricula: ICurriculaNamespace;
  topics: ITopicsNamespace;
  lessons: ILessonsNamespace;
  plugins: IPluginsNamespace;
  system: ISystemNamespace;
  // Aşama 12+
  backup: IBackupNamespace;
  export: IExportNamespace;
  imports: IImportsNamespace;
  // Aşama 22 — taksonomi
  subjects: ISubjectsNamespace;
  tags: ITagsNamespace;
  projectTaxonomy: IProjectTaxonomyNamespace;
  // Aşama 29-32 — oyunlaştırma + dışa aktarmalar
  gamification: IGamificationNamespace;
  anki: IAnkiNamespace;
  notebooklm: INotebookLmNamespace;
  pronunciation: IPronunciationNamespace;
}
```

Her sayfa, `IStorageService`'i `getStorage()` fabrikası aracılığıyla
kullanır. Sayfalar hiçbir zaman doğrudan `api/client.ts`'i veya
Dexie veritabanını içe aktarmaz.

## ApiStorage

`storage/api-storage.ts`, `api.*`'a ince bir geçiş katmanıdır.
Her yöntem birebir devredilir. Davranış v0.6.0 ile özdeştir.

## DexieStorage

`storage/dexie-storage.ts`, Dexie 4.4.2 aracılığıyla her şeyi
IndexedDB'ye kaydeder. `storage/db.ts` içindeki şema, tüm 25
SQLAlchemy modelini ve 4 ilişki tablosunu (project_subjects /
project_tags vb.) birebir yansıtır.

`storage/` altındaki alt modüller taşınan mantığı taşır:

| Modül | Sorumluluk |
|---|---|
| `assessment.ts` | 12 soruluk paket + profil hesaplayıcı |
| `prompts.ts` | 42 hücreli sistem istemi matrisi |
| `step-evaluator.ts` | Çift istemli adım değerlendirme taşıması |
| `session-flow.ts` | başlat + mesaj orkestrasyonu |
| `tracking.ts` | toplayıcı + buildCommitFromSession |
| `tools.ts` | rankTools + buildSpacedRecommendations |
| `ai-providers.ts` | Anthropic/OpenAI/Gemini HTTP istemcileri |

Paketlenmiş veriler `frontend/src/data/` dizininde yaşar:

- `assessment-questions.json` — arka ucun `QUESTIONS` listesinden
  olduğu gibi dışa aktarılmış (12 soru × 4 cevap × 5 dil).
- `session-prompts.json` — arka ucun `_PROMPTS` sözlüğünden olduğu
  gibi dışa aktarılmış (6 yöntem × 7 adım × 2 dil).

## Üçüncü bir depolama arka ucu ekleme

`IStorageService`'i istediğiniz kalıcılık katmanıyla uygulayın
(Supabase, Firestore, özel bir REST API). `storage/index.ts`'in
fabrikasına kaydedin:

```typescript
if (mode === "supabase") {
  cachedStorage = supabaseStorage;
}
```

`StorageMode` türüne modu ekleyin:

```typescript
export type StorageMode = "api" | "dexie" | "supabase";
```

Ayarlar arayüzünün depolama modu bölümüne bağlayın. Başka dosya
değişikliği gerekmez — sayfalar hâlâ `getStorage()` üzerinden gider.

## Tarayıcı doğrudan AI çağrıları

`storage/ai-providers.ts` üç sağlayıcı istemcisi uygular:

- **Anthropic** — `https://api.anthropic.com/v1/messages` adresine
  `anthropic-dangerous-direct-browser-access: true` başlığıyla POST
  yapar. Bu, Anthropic'in tarayıcı arayanlara yönelik açık katılım
  seçeneğidir; olmadan CORS reddeder.
- **OpenAI** — `https://api.openai.com/v1/chat/completions` adresine
  `Authorization: Bearer ${apiKey}` ile POST yapar. CORS varsayılan
  olarak açıktır.
- **Gemini** — `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
  adresine POST yapar. Sorgu parametresi kimlik doğrulaması, sistem
  alanı yok; sistem mesajları ilk kullanıcı dönüşüne katlanır.

Her üçü de hataları `ApiError(status, "Provider: detail")` olarak
normalleştirir; böylece mevcut frontend toast / GitHub Issue deneyimi
dallanma olmadan bunları işler.

## Dexie modunda neden düz metin API anahtarları?

Dexie modunda kullanıcının API anahtarı IndexedDB düz metninde
(`UserSettings.api_key_{provider}`) bulunur. Kabul edilebilir tehdit modeli:

- Veriler hiçbir zaman kullanıcının kendi cihazından çıkmaz.
- AI sağlayıcı, anahtarı gören TEK ağ uç noktasıdır.
- IndexedDB'de şifrelemek, ya oturum başına bir parola istemi gerektirir
  (kullanıcı deneyimi düşman) ya da uygulamaya paketlenmiş sabit bir
  anahtar gerektirir (güvenlik göstermeliği — saldırganın paketi var).

Sunucu modu davranışı farklıdır: API anahtarları beklemede Fernet
şifrelemesiyle geçer (`ADAPTIVE_LEARNER_SECRET_KEY`). ApiStorage
hiçbir zaman düz metni görmez.

v1.20.0 / Aşama 34'ten itibaren, her iki mod da sağlayıcı başına
kaynak ilişkilendirmesi sunar
(`UserSettings.key_source_anthropic | openai | gemini`), böylece
arayüz "Anahtar kaynağı: secrets.yaml" / "ortam" / "Ayarlar"
şeklinde gösterebilir. Dexie modunda kaynak `settings` veya `none`'a
daralır; tarayıcı sandbox'u dosya sistemi erişimine sahip olmadığından
`secrets.yaml` bir masaüstü / sunucu modu kavramıdır.

## Mod çözümleme

`storage/index.ts` modu şu sırayla çözümler:

1. `localStorage["adaptive-learner.storage_mode"]` — Ayarlar'dan
   kullanıcı seçimi.
2. `VITE_STORAGE_MODE` — derleme zamanı varsayılanı (GH Pages bunu
   `"dexie"` olarak ayarlar).
3. Geri dönüş: `"api"`.

Sonuç, sayfanın ömrü boyunca önbelleğe alınır. Test kodu
`_resetStorageCacheForTests()` aracılığıyla sıfırlayabilir.
