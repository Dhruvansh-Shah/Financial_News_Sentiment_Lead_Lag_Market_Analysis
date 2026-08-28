# Quickstart: Lead-Lag Sentiment Analyser

**Date**: 2026-04-20

---

## Prerequisites

- Python 3.10+ (VS Code) or Google Colab (Python 3.10+ pre-installed)
- Kaggle account with API access enabled

---

## Step 1: Credentials

Create a `.env` file at the project root:

```
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_api_key
```

Find your Kaggle credentials at: Account → API → Create New Token.
Do **not** commit `.env` to version control.

---

## Step 2: Install Dependencies

**VS Code (once per environment)**:

```bash
pip install python-dotenv pandas pyarrow numpy \
            kaggle yfinance pandas-market-calendars \
            torch transformers lm-ssc tqdm \
            statsmodels scipy seaborn matplotlib \
            networkx python-louvain plotly
```

**Google Colab**: Each notebook starts with a `%pip install` cell for its specific
dependencies — no manual setup required beyond uploading `.env`.

---

## Step 3: Run the Notebooks in Order

Each notebook is independent (re-runnable from cell 1) but requires the outputs of
prior notebooks as Parquet checkpoints.

### notebook_01_data_collection.ipynb

1. Open the notebook.
2. Set `INPUT_TICKER = "AAPL"` (or any ticker in the sector map) in the first cell.
3. Run all cells.
4. **Outputs**: `data/raw_news.parquet`, `data/raw_prices.parquet`
5. **Verify**: Printed summary shows headline count per ticker and price date range.

*First run downloads the Kaggle dataset (~1 GB). Subsequent runs skip the download.*

### notebook_02_sentiment_analysis.ipynb

1. Open the notebook.
2. Run all cells. No configuration required.
3. **Outputs**: `data/sentiment_daily.parquet`
4. **Verify**: Device selection printed at start; total headlines and date range
   printed at end.

*FinBERT model (~500 MB) is downloaded from HuggingFace on first run and cached.*
*Scoring takes ~5 min on GPU/MPS, ~30 min on CPU.*

### notebook_03_granger_and_leadlag.ipynb

1. Open the notebook.
2. Run all cells. No configuration required.
3. **Outputs**: `data/granger_results.parquet`, `data/lead_lag_matrix.parquet`
4. **Verify**: Granger results table and lead-lag heatmap rendered inline.

### notebook_04_network_and_signals.ipynb

1. Open the notebook.
2. Set `INPUT_TICKER = "AAPL"` (must match notebook_01 value) in the first cell.
3. Run all cells.
4. **Outputs**: `data/cluster_assignments.parquet`, `outputs/network_graph.html`
5. **Verify**: Suggestion table and plain-language paragraph printed inline;
   open `outputs/network_graph.html` in a browser to view the interactive graph.

---

## Directory Layout After Full Run

```
data/
├── raw_news.parquet
├── raw_prices.parquet
├── sentiment_daily.parquet
├── granger_results.parquet
├── lead_lag_matrix.parquet
└── cluster_assignments.parquet

outputs/
└── network_graph.html
```

---

## Changing the Input Ticker

1. Re-run **notebook_01** with the new `INPUT_TICKER` value.
2. Re-run **notebook_02** (processes all tickers in the new news file automatically).
3. Re-run **notebook_03** (no configuration change needed).
4. Re-run **notebook_04** with the same `INPUT_TICKER` value.

All output files are overwritten on each run. No cleanup step is required.

---

## Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `401 Unauthorized` on Kaggle download | Invalid credentials in `.env` | Check KAGGLE_USERNAME and KAGGLE_KEY at kaggle.com/settings |
| `FileNotFoundError: data/raw_news.parquet` | notebook_02 run before notebook_01 | Run notebook_01 first |
| FinBERT inference very slow | Running on CPU | Normal; expected ~30 min for full corpus |
| `INPUT_TICKER not found in lead-lag matrix` | notebook_04 ticker differs from notebook_01 | Set identical INPUT_TICKER in both notebooks |
| Network graph shows all followers | Louvain found one community | Thin data or weak lead-lag signals; warning printed in notebook_04 |
