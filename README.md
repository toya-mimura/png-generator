# Web Scraping Report Generator

指定したウェブページをスクレイピングし、OpenAI APIで分析・可視化したレポートをPNG画像として生成するツールです。

## 機能

- Playwrightによる動的ウェブページのスクレイピング
- OpenAI APIを使用したデータ分析とビジュアライゼーション
- PuppeteerによるHTMLからPNGへの変換
- GitHub Actionsによる定時実行対応

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` にコピーして、OpenAI APIキーを設定：

```bash
cp .env.example .env
```

`.env` ファイルを編集：
```
OPENAI_API_KEY=your_actual_api_key_here
```

### 3. スクレイピング対象URLの設定

以下の2つの方法のいずれかでURLを指定できます：

**方法1: systemprompt.md に記載**
```markdown
## Target URLs（オプション）
- https://www.google.com/finance/quote/VIX:INDEXCBOE
- https://tenki.jp/forecast/3/17/4610/14100/
```

**方法2: .env ファイルに記載**
```
TARGET_URLS=https://www.google.com/finance/quote/VIX:INDEXCBOE,https://tenki.jp/forecast/3/17/4610/14100/
```

## 使用方法

### ローカル実行

```bash
npm start
```

実行後、以下のファイルが生成されます：
- `report.html` - レポートのHTML版
- `report.png` - レポートのPNG画像

### GitHub Actions での定時実行

1. リポジトリの Settings > Secrets and variables > Actions で `OPENAI_API_KEY` を設定

2. Actions タブから手動実行、または毎日午前9時（JST）に自動実行

## ファイル構成

```
.
├── index.js              # メインスクリプト
├── package.json          # プロジェクト設定
├── systemprompt.md       # OpenAI用プロンプトとURL設定
├── .env.example          # 環境変数テンプレート
├── .gitignore           # Git除外設定
├── README.md            # このファイル
└── .github/
    └── workflows/
        └── generate-report.yml  # GitHub Actions設定
```

## カスタマイズ

### レポートフォーマットの変更

`systemprompt.md` を編集して、レポートの形式や内容をカスタマイズできます。

### スクレイピング対象の追加

金融データ、天気情報以外のサイトも追加可能です。必要に応じて `index.js` の `scrapeURL` 関数内のセレクタを調整してください。

## トラブルシューティング

### Playwrightのブラウザがインストールされない場合

```bash
npx playwright install chromium
```

### OpenAI APIエラー

- APIキーが正しく設定されているか確認
- APIの利用制限に達していないか確認
