<!-- Translation: AI-generated, pending native review -->

# Yeni bir alıştırma türü ekleme

Kanonik model spec üzerine **genişletilmez**. Yeni bir alıştırma türü
yalnızca somut içerik ona ihtiyaç duyduğunda ve o zaman da tek, küçük,
additif bir PR olarak eklenir. Bu, gerçek `cloze`/`select` çoktan
seçmeli çalışmasından (#1342) ve EXP-039 şema hattından türetilmiş
bağlayıcı reçetedir.

Başlamadan önce, türün gerçekten yeni bir **tür** olduğunu, yani
[alıştırma türü kataloğu](authoring-content.md#exercise-type-catalog-status)
tarafından zaten kapsanan bir sunum ya da konvansiyon olmadığını doğrula
(metin çoktan seçmeli, Doğru/Yanlış, açılır liste/radyo/onay kutusu yeni
türler **değildir**). Tür **ikili olarak SRS-puanlanabilir** olmalıdır
(öğe başına tek bir doğru/yanlış sonucu) - kataloğun "kasıtlı olarak
dışlanan" listesinin çizdiği sınır budur.

## Adımlar

1. **EXP girişi / gerekçe.** İhtiyacı, ikili puanlama anlamını ve
   mevcut türlerden ayrımını ilgili keşif belgesine kaydet (alıştırma
   türü uygunluğu için `docs/explorations/EXP-041-*` ya da yeni bir
   EXP). Belgelenmiş bir gerekçe olmadan tür olmaz.
2. **Formatı engine'de genişlet.** Ders formatının kanonik yeri
   [learn-content-engine](https://github.com/astrapi69/learn-content-engine)
   paketidir: türü onun şemasına, elle yazılmış anlamsal katmanına
   (`src/rules.ts`) ve
   [format referansına](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)
   ekle, ardından engine'i release et. Bir format değişikliği **engine'de
   başlar** - uygulamanın `schema/*.json`'ı, sabitlenmiş release'in tam
   olarak tek yazarı olan bir byte aynasıdır
   (`scripts/sync_schema_mirror_from_engine.py`, #2265).
3. **Pin'i yükselt, senkronizasyonu çalıştır.** `frontend/package.json`
   içindeki `learn-content-engine` pin'ini yükselt, ardından **aynı
   PR'da** `make sync-schema`'yı çalıştır: kurulu paketten
   `schema/*.json` aynasını tazeler ve türetilmiş her artefact'ı yeniden
   üretir - yapısal Pydantic katmanı
   (`plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema_generated.py`,
   `scripts/generate_pydantic_models.py` üzerinden), tarayıcıdaki ajv şema aynası
   (`frontend/src/lib/content/validation/lesson.schema.generated.json`)
   ile bağımsız doğrulayıcısı ve
   format referansı belgesi. Aynalanan ya da üretilen bir artefact'ı
   **asla elle düzenleme**; düzenlersen `make sync-schema-check` sapma
   kapısı başarısız olur.
4. **Şema sürümü.** `models.py` içindeki `CURRENT_SCHEMA_VERSION`'ı
   sabitlenmiş engine şema sürümüyle uyumlu tut (**minor** = additif;
   eski içerik major sürüm eşleşmesi üzerinden doğrulanmaya devam eder).
   Uygulama tarafında alanlar arası kuralları
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py`
   dosyasına ekleme: anlamsal kurallar engine'e aittir ve yazım zamanında
   ve frontend'de bir kullanıcı seti kaydedilmeden önce çalışır (#3245);
   arka uç dersi yalnızca saklar ve sunar.
5. **Render eden'i kaydet.** Dalı ve türü
   `frontend/src/components/exercises/shell/ExerciseDispatcher.tsx`
   içindeki `SUPPORTED_EXERCISE_TYPES`'a ekle. **Kayıt enum'a eşit
   olmalıdır** - bir parite testi bunu zorunlu kılar, böylece render
   edilmeyen bir tür CI'da başarısız olur (ölü şemayı önleyen değişmez).
6. **Puanlamayı / SRS'i bağla.** Render eden'den
   `useControlledExercise` üzerinden bir `ExerciseScored` yay;
   `LessonStepView.tsx` içindeki ortak `onComplete` → `recordStepResult`
   yolu her denemeyi zaten `getStorage().elementErrors.recordBulk`
   üzerinden dağıtır - onu yeniden kullan, ikinci bir kayıt yolu ekleme.
7. **İçerik reposu doğrulaması.** İstemci doğrulayıcısını genişlet
   (`frontend/src/lib/content/validation/content-validator.ts`). Kalite
   alt sınırları engine'in `quality-rules.json` dosyasında bulunur
   (`schema/quality-rules.json` içine aynalanır); tür onları
   etkiliyorsa, onları uygulamada değil engine'de genişlet.
8. **Yazım belgeleri.** Türü
   [katalog tablosuna](authoring-content.md#exercise-type-catalog-status)
   ekle ve JSON örnekli bir `### <type>` referans bloğu yaz (EN + DE).
9. **Testler.** Şema geçerli bir örneği kabul eder ve geçersiz birini
   reddeder (eksik zorunlu alan / fazladan anahtar); render eden
   doğru/yanlışı render eder + puanlar; SRS denemesi kaydedilir;
   kontrolün görünümü yeniyse bir mobil görsel baseline ekle.
10. **Takip (bu PR değil).** İçerik repoları
    (`adaptive-learner-content`), engine release'lerini yeniden
    sabitlediklerinde yeni türü benimser; bunu not et, ona takılıp kalma.

## Bu neden küçük kalır

Format sabitlenmiş engine release'inden aynalandığı ve her uygulama
artefact'ı o aynadan türediği için (adım 3) ve dispatcher parite testi
kaydın enum'a eşit olmasını zorladığı için (adım 5), yeni bir tür sabit
biçimli additif bir değişikliktir: engine → pin → üret → render eden →
puanlama → belgeler → testler. Paralel, elle tutulan bir kopya
sapamaz ve hiçbir tür render eden olmadan gönderilemez.
