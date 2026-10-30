<!-- Translation: AI-generated, pending native review -->

# Test

AdaptiveLearner'ın test disiplini, her değişiklikte `make test`
tarafından uygulanır. Strateji bir piramittir: tabanda birim
testleri, ortada entegrasyon, üstte E2E duman testleri.

## Test sayıları

| Katman | Araç |
|---|---|
| Arka uç birim + entegrasyon | pytest ^9 |
| Eklenti testleri (tüm eklentiler) | pytest ^9 |
| Frontend birim + entegrasyon | Vitest 4 |
| E2E duman | Playwright |
| Dexie modu sürüm kapısı | Playwright |

Sayılar her sürümde artar. Senkronu bozulan yinelenen sayılardan
kaçınmak için bu sayfa toplam YAZMAZ. Test sayıları ve kapsam için
tek kanonik ve her zaman güncel kaynak
`docs/audits/current-coverage.md` dosyasıdır. Eklentiler:
assessment, yapay zeka sağlayıcıları (anthropic / openai / gemini /
perplexity), session, tracking, tools, gamification, anki,
notebooklm, learning-repo, content-loader ve missions.

## Arka uç pytest

```bash
make test-backend      # tüm arka uç testleri
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb
```

Testler `backend/tests/` dizininde bulunur. `conftest.py`
içindeki fikstürler test başına taze bir bellek içi SQLite veritabanı,
`TestClient` ve sahte bir eklenti yöneticisi sağlar. Test izolasyonu
katıdır - herhangi bir `app.*` içe aktarımından önce
`ADAPTIVE_LEARNER_TEST=1` ayarlanır.

## Eklenti testleri

Her eklentinin kendi `tests/` dizini vardır:

```bash
make test-plugins              # tümü
make test-plugin-session       # yalnızca biri
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Eklenti testleri FastAPI uygulamasını yüklemez - eklentinin
modüllerini izole olarak test eder. Hook tetiklemeyi test ederken
`pluggy.PluginManager`'ı sahte yapın.

## Frontend Vitest

```bash
make test-frontend                # Vitest'i frontend/ içinden çalıştırır
cd frontend && bunx vitest         # izleme modu
cd frontend && bunx vitest run src/storage/  # tek dizin
```

Testler kaynakla birlikte yaşar: `Component.tsx` yanında
`Component.test.tsx`. Ortam happy-dom'dur; React 19 + RTL.

## Sahte desenler

**AI sağlayıcıları**: `global.fetch`'i sahte yapın ve URL,
başlıklar, gövde üzerinde iddia edin:

```typescript
beforeEach(() => {
  global.fetch = vi.fn(async (input, init) => {
    calls.push({url, method, body});
    return new Response(JSON.stringify({content: [{type: "text", text: "hi"}]}), {status: 200});
  });
});
```

**fake-indexeddb**: her Dexie test dosyasının başında:

```typescript
import "fake-indexeddb/auto";

beforeEach(async () => {
  await _resetDbForTests();
  const {IDBFactory} = await import("fake-indexeddb");
  (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});
```

Her test taze bir bellek içi IndexedDB alır - sızıntı yok.

**api/client.ts sahte yapıları** (eski sayfalar):

```typescript
vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {...actual, api: {...actual.api, users: {...actual.api.users, get: apiGetMock}}};
});
```

Sayfa `getStorage()`'ı içe aktarır, bu ApiStorage'a, o da `api.*`'a
devretir. Sahte yapı `api.*` katmanında keser ve depolama yığını
üzerinden hâlâ tetiklenir.

## Playwright E2E

```bash
cd e2e && npx playwright test
cd e2e && npx playwright test --ui   # etkileşimli
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

Duman testleri kritik kullanıcı yollarını kapsar:

- Açılış dil seçici + başlangıç formu
- Değerlendirme 12 soru + radar oluşturma
- Oturum başlatma + bitirme + puanlama
- Ayarlar dil + API anahtarı
- Müfredat oluşturma
- Mobil görünüm alanları (iPhone SE, iPhone 14, Pixel 7, iPad)

Testler yalnızca `data-testid` seçicileri kullanır - kırılgan CSS
seçicileri yok. Duman testleri `make test` yolunda değildir;
kendi portlarında kendi sunucularını başlatır ve çalışan bir
uygulama gerektirmez. Çalışan bir `make dev` etkilenmez.

## Kapsam

```bash
make test-coverage   # isteğe bağlı; yavaş + ısıl olarak ağır
```

Kapsam bir rapordur, merge kapısı değildir; bu yüzden PR'lerde
çalışmaz. `coverage.yml` workflow'u her gece (ve manuel tetiklemeyle)
çalışır; artefaktları indirin:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

Her eklentinin kendi artefaktı vardır: `<eklenti-dizini>-coverage`,
örneğin
`gh run download --name adaptive-learner-plugin-session-coverage`;
yeni bir eklenti workflow değiştirilmeden kapsanır.

`.claude/rules/quality-checks.md` başına hedefler:

- Servisler + iş mantığı: min %95
- API uç noktaları: min %90
- Mantıklı frontend bileşenleri: min %85
- Hook'lar + yardımcılar: min %95

Genel: proje genelinde %85-95.

## Ön teslim

```bash
cd backend && poetry run pre-commit install
```

Kancalar `.pre-commit-config.yaml` içinde listelenir, örneğin ruff
check (otomatik düzeltme) ve ruff format, boşluk, YAML, JSON ve
merge çakışması denetimleri, frontend ESLint, doküman denetimleri
(umlaut yerine geçen yazımlar için ratchet, doküman referansları) ve
`plugin-lock-paired-with-pyproject` (engelleyici): `pyproject.toml`
ya da `poetry.lock` dosyası etkilenen her eklenti için
`poetry check --lock` çalıştırır ve lock yazıldığından beri
bağımlılıklar değiştiyse başarısız olur; CI'daki pre-commit işinde
de tüm dosyalar üzerinde çalışır. Bu işte `eslint` kancası atlanır
(frontend test işi ESLint'i kurulu bağımlılıklarla çalıştırır).
Prettier bir kanca değildir: `bun run format:check` frontend test
işinde çalışır ve #3270'teki tek seferlik yeniden biçimlendirmeye
kadar engellemez.

## CI

CI iki katmana ayrılır: doğruluk kapıları her PR'de çalışır (merge
için geçmeleri zorunludur); pahalı ya da yalnızca uyarı veren
takımlar gece vardiyasında ve release zamanında çalışır.

`.github/workflows/ci.yml`, `develop` / `main` dallarına push'ta ve
her PR'de çalışır (Python 3.12):

1. Arka uç testleri (pytest)
2. Eklenti testleri (`make test-plugins`, arka uç venv'i üzerinden
   tümü)
3. Frontend: `tsc --noEmit`, ESLint (`--max-warnings 0`), döngüsel
   bağımlılık denetimi, Stylelint, Vitest, `vite build`,
   `bun audit --audit-level=high` (yüksek ve kritik bulgularda
   engeller). Yamalı sürümü olmayan ve yalnızca bir geliştirme
   bağımlılığına ulaşan bir uyarı, ID'siyle
   `frontend/audit-ignore.txt` içinde muaf tutulur: satır başına bir
   ID, üstünde nedeni ve girdinin ne zaman kalkacağını söyleyen bir
   yorum. `make check-security` aynı listeyi okur;
   `security-scan.yml` filtresiz kalır.
4. Tüm dosyalarda pre-commit kancaları
5. Arka uç ruff + mypy + pip-audit
6. Dokümantasyon sapma doğrulayıcısı (`verify_docs.py` +
   mkdocs-nav eşitlemesi)

**Test Impact Analysis (#615):** bir PR'de yalnızca etkilenen
testler çalışır - `vitest run --changed origin/<base>` ve
`pytest --testmon`. `develop` / `main` push'ları, gece koşuları ve
release koşuları her zaman TAM takımı çalıştırır. Tam takıma geri
dönüş otomatiktir (çözülemeyen base ref'i ya da testmon önbellek
kaçırması).
Bir PR'ın ilk koşusu da seçicidir: `testmon-seed` işinin `develop`'a her push'ta yazdığı testmon verilerini geri yükler (#3901).

Diğer PR kapıları kendi workflow'larında yaşar:

- `complexity-check.yml` - karmaşıklık ratchet kapısı
  (`make check-complexity-gate`, Python için radon + TS için ESLint
  complexity). Bir baseline ratchet'idir: yalnızca
  `.complexity-baseline` karşısında YENİ ya da gerileyen ihlallerde
  başarısız olur; böylece var olan borcun topluca temizlenmesini
  zorlamadan yeni karmaşıklığı engeller. Yalnızca uyarı veren tam
  karmaşıklık raporu gece çalışır. Aynı işte klasör boyutu koruması
  da çalışır (`.dirsize-baseline` karşısında
  `scripts/check-folder-size.sh`); yerelde `make check-folder-size`
  ile ya da `make ci` içinde.
- `cohesion-check.yml` - dosya boyutu koruması
  (`.filesize-whitelist` karşısında kapı) artı iki sınıf adı
  kapısı: ölü CSS sınıf adları (`check-dead-classnames.py`,
  `.dead-classnames-baseline` karşısında) ve **stillenmemiş
  className kapısı** (`--unstyled`, `.unstyled-classnames-baseline`
  karşısında bir ratchet) - tüm token'ları ölü olan bir `className`
  PR'ı engeller.
- `visual-baseline-gate.yml` - görsel açıdan kritik yolları (ders
  bileşenleri, alıştırma renderer'ları, tema/CSS dosyaları)
  değiştiren bir PR, etkilenen baseline ekran görüntülerini aynı
  PR'de getirmek zorundadır; kanıtlanabilir şekilde etkisiz
  değişiklikler için kaçış etiketi `visual-baselines-unaffected`.
- `testid-reference-gate.yml` - bir PR, bir E2E spec'inin statik
  olarak referans verdiği bir `data-testid`'yi (kullanıcıya çok
  görünür bir yüzeyde) spec'e dokunmadan kaldırır ya da yeniden
  adlandırırsa kapı başarısız olur (`make check-testid-refs`);
  kaçış etiketi `testid-refs-unaffected`.
- `docker-build-smoke.yml` - üretim compose imajlarının yalnızca
  build içeren duman testi (launcher / install.sh yolu), PR'lerde
  yol filtreli, ayrıca `release/**` üzerinde, haftalık ve manuel
  tetiklemeyle; yerelde `make docker-build-smoke`.
- `dexie-smoke.yml` - Dexie modu E2E kapısı: ilgilendirdiği her pull
  request'te (`scripts/dexie_smoke_affected.py` karar verir;
  `Dexie smoke (required)` işi her zaman rapor verir), ayrıca günlük,
  `release/**` üzerinde ve manuel tetiklemeyle; yerelde
  `make test-dexie-smoke`.
- `backup-e2e.yml` - bir yedekleme yoluna dokunan PR'lerde çalışır
  (örneğin `frontend/src/storage/backup/`, Dexie store'ları ya da arka
  ucun yedekleme servisleri; liste workflow'dadır) ve her
  `e2e/dexie/backup-*.spec.ts` dosyasını çalıştırır, tüm yedekleme
  tabloları üzerinden gidiş-dönüş dahil.

**Gece vardiyası / release (PR'lerde değil):**

- `coverage.yml` - kapsam raporu (günlük + manuel tetikleme)
- `security-scan.yml` - pip-audit / bun audit / bandit (haftalık +
  `release/**` üzerinde + manuel tetikleme; yalnızca uyarı)
- `content-stats.yml` - taze bir içerik checkout'una karşı içerik
  istatistikleri sapması (günlük + manuel tetikleme)
- `mutation-frontend.yml` - Stryker mutasyon testleri (gecelik,
  `ENABLE_NIGHTLY_MUTATION` repo değişkeninin arkasında + manuel
  tetikleme; her çalıştırma, iş zaman sınırına sığmak için
  dosyaların bir dilimini mutasyona uğratır); arka uç mutasyon
  testleri mutmut kullanır
- `webkit-gate.yml` - gerçek WebKit motoruyla çalışan yerleşim
  kapısı (Chromium kapılarının yapısal olarak göremediği
  iOS/Safari hata sınıfları), günlük olarak `ENABLE_NIGHTLY_WEBKIT`
  repo değişkeninin arkasında, `release/**` üzerinde ve manuel
  tetiklemede her zaman
- `visual-regression.yml` - görsel baseline matrisi (günlük +
  manuel tetikleme; `update_baselines=true`, baseline'ları CI'da
  yeniden render eder ve artefakt olarak yükler)
- `visual-baseline-sync.yml` - servis workflow'u: baseline'ları
  CI'da render eder ve PR dalına bir commit olarak push'lar
  (`refresh-visual-baselines` etiketi ya da PR numarasıyla manuel
  tetikleme) - merge öncesi görsel inceleme zorunlu kalır
- `smoke-nightly.yml` - mobil viewport duman testinin gece koşusu;
  bulgular tek bir takip issue'suna gider
- `unused-catalog-keys.yml` - hazırlık penceresinden daha eski,
  tüketicisi olmayan katalog anahtarlarının gece raporu (`AGE_DAYS`,
  `frontend/src/i18n/unused-catalog-keys.ts` içinde), tek bir takip
  issue'sunda; içindeki her anahtar bir adaydır ve silinmeden önce
  tek tek kontrol edilir

`.github/workflows/release-gate.yml`, etiket push'larında çalışır:
sürüm pinlerinin sürüm taşıyan tüm dosyalarda eşitlendiğini (sapma
yok), eklenti kilit dosyalarının eşleştiğini ve yeniden üretilen
artefaktların güncel olduğunu doğrular.
