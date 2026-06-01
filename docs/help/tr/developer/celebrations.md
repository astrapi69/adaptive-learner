<!-- Translation: AI-generated, pending native review -->

# Kutlama katmanı

Kutlama katmanı (EXP-008, Aşama 55), mevcut mekanik takıbın
üzerine duygusal geri bildirimi ekler. Yalnızca frontend'dedir
ve her iki depolama modunda da çalışır.

## Parçalar

| Modül | Rol |
|---|---|
| `lib/praise/phrase-picker.ts` | `make sync-praise` aracılığıyla `backend/config/praise/*.yaml`'dan paketlenen `data/praise/{lang}.json`'ı okuyan, tekrarsız övgü cümlesi döngüsü. |
| `lib/feedback/feedbackPref.ts` | localStorage'daki yoğunluk (`subtle`/`normal`/`enthusiastic`) + ses tercihleri; azaltılmış hareket geçersiz kılma; seviye başına geçit + sıklık yardımcıları. |
| `hooks/useFeedbackIntensity.ts` | Canlı etkin yoğunluk (tercih değişikliği + azaltılmış hareket değişikliğini yeniden okur). |
| `lib/feedback/milestones.ts` | Saf eşik algılama (seri/ustalık/seviye). |
| `lib/feedback/celebrationQueue.ts` | id tekilleştirmeyle modül düzeyinde FIFO; bir dinleyici (host). |
| `lib/praise/celebration-bus.ts` | `emitCelebration` (eşlenmiş sesi çalar + abonelere bildirir) ve `celebrate*` kilometre taşı yardımcıları. |
| `lib/feedback/celebration-stats.ts` | Oyunlaştırmayı anlık görüntüler + tamamlamada kilometre taşı/rozet kutlamasını yürütür. |
| `lib/audio/sound-effects.ts` | Çalışma zamanında sentezlenmiş sesler (ses dosyası yok). |
| `components/exercises/AnswerCelebration.tsx` | Cevap başına dokunsal + övgü + bus emit. |
| `components/feedback/Confetti.tsx` | Yalnızca CSS konfeti patlaması. |
| `components/feedback/MilestoneHost.tsx` + `MilestoneOverlay.tsx` | Kuyruğu boşaltır, bir seferde bir bindirme gösterir. |

## Akış

1. Bir alıştırma `<AnswerCelebration isCorrect>` oluşturur; dokunsal
   tetikler, bir cümle seçer (yoğunluk + sıklık geçitli) ve bus'ta
   `answer_correct`/`answer_wrong` emit eder.
2. `emitCelebration`, eşlenmiş sesi çalar (ses tercihinde kendi kendini
   geçit yapar) ve abonelere bildirir.
3. Ders tamamlanmasında sayfa oyunlaştırmayı anlık görüntüler, ödülü
   çalıştırır, ardından `celebrateProgressSince` kilometre taşlarını +
   rozetleri algılar ve bunları `celebrateMilestone` aracılığıyla
   yönlendirir; bu bir bindirme kuyruğa alır ve bir ses emit eder.
   `MilestoneHost`, bindirmeleri sırayla gösterir.

## Kurallar

- Tüm animasyonlar CSS'dir (transform + opacity); animasyon kütüphanesi
  yok. `prefers-reduced-motion`, her animasyonu bastırır ve etkin
  yoğunluğu `subtle`'a zorlar.
- Sesler, katkı tariflerinden çalışma zamanında sentezlenir
  (`renderSamples` saf, test edilebilir çekirdektir); `AudioContext`,
  kullanıcı hareketi içindeki ilk oynatmada tembelce oluşturulur.
- Kutlama katmanı tamamlayıcıdır: her ipucu aynı zamanda görünürdür.
  Bunda bir başarısızlık asla ders akışını kırmamalıdır (istatistik
  okumaları savunmacıdır).
