<!-- Translation: AI-generated, pending native review -->

# Başlangıç: ilk hata düzeltmen

Yeni bir katkıda bulunan için pratik, adım adım bir rehber.
[Mimari](architecture.md) ve [Kurulum](setup.md) sayfalarından farklı
olarak (sistemin *ne* olduğunu açıklarlar), bu sayfa ilk hata
düzeltmeni baştan sona *yapmanda* sana eşlik eder - taze bir klondan
merge edilmiş bir pull request'e kadar.

## 1. Geliştirme ortamını kur

Ön koşullar: **Python 3.12** (arka uç kısıtı `~3.12`),
**Node 24+** (Vite 8 tarafından gerekli), **Poetry**, **Bun**
ve **GNU Make**.

```bash
# Clone
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Install everything: Poetry backend + plugin path-deps + Bun frontend
make install

# Establish a green baseline before you change anything
make test

# Run the app (backend on :18001, frontend on :15174)
make dev
```

Frontend geliştirme sunucusu **http://localhost:15174** adresinde,
arka uç **http://localhost:18001** adresinde çalışır. Her iki port da
`ADAPTIVE_LEARNER_FRONTEND_PORT` / `ADAPTIVE_LEARNER_PORT` ile
değiştirilebilir. İkisini de durdurmak için bir kez Ctrl-C'ye bas.

`make install` başarısız olursa, olağan suçlu Poetry'nin yanlış Python'u
seçmesidir - `backend/` içinde `poetry env use python3.12` çalıştır ve
yeniden kur. Tam yapılandırma zinciri için (secret'lar, yapay zeka
anahtarları, zorunlu `ADAPTIVE_LEARNER_SECRET_KEY`)
[Kurulum](setup.md) sayfasına bak.

## 2. Bir hata bul

Issue'lar iş kuyruğudur. Her düzeltme **önce** bir issue gerektirir
(`GITHUB-ISSUE-PFLICHT`).

```bash
# Open bug issues
gh issue list --label bug --state open
```

Ya da GitHub'da:
<https://github.com/astrapi69/adaptive-learner/issues?q=is%3Aissue+is%3Aopen+label%3Abug>

Başlamak için küçük bir şey seç - `good first issue` ya da az efor
gerektiren bir `bug` ara. Bulduğun hata için bir issue yoksa, **koda
dokunmadan önce bir tane oluştur** - ve yol boyunca keşfettiğin her
yeni hata için *ayrı* bir issue aç.

## 3. Issue'yu anla

- Açıklamayı oku ve hatayı yerelde yeniden üret.
- Hangi depolama modunda ortaya çıktığını not et. Adaptive Learner
  **ikili depolama** ile gelir (API/SQLite *ve* Dexie/IndexedDB); bir
  hata bir modda, diğerinde ya da her ikisinde olabilir.
  [Depolama katmanı](storage-layer.md) sayfasına bak.
- Yeniden üretemiyorsan, tahmin etmek yerine issue'da sor.

## 4. Bir dal oluştur

Adaptive Learner **gitflow** kullanır: `develop` etkin daldır;
`main` yalnızca release'leri tutar. `develop`'*tan* dal aç ve PR'ını
`develop`'*a karşı* aç.

```bash
git checkout develop
git pull origin develop
git checkout -b fix/short-description
```

Dal adlandırma:

| Önek | Ne için |
|---|---|
| `fix/...` | hata düzeltmeleri |
| `feature/...` | yeni özellikler |
| `refactor/...` | refactor'lar |
| `docs/...` | dokümantasyon |
| `chore/...` | araçlar / bakım işleri |

## 5. Hatayı düzelt

Kodu bulmak için ipuçları:

```bash
# Search by an error string / symbol (use ripgrep)
rg "the error message" frontend/src backend/app
```

- Frontend hataları: tarayıcının DevTools konsolunu aç.
- `cd frontend && bunx vitest --watch <file>`, düzenleme yaparken canlı
  test geri bildirimi verir (vitest'i her zaman repo kökünden değil
  `frontend/` içinden çalıştır).
- **Stil: yalnızca Tailwind yardımcı sınıfları**, satır içi renk stili
  yok ve `global.css` içinde yeni kural yok. Renkler tasarım
  token'larından (CSS değişkenleri) geçer - [Tema sistemi](themes.md)
  sayfasına bak.
- **Her iki depolama modu da çalışmaya devam etmelidir.** API modunda
  Dexie yolu olmadan (ya da zarif bir "tarayıcı modunda kullanılamaz"
  mesajı olmadan) gönderilen bir özellik, bir release engelleyicisidir.

## 6. Bir regresyon testi yaz

Her düzeltme, değişiklikten önce başarısız olan ve sonra geçen en az bir
test gerektirir.

```bash
# Frontend (Vitest) - run from frontend/
cd frontend && bunx vitest run src/path/to/file.test.ts

# Backend (pytest)
cd backend && poetry run pytest tests/path/ -v

# A single plugin
make test-plugin-gamification
```

Yedeğe dokunan değişiklikler için ek bir kapı vardır: `make dev` içinde
gerçek verilerle gerçek bir Dışa aktar → İçe aktar gidiş-dönüşü
(`BACKUP-AKZEPTANZTEST`). Birim testleri tek başına bir yedekleme
merge'ünü asla haklı çıkarmaz.

## 7. Tam kapıyı yerelde çalıştır

```bash
make test            # backend + plugins + frontend Vitest
make check-types     # mypy + tsc --noEmit
make test-dexie-smoke  # GH-Pages-shape build, every route, no backend
cd frontend && bun run build
```

PR açmadan önce her şey yeşil olmalıdır.

## 8. Commit et ve push et

[Conventional Commits](https://www.conventionalcommits.org/). Merge'ün
issue'yu otomatik kapatması için ona bir kapatma anahtar sözcüğüyle
atıfta bulun.

```bash
git add -A
git commit -m "fix(area): short description

Longer description of what the problem was and how it was fixed.

Closes #123"

git push -u origin fix/short-description
```

Commit'leri **atomik** tut - her commit ağacı yeşil bırakır
(`make test` geçer). Bunları ayırmak kırmızı bir ara durum yaratacaksa,
bir kaynak değişikliğini test değişikliğiyle aynı commit'te birleştir.

## 9. Bir pull request aç

```bash
gh pr create --base develop \
  --title "fix(area): short description" \
  --body "Closes #123

## What changed
- ...

## Tests
- ..."
```

Her zaman **`develop`**'u hedefle, asla `main`'i değil (`main` release
dalıdır). Bir şemsiye/epic'in alt issue'su için, *alt issue*'ya
`Closes #<sub-issue>` ile, izlenebilirlik için ayrıca
`Refs #<umbrella>` ile atıfta bulun.

## 10. CI'ı bekle

CI, her PR'da doğruluk kapılarını çalıştırır:

- Frontend testleri (Vitest) + Arka uç / eklenti testleri (pytest)
- TypeScript (`tsc --noEmit`) + mypy + ruff + ESLint
- Pre-commit kancaları
- Karmaşıklık kapısı (baseline ratchet'i - yeni fonksiyonlar döngüsel
  karmaşıklık eşiğinin altında kalmalıdır)
- Klasör boyutu + dosya boyutu korumaları (god-file / god-folder önleme)
- i18n paritesi (`backend/config/i18n/` altındaki her katalog her
  anahtarı tanımlamalıdır)
- Tasarım token'ı koruması (sabit kodlanmış renk / sabit palet yardımcısı yok)
- Docs-drift doğrulayıcısı

Daha ağır denetimler (Dexie modu E2E, kapsam, mutasyon testleri,
güvenlik taraması, content-stats sapması) her PR'da değil, gece + release
zamanında çalışır. Bu yüzden yeşil bir PR, `develop`'un yeşil olduğunun
kanıtı değildir.

Bir kapı seni engellediğinde - özellikle bir **ratchet** (karmaşıklık,
dosya boyutu, klasör boyutu, ...) - yanlış olduğunu varsaymadan önce
[Kapılar, ratchet'ler ve dal koruması](gates-and-ratchets.md) sayfasını
oku. Her kapının ne olduğunu, bir ratchet seni engellediğinde ne
yapacağını ve push etmeden önce kapıları `make ci` ile yerelde nasıl
çalıştıracağını açıklar.

## 11. İnceleme ve merge

İncelemeyi bekle (ya da maintainer haklarına sahipsen kendin merge et).
PR'lar `develop`'a **squash-merge** edilir, böylece dalının commit'leri
ana hatta tek bir temiz commit'e çöker.

---

## Proje kuralları (kısa sürüm)

| Kural | Anlamı |
|---|---|
| `GITHUB-ISSUE-PFLICHT` | her düzeltme/özellik önce bir issue gerektirir |
| Yalnızca Tailwind | `global.css` eklemesi yok, satır içi renk stili yok |
| Tasarım token'ları | renkler CSS değişkenleri üzerinden, asla hex sabitleri değil |
| Dexie modu paritesi | her şey Dexie *ve* API modunda çalışır |
| Önce kütüphane | yerel API > framework > kütüphane > özel kod |
| Conventional Commits | `fix()`, `feat()`, `refactor()`, `docs()`, ... |
| i18n | tüm UI metinleri her `backend/config/i18n/` kataloğunda |
| 44px dokunma hedefleri | mobil dostu etkileşimli öğeler |
| PR başına tek konu | her PR tek, tutarlı bir değişiklik taşır |
| Dal koruması | `develop` güncel bir dal + yeşil denetimler gerektirir (yöneticileri de bağlar) |

Tam kural seti: [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).

## Sık kullanılan komutlar

```bash
make dev               # start backend + frontend
make test              # all tests (backend + plugins + Vitest)
make test-dexie-smoke  # Dexie-mode release gate (no backend)
make check-types       # mypy + tsc --noEmit
make check-complexity-gate   # complexity ratchet
make check-folder-size       # god-folder guard
make sync-i18n         # regenerate frontend i18n from backend YAML
make sync-versions     # propagate the canonical version
cd frontend && bun run build   # build the frontend
```

`make help` her hedefi listeler; build komutları için tek doğruluk
kaynağı
[Makefile](https://github.com/astrapi69/adaptive-learner/blob/develop/Makefile)'dır.

## Tek ekranda mimari

```
frontend/src/
  api/          FastAPI client (the only place fetch() lives)
  components/   UI components, grouped by concern (dashboard/, lesson/, ...)
  features/     feature-strategy gating (useFeatureAvailable)
  hooks/        React hooks
  lib/          business logic, grouped by domain (lesson/, srs/, ai/, ...)
  pages/        route components (+ content/, dashboard/, lesson/ subdirs)
  shared/       app-independent reusable components
  storage/      dual storage: getStorage() -> IStorageService
  styles/       design tokens + per-theme CSS

backend/app/
  routers/      thin FastAPI endpoints (delegate to services)
  services/     business logic (no FastAPI imports)
  repositories/ data layer (Session-free contracts)
  models/       SQLAlchemy models (single-file domain model)
  hookspecs.py  the 10 plugin hooks

plugins/        PluginForge plugins (one package each; the
                catalogue lives in CLAUDE.md)
```

Ayrıntılar: [Mimari](architecture.md).

## Nerede bulurum...?

| Ne | Nerede |
|---|---|
| Proje kuralları | [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules) |
| Mimari | [Mimari](architecture.md) |
| Kapılar, ratchet'ler, dal koruması | [Kapılar, ratchet'ler ve dal koruması](gates-and-ratchets.md) |
| Depolama katmanı | [Depolama katmanı](storage-layer.md) |
| Eklenti sistemi | [Eklenti yazma](plugin-guide.md) |
| Yapay zeka entegrasyonu | [Yapay zeka entegrasyonu](ai-integration.md) |
| Test | [Test](testing.md) |
| Release iş akışı | [Sürüm yayınlama iş akışı](release.md) |
| Ders içeriği formatı | [Ders içeriği oluşturma](authoring-content.md) |
| i18n | [Uluslararasılaştırma](i18n.md) |
| Dağıtım | [Dağıtım](deployment.md) |
| Yol haritası | [`docs/ROADMAP.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/ROADMAP.md) |
