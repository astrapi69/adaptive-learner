# Design-Token mimarisi

Uygulamanın tüm görsel özellikleri **Design-Token'lar** (CSS
değişkenleri) üzerinden yönetilir. Uygulamayı yeniden renklendirmek
ya da yeni bir tema oluşturmak isteyen tek bir `theme-*.css`
dosyasını düzenler ve hiçbir bileşene dokunmaz. Bu kural sadece bir
konvansiyon değil, testlerle zorunlu kılınmıştır. Eksiksiz Token
referansı
[`docs/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/DESIGN-TOKENS.md)
içinde bulunur.

---

## Token katmanları

1. **Tema başına Token'lar** — `frontend/src/styles/themes/theme-<id>.css`
   içinde tema başına bir kez tanımlanan 44 Token'lık kanonik küme
   (arka planlar, metin, kenarlıklar, etkileşim, vurgu, durum,
   alıştırma geri bildirimi, yıldız, grafikler, gölgeler).
   `[data-theme]` değiştiğinde hepsi değişir. **Her tema tam olarak
   aynı kümeyi tanımlamalıdır** (`themes.test.ts` ile sabitlenmiştir).
2. **Temadan bağımsız Token'lar** — yapısı gereği her temada aynı
   olan değerler (örn. marka paleti, sözdizimi renkleri, düzen
   boşlukları). Bunlar `global.css :root` içinde yer alır.
3. **Legacy alias'lar** — `--surface`, `--danger` gibi kanonik
   Token'lar **üzerinden** çözülen eski adlar.

---

## Kurallar (kısaca)

- Tüketen bir bildirimde **ham renk değişmezi yok** (`#hex`, `rgb()`,
  `hsl()`). Bir değişmez yalnızca bir `--token:` tanımının değeri
  olarak izinlidir. Bileşenlerde ve CSS kurallarında Token'lara
  başvurursun: `color: var(--fg-primary)`.
- **Sabit paletli Tailwind utility'leri yok** (`bg-blue-500`).
  Token destekli utility'leri (`bg-accent` → `var(--accent)`) ya da
  bir Token üzerinde arbitrary-value kullan.
- **Renk değerli inline stiller yok.**
- **Gölgeler, yarıçaplar, boşluklar da Token'dır**
  (`--shadow-elevated`, `--radius-md`, `--space-4`).

---

## Bir tema oluşturma veya uyarlama

1. Mevcut bir `theme-<id>.css` dosyasını şablon olarak kopyala.
2. 44 kanonik Token'ın tümünü ayarla (eşlik zorunludur).
3. **WCAG-AA kontrastına** dikkat et — `contrast.test.ts` tüm
   temaları hesaplamalı olarak denetler.
4. Temayı kaydet; Ayarlar → Görünüm altındaki seçici onu devralır.

Yeni bir özellik yeni bir renk gerektiriyorsa: bir **Token ekle**,
değişmez değil. Tema başına değişiyorsa tüm `theme-*.css`
dosyalarına ekle; her yerde aynıysa `global.css :root` içine ekle.

---

## Zorlama

`make test` içinde üç guard çalışır
(`no-hardcoded-colors.test.ts`): `.tsx` içindeki renk değişmezleri
(yalnızca küçülen bir allowlist üzerinden), tema-dışı CSS'teki renk
değişmezleri ve sabit paletli Tailwind utility'leri (sıfır olmak
zorundadır). Buna ek olarak `themes.test.ts` (Token eşliği) ve
`contrast.test.ts` (tüm temalarda AA).

---

## İlgili sayfalar

- [Tema sistemi](../developer/themes.md) — gönderilen temalar + seçici
- [`docs/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/DESIGN-TOKENS.md) — eksiksiz Token listesi
