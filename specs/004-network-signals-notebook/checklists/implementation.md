# Implementation Checklist: Lead-Lag Sentiment Analyser (All Four Notebooks)

**Purpose**: Per-notebook verification of files saved, outputs printed, and observable results — every item is a single checkable thing.
**Created**: 2026-04-20
**Feature**: [plan.md](../plan.md) | [data-model.md](../data-model.md)

---

## notebook_01 — Data Collection

### Environment and Credentials

- [ ] CHK001 `.env` file exists at project root containing `KAGGLE_USERNAME` and `KAGGLE_KEY`
- [ ] CHK002 `python-dotenv`, `kaggle`, `yfinance`, `pandas-market-calendars` are installed

### Ticker Resolution

- [ ] CHK003 `INPUT_TICKER = "AAPL"` resolves `TICKERS` to exactly 10 technology sector tickers (`AAPL MSFT GOOGL AMZN META NFLX AMD TSLA NVDA INTC`)
- [ ] CHK004 `INPUT_TICKER = "JPM"` resolves `TICKERS` to exactly 10 finance sector tickers with `JPM` first
- [ ] CHK005 `INPUT_TICKER = "UNKNOWN"` resolves `TICKERS` to the default fallback list of exactly 10 tickers
- [ ] CHK006 No ticker appears more than once in `TICKERS` regardless of `INPUT_TICKER` value

### News Ingestion

- [ ] CHK007 `data/raw_news.parquet` is created and non-empty after running all cells
- [ ] CHK008 `data/raw_news.parquet` has exactly four columns: `date`, `ticker`, `headline`, `source`
- [ ] CHK009 `source` column contains only the values `"Reuters"`, `"Forbes"`, `"Business Insider"` — zero other values
- [ ] CHK010 `ticker` column contains only values from the resolved `TICKERS` list — zero other values
- [ ] CHK011 Zero rows in `data/raw_news.parquet` where `date` is a Saturday, Sunday, or NYSE holiday
- [ ] CHK012 A headline mentioning two tickers in `TICKERS` produces two separate rows in the output (one per ticker)

### Price Ingestion

- [ ] CHK013 `data/raw_prices.parquet` is created and non-empty after running all cells
- [ ] CHK014 `data/raw_prices.parquet` contains columns `date`, `ticker`, `open`, `high`, `low`, `close`, `volume`, `log_return`
- [ ] CHK015 `log_return` column contains `NaN` only on the first trading day per ticker — zero other nulls
- [ ] CHK016 If yfinance returns no data for a ticker, a warning is printed and the notebook continues without raising an exception

### Summary Output

- [ ] CHK017 A printed summary appears after all cells run showing headline count per ticker
- [ ] CHK018 The same printed summary shows the min and max date in `data/raw_prices.parquet`

---

## notebook_02 — Sentiment Scoring

### Setup

- [ ] CHK019 `torch`, `transformers`, `lm-ssc`, `tqdm` are installed
- [ ] CHK020 A device-selection message is printed before any headline is scored (e.g., `"Using device: cpu"` or `"Using device: mps"`)
- [ ] CHK021 The FinBERT model loads without error (downloads on first run, uses cache thereafter)
- [ ] CHK022 The Loughran-McDonald word lists load without error before any scoring begins

### Scoring Output

- [ ] CHK023 `data/sentiment_daily.parquet` is created and non-empty after running all cells
- [ ] CHK024 `data/sentiment_daily.parquet` has exactly six columns: `date`, `ticker`, `sentiment_score`, `article_count`, `avg_finbert_score`, `avg_lm_score`
- [ ] CHK025 Zero null values exist in any column of `data/sentiment_daily.parquet`
- [ ] CHK026 All values in `sentiment_score` are within the closed interval `[-1.0, +1.0]`
- [ ] CHK027 All values in `avg_finbert_score` are within `[-1.0, +1.0]`
- [ ] CHK028 All values in `avg_lm_score` are within `[-1.0, +1.0]`
- [ ] CHK029 For every row: `abs(sentiment_score - (0.70 * avg_finbert_score + 0.30 * avg_lm_score)) < 1e-6` (spot-check three rows)
- [ ] CHK030 A ticker/date group with one headline produces `article_count = 1` and `sentiment_score` equal to that headline's composite score

### Error Handling

- [ ] CHK031 Empty or null headlines are skipped silently — no unhandled exception is raised
- [ ] CHK032 Running with a missing `data/raw_news.parquet` raises a clear error naming the missing file before any scoring begins

### Summary Output

- [ ] CHK033 A printed summary after all cells shows total headlines successfully processed
- [ ] CHK034 The same printed summary shows the earliest and latest `date` values in `data/sentiment_daily.parquet`

---

## notebook_03 — Granger Causality and Lead-Lag

### Setup

- [ ] CHK035 `statsmodels`, `scipy`, `seaborn`, `matplotlib` are installed
- [ ] CHK036 Running with a missing `data/sentiment_daily.parquet` raises a clear error naming the missing file

### Stationarity and Granger

- [ ] CHK037 `data/granger_results.parquet` is created with exactly one row per ticker after all cells run
- [ ] CHK038 `data/granger_results.parquet` has columns `ticker`, `granger_verified`, `optimal_lag`, `p_lag_1`, `p_lag_2`, `p_lag_3`, `p_lag_4`, `p_lag_5`
- [ ] CHK039 `ticker`, `granger_verified`, and `optimal_lag` columns contain zero null values
- [ ] CHK040 `granger_verified` is `True` for a given ticker if and only if at least one of `p_lag_1`–`p_lag_5` is below 0.05
- [ ] CHK041 `optimal_lag` equals the lag number corresponding to the minimum value among `p_lag_1`–`p_lag_5` for each ticker
- [ ] CHK042 All five `p_lag_*` columns are null for any ticker that had fewer than 50 merged observations, and `granger_verified` is `False` for that ticker
- [ ] CHK043 A ticker with a non-stationary `log_return` series (ADF p >= 0.05) is differenced before Granger testing, and a note is printed for that ticker

### Lead-Lag Matrix

- [ ] CHK044 `data/lead_lag_matrix.parquet` is created with shape `(N, N)` where N equals the number of tickers
- [ ] CHK045 Row index and column labels of `data/lead_lag_matrix.parquet` are identical to the TICKERS list
- [ ] CHK046 All diagonal entries `L(i,i)` equal exactly `0.0`
- [ ] CHK047 At least one off-diagonal entry is non-zero
- [ ] CHK048 Two tickers with no shared price dates produce `L(i,j) = 0.0` and a printed warning

### Display Output

- [ ] CHK049 A Granger results table is printed inline showing at minimum `ticker`, `granger_verified`, `optimal_lag`, and the p-value at the optimal lag
- [ ] CHK050 A colour heatmap of the lead-lag matrix is rendered inline with a diverging colour scale (positive and negative values in distinct colours) and ticker labels on both axes

---

## notebook_04 — Network Graph and Signals

### Setup

- [ ] CHK051 `networkx`, `python-louvain`, `plotly` are installed
- [ ] CHK052 Running with a missing `data/lead_lag_matrix.parquet` raises a clear error naming the missing file
- [ ] CHK053 Setting `INPUT_TICKER` to a value not present in the lead-lag matrix raises a clear error before graph construction begins

### Clustering

- [ ] CHK054 `data/cluster_assignments.parquet` is created with exactly one row per ticker after all cells run
- [ ] CHK055 `data/cluster_assignments.parquet` has columns `ticker`, `cluster`, `centrality_score`
- [ ] CHK056 `cluster` column contains only the values `"leader"` and `"follower"` — zero other values
- [ ] CHK057 Zero null values exist in any column of `data/cluster_assignments.parquet`
- [ ] CHK058 All `centrality_score` values are within `[0.0, 1.0]`
- [ ] CHK059 When Louvain returns more than two partitions, all non-maximum-net-outflow partitions are merged into `"follower"` with no exception raised
- [ ] CHK060 When Louvain returns exactly one partition, all tickers are assigned `"follower"` and a warning is printed

### Network Graph

- [ ] CHK061 `outputs/network_graph.html` is created and is a non-empty file after all cells run
- [ ] CHK062 Running the notebook twice with identical `INPUT_TICKER` produces the same `cluster_assignments.parquet` cluster labels (deterministic Louvain — acceptable if `random_state` not set; layout is deterministic due to seed 42)
- [ ] CHK063 No edges appear in the graph for ticker pairs where `|L(i,j)| <= 0.05`

### Suggestion Output

- [ ] CHK064 A suggestion table is printed inline with at least one row and columns for related ticker, lead-lag score, and optimal lag
- [ ] CHK065 When `INPUT_TICKER` is a leader, the suggestion table lists follower tickers sorted by descending absolute `L` score
- [ ] CHK066 When `INPUT_TICKER` is a follower, the suggestion table lists leader tickers sorted by descending absolute `L` score
- [ ] CHK067 A plain-language paragraph is printed naming `INPUT_TICKER` by symbol and stating its role ("leader" or "follower")
- [ ] CHK068 The plain-language paragraph explicitly states whether `granger_verified` was `True` or `False` for `INPUT_TICKER`
- [ ] CHK069 When `granger_verified` is `False`, the paragraph includes a caution statement

---

## End-to-End Integration: INPUT_TICKER = AAPL

- [ ] CHK070 Set `INPUT_TICKER = "AAPL"` in notebook_01; run all cells; `data/raw_news.parquet` and `data/raw_prices.parquet` are both created
- [ ] CHK071 Run notebook_02 on the above outputs; `data/sentiment_daily.parquet` is created with zero null values
- [ ] CHK072 Run notebook_03; `data/granger_results.parquet` and `data/lead_lag_matrix.parquet` are both created
- [ ] CHK073 Set `INPUT_TICKER = "AAPL"` in notebook_04; run all cells; `data/cluster_assignments.parquet` and `outputs/network_graph.html` are both created
- [ ] CHK074 Open `outputs/network_graph.html` in a browser — the interactive network graph renders with nodes visible, coloured in steel-blue (leaders) and dark-orange (followers), ticker labels displayed on nodes, and pan/zoom/hover interactions working

## Notes

- Check items off as completed: change `[ ]` to `[x]`
- Null/empty parquet file checks: `import pandas as pd; df = pd.read_parquet('data/raw_news.parquet'); assert len(df) > 0`
- Column check: `assert list(df.columns) == ['date','ticker','headline','source']`
- Range check: `assert df['sentiment_score'].between(-1.0, 1.0).all()`
- Items are numbered CHK001–CHK074 for traceability
