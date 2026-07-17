# Tema sistemi

Faz 58 (v1.41.0), eski açık/koyu çiftini tek bir `data-theme`
boyutu üzerinde altı klasik temadan oluşan bir sistemle değiştirdi;
ayrıca işletim sistemini izleyen bir `auto` seçeneği ekledi. Faz 63
(v1.63.0) altı **önerilen WCAG-AA ön ayarı** ekledi, böylece seçici
toplam **12 tema** taşır.

## Önerilen ön ayarlar (Faz 63 / v1.63.0)

Ayarlar → Görünüm altındaki seçici, bir **Önerilen** alt sekmesiyle
başlar:

- **Açık:** `catppuccin-latte`, `supabase`, `graphite`
- **Koyu:** `catppuccin-mocha`, `soft-pop`, `amethyst-haze`

Bunlar, tweakcn ön ayarlarından `scripts/generate_preset_themes.py`
ile tam 44-Token'lık temalar olarak üretildi; **hesaplamalı olarak
zorunlu kılınmış WCAG AA** ile (`contrast.test.ts` tüm 12 temada).
Klasik altı (`light`, `dark`, `ocean`, `forest`, `high-contrast`,
`sepia`) değişmeden kalır.

## Nasıl çalışır

- **Kanonik renk Token'ları** `frontend/src/styles/themes/theme-<id>.css`
  içinde bulunur, her `data-theme` değeri (`light`, `dark`, `ocean`,
  `forest`, `high-contrast`, `sepia`) için bir blok. Her dosya
  **eksiksiz** anlamsal Token kümesini tanımlar — açığa düşme yoktur.
- **Temadan bağımsız Token'lar** (boşluklar, yarıçap, yazı tipleri,
  marka yöntem paleti) ve **Legacy alias'lar** (`--bg`, `--surface`,
  `--fg`, `--danger`, ...) `styles/global.css :root` içinde bulunur.
  Alias'lar kanonik Token'lar *üzerinden* çözülür ve böylece otomatik
  olarak aktif temayı izler.
- Tema dosyaları `main.tsx` içinde içe aktarılır, **önce açık**,
  böylece aktif tema, özgüllük eşitliğini `:root`a karşı kazanır.
- `frontend/src/lib/themes.ts` kayıt defteridir: `THEMES`, `ThemeId` /
  `ThemeChoice` türleri, `auto` eşlemesi için `resolveTheme(choice,
  prefersDark)` ve önizleme renk örnekleri.
- `frontend/src/hooks/useTheme.ts`, uygulanan `data-theme` özniteliğine
  sahiptir ve seçimi `adaptive-learner.theme` altında saklar (eski
  `adaptive-learner-theme` anahtarını bir kez taşır).
- `index.html`, kaydedilen temayı **ilk paint'ten önce** uygulayan
  küçük bir satır içi script içerir (titreme yok). Hook'un çözümünü
  yansıtır; ikisini de senkron tut.
- Diyagramlar (Recharts) CSS değişkenlerini SVG özniteliklerinde
  okuyamaz, bu nedenle `lib/chartTheme.ts` + `useChartTheme` hesaplanmış
  Token değerlerini okur ve `data-theme` değiştiğinde yeniden okur.

## Token kümesi (her tema tarafından tanımlanır)

Arka planlar (`--bg-primary/secondary/surface/elevated/overlay`),
metin (`--fg-primary/secondary/muted/inverse`), kenarlıklar
(`--border-primary/subtle/accent`), etkileşimli
(`--interactive-bg/hover/active/disabled`), vurgu
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), durum çiftleri
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
alıştırma geri bildirimi (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, diyagram serileri (`--chart-1..6`) ve gölgeler
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts`, bir temaya bu Token'lardan biri
eksikse ya da fazladan biri varsa başarısız olur;
`styles/contrast.test.ts` tüm 12 temada WCAG 2.1 AA'yı denetler.
Eksiksiz Token referansı
[Design-Token mimarisi](../architecture/design-tokens.md) içinde
bulunur.

## Yeni bir tema ekleme

1. Mevcut bir dosyayı **kopyala**, örn.
   `cp theme-dark.css theme-midnight.css`, ve seçiciyi
   `[data-theme="midnight"]` olarak değiştir. **Her** Token'ı koru —
   yalnızca değerleri değiştir. Burada bileşen stilleri yok.
2. Onu `lib/themes.ts` içinde **kaydet**: `THEMES`'e bir `ThemeMeta`
   girişi ekle (id, İngilizce `label`, `family` light|dark ve Settings
   önizlemesi için bir `swatch`) ve id'yi `ThemeId` birleşimine ekle.
3. Onu `main.tsx` içinde `theme-light.css`'den sonra **içe aktar**
   (sıra yalnızca açığa göre önemlidir).
4. **Pre-Paint guard'da izin ver**: id'yi `index.html` içindeki satır
   içi `<script>` içindeki `valid` dizisine ekle.
5. **i18n**: `ui.themes.midnight`'ı `backend/config/i18n/*.yaml`
   altındaki tüm sekiz katalogda ekle ve `make sync-i18n` çalıştır.
6. **Denetle**: `bunx vitest run src/styles/themes src/styles/contrast`
   — eksiksizlik ve kontrast pin'leri yeşil kalmalıdır (yeni temada
   kontrast AA'yı karşılayana kadar değerleri ayarla).

Hepsi bu kadar — ThemePicker, Pre-Paint script'i, diyagramlar ve her
bileşen yeni temayı otomatik olarak devralır, çünkü hepsi kanonik
Token'ları okur.

## Kurallar

- Bileşenlerde **sabit kodlanmış renkler yok**.
  `styles/no-hardcoded-colors.test.ts` bunu `.tsx` stilleri için
  zorunlu kılar (belgelenmiş bir allowlist; diyagram çözücüleri,
  dekoratif konfeti ve veri renklerini kapsar).
- **Her tema her Token'ı tanımlar.** Açıktan miras alınan boşluklar
  yok — bu, F1 denetim hatasıydı (koyu modda açık hex gösteren
  tanımsız Token'lar).
- **Tema değişimi anlıktır** — bir `data-theme` takası, asla bir
  yeniden yükleme.
