<!-- Translation: AI-generated, pending native review -->

# Test

AdaptiveLearner'ın test disiplini, her değişiklikte `make test`
tarafından uygulanır. Strateji bir piramittir: tabanda birim
testleri, ortada entegrasyon, üstte E2E duman testleri.

## Test sayıları (v1.20.0)

| Katman | Sayı | Araç |
|---|---|---|
| Arka uç birim + entegrasyon | 786 | pytest ^9 |
| Eklenti testleri (10 eklenti) | 615 | pytest ^9 |
| Frontend birim + entegrasyon | 1233 | Vitest 4 |
| E2E duman | 16 dosya | Playwright |
| **Toplam (`make test`)** | **2634** | |

Eklenti dağılımı: assessment 110 + ai-anthropic 34 +
ai-openai 31 + ai-gemini 33 + session 215 + tracking 64 +
tools 58 + gamification 23 + anki 20 + notebooklm 27.

## Arka uç pytest

```bash
make test-backend      # 786 test, ~35s
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb
```

Testler `backend/tests/` dizininde bulunur. `conftest.py`
içindeki fikstürler test başına taze bir bellek içi SQLite veritabanı,
`TestClient` ve sahte bir eklenti yöneticisi sağlar. Test izolasyonu
katıdır — herhangi bir `app.*` içe aktarımından önce
`ADAPTIVE_LEARNER_TEST=1` ayarlanır.

## Eklenti testleri

Her eklentinin kendi `tests/` dizini vardır:

```bash
make test-plugins              # tümü
make test-plugin-session       # yalnızca biri
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Eklenti testleri FastAPI uygulamasını yüklemez — eklentinin
modüllerini izole olarak test eder. Hook tetiklemeyi test ederken
`pluggy.PluginManager`'ı sahte yapın.

## Frontend Vitest

```bash
make test-frontend                # 387 test, ~2s
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

Her test taze bir bellek içi IndexedDB alır — sızıntı yok.

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

Testler yalnızca `data-testid` seçicileri kullanır — kırılgan CSS
seçicileri yok. Duman testleri `make test` yolunda değildir;
çalışan bir uygulama gerektirir (önce `make dev-bg` çalıştırın).

## Kapsam

```bash
make test-coverage   # isteğe bağlı; yavaş + ısıl olarak ağır
```

Kapsam, main'e her push'ta CI'da çalışır; artefaktları indirin:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

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

Kancalar: ruff check (otomatik düzeltme), ruff format, sondaki
boşluk, dosya sonu düzeltici, check-yaml, check-merge-conflict.
Yalnızca arka uç — frontend lint, ön teslimde değil CI zamanında
çalışır.

## CI

`.github/workflows/ci.yml`, main'e her push + her PR'de çalışır:

1. Arka uç testleri (Python 3.12 + 3.13 matrisi)
2. Eklenti testleri (eklenti başına bir iş; matris-stratejisi)
3. Frontend Vitest + tsc + lint
4. ruff check + format-check

`.github/workflows/release-gate.yml`, etiket push'larında çalışır:
sürüm pinlerinin eşitlenmiş olduğunu (12 dosyada sapma yok),
eklenti kilit dosyalarının eşleştiğini, yeniden oluşturulan
artefaktların güncel olduğunu doğrular.
