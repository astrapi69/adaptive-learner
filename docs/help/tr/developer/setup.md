<!-- Translation: AI-generated, pending native review -->

# Geliştirici kurulumu

## Ön gereksinimler

- **Python 3.12+** (eklentiler 3.12 ile test edilir, ancak
  arka uç için 3.11 de çalışır).
- **Node 24+** (Vite 8 için gereklidir). Daha eski Node sürümleri
  `crypto.hash is not a function` hatasıyla derleme adımında başarısız olur.
- **Poetry** Python bağımlılık yönetimi için. Kurulum:
  `curl -sSL https://install.python-poetry.org | python3 -`.
- **Bun** 1.3+ (frontend paket yöneticisi, #1492).
- **GNU Make** düzenleme hedefleri için. Makefile tek yetkili
  kaynak — her CI komutu orada bulunur.

## Klon + kurulum

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install
```

`make install` şunları çalıştırır:

1. `cd backend && poetry install` — arka uç + eklenti path-dep'leri.
2. `cd frontend && bun install` — frontend bağımlılıkları (Node 24).
3. `plugins/` altındaki her eklentiyi arka ucun venv'ine path-dep
   olarak kurar (`develop = true` — düzenlemeler canlı olarak yansır).

`make install` başarısız olursa en yaygın neden Poetry'nin yanlış
Python'u seçmesidir. `backend/` dizininde (ve derine girdiyseniz her
eklentide) `poetry env use python3.12` çalıştırın ve yeniden kurun.

## Yapılandırma

Arka uç yapılandırmasını üç katmanlı bir zincirden okur
(en yüksek öncelik kazanır):

1. **Ortam değişkenleri** `ADAPTIVE_LEARNER_*` önekiyle.
2. **Kullanıcı sırları** `~/.config/adaptive_learner/secrets.yaml`
   konumunda — ilk başlatmada yorumlu bir şablon olarak otomatik
   oluşturulur (POSIX'te `chmod 0600`); git'e hiçbir zaman teslim edilmez.
3. **Varsayılanlar** `backend/config/app.yaml` içinde.

Bunların üzerine katmanlanan AI anahtar çözümleme:
**env > secrets.yaml > Fernet şifreli veritabanı sütunu** (Ayarlar
arayüzü aracılığıyla ayarlanır), `UserSettingsOut` üzerindeki
`key_source_*` alanı olarak arayüze sunulur.

Tek zorunlu sır `ADAPTIVE_LEARNER_SECRET_KEY` — kullanıcı API
anahtarlarını Fernet ile beklemede şifrelemek için kullanılır.
Şu komutla oluşturun:
`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
Üç yerleştirme seçeneği (en yüksek öncelik kazanır):
`ADAPTIVE_LEARNER_SECRET_KEY` ortam değişkeni, `secrets.yaml`
içinde `secret_key:`, veya tek seferlik geliştirme anahtarı için
`make dev-secret`. Anahtar ayarlanmamışsa uygulama başlangıçta
sert biçimde başarısız olur (sessiz oluşturulan varsayılan yok —
bkz.
[docs/configuration.md](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)).

## Çalıştırma

```bash
make dev
```

Arka ucu 18001 numaralı bağlantı noktasında ve frontend'i 15174
numaralı bağlantı noktasında paralel olarak başlatır. Arka uç,
uvicorn'un `--reload` seçeneğiyle sıcak yeniden yükleme yapar;
frontend Vite'nin geliştirme sunucusudur. Her ikisini durdurmak için
Ctrl-C'ye bir kez basın.

Arka plan modu:

```bash
make dev-bg   # arka uç + frontend'i arka planda başlat
make dev-down # bunları durdur
```

## Testler

```bash
make test                 # arka uç + eklentiler + frontend Vitest
make test-backend         # yalnızca arka uç pytest
make test-frontend        # yalnızca frontend Vitest
make test-coverage        # isteğe bağlı kapsam çalıştırması (yavaş)
```

E2E testleri:

```bash
cd e2e && npx playwright test
```

v1.20.0'da 16 duman testi dosyası: açılış, başlangıç +
değerlendirme, oturum (3 parçalı SSE), müfredat, ayarlar,
mobil görünüm alanları, eşitleme eşleştirme, yedekleme gidiş-dönüş,
çok döngülü otomatik döngü, içe aktarma + analiz, MD dışa aktarma,
konu/etiket filtresi, zengin metin notları, model seçici.

## Linting + biçimlendirme

```bash
cd backend && poetry run ruff check .       # Python lint
cd backend && poetry run ruff format .      # Python biçimlendirmesi
cd frontend && bunx tsc --noEmit             # TypeScript kontrolü
cd frontend && bun run lint                 # ESLint
cd frontend && bun run format               # Prettier
```

Ön teslim kancaları her teslimde ruff + biçimlendirici
kontrollerini uygular:

```bash
cd backend && poetry run pre-commit install
```

## Dokümanlar

```bash
make docs-install   # tek seferlik, MkDocs venv'ini docs/ dizinine kurar
make docs-serve     # dokümanları sıcak yeniden yüklemeyle localhost:8000'de sunar
make docs-build     # statik siteyi site/ dizinine derler
```

Dokümanlar venv'i arka ucunkinden ayrıdır — MkDocs,
mkdocs-material + mkdocs-static-i18n ile kendi `docs/pyproject.toml`
dosyasına sahiptir.

## Yaygın hatalar

- **`make dev` "port already in use" hatasıyla çöküyor**: başka
  bir AdaptiveLearner örneği hâlâ çalışıyor. `make dev-down`
  veya `pkill -f uvicorn` çalıştırın.
- **Testler "duplicate column name" hatasıyla başarısız**: bir
  Alembic geçişi şemayı değiştirdi. `backend/adaptive_learner.db`
  dosyasını silin ve yeniden çalıştırın.
- **`bun run build` Node 18'de başarısız**: Node 24'e yükseltin.
  Vite 8 bunu gerektiriyor.
