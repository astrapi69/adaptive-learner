<!-- Translation: AI-generated, pending native review -->

# ゲート、ラチェット、ブランチ保護

このプロジェクトは異例なほど厳格です。数十のCIゲート、固定された
ベースラインを持つラチェット群、必須のissueとプルリクエスト、
ゲートテスト契約、そして管理者にも適用されるブランチ保護があります。
そのほとんどは人間が読む場所には書かれておらず、エージェント向けの
ルールファイル
[`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules)
にあります。このページは人間向けの地図です。各仕組みが何であり、
なぜ存在するのか、そしてブロックされたときに実際に重要な部分、
つまり何をすればよいかを説明します。

ここでは規範を繰り返しません。ルールが拘束力のある文言を持つ場合、
このページはそこへリンクして説明します。ルールが唯一の正しい情報源です。
2つ目のコピーはずれていき、このコードベースではそれが起きたことを
一度ならず検出しています。

## 2つのケイデンス: PRゲートと夜間シフト

プルリクエストがグリーンでも、`develop`がグリーンだという意味には
**なりません**。PRのCIは正しさのゲート、つまり失敗したらマージを
ブロックしなければならないものだけを実行します。情報提供目的のもの、
警告のみのもの、外部の状態に左右されるものはすべて夜間シフト
（夜間スケジュールと`workflow_dispatch`）で実行されます。

| すべてのPRで実行 | 夜間とリリース時に実行 |
|---|---|
| バックエンド / プラグイン / フロントエンドのテスト、ruff + mypy、pre-commit、ドキュメントドリフト検証ツール | セキュリティスキャン（pip-audit / bun audit / bandit） |
| 複雑度ラチェット、フォルダーサイズ + ファイルサイズのガード | カバレッジレポート（レポートであり、ゲートではない） |
| ビジュアルベースラインゲート、testid参照ゲート | DexieモードのE2E、ビジュアルリグレッション、ミューテーションテスト |
| docker-build-smoke（パスフィルター付き） | コンテンツ統計のドリフト、WebKitゲート |

その結果、夜間シフトだけがカバーする領域への変更は、クリーンなPRとして
マージされ、次の夜間実行をレッドにすることがあります。これは一度きりの
ことではなく、既知の繰り返し起こるリスクのクラスです。正式な表と
その理由は
[`quality-checks.md` -> "CI cadence: PR gates vs the night shift"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md)
にあります。

## ゲートとは何か、そして何でないか

ゲートとは**フェイルクローズ**するチェックです。プロジェクトのゲート
テスト契約（ゲートごとに5つのテスト）は
[`quality-checks.md` -> "Gate test contract"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md)
に詳しく書かれています。コントリビューターとして実感する2つのルール:

- **チェックできないゲートは決してグリーンを報告してはなりません。**
  「実行できなかった」は「見つかるものがない」ではありません。
  ゲートの前提（ベースラインの欠如、ヘルパーのクラッシュ、未ビルドの
  フロントエンド）が欠けている場合、ゲートは合格せず失敗します。
- **ゲートは何を測定したかを報告します。** 「0件の検出」と
  「0ファイルを確認」は同じ結果ではなく、ゲートはその2つを
  区別できるように作られています。

ですから、ゲートにブロックされたら、それが間違っていると考える前に、
何を測定したと言っているかを読んでください。「誤った」ゲート失敗の
ほとんどは、予期していなかった実際のドリフトをゲートが正しく
報告しているものです。

## ラチェットとベースライン

**ラチェット**は、現在の測定値をツリー内にある固定されたベースラインと
比較します。測定値は自由に改善してよいですが、黙って悪化してはなりません。
数値とベースラインの両方がコミットされているため、どちらもずれる可能性が
あります。

ラチェット群と、それぞれのベースラインの場所:

| ラチェット | ベースラインファイル | ローカルターゲット |
|---|---|---|
| 循環的複雑度 | `.complexity-baseline` | `make check-complexity-gate` |
| ファイルサイズ（行数） | `.filesize-baseline` | `make check-file-sizes` |
| フォルダーサイズ（ディレクトリ直下のファイル数） | `.dirsize-baseline` | `make check-folder-size` |
| `global.css`のサイズ | `.css-size-baseline` | `make check-css-size` |
| テーマトークン / コントラスト | `.theme-baseline.json` | `make verify-theme` |
| ルールコーパスのサイズ | `.claude/rules/.corpus-baseline.json` | `make verify-rule-corpus-size` |
| ドキュメントのウムラウト代替表記 | `docs/.docs-hygiene-baseline.json` | `make verify-docs-hygiene` |
| 壊れたドキュメント参照 | `docs/.doc-refs-baseline.json` | `make verify-doc-refs` |
| 公開イメージのサイズ | （`verify-image-size`内） | `make verify-image-size` |

### ラチェットにブロックされたとき

1. **まず`develop`をマージし、それから測定し直します。** ラチェットは
   現在のツリーをベースラインと比較します。ベースより遅れているブランチは、
   *新しい*マージ後のコンテンツに対して*古い*ベースラインを持っているため、
   ローカルで読む数値はCIが読む数値と一致しません。何かに手を付ける前に
   ブランチを更新してください。これがなぜ問題になるかは
   [`lessons/ci-gates.md` -> "A ratchet baseline is itself a
   measurement"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
   に記録されています。

2. **増加が正当なものであれば、意図的にベースラインを引き上げ、
   その理由を述べてください。** 各ラチェットには明示的な引き上げ/更新
   ターゲットがあり、新しい上限が差分に入り、レビュー可能になり、
   コミットメッセージに理由が残ります:

   ```bash
   make check-complexity-gate-update      # regenerate .complexity-baseline
   make check-folder-size-update          # show offenders to whitelist
   make verify-theme-baseline-update      # re-record .theme-baseline.json
   make verify-rule-corpus-size-raise     # raise the corpus ceiling
   make verify-image-size-raise           # raise the image ceiling
   ```

3. **ラチェットが自ら下がることを期待しないでください。** 一部の
   ラチェットは本当の減少を自動的に反映します（ゼロであるべきエラー
   カウンター）。*予算*ラチェットは減少を余裕として残し、意図的な操作に
   よってのみ動きます。*ドリフトするオラクル*のラチェット（複雑度、
   ビルドされたTailwind CSS）は決して自動で下がりません。下がったのが
   本当の改善ではなくツールのドリフトかもしれないからです。この3通りの
   判断はゲートテスト契約のポイント5で説明されています。数値が*縮んだ*
   ためにラチェットが失敗した場合、それも検出結果であり、通過の許可では
   ありません。

ローカルのレッドをグリーンにするために上限を下げることは決してしないで
ください。数値は設計上どこでも同じ意味を持ちます。それを黙って動かすことは、
まさにラチェットが防ぐために存在している失敗です。

### 実例: ルールコーパスのラチェット

`.claude/rules/`配下のルールファイルにセクションを追加したとします。
そのようなファイルはすべてのプロンプトに注入されるため、コーパスの
ラチェットがその合計サイズを守っています。実行するとブロックされます:

```
$ make verify-rule-corpus-size
rule corpus: 24 files, 292314 chars (~73078 tokens per prompt)
rule corpus is 58 chars over the ceiling (292314 > 292256).
  - condense or delete elsewhere in the corpus (see the condensation rule
  - raise the ceiling deliberately:
      make verify-rule-corpus-size-raise
    and say in the commit what the corpus bought for the space.
make: *** [Makefile:899: verify-rule-corpus-size] Error 1
```

ゲートは2つの正当な抜け道を、そしてその2つだけを表示します。合計が
再び収まるように他の部分を圧縮または削除するか、
`make verify-rule-corpus-size-raise`で意図的に上限を引き上げてコミットで
正当化するかです。ゲートは非ゼロ（`Error 1`）で終了するため、どちらかを
行うまでビルドは失敗します。追加がそのまま紛れ込む第3の道はありません。
上の表のすべてのラチェットは同じ形でブロックします: 何を測定したかを示す
行、上限に対する現在値、そして独自の引き上げ/更新ターゲットです。

プッシュ後にしか効かないゲートは往復のコストがかかります。ビルド不要の
ゲートを、CIと同じ順序で1つのコマンドで実行できます:

```bash
make ci        # every build-free gate, in CI order (BASE=<ref> for diff gates)
make ci-full   # the above plus gates that need a built frontend
```

`make ci`は次の順に実行します: ドキュメントのドリフト、ドキュメントの
衛生、ドキュメント参照、ゲート<->ルールのリンク、チェックインベントリー、
レッスンインベントリー、規範的変更、ルールコーパスのサイズ、複雑度
ラチェット、testid参照、Dockerコンテキスト、ファイルサイズ、OpenAPI
スナップショット。2つのゲートはインストール済みかつビルド済みの
フロントエンドを必要とする（Tailwindクラスのオラクルをビルドする）ため、
`make ci`ではなく`make ci-full`に入っています。テストスイートは別です:
`make test`。

## ゲートはルールと結び付けられ、変更は宣言される

2つのマニフェストが強制の誠実さを保っており、ルールファイルや
ワークフローを編集するとどちらにも引っかかる可能性があります:

- [`.claude/rules/gates.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/gates.yaml)
  は、ルールを強制するすべてのゲートを、それが強制するルールセクションと
  結び付けます。`make verify-gate-rule-links`は両方向で失敗します:
  ルールのないゲート、またはもう存在しないワークフローを引用するルールです。
  結び付けられた各ゲートはルールセクションの`body_sha`も持つため、
  見出しを残したままルール本文を空洞化すると検出されます。
- [`.claude/rules/checks.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/checks.yaml)
  はすべてのチェックの一覧です。`make verify-check-inventory`は、
  `active`なチェックが実際に接続されていて、何もしない状態に劣化して
  いないことを証明します。チェックを無効にできるのは、理由を添えて
  `status: disabled`を宣言した場合だけで、差分にそれが表れます。
  黙って無効化することが不可能になります。

PRがルールファイルの拘束力のある文言を追加または削除する場合、あるいは
ゲートのステータスを変更する場合、`make verify-normative-changes`は
それを**宣言**するよう求めます: `rule-change-declared`ラベル、または
PR本文かコミットメッセージ中の
`RULE-CHANGE DECLARED: <what and why>`という行です。宣言は意図的に
通過可能にしてありますが、偶然に通ることは決してありません。そして
宣言は機械によって
[`docs/rule-change-log.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/rule-change-log.md)
に集約されます。詳しい理由:
[`quality-checks.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md)
の#2075 / #2077 / #2079 / #2081 / #2087のシリーズ。

ルールコーパスに上限があるのには具体的な理由があります。すべての
`.claude/rules/**/*.md`ファイルは、すべてのエージェントセッションの
すべてのプロンプトに注入されます。そのため新しいルールセクションは
追加ではなく取引です。まず何かを圧縮または削除するか、そのスペースで
コーパスが何を得たのかをコミットで述べてください。

## ブランチ保護は管理者にも適用される

`develop`は、マージの前に最新のブランチとグリーンの必須チェックを
要求します。2026-08-06以降、`develop`では`enforce_admins`が**有効**で、
必須チェックはリポジトリ管理者にも適用されます。それを無効にすることは
意図的で目に見える操作であり、通常のマージの一部には決してなりません。
これが存在するのは、かつてリリースとホットフィックスのバックマージが
ゲートを通らずに`develop`に到達し、人間が気付くまですべてのブランチで
レッドのままにしたからです。経緯は
[`lessons/ci-gates.md` -> "Release/hotfix back-merges land
ratchet-tripping changes on develop ungated"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
と
[`docs/development/release-ratchet-gap.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/development/release-ratchet-gap.md)
にあります。

実際の影響: レッドのゲートを迂回してマージする人はいません。PRが
`develop`より遅れている場合は、マージできるようになる前に、結合された
状態に対してCIが再実行されるよう更新してください。

## 義務: issue、PR、テスト計画、1つの関心事

ゲートの上に、4つの常設の義務があります。これらはCIのチェックではなく
規範であり、タスクが求めたかどうかに関係なく拘束力を持ちます:

- **まずissue**（`GITHUB-ISSUE-PFLICHT`）: すべてのバグや変更には、修正の
  *前に*GitHubのissueが必要で、コミット/PRはクローズキーワード
  （`Closes #NN`）でそれを引用します。
- **常にPR**（`PR-PFLICHT`）: プッシュされたコード変更は、求められたか
  どうかにかかわらず、`develop`に対するプルリクエストを開きます。
  PRのないプッシュ済みブランチは未完成の作業です。
- **ユーザーに見える変更にはテスト計画**（`TESTPLAN-PFLICHT`）:
  ユーザーに見える動作の変更は、同じPRで手動テスト計画（ドイツ語と
  英語）を更新します。純粋なリファクタリング、インフラ、ドキュメントは
  対象外です。
- **PRごとに1つの関心事**: 各PRは1つのまとまった変更を扱います。

拘束力のある文言は
[`.claude/rules/ai-workflow/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules/ai-workflow)
（`github-issue-policy.md`、`pr-policy.md`、`testplan-policy.md`）と
[`vibe-coding.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/vibe-coding.md)
にあります。

## このページの位置付け

このページは「なぜそのゲートがあるのか」を説明する補助ページで、
クローンからマージ済みPRまでの手順を追う
[オンボーディングのウォークスルー](onboarding.md)と対になっています。
テストのワークフロー自体（Red-Green-Refactorと実例）については
[テスト](testing.md)を参照してください。リリース時のゲートについては
[リリースワークフロー](release.md)を参照してください。
