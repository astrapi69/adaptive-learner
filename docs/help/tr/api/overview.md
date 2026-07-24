<!-- Translation: AI-generated, pending native review -->

# API genel bakış

AdaptiveLearner'ın arka ucu bir FastAPI REST API'si sunar.
Sunucu modunda frontend buna konuşur; Yerel (Dexie) modda
API'ye ulaşılamaz - aynı işlemler tarayıcıda çalışır.

## Temel URL

- **Yerel geliştirme**: `http://localhost:18001/api`
- **Docker prod**: dağıtım başına yapılandırılır (örn.
  `https://yourdomain.com/api`)
- **GH Pages**: geçerli değil (Dexie modu)

Frontend, temel URL'yi derleme zamanında `VITE_API_BASE`'den
çözümler; varsayılan `/api`'dir, bu nedenle Vite geliştirme
sunucusu proxy şeffaf biçimde iletir.

## Kimlik doğrulama

v1.20.0'da istek başına kimlik doğrulama yoktur. Sistem
tarayıcı başına tek kullanıcıdır: `user_id`,
`localStorage`'da saklanır ve URL yollarında geçirilir
(`/users/{user_id}/...`).

AI sağlayıcı anahtarları üç katmanlı bir zincir aracılığıyla
çözümlenir (`services.settings.resolve_api_key`):

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` ortam değişkeni.
2. `~/.config/adaptive_learner/secrets.yaml` içinde
   `ai.<provider>.api_key`.
3. Fernet şifreli `UserSettings.api_key_<provider>` sütunu
   (Ayarlar arayüzü aracılığıyla ayarlanır; frontend'e hiçbir
   zaman düz metin olarak döndürülmez).
4. `None` - AI çağrısı arayüze bir hata gösterir.

`UserSettingsOut.key_source_*` (enum
`env | secrets_yaml | settings | none`), Ayarlar arayüzünün
kaynak rozeti için sağlayıcı başına hangi katmanın etkin anahtarı
çözdüğünü bildirir.

Gelecekteki çok kullanıcılı / çok kiracılı bir aşama kimlik
doğrulama ekleyecektir. Şimdilik, bir ağa maruz kalan dağıtımlar
kendi kimlik doğrulama katmanlarının arkasında bulunmalıdır (HTTP
temel kimlik doğrulamalı ters proxy, Tailscale, VPN vb.).

## Yanıt biçimi

Başarılı yanıtlar, veri nesnesini doğrudan döndürür, zarf yok:

```json
{
  "id": "abc-123",
  "topic": "Spanish grammar",
  "active": true
}
```

Listeler JSON dizileri döndürür:

```json
[
  {"id": "p1", "topic": "Spanish"},
  {"id": "p2", "topic": "Calculus"}
]
```

HTTP durum kodları:

| Kod | Anlam |
|---|---|
| 200 | OK (okuma) |
| 201 | Oluşturuldu (POST) |
| 204 | İçerik Yok (DELETE) |
| 400 | Doğrulama hatası (Pydantic) |
| 404 | Bulunamadı |
| 409 | Çakışma (nadir) |
| 422 | Pydantic doğrulama hatası (FastAPI varsayılanı) |
| 500 | Sunucu hatası |
| 502 | Dış servis ulaşılamaz (AI sağlayıcı) |

## Hata biçimi

Hatalar tek bir `detail` alanı döndürür:

```json
{"detail": "Project abc-123 not found"}
```

Pydantic doğrulama hataları yapılandırılmış bir liste döndürür:

```json
{
  "detail": [
    {"loc": ["body", "daily_minutes"], "msg": "value is not a valid integer", "type": "type_error.integer"}
  ]
}
```

Hata ayıklama modunda (`ADAPTIVE_LEARNER_DEBUG=true`) yanıt
ayrıca bir `traceback` alanı içerir. Üretim dağıtımları
hata ayıklamayı kapalı bırakmalıdır.

Frontend'in `ApiError` sınıfı her iki şekli de kullanır -
tam ayrıştırıcı için `frontend/src/api/client.ts`'e bakın.

## Uç nokta grupları

| Grup | Önek | Ne yapar |
|---|---|---|
| Sağlık + i18n | `/health`, `/i18n/{lang}` | Uygulama sağlığı + arayüz dizeleri |
| Kullanıcılar | `/users` | Kullanıcı CRUD + iç içe projeler |
| Projeler | `/projects` | Proje kapsamlı okumalar / güncellemeler |
| Ayarlar | `/settings/{user_id}` | UserSettings + API anahtarları + key_source + mevcut modeller |
| Sistem | `/system/info` | Sürüm, yollar, bağımlılık sürümleri |
| Yedekleme | `/backup/export`, `/backup/import`, `/backup/stats` | JSON anlık görüntüsü + geri yükleme |
| Dışa aktarma | `/export/{progress,session,curriculum}` | MD + PDF raporları |
| Eşitleme | `/sync/...` | İtme, çekme, çözümleme, eşleştirme |
| İçe aktarmalar | `/users/{user_id}/imports` | Sohbet geçmişi içe aktarma + çözümleyici |
| Konular + etiketler | `/subjects`, `/users/{id}/tags`, `/projects/{id}/{subjects,tags}` | Global taksonomi + kullanıcı başına etiketler |
| Değerlendirme eklentisi | `/plugins/assessment/...` | Sorular, değerlendirme, profil |
| Oturum eklentisi | `/plugins/session/...` | Başlatma, mesaj + akış, puanlama, bitirme, geçiş, telaffuz |
| Takip eklentisi | `/plugins/tracking/...` | İlerleme + teslimler |
| Araçlar eklentisi | `/plugins/tools/...` | Öneriler + aralıklı |
| Oyunlaştırma eklentisi | `/plugins/gamification/...` | XP, rozetler, seriler, sıfırlama |
| Anki eklentisi | `/plugins/anki/...` | Kart CRUD + AI çıkarımı + dışa aktarıldı işaretle |
| NotebookLM eklentisi | `/plugins/notebooklm/...` | Çalışma soruları + çalışma kılavuzu |
| Müfredat | `/users/{user_id}/curricula`, `/curricula/{id}` | Müfredat + konular + dersler CRUD |
| Eklenti keşfi | `/plugins/manifests`, `/plugins/health`, `/plugins/errors` | Kayıtlı olanlar |

Tam yöntem listesi için istek / yanıt örnekleriyle birlikte
[Çekirdek uç noktalar](core-endpoints.md) ve
[Eklenti uç noktaları](plugin-endpoints.md) bölümlerine bakın.

## OpenAPI / Swagger

FastAPI, Pydantic şemalarından otomatik olarak bir OpenAPI 3.1
spesifikasyonu oluşturur. Geliştirme modunda:

- **Swagger UI**: `http://localhost:18001/api/docs`
- **Redoc**: `http://localhost:18001/api/redoc`
- **Ham OpenAPI JSON**: `http://localhost:18001/api/openapi.json`

Bunlar, her uç noktanın tam şekli için yetkili referanstır.
Buradaki Markdown sayfaları okunabilirlik için seçilmiş bir
alt kümedir.

## Sayfalandırma

v1.20.0'da uç noktalar sayfalandırmaz. Veri kümesi tek
kullanıcılıdır ve küçüktür; en büyük liste (proje başına
oturumlar) yüzlere ulaşır, binlere değil. Gelecekteki bir
aşama, veri şekli büyürse imleç tabanlı sayfalandırma ekleyecektir.

## Sürüm oluşturma

API'nin URL'de sürüm öneki yoktur. Son değişiklikler semver-major
sınırlarında yapılır; CHANGELOG neyin taşındığını belgeler.
