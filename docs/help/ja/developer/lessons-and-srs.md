<!-- Translation: AI-generated, pending native review -->

# レッスン + SRS内部仕様

このページでは、v1.27.0〜v1.31.0のコンテンツレッスン + SRS機能スタックがバックエンド、フロントエンド、2つのプラグインにまたがってどのように配線されているかを説明します。ユーザー向けの概要は[`user-guide/lessons.md`](../user-guide/lessons.md)を参照してください。

---

## アーキテクチャ概要

```
┌──────────────────────────────────────────────────────────┐
│ フロントエンド: レッスンビューアー + レビューセッション  │
│   pages/Lesson.tsx  ──→  ExerciseDispatcher  ──→  4種類の│
│   pages/Review.tsx           ↓               演習       │
│                              ↓               コンポーネント│
│                              ↓                           │
│                   recordStepResult                       │
│                              ↓                           │
│                  elementErrors.recordBulk                │
│                              ↓                           │
└──────────────────────────────────────────────────────────┘
                              ↓
                   IStorageServiceの境界
                              ↓
   ┌─────────────────────┐      ┌─────────────────────────┐
   │ ApiStorage          │      │ DexieStorage            │
   │                     │      │                         │
   │ POST /api/users/    │      │ element-errors-dexie.ts │
   │   {id}/element-     │      │   バックエンドサービスを │
   │   errors            │      │   IndexedDBに1:1で      │
   │                     │      │   ミラーリング           │
   └─────────────────────┘      └─────────────────────────┘
            ↓
   ┌──────────────────────────────────────────────────────┐
   │ バックエンド                                          │
   │                                                      │
   │  app/services/element_errors.py                      │
   │    - アップサートトランジションマトリックス           │
   │    - MASTERY_THRESHOLD = 3                           │
   │                                                      │
   │  app/services/element_srs.py                         │
   │    - 1日/3日/7日バンドスケジューラー                  │
   │    - 期限超過 → error_count → last_error_at ソート   │
   │                                                      │
   │  app/services/lesson_progress.py                     │
   │    - mark_completed切り替えを持つupsert_progress     │
   │      がlesson_session_unificationをトリガー           │
   │                                                      │
   │  app/services/lesson_session_unification.py          │
   │    - find_or_create_content_pseudo_project（遅延）   │
   │    - record_lesson_completion_session                │
   │    - manager._pm.hook経由でon_session_completeを発火 │
   └──────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────────────────────┐
            │ ゲーミフィケーションプラグイン   │
            │   on_session_complete dispatch  │
            │     method == "content"  →      │
            │       award_xp_for_lesson_      │
            │       session（レッスン式）      │
            │     else →                      │
            │       award_xp_for_session      │
            │       （チャット式、変更なし）   │
            │   badge_service.evaluate_user   │
            │     → 4つの新しいレッスン述語   │
            └─────────────────────────────────┘
```

---

## 要素レベルのエラートラッキング（v1.30.0 / Phase 46B）

### モデル

``app/models/__init__.py:ElementError``（``(user_id, set_id, lesson_id, exercise_id, element_key)``の複合UNIQUEコンストレイント付き）。決定**D2**によるレッスンスコープの要素キー — 2つの異なるレッスンにある同じ単語は2行になります。

```python
class ElementError(Base):
    user_id: str           # FK → users.id (CASCADE)
    set_id: str            # コンテンツセットID（文字列、FKではない）
    lesson_id: str         # コンテンツレッスンID（文字列、FKではない）
    exercise_id: str       # レッスン内の演習ID
    element_key: str       # 特定の単語/ペア/フレーズ
    element_type: str      # "vocabulary" | "grammar_rule"
    user_answer: str
    correct_answer: str
    error_count: int       # 誤答のたびにインクリメント
    correct_streak: int    # 正解でインクリメント、誤答でリセット
    last_error_at: datetime | None
    last_attempt_at: datetime
    mastered: bool         # correct_streak ≥ 3の場合True
    mastered_at: datetime | None
```

設計上、``learning_sessions``から切り離されています（FKなし） — コンテンツレッスンはリレーショナルジョインではなく文字列でコンテンツセット / レッスンIDを参照します。これにより、テーブルはセッション行とは独立してキャッシュの排除を生き残ります。

### アップサートトランジションマトリックス

``app/services/element_errors.py:upsert_element_error``が唯一の変更器です。動作:

| トリガー | アクション |
|---|---|
| 初回（正解） | 行をINSERT、``correct_streak=1`` |
| 初回（誤答） | 行をINSERT、``error_count=1`` |
| 既存行、正解の試行 | ``correct_streak += 1``; ストリークが``MASTERY_THRESHOLD``（3）に達したら``mastered=True``に切り替え |
| 既存行、未マスタリー行への誤答の試行 | ``error_count += 1``、``correct_streak = 0`` |
| 既存行、**マスタリー済み**行への誤答の試行 | 降格: ``mastered=False``、``mastered_at=None``、``correct_streak=0``、``error_count += 1`` |

マスタリーのしきい値はコードレベルの定数（``MASTERY_THRESHOLD = 3``）です; 決定**D4**によりSRSセマンティクスに固有であり、設定可能なパラメーターではありません。

### Dexieミラー

``frontend/src/storage/element-errors-dexie.ts``はバックエンドサービスをIndexedDBに1:1でミラーリングします。``IElementErrorsNamespace``のコントラクトは両方のストレージ実装で同一のため、Dexieモードのリリースゲート（``make test-dexie-smoke``）がドリフトを検出します。

---

## SRSスケジューリング（v1.30.0 / Phase 46C）

### インターバルポリシー

``app/services/element_srs.py:next_review_due_at``は未マスタリー行の次のレビューを予測します。

| ``correct_streak`` | インターバル |
|---|---|
| 0 | ``last_attempt_at``の1日後 |
| 1 | 3日後 |
| 2 | 7日後 |
| ≥ 3 | マスタリー済み — キューから除外 |

### 優先度ソート

レビューキューエンドポイントは以下でソートします:

1. **期限超過優先**（``next_review_due_at < now``は``next_review_due_at > now``より上位）
2. **エラー数降順**（エラーが多い = 優先度が高い）
3. **最新エラー優先**（最近の失敗がより古い失敗より上位、``-last_error_at.timestamp_us``によるマイクロ秒解像度）

タプルは``_sort_key``でキーイングされ``tuple[int, int, int]``を返します（v1.30.0のCIホットフィックス``9275841``がリファクタリング後にdatetimeから整数マイクロ秒へのmypyアノテーションを固定しました）。

### エンドポイント

``GET /api/users/{user_id}/element-errors/review-queue``が優先度付きキューを返します。Dexie側の等価物は``element-errors-dexie.ts``の``computeReviewQueueDexie``です。ダッシュボードの``<ReviewQueueCard>``ウィジェットは設定されたストレージモードに応じてどちらかを呼び出し、カウント + 期限超過バッジ + レビューセッションへのCTAをレンダリングします。

---

## LessonProgress ↔ LearningSession統合（v1.31.0 / Phase 46F）

### 決定

v1.30.0の``ElementError``の作業は意図的に``LearningSession``から切り離しました。v1.31.0のPhase 46Fはこの統合レイヤーを追加します: すべてのコンテンツレッスンの完了が``LearningSession``行を書き込むようになり、既存のゲーミフィケーション + トラッキング + ストリーク機構が新しいフックなしでピックアップできます。

3つの決定が形状を決めます:

- **D1（遅延擬似プロジェクト）**: ``kind="content"``の「コンテンツレッスン」``LearningProject``が最初のレッスン完了時に自動作成されます（オンボーディング時にはシードされません）。ユーザーごとに1つ。
- **D2（``method="content"`` 7番目の値）**: 統合パス専用に``LearningSession.method``の有効な値のセットに追加されます。他の6つのメソッド（deductive / inductive / error_based / dialogic / contextual / ai_adaptive）はチャットセッションを変更なしにカバーします。
- **D5（拡張しない、再利用する）**: 新しいフックスペックなし。``record_lesson_completion_session``は``manager._pm.hook``経由で既存の``on_session_complete``フックを発火させます。ゲーミフィケーション + トラッキングプラグインの既存ハンドラーは、メソッドによるディスパッチで、レッスンがチャットセッションであるかのように実行されます。

### スキーマ変更

```python
# app/models/__init__.py — Phase 46F.1
LEARNING_PROJECT_KIND_STANDARD = "standard"
LEARNING_PROJECT_KIND_CONTENT = "content"

class LearningProject(Base):
    ...
    kind: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=LEARNING_PROJECT_KIND_STANDARD,
        server_default=LEARNING_PROJECT_KIND_STANDARD,
    )
```

Alembic ``0020_learning_project_kind``は``batch_alter_table`` + ``add_column``（``server_default="standard"``付き）でカラムを追加するため、SQLiteで既存の行が正常にバックフィルされます。同期サーフェスがカラムをピックアップするため、``ApiStorage`` ↔ ``DexieStorage``の往復が両方向で機能します。

### 統合ヘルパー

``app/services/lesson_session_unification.py``には2つのパブリック関数があります:

- ``find_or_create_content_pseudo_project(db, user_id)`` — 冪等なルックアップ; ミス時のみ作成。
- ``record_lesson_completion_session(db, *, user_id, lesson_progress_id, score_correct, score_total)`` — ``LearningSession``行を書き込み、コミットし、次に``on_session_complete``を発火させます。

両方とも``app/services/lesson_progress.py:upsert_progress``から、行が``in_progress``から``completed``に切り替わるときに呼び出されます。ヘルパー自身のDB書き込みは例外を伝播します（実際のDB問題）が、フック発火パスはセッションプラグインの``routes.py``の``_fire_on_session_complete``パターンに従ってサブスクライバーの例外をラップします — ゲーミフィケーションのクラッシュがサマリー画面で既に確認したレッスンをロールバックすることはできません。

### フロントエンドフィルター

``frontend/src/lib/learning-project.ts``は``isStandardProject`` + ``filterStandardProjects``を公開します。3つのコンシューマーがフィルターを適用します:

- ``DashboardFilterBar.tsx``（ダッシュボードプロジェクトピッカー）
- ``ExportSection.tsx``（エクスポートピッカー）
- ``Anki.tsx``（Ankiプロジェクトドロップダウン）

バックエンドエンドポイントは意図的に擬似プロジェクトを公開しているため、将来の「全アクティビティ」管理者ビューがオプトインできます。フィルターはUIポリシーの決定であり、データの隠蔽ではありません。

---

## レッスン式のXPルール（v1.31.0 / Phase 46E.1）

``adaptive_learner_gamification.xp_service``が以下を追加します:

- ``compute_stars(correct, total)`` — スコアから0〜3を計算（50% / 75% / 90%のバンド）。フロントエンドの``lib/lesson-summary.ts``の``computeStars``をミラーリングするため、両サイドが同じスター評価を予測します。
- ``calculate_lesson_session_xp(*, stars, first_attempt, streak_days)`` — 純粋な計算機。30ベース + スターごと10 + 最初の試行で3スター20 + チャット式と同じ+25%/日のストリーク倍率（7日上限）。
- ``_is_first_attempt(db, lesson_progress_id)`` — ``LessonProgress.step_results`` JSONを読み取り、すべてのステップ行が``attempts == 1``の場合にTrueを返します。
- ``award_xp_for_lesson_session(db, *, session)`` — プロジェクトFKからuser_idを解決し、式を適用する永続化ラッパー。

ディスパッチは``GamificationPlugin.on_session_complete``で``session["method"]``に基づいて行われます。チャットメソッドは``award_xp_for_session``に留まります。コンテンツメソッドはレッスン式にルーティングします。統合ヘルパーからのセッションペイロードはレッスン固有のキー（``lesson_progress_id``、``score_correct``、``score_total``）を持ちます; チャットセッションのペイロードはそれらを持たないため、ディスパッチが漏れた場合でもレッスンXPラッパーは適切にデグレードします — ただし``backend/tests/test_lesson_session_unification.py``の回帰ピンテストが正確なレッスンアワード（4/4の最初の試行完了 + 初日のストリークで100 XP）を確認するため、漏れはすぐに表面化します。

---

## レッスンバッジ（v1.31.0 / Phase 46E.2）

``adaptive_learner_gamification.badge_service._EVALUATORS``に4つの新しい述語が追加されました:

| キー | 述語 | ヘルパー |
|---|---|---|
| ``first_lesson`` | ``_completed_lesson_count >= 1`` | ``LessonProgress.status="completed"``をカウント（LearningSession経由ではない — レッスン行が権威的） |
| ``lessons_10`` | ``_completed_lesson_count >= 10`` | 同上 |
| ``three_star_streak`` | ``_last_n_lessons_all_three_star(n=3)`` | ユーザーの最後の3つの完了した``LessonProgress``を``completed_at``の降順で読み取り、``xp_service.compute_stars``で各々を予測 |
| ``review_master`` | ``_mastered_elements_count >= 50`` | ``ElementError.mastered=True``をカウント |

カタログ数: **24 → 28**（+1 getting_started + 1 consistency + 2 depth）。既存の``すべてのyamlバッジが評価器を持つ``対称テスト（``backend/tests/test_gamification_badges_integration.py``内）が2つのリスト間のドリフトを検出します。

---

## ストレージモードの注意事項

要素トラッキング + SRSチェーンは**両方**のストレージモードで同一に動作します — ``IElementErrorsNamespace``コントラクトはモードに依存せず、Dexieモードのリリースゲート（18スペック、``/review``ルートを含む）がリグレッションをブロックします。

レッスンセッション統合 + ゲーミフィケーションの副作用は**APIモードのみ**です。Dexieモードでは、レッスン完了が``LessonProgress``への書き込み、``ElementError``行の記録、レビューキューの駆動を引き続き行います — ただし``LearningSession``の書き込みと``on_session_complete``フックは発火しません（バックエンドなし、フック可能なものなし）。Dexieモードのユーザーはフルレビューループを得られます; チャットセッションパスからのXP / バッジアワードは引き続き機能しますが、レッスン完了はまだその合計に貢献しません。

ゲーミフィケーションの副作用を``DexieStorage``に統合する将来の作業（Dexieモードユーザーのレッスン完了もローカルでXPを付与するようにする）はv1.31.0の意図的な非目標です — TypeScriptで式実装を複製するか、on_session_completeフックのサービスワーカーシムが必要になり、どちらもv1.31.0のスコープを超えるより大きなリファクタリングになります。

---

## 次に読むべき場所

- ``backend/app/services/element_errors.py`` — アップサートトランジションマトリックス。
- ``backend/app/services/element_srs.py`` — スケジューラー。
- ``backend/app/services/lesson_session_unification.py`` — 擬似プロジェクト + フック発火。
- ``plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/xp_service.py`` — ``calculate_lesson_session_xp`` + ディスパッチ。
- ``plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/badge_service.py`` — 4つの新しい述語。
- ``frontend/src/lib/learning-project.ts`` — 擬似プロジェクトフィルターヘルパー。
- ``e2e/dexie/dexie-mode.spec.ts`` — Dexieモードのリグレッションを防ぐリリースゲート（``/lesson/...``のレッスンスペック、``/review/...``のレビュースペック）。

---

## トークンdiff + cloze + 修正ラウンド（v1.35.0 / Phase 52）

受動的な再生をアクティブな学習に変える3つの重層的な追加:

**トークンdiff + DiffHighlight** — free-textとword-tilesの誤答が、結果の段落の下に`<DiffHighlight tokens={tokenDiff(input, canonical)} />`インラインでレンダリングされるようになりました。レッスンサマリーの演習ごとの内訳は、v1.35.0以降に保存された`user_answer`が利用可能な場合、free-text + word-tilesの同じdiffを表示します（古い行は正規のみの行にフォールバックします）。アルゴリズムは`frontend/src/lib/exercises/token-diff.ts`内 — 純粋な単語レベルLCS、NFC正規化、大文字/小文字 + アクセント感応性。

**Cloze演習タイプ（スキーマ1.1）** — 5番目のExerciseType: 見えやすい`___`マーカーを使った穴埋め。2つのレンダリングモード: `type`（デフォルト、`<input>`）と`select`（`distractors`からのオプションを持つ`<select>`）。`deriveClozeAttempts`によるブランクごとのSRSファンアウト — ブランクごとに1つのElementAttempt、ブランクごとのマスタリートラッキングがきれいに機能します。レンダラーは`frontend/src/components/exercises/ClozeExercise.tsx`; スキーマは`plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py`。

**Clozeジェネレーター** — `generateClozeFromError(error, sourceExercise, sourceCard)`がElementErrorからclozeステップを合成します。アルゴリズム:

1. `sourceCard.token_roles`に`token === error.correct_answer`のエントリがある場合、`sourceCard.front`でそのトークンを空白にします。
2. そうでなければ、`sourceCard.front`が`error.correct_answer`をちょうど1回含む場合、それを空白にします。
3. そうでなければ、ソースがfree_textでそのプロンプトが答えをちょうど1回含む場合、それを空白にします。
4. そうでなければnullを返します — 呼び出し元は再生にフォールバックします。

決定論的: 同じ入力 → バイト同一の出力。AI、ランダム性、非同期なし。Distractorsは`error.user_answer`（正解と異なる場合）を最初に、次に`sourceExercise.distractors`をフィルタリングして重複排除したものを含みます。コードは`frontend/src/lib/exercises/cloze-generator.ts`。

**レッスン終了後の修正ラウンド** — `<CorrectionBlock />`が`LessonSummary`内にスコア / 内訳とアクションボタンの間にマウントされます。マウント時に、完了したばかりのレッスンのElementError行を読み取り、未マスタリーの失敗ごとにclozeを生成し（上限5）、ユーザーがそれらを1つずつ処理できるようにします。各完了したclozeは、元の失敗が記録されたのと同じelement_keyに対して新鮮なElementAttempt行を書き込むため、SRSのストリーク + マスタリーが進みます。完璧なスコア / エラーなし / 構築可能なclozeなしの場合に自己非表示します。コードは`frontend/src/components/exercises/CorrectionBlock.tsx`。

**レビューセッションでのCloze（Phase 52G）** — `synthesizeReviewLesson`のアイテムごとのブランチ（`_buildReviewStep`）が選択するようになりました:

- free_textまたはword_tilesのソース → clozeを試み、再生にフォールバック
- matching、picture_choice、cloze → 常に再生

決定基準は`frontend/src/lib/review-lesson.ts`に記載されています。再生ステップのIDは`review-`で始まります; 生成されたclozeステップのIDはトレーサビリティのために`review-cloze-`で始まります。

**カードのトークンロール（Phase 52I）** — カード上のオプションの`token_roles: list[{token, role}]`アノテーション、閉じた列挙型の文法ロール（article / verb / noun / adjective / preposition / gender_marker / tense_marker）。ジェネレーターはこれらを使用して、部分文字列マッチングではなく意味的に意味のある空白を選択します。ロールの追加はマイナーなschema_versionバンプです — 列挙型を閉じたまま保つ。
