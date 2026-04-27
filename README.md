# EVM Trainer

EVM (Earned Value Management) を脊髄反射で解けるようにする 100 本ノック。
React + Vite + Tailwind v4 + Recharts。サーバー不要、GitHub Pages にそのまま乗ります。

公開先: https://takah.github.io/evm-trainer/

## 出題モード

- **数値**: PV / EV / AC / BAC が与えられて、SV / CV / SPI / CPI / EAC / ETC / VAC のいずれか 1 つを答える
- **状況**: 数値から「遅延+超過」など 4 区分を判定（数字キー 1〜4 で選択）
- **グラフ**: PV / EV / AC の曲線を見て同じ 4 区分を判定
- **ミックス**: 上記をランダムに

成績はブラウザの LocalStorage に保存。カテゴリ別の正答率も出る（70% 未満は赤背景で「弱点」表示）。

## ローカルで動かす

```bash
npm install
npm run dev
```

## GitHub Pages へのデプロイ

1. GitHub のリポジトリ設定で **Settings → Pages → Build and deployment → Source = "GitHub Actions"** に変更
2. `main` に push すれば `.github/workflows/deploy.yml` が走り、`https://<user>.github.io/evm-trainer/` で公開されます

リポジトリ名を `evm-trainer` 以外にするときは `vite.config.js` の `base` を `'/<repo-name>/'` に書き換えてください。

## 操作

- **Enter**: 回答 / 次の問題へ
- **1〜4**: 状況・グラフ問題の選択肢
- **リセット**: ヘッダー右の「リセット」で成績を初期化

## 採点の許容誤差

- 比率系 (SPI / CPI): ±0.02
- 金額系 (SV / CV / EAC / ETC / VAC): ±2% または ±$500 のうち大きい方
