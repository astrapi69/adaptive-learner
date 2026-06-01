<!-- Translation: AI-generated, pending native review -->

# Çekirdek uç noktalar

Bir eklenti tarafından kaydedilmeyen uç noktalar: kullanıcılar,
projeler, ayarlar, i18n, sağlık.

## Sağlık

```
GET /api/health
```

```json
{
  "status": "ok",
  "version": "1.20.0",
  "debug": false
}
```

## i18n kataloğu

```
GET /api/i18n/{lang}
```

İstenen dil için tam iç içe kataloğu döndürür. `{lang}`
kayıtlı değilse EN'e geri döner.

```json
{
  "common": {"save": "Save", "cancel": "Cancel"},
  "settings": {"title": "Settings", "section_language": "Language", ...},
  ...
}
```

## Kullanıcılar

```
POST /api/users
```

Gövde:

```json
{"name": "Asterios", "email": "ar@example.com", "language": "de"}
```

Yanıt (201):

```json
{
  "id": "abc-123",
  "name": "Asterios",
  "email": "ar@example.com",
  "language": "de",
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

```
GET /api/users/{user_id}
```

Kullanıcıyı döndürür. Bulunamazsa 404.

```
PATCH /api/users/{user_id}
```

Gövde: `{name, email, language}` içinden herhangi bir alt küme.
Güncellenen satırı döndürür.

## Projeler (kullanıcı kapsamlı)

```
GET /api/users/{user_id}/projects
POST /api/users/{user_id}/projects
```

POST gövdesi:

```json
{
  "topic": "Spanish grammar",
  "goal": "Pass B2 exam",
  "timeframe": "6 weeks",
  "daily_minutes": 30,
  "current_problem": "Tenses",
  "active": true
}
```

Yanıt (201):

```json
{
  "id": "p1",
  "user_id": "abc-123",
  "topic": "Spanish grammar",
  "goal": "Pass B2 exam",
  "timeframe": "6 weeks",
  "daily_minutes": 30,
  "current_problem": "Tenses",
  "active": true,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

## Projeler (doğrudan)

```
GET /api/projects/{project_id}
PATCH /api/projects/{project_id}
```

PATCH gövdesi: `{topic, goal, timeframe, daily_minutes,
current_problem, active}` içinden herhangi bir alt küme.
Güncellenen satırı döndürür.

## Ayarlar

```
GET /api/settings/{user_id}
```

API anahtar alanları **boolean'lar + kaynak enum'ları olarak**
UserSettings'i döndürür (arka uç, düz metin anahtarları asla
geri göndermez):

```json
{
  "id": "s1",
  "user_id": "abc-123",
  "language": "de",
  "active_provider": "anthropic",
  "has_anthropic_key": true,
  "has_openai_key": false,
  "has_gemini_key": false,
  "key_source_anthropic": "secrets_yaml",
  "key_source_openai": "none",
  "key_source_gemini": "none",
  "model_override_anthropic": "claude-sonnet-4-20250514",
  "model_override_openai": null,
  "model_override_gemini": null,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

`key_source_*` değerleri: `env` (ortam değişkeni ayarlanmış +
değer yaml'dan farklı), `secrets_yaml` (değer yaml ile eşleşiyor
VEYA env-yaml'dan hidrate edilmiş), `settings` (Fernet veritabanı
sütunu), `none`.

```
PATCH /api/settings/{user_id}
```

Gövde: `{active_provider, language, model_override_anthropic,
model_override_openai, model_override_gemini}` içinden herhangi
bir alt küme. Boş dize bir geçersiz kılmayı temizler; bir alanı
atlamak onu olduğu gibi bırakır.

## API anahtarları

```
POST /api/settings/{user_id}/api-key
```

Gövde:

```json
{"provider": "anthropic", "key": "sk-ant-..."}
```

Fernet ile şifreler ve saklar. `has_<provider>_key: true`
ile güncellenmiş UserSettings'i döndürür.

```
DELETE /api/settings/{user_id}/api-key/{provider}
```

Anahtarı temizler. `has_<provider>_key: false` ile güncellenmiş
UserSettings'i döndürür.

## Müfredat

```
GET /api/users/{user_id}/curricula
POST /api/users/{user_id}/curricula
GET /api/curricula/{curriculum_id}
PATCH /api/curricula/{curriculum_id}
DELETE /api/curricula/{curriculum_id}
```

Müfredat POST gövdesi:

```json
{"title": "Spanish", "description": "Grammar + vocab", "language": "de"}
```

```
GET /api/curricula/{curriculum_id}/topics
POST /api/curricula/{curriculum_id}/topics
GET /api/topics/{topic_id}
PATCH /api/topics/{topic_id}
DELETE /api/topics/{topic_id}
```

Konu POST gövdesi:

```json
{"title": "Subjunctive", "description": null, "parent_id": null, "order_index": 0}
```

```
GET /api/curricula/{curriculum_id}/lessons
POST /api/curricula/{curriculum_id}/lessons
GET /api/lessons/{lesson_id}
PATCH /api/lessons/{lesson_id}
DELETE /api/lessons/{lesson_id}
```

Ders POST gövdesi:

```json
{"title": "Past subjunctive", "content": "# Past subjunctive...", "order_index": 0}
```
