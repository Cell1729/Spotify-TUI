# Spotify-TUI

```bash
                                                                                ___   ___ 
    //   ) )                                 //  ) )          /__  ___/ //   / /   / /    
   ((         ___      ___    __  ___ ( ) __//__                / /    //   / /   / /     
     \\     //   ) ) //   ) )  / /   / /   //   //   / / ____  / /    //   / /   / /      
       ) ) //___/ / //   / /  / /   / /   //   ((___/ /       / /    //   / /   / /       
((___ / / //       ((___/ /  / /   / /   //        / /       / /    ((___/ / __/ /___
```

SpotifyをTUI、CLIでコントロールするアプリです。自分用途です。

## Demonstration

comming soon...

## インストール

1. このリポジトリを適当な場所にクローン（またはソースコードをダウンロード）します。
2. ターミナルでリポジトリのディレクトリに移動し、依存関係をインストールします。
   ```bash
   npm install
   ```
3. 以下のコマンドを実行して、システム全体で `spt` コマンドを使えるようにします。
   ```bash
   npm link
   ```
   ※ Windows の場合、`C:\Users\<ユーザー名>\AppData\Roaming\npm` に環境変数 PATH が通っている必要があります。

## 使い方

### 1. Spotify API キーの取得

[Spotify Dashboard](https://developer.spotify.com/dashboard) にアクセスしてアプリを作成し、`Client ID` と `Client Secret` を取得してください。
- `Redirect URI` には `http://127.0.0.1:8888/callback` を追加する必要があります。

### 2. 初回セットアップ

ターミナルで以下のコマンドを入力します。
```bash
spt -i
```
プロンプトに従って `Client ID` と `Client Secret` を入力すると、ブラウザが開いて認証が行われます。完了すると TUI が起動します。

### CLI Usage

`spt` の後ろに引数を指定することで、TUI を開かずに直接操作が可能です。

| Option | Action |
| ------ | ------ |
| `--help` | 引数（オプション）の一覧を表示 |
| `--play` | 再生開始 |
| `--stop` | 一時停止 |
| `--n` | 次の曲へスキップ |
| `--p` | 前の曲へ戻る |
| `v up [number]` | 音量を上げる (デフォルト10) |
| `v dw [number]` | 音量を下げる (デフォルト10) |
| `-i`, `--interactive` | TUI (インタラクティブモード) を起動 |

### Keybindings (TUI)

`~/.config/spt/config.json` を編集することで、キーバインドを自由にカスタマイズできます。

```json
{
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "redirectUri": "http://127.0.0.1:8888/callback",
  "accessToken": "...",
  "refreshToken": "...",
  "keybindings": {
    "quit": "q",
    "help": "?",
    "search": "/",
    "playPause": " ",
    "next": "n",
    "previous": "b",
    "volumeUp": "+",
    "volumeDown": "-",
    "enterSearch": "i",
    "focusPlaylists": "a",
    "focusArtists": "s",
    "focusPlayer": "d",
    "focusSearch": "f"
  }
}
```

## 開発

ソースコードからビルドしたり、機能を拡張したりする場合の手順です。

### 環境構築

1. リポジトリをクローンします。
2. 依存関係をインストールします。
   ```bash
   npm install
   ```
3. 開発モードで実行します。
   ```bash
   npm run dev -- -i
   ```

### グローバルコマンドとして登録 (npm link)

開発中のコードをシステム全体で `spt` として使いたい場合は、プロジェクトルートで以下を実行します。
```bash
npm link
```
これにより、独自のビルドなしで最新のソースコードをどこからでも実行できるようになります。
