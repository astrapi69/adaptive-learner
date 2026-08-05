<!-- Translation: AI-generated, pending native review -->

# Dağıtım

v1.20.0'da dört dağıtım modu gönderilir:

| Mod | Nerede | Arka uç | AI çağrıları | Anahtar kaynağı |
|---|---|---|---|---|
| Yerel geliştirme | `make dev` | :18001'de FastAPI | Sunucu tarafı | env / secrets.yaml / DB |
| GitHub Pages | `astrapi69.github.io/adaptive-learner/` | Hiçbiri (Dexie) | Tarayıcı doğrudan | DB (IndexedDB) |
| Masaüstü başlatıcısı | PyInstaller ikili | FastAPI yerel olarak önyüklenmiş | Sunucu tarafı | secrets.yaml (otomatik oluşturulur) / Ayarlar UI |
| Docker | Docker Compose kendi kendine barındırma | Konteynerdeki FastAPI | Sunucu tarafı | env / Ayarlar UI |

## Yerel geliştirme

```bash
make dev
```

18001 portunda arka ucu (FastAPI + uvicorn `--reload`) ve 15174
portunda frontend'i (Vite dev sunucusu) paralel olarak başlatır.
Her ikisini de durdurmak için bir kez Ctrl-C basın.

Frontend'in Vite proxy'si `/api/*`'yi arka uca yönlendirir,
bu nedenle frontend her zaman `/api`'yi temel URL olarak kullanır -
yerel geliştirme için CORS yapılandırması gerekmez.

Arka plan modu için:

```bash
make dev-bg     # detached
make dev-down   # stop
```

## GitHub Pages (yalnızca Dexie)

`.github/workflows/deploy-gh-pages.yml`, frontend'i şunlarla derler:

- `VITE_BASE="/adaptive-learner/"` - her varlık URL'sine sayfa başına
  Pages yolunu önek olarak ekler.
- `VITE_STORAGE_MODE="dexie"` - DexieStorage'ı varsayılan mod olarak
  sabitler.
- `VITE_API_BASE=""` - işaret edilecek arka uç yok.

İş akışı, `main`'e her push'ta ve manuel dağıtımda çalışır. Derleme
sonrası, SPA-yönlendirici geri dönüşü için `dist/index.html`'yi
`dist/404.html`'ye kopyalar, ardından yayınlamak için
`actions/upload-pages-artifact@v5` + `actions/deploy-pages@v5`
kullanır.

Site URL'si `https://astrapi69.github.io/adaptive-learner/`'dır.
Özel alan adı kullananlar, `frontend/public/`'a alan adıyla bir
`CNAME` dosyası ekler; GitHub'ın alana duyarlı Pages yönlendirmesi
geri kalanını halleder.

## Docker Compose (tam yığın)

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

`docker-compose.prod.yml` **tek bir servis, `app`** içerir (#2058
sonrası tek konteyner - nginx yok, ayrı bir frontend konteyneri
yok):

- **FastAPI (Python 3.12 görüntüsü)**, derlenmiş frontend
  statics'lerini VE `/api/*`'yi birlikte, iç port
  `${ADAPTIVE_LEARNER_BACKEND_PORT:-8000}` üzerinde sunar.
- Host'ta yayımlanan port:
  `${ADAPTIVE_LEARNER_BIND_ADDRESS:-127.0.0.1}:${ADAPTIVE_LEARNER_PUBLIC_PORT:-8501}` -
  varsayılan loopback.
- **Konteyner yeniden kurulumlarında hayatta kalan adlandırılmış
  `adaptive-learner-data` birimi** (`/app/data`).

`install.sh` ve `install.ps1`, son kullanıcılar için curl-pipe
yükleyicileridir - etiketli bir sürüm tarbalını çeker, ayarlar
yapar ve `docker compose up` çalıştırır.

Yükleyiciler, sürüm zamanında `install.sh.template` /
`install.ps1.template` artı `backend/pyproject.toml`'ın sürümünden
yeniden oluşturulur. Oluşturulan dosyaları doğrudan düzenlemeyin.

## Üretim için yapılandırma

Üretim için dört şey önemlidir:

1. **`ADAPTIVE_LEARNER_SECRET_KEY`**: sabit bir Fernet anahtarı
   olmalıdır. Bir kez oluşturun, güvenli bir yerde saklayın
   (HashiCorp Vault, AWS Secrets Manager, mühürlü bir `.env`).
   Onu kaybetmek, tüm şifreli API anahtarlarını okunamaz hale
   getirir. Uygulama, ayarlanmamışsa başlatmada sert biçimde
   başarısız olur (sessiz varsayılan yok).
2. **`ADAPTIVE_LEARNER_CORS_ORIGINS`**: virgülle ayrılmış izin
   verilen kaynak listesi. Varsayılan izin vericidir; üretim için
   sıkılaştırın.
3. **`ADAPTIVE_LEARNER_DEBUG`**: üretimde ayarlanmamış / false
   bırakın. Debug modu, hata yanıtlarında yığın izlerini açığa
   çıkarır.
4. **`ADAPTIVE_LEARNER_BIND_ADDRESS`**: varsayılan `127.0.0.1`,
   yani yayımlanan porta yalnızca host'un kendisinden erişilebilir.
   Uygulamada kimlik doğrulaması yoktur - `0.0.0.0` bağlamayı
   yalnızca bilinçli olarak, güvenilir bir ağda ya da kendi kimlik
   doğrulama katmanının (basic auth'lu reverse proxy, VPN) arkasında
   yapın.

Konteynerler için env değişkenleri deyimsel enjeksiyon kanalıdır.
`~/.config/adaptive_learner/secrets.yaml` katmanı, masaüstü /
başlatıcı kullanımı için tasarlanmıştır; birkaç env değişkeni
yerine tek bir yapılandırma dosyasını tercih ediyorsanız onu
bir konteynere bağlayabilirsiniz.

## Masaüstü başlatıcısı

`launcher/` altındaki PyInstaller ikilileri, uygulamayı Docker
konteyneri olarak çalıştırır (varsayılan `http://localhost:8501`),
ardından kullanıcının varsayılan tarayıcısını açar. İlk başlatmada başlatıcı ayrıca POSIX'te
`~/.config/adaptive-learner/secrets.yaml`'ı yorumlanmış şablon
olarak + `chmod 0600` olarak oluşturur, böylece kullanıcı API
anahtarlarını Ayarlar UI'ına dokunmadan oraya ekleyebilir.

Tam üç katmanlı yapılandırma zinciri (proje YAML < kullanıcı
katmanı < env değişkenleri) `docs/configuration.md`'de
belgelenmiştir.

## Başlatıcı (platformlar arası masaüstü)

`launcher/` PyInstaller tabanlı tek ikili bir yükleyicidir.
GitHub Actions, sürüm başına üç ikili derler:

- `launcher-linux.yml` → `adaptive-learner-launcher-linux`
- `launcher-macos.yml` → `adaptive-learner-launcher-macos`
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

Her başlatıcı, sürümü gömer (`__version__` değişmezi + spec
dosyası tarafından derleme zamanında yazılan `_build_info.py`)
ve eşleşen etiketli sürüm tarbalını getirir + çıkarır + arka
ucu önyükler + kullanıcının tarayıcısında frontend'i açar.

## CI/CD mimarisi

Her iş akışı yalıtılmış olarak çalışır; aralarında paylaşılan
durum yoktur:

| İş Akışı | Tetikleyici | Ne Yapar |
|---|---|---|
| `ci.yml` | push, pull_request | Testler + lint + tsc |
| `coverage.yml` | main'e push | Kapsam HTML + xml |
| `release-gate.yml` | etiket push | Sürüm pin sapma denetimi |
| `deploy-gh-pages.yml` | main'e push, dispatch | GH Pages derleme + dağıtım |
| `launcher-{linux,macos,windows}.yml` | release: created | Derleme + başlatıcı ikilisini ekle |
| `docs.yml` | main'e push | MkDocs derleme (şu anda etkin değil - site GH Pages iş akışından geliyor) |
