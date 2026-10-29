<!-- Translation: AI-generated, pending native review -->

# 新しい演習タイプの追加

正準モデルは、見込みで拡張されることは**ありません**。新しい演習タイプは、
具体的なコンテンツが必要とする場合にのみ、1つの小さな追加型PRとして
追加されます。これは、実際の`cloze`/`select`多肢選択の作業（#1342）と
EXP-039スキーマパイプラインから導き出された、拘束力のある手順です。

始める前に、そのタイプが本当に新しい**タイプ**であり、
[演習タイプカタログ](authoring-content.md#exercise-type-catalog-status)で
すでにカバーされている表示形式や慣例ではないことを確認してください
（テキストの多肢選択、正誤問題、ドロップダウン/ラジオ/チェックボックスは
新しいタイプでは**ありません**）。タイプは**二値でSRS採点可能**
（要素ごとに正解/不正解の単一の結果）でなければなりません。これが、
カタログの「意図的に除外」リストが引いている境界線です。

## 手順

1. **EXPエントリー / 根拠。** 必要性、二値採点のセマンティクス、
   既存タイプとの区別を、該当するエクスプロレーション
   （演習タイプの適合性については`docs/explorations/EXP-041-*`、
   または新しいEXP）に記録します。文書化された理由のないタイプは認められません。
2. **エンジンで形式を拡張する。** レッスン形式の正準的な置き場所は
   [learn-content-engine](https://github.com/astrapi69/learn-content-engine)
   パッケージです。そのスキーマ、手書きのセマンティックレイヤー
   （`src/rules.ts`）、および
   [形式リファレンス](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)
   にタイプを追加し、エンジンをリリースします。形式の変更は**エンジンから
   始まります**。アプリの`schema/*.json`は固定されたリリースのバイトミラーで、
   書き込み元はただ1つ（`scripts/sync_schema_mirror_from_engine.py`、#2265）です。
3. **ピンを引き上げ、同期を実行する。** `frontend/package.json`の
   `learn-content-engine`のピンを引き上げ、**同じPR**で`make sync-schema`を
   実行します。これはインストール済みパッケージからミラー`schema/*.json`を
   更新し、派生するすべての成果物を再生成します。対象は構造的なPydanticレイヤー
   （`scripts/generate_pydantic_models.py`による
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema_generated.py`）、
   ブラウザー用 ajv スキーマのミラー
   （`frontend/src/lib/content/validation/lesson.schema.generated.json`）とその
   スタンドアロンバリデーター、
   形式リファレンスのドキュメントです。ミラーまたは生成された成果物は
   **決して手動で編集しないでください**。編集すると`make sync-schema-check`の
   ドリフトゲートが失敗します。
4. **スキーマバージョン。** `models.py`の`CURRENT_SCHEMA_VERSION`を、
   固定されたエンジンのスキーマバージョンに合わせておきます
   （**マイナー** = 追加型。古いコンテンツはメジャーバージョンの一致によって
   引き続き検証を通ります）。アプリ側のフィールド横断ルールを
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py`
   に追加しないでください。セマンティックルールはエンジンのものであり、
   オーサリング時と、ユーザーのセットが保存される前のフロントエンドで実行されます
   （#3245）。バックエンドはレッスンを保存して配信するだけです。
5. **レンダラーを登録する。** 分岐とタイプを
   `frontend/src/components/exercises/shell/ExerciseDispatcher.tsx`の
   `SUPPORTED_EXERCISE_TYPES`に追加します。**レジストリはenumと
   一致しなければなりません**。パリティテストがこれを強制するため、
   レンダリングされないタイプはCIで失敗します（死んだスキーマを防ぐ不変条件です）。
6. **採点 / SRSを接続する。** `useControlledExercise`を通じて
   レンダラーから`ExerciseScored`を発行します。`LessonStepView.tsx`の
   共通の`onComplete` → `recordStepResult`パスが、すでに各回答を
   `getStorage().elementErrors.recordBulk`経由で振り分けています。
   これを再利用し、2つ目の記録パスを追加しないでください。
7. **コンテンツリポジトリの検証。** クライアントのバリデーター
   （`frontend/src/lib/content/validation/content-validator.ts`）を拡張します。
   品質の最低基準はエンジンの`quality-rules.json`
   （`schema/quality-rules.json`にミラーされます）にあります。タイプが
   それに影響する場合は、アプリではなくエンジンで拡張してください。
8. **オーサリングドキュメント。** タイプを
   [カタログ表](authoring-content.md#exercise-type-catalog-status)に追加し、
   JSONの例を含む`### <type>`リファレンスブロックを追加します（EN + DE）。
9. **テスト。** スキーマが有効な例を受け入れ、無効な例
   （必須フィールドの欠落 / 余分なキー）を拒否すること。レンダラーが
   正解/不正解をレンダリングして採点すること。SRSの回答が記録されること。
   コントロールの見た目が新しい場合は、モバイルのビジュアルベースラインを追加します。
10. **フォローアップ（このPRではない）。** コンテンツリポジトリ
    （`adaptive-learner-content`）は、エンジンリリースを再固定する際に
    新しいタイプを採用します。それを記録し、それを待ってブロックしないでください。

## これが小さく保たれる理由

形式は固定されたエンジンリリースからミラーされ、アプリのすべての成果物が
そのミラーから派生し（手順3）、ディスパッチャーのパリティテストが
レジストリとenumの一致を強制する（手順5）ため、新しいタイプは決まった形を持つ
追加型の変更になります: エンジン → ピン → 生成 → レンダラー → 採点 →
ドキュメント → テスト。手作業で並行管理されるコピーがずれることはなく、
レンダラーのないタイプが出荷されることもありません。
