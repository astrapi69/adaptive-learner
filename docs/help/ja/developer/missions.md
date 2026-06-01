<!-- Translation: AI-generated, pending native review -->

# デイリーミッションのアーキテクチャ

デイリーミッション（EXP-010、Phase 56）は、受動的なXP/バッジ/ストリーク報酬の上にアクティブでオプトインの動機付けを追加します。両方のストレージモードで動作し、追跡テーブルをちょうど1つだけ追加します。

## 構成要素

| モジュール | 役割 |
|---|---|
| `plugins/.../missions/templates.yaml` | 静的なミッションカタログ（22テンプレート、5カテゴリ）。`make sync-missions`でフロントエンドに同期されます。 |
| `MissionTemplate`（Pydantic） | カタログエントリの形式（設定、テーブルではない）。 |
| `UserMission`（モデル） | 唯一の新テーブル: ユーザー/日ごとのアサインメント + 進捗 + `xp_awarded`ガード。Alembic `0021`、Dexie v20、同期サーフェス（MUTABLE）。 |
| `lib/missions/generator.ts` + `generator.py` | 決定論的（シード付きPRNG）アダプティブ選択: 難易度スロットごとに1つを選択、履歴による適格性（新規/アクティブ/ベテラン）、連続する日の繰り返しなし。 |
| `lib/missions/checks.ts` + `SUPPORTED_CHECK_FUNCTIONS` | 既存のデータから計算可能なチェックのみアサインされます（他の5つのカタログエントリはトラッキングが存在するまでアサインされません）。 |
| `lib/missions/progress.ts` | 純粋な`check_function` + 統計スナップショット -> {current, target, completed}。 |
| `lib/missions/schedule.ts` | ローカル深夜の`today`（言語→タイムゾーン）+ ストリークジョーカー。 |
| `storage/missions-dexie.ts` | Dexie: 「今日」の統計スナップショットを収集し、冪等にアサインし、評価し、完了時にXPを付与。 |
| ミッションプラグイン`service.py` | APIモード向けにSQLAlchemy対して同じフロー（`GET /today`、`POST /regenerate`）。 |

## フロー

1. ダッシュボードウィジェット（またはレッスン完了）が`getStorage().missions.getDaily(userId, {todayIso})`を呼び出します。
2. その日のローカル日付に行が存在しない場合、ジェネレーターが新しいセットをアサインします（`userId + date`でシードし、昨日のものを除外）。
3. 進捗は既存のデータ（LessonProgress / ElementError / ストリーク）に対して再評価されます。新たに完了したミッションは`completed`を切り替え、1回だけ`xp_reward`を付与します（`xp_awarded`による冪等性）。
4. `celebrateMissions`（お祝いバス）がミッションサウンドを再生し、称賛フレーズを表示します; オールクリアにはより大きなサウンド + 紙吹雪バーストが再生されます。

## ルール

- （userId、date）ごとに決定論的; ユーザーは1つのストレージバックエンドを使用するため、クロスバックエンドの完全なパリティは必要ありません。
- `UserMission`を超えるトラッキングはありません; 追跡不可能なチェックはアサインされません。
- ミッションは補足的です — 失敗がレッスンフローを決して壊してはなりません（すべての読み取りは防御的）。ミスした日へのペナルティはありません。
