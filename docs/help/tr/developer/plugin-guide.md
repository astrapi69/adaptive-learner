<!-- Translation: AI-generated, pending native review -->

# Eklenti yazma

Eklentiler, çekirdeğe dokunmadan AdaptiveLearner'ı genişletir.
Eklenti sistemi [PluginForge](https://github.com/astrapi69/pluginforge)
([pluggy](https://pluggy.readthedocs.io/) etrafında bir sarmalayıcı)
kullanır. Her eklenti, bir giriş noktası aracılığıyla kayıtlı
bağımsız bir Poetry paketidir.

Bu öğretici, bir rota ekleyen ve bir hook'u dinleyen bir
"hello-world" eklentisi oluşturmayı anlatır.

## 1. Dizini iskelete dönüştür

```bash
mkdir -p plugins/adaptive-learner-plugin-hello/adaptive_learner_hello
mkdir -p plugins/adaptive-learner-plugin-hello/tests
cd plugins/adaptive-learner-plugin-hello
```

## 2. pyproject.toml

```toml
[tool.poetry]
name = "adaptive-learner-plugin-hello"
version = "1.0.0"
description = "Adaptive Learner: hello-world plugin"
authors = ["Your Name"]
license = "MIT"

[tool.poetry.dependencies]
python = "^3.11"
pluginforge = "^0.10.0"
fastapi = "^0.136.0"

[project.entry-points."adaptive_learner.plugins"]
hello = "adaptive_learner_hello.plugin:HelloPlugin"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

Giriş noktası adı (burada `hello`), eklenti kayıt defterinin
eklentiyi takip etmek için kullandığı şeydir. Sınıf yolu
(`adaptive_learner_hello.plugin:HelloPlugin`), eklenti sınıfına
Python içe aktarma yoludur.

## 3. plugin.py

```python
from pluginforge import BasePlugin, hookimpl
from typing import Any

class HelloPlugin(BasePlugin):
    name = "hello"
    version = "1.0.0"
    # pluginforge ^0.10.0 kimlik geçidiz. Bunu
    # "adaptive_learner" olarak ayarlayın; böylece host'un
    # PluginManager'ı (``app_id="adaptive_learner"``'ı geçen)
    # eklentiyi bu uygulamayı hedeflediği olarak tanır.
    target_application = "adaptive_learner"
    depends_on: list[str] = []

    @hookimpl
    def on_session_complete(
        self, session: dict[str, Any], rating: dict[str, Any]
    ) -> None:
        print(f"Hello! Session {session['id']} ended.")
```

`BasePlugin`, PluginForge'dan temel sınıftır. `@hookimpl`
dekoratörü, bir yöntemi `backend/app/hookspecs.py`'de belirtilen
bir hook'u uyguladığı olarak işaretler.

## 4. routes.py

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/plugins/hello", tags=["hello"])

@router.get("/greet")
def greet() -> dict:
    return {"message": "Hello from the hello plugin!"}
```

## 5. plugin.py'de rotaları kaydet

```python
from fastapi import FastAPI
from .routes import router

class HelloPlugin(BasePlugin):
    ...

    def mount_routes(self, app: FastAPI) -> None:
        app.include_router(router)
```

Eklenti yöneticisi, çekirdek uygulama başlatıldıktan sonra
bunu tanımlayan her eklenti için `mount_routes()` çağırır.

## 6. Testler

```python
# tests/test_plugin.py
from adaptive_learner_hello.plugin import HelloPlugin

def test_hello_plugin_has_name():
    plugin = HelloPlugin()
    assert plugin.name == "hello"
```

## 7. Yükle + etkinleştir

Eklentiyi `backend/pyproject.toml`'a path-dep olarak ekleyin:

```toml
[tool.poetry.dependencies]
...
adaptive-learner-plugin-hello = {path = "../plugins/adaptive-learner-plugin-hello", develop = true}
```

Ardından:

```bash
cd backend && poetry lock && poetry install
make dev
curl http://localhost:18001/api/plugins/hello/greet
```

## 10 hookspec

Tüm hook spesifikasyonları `backend/app/hookspecs.py`'de yaşar:

1. `get_assessment_questions(lang: str)` - soru paketi döndür.
2. `calculate_profile(answers: list)` - yöntem ağırlıklarını
   hesapla (firstresult).
3. `create_session_prompt(...)` - sistem istemini oluştur
   (firstresult).
4. `ai_complete(messages, model, api_key, max_tokens)` - AI'yi
   eş zamanlı olarak çağır (firstresult, sağlayıcı model
   önekine göre yönlendirir).
5. `ai_complete_async(...)` - paralel döngü sınırı değerlendirmesi
   için async varyant (v1.5.0+, firstresult).
6. `ai_complete_stream(...)` - SSE aracılığıyla metin deltalarını
   verimleyen akış varyantı (v1.6.0+, firstresult).
7. `recommend_method_switch(history, profile)` - bir geçiş
   önerisi veya None döndür.
8. `on_session_complete(session, rating)` - yayın yan etkisi;
   oyunlaştırma + takip dinler.
9. `get_progress_summary(project_id, db)` - gösterge tablosu
   özetinin bir ad alanı dilimini döndür.
10. `get_tool_recommendations(profile, lang)` - sıralı araçları
    döndür.

[Tam hookspec referansı](../api/hooks.md)

## firstresult semantiği

`firstresult=True` ile işaretlenen hook'lar, None olmayan bir
değer döndüren ilk eklentide durur. "Tam olarak bir eklenti bunu
yönetmeli" durumları için yararlıdır - `ai_complete` gibi, eşleşen
sağlayıcının eklentisi metni döndürür ve diğerleri None döndürür.

`firstresult=True` olmayan hook'lar her eklentide çalışır (liste
modu). Arayan, bir sonuç listesi alır ve ne yapacağına karar verir
(birleştir, tercih et, vb.).
