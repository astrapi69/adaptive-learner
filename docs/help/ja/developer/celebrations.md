<!-- Translation: AI-generated, pending native review -->

# お祝いレイヤー

お祝いレイヤー（EXP-008、Phase 55）は、既存の機械的なトラッキングの上に感情的なフィードバックを追加します。フロントエンドのみで、両方のストレージモードで動作します。

## 構成要素

| モジュール | 役割 |
|---|---|
| `lib/praise/phrase-picker.ts` | 繰り返しなしの称賛フレーズのサイクリング。`data/praise/{lang}.json`（`make sync-praise`経由で`backend/config/praise/*.yaml`からバンドルされたもの）を読み取ります。 |
| `lib/feedback/feedbackPref.ts` | 強度（`subtle`/`normal`/`enthusiastic`）+ localStorage内のサウンドプリファレンス; reduced-motionオーバーライド; レベルごとのゲーティング + 頻度ヘルパー。 |
| `hooks/useFeedbackIntensity.ts` | ライブの有効な強度（プリファレンス変更 + reduced-motion変更時に再読み取り）。 |
| `lib/feedback/milestones.ts` | 純粋なしきい値検出（ストリーク/マスタリー/レベル）。 |
| `lib/feedback/celebrationQueue.ts` | ID重複排除付きのモジュールレベルFIFO; 1つのリスナー（ホスト）。 |
| `lib/praise/celebration-bus.ts` | `emitCelebration`（マップされたサウンドを再生 + サブスクライバーに通知）と`celebrate*`マイルストーンヘルパー。 |
| `lib/feedback/celebration-stats.ts` | ゲーミフィケーションのスナップショット + 完了時にマイルストーン/バッジのお祝いを駆動します。 |
| `lib/audio/sound-effects.ts` | ランタイム合成サウンド（オーディオファイルなし）。 |
| `components/exercises/AnswerCelebration.tsx` | 回答ごとのハプティック + 称賛 + バス送出。 |
| `components/feedback/Confetti.tsx` | CSSのみの紙吹雪バースト。 |
| `components/feedback/MilestoneHost.tsx` + `MilestoneOverlay.tsx` | キューを消化し、一度に1つのオーバーレイを表示します。 |

## フロー

1. 演習が`<AnswerCelebration isCorrect>`をレンダリングします; ハプティックを発生させ、フレーズを選択し（強度 + 頻度でゲーティング）、バスに`answer_correct`/`answer_wrong`を送出します。
2. `emitCelebration`がマップされたサウンドを再生し（サウンドプリファレンスでセルフゲーティング）、サブスクライバーに通知します。
3. レッスン完了時に、ページはゲーミフィケーションのスナップショットを取り、アワードを実行し、次に`celebrateProgressSince`がマイルストーン + バッジを検出して`celebrateMilestone`にルーティングし、オーバーレイをエンキューしてサウンドを送出します。`MilestoneHost`がオーバーレイを順番に表示します。

## ルール

- すべてのアニメーションはCSS（transform + opacity）; アニメーションライブラリなし。`prefers-reduced-motion`はすべてのアニメーションを抑制し、有効な強度を`subtle`に強制します。
- サウンドは加算的なレシピ（`renderSamples`は純粋でテスト可能なコア）からランタイムで合成されます; `AudioContext`はユーザーのジェスチャー内での最初の再生で遅延作成されます。
- お祝いレイヤーは補足的です: すべてのキューは視覚的にも確認できます。レイヤーの障害がレッスンフローを決して壊してはなりません（統計読み取りは防御的です）。
