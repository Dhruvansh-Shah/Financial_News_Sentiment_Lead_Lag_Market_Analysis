# Data Model: Lead-Lag Sentiment Analyser

**Branch**: `004-network-signals-notebook` | **Date**: 2026-04-20

---

## Pipeline Data Flow

```
notebook_01_data_collection.ipynb
  │
  ├─► data/raw_news.parquet        (news articles filtered + ticker-mapped)
  └─► data/raw_prices.parquet      (OHLCV + log_return, 2013–2020)

notebook_02_sentiment_analysis.ipynb
  reads:  data/raw_news.parquet
  │
  └─► data/sentiment_daily.parquet (daily composite sentiment per ticker/date)

notebook_03_granger_and_leadlag.ipynb
  reads:  data/sentiment_daily.parquet  (for Granger)
          data/raw_prices.parquet       (for cross-correlation AND Granger merge)
  │
  ├─► data/granger_results.parquet  (per-ticker Granger test results)
  └─► data/lead_lag_matrix.parquet  (N×N signed lead-lag scores)

notebook_04_network_and_signals.ipynb
  reads:  data/lead_lag_matrix.parquet
          data/granger_results.parquet
          data/sentiment_daily.parquet
  │
  ├─► data/cluster_assignments.parquet  (ticker → leader/follower + centrality)
  └─► outputs/network_graph.html        (interactive Plotly graph)
```

---

## Parquet Schemas

### `data/raw_news.parquet`

Produced by: notebook_01
Consumed by: notebook_02

| Column     | Type            | Nullable | Constraints |
| ---------- | --------------- | -------- | ----------- |
| `date`     | datetime64[ns]  | No       | NYSE trading day (no weekends/holidays) |
| `ticker`   | string          | No       | Must be in TICKERS list |
| `headline` | string          | No       | Original headline text |
| `source`   | string          | No       | One of: "Reuters", "Forbes", "Business Insider" |

Primary key: (`date`, `ticker`, `headline`) — a headline can match multiple tickers,
producing one row per match.

---

### `data/raw_prices.parquet`

Produced by: notebook_01
Consumed by: notebook_03

| Column       | Type           | Nullable | Constraints |
| ------------ | -------------- | -------- | ----------- |
| `date`       | datetime64[ns] | No       | NYSE trading day, 2013-01-01 to 2020-12-31 |
| `ticker`     | string         | No       | One of the resolved TICKERS |
| `open`       | float64        | No       | Daily open price |
| `high`       | float64        | No       | Daily high price |
| `low`        | float64        | No       | Daily low price |
| `close`      | float64        | No       | Daily close price |
| `volume`     | int64          | No       | Daily traded volume |
| `log_return` | float64        | Yes      | ln(close / prev_close); NaN on first trading day per ticker |

Primary key: (`date`, `ticker`)

---

### `data/sentiment_daily.parquet`

Produced by: notebook_02
Consumed by: notebook_03, notebook_04

| Column              | Type           | Nullable | Constraints |
| ------------------- | -------------- | -------- | ----------- |
| `date`              | datetime64[ns] | No       | NYSE trading day |
| `ticker`            | string         | No       | Present in raw_news.parquet |
| `sentiment_score`   | float64        | No       | Composite: 0.70*finbert + 0.30*lm; range [-1.0, +1.0] |
| `article_count`     | int64          | No       | Count of headlines in group; >= 1 |
| `avg_finbert_score` | float64        | No       | Mean FinBERT component; range [-1.0, +1.0] |
| `avg_lm_score`      | float64        | No       | Mean LM component; range [-1.0, +1.0] |

Primary key: (`date`, `ticker`) — one row per ticker per trading day.

Invariant: `abs(sentiment_score - (0.70*avg_finbert_score + 0.30*avg_lm_score)) < 1e-6`

**Coverage note**: Only tickers with at least one matching article appear here.
Tickers with no name-pattern matches in the Kaggle corpus are absent; they are
treated as `granger_verified=False` in notebook_03 and still appear in the
lead-lag matrix via the full price series.

---

### `data/granger_results.parquet`

Produced by: notebook_03
Consumed by: notebook_04

| Column          | Type    | Nullable | Constraints |
| --------------- | ------- | -------- | ----------- |
| `ticker`        | string  | No       | One per ticker in TICKERS |
| `granger_verified` | bool | No       | True if any p_lag_* < 0.05 |
| `optimal_lag`   | int64   | No       | Lag (1–5) with minimum p-value; set to 1 if all p-values null |
| `p_lag_1`       | float64 | Yes      | Granger F-test p-value at lag 1; null if skipped (< 50 obs) |
| `p_lag_2`       | float64 | Yes      | p-value at lag 2 |
| `p_lag_3`       | float64 | Yes      | p-value at lag 3 |
| `p_lag_4`       | float64 | Yes      | p-value at lag 4 |
| `p_lag_5`       | float64 | Yes      | p-value at lag 5 |

Primary key: `ticker` — exactly one row per ticker.

**Null policy**: All five `p_lag_*` columns are null when a ticker is skipped due
to fewer than 50 merged observations. `granger_verified` is `False` in that case.

**Data source for Granger**: Inner join of `sentiment_daily.parquet` and
`raw_prices.parquet` on (`date`, `ticker`). Series must have >= 50 rows after
joining and differencing (if non-stationary) to be tested.

---

### `data/lead_lag_matrix.parquet`

Produced by: notebook_03
Consumed by: notebook_04

**Shape**: N × N where N = number of tickers in TICKERS (up to 10).

**Storage format**: Wide DataFrame — row index is the leading ticker, column names
are the lagging tickers.

| Dimension | Type    | Description |
| --------- | ------- | ----------- |
| Row index | string  | Ticker i (potential leader) |
| Columns   | string  | Ticker j (potential follower) |
| Values    | float64 | `L(i,j) = sum(k * corr(k) for k in -10..10)` |

Diagonal: `L(i,i) = 0.0` (a ticker does not lead/lag itself).

Positive `L(i,j)` indicates ticker i tends to move before ticker j.
Negative `L(i,j)` indicates ticker j tends to move before ticker i.

**Data source for cross-correlation**: Full `raw_prices.parquet` `log_return`
series (all 2013–2020 trading days), independent of sentiment data. Two tickers'
series are aligned on shared dates before computing correlation.

---

### `data/cluster_assignments.parquet`

Produced by: notebook_04

| Column            | Type    | Nullable | Constraints |
| ----------------- | ------- | -------- | ----------- |
| `ticker`          | string  | No       | One per ticker in lead_lag_matrix |
| `cluster`         | string  | No       | Exactly "leader" or "follower" |
| `centrality_score`| float64 | No       | Eigenvector centrality in [0.0, 1.0]; degree centrality as fallback |

Primary key: `ticker` — exactly one row per ticker.

---

## Entity Relationships

```
SECTOR_MAP (in-memory, notebook_01)
  └─► TICKERS (list of 10 tickers derived from INPUT_TICKER)
        ├─► raw_news.parquet  (filtered by TICKERS)
        └─► raw_prices.parquet (fetched for TICKERS)

raw_news.parquet
  └─► sentiment_daily.parquet  (aggregated by date+ticker in notebook_02)

raw_prices.parquet + sentiment_daily.parquet
  └─► granger_results.parquet  (inner-join date+ticker window, notebook_03)

raw_prices.parquet
  └─► lead_lag_matrix.parquet  (full price series, notebook_03)

lead_lag_matrix.parquet + granger_results.parquet + sentiment_daily.parquet
  ├─► cluster_assignments.parquet  (notebook_04)
  └─► network_graph.html           (notebook_04)
```

---

## Name-to-Ticker Mapping Coverage

All 60 sector tickers have at least one company name pattern (see spec 001 for full
table). Patterns are case-insensitive word-boundary regex. Tickers not covered by
the name mapping (i.e., those present in TICKERS but not matched in any article)
will be absent from `sentiment_daily.parquet` and skipped for Granger testing, but
will appear in `lead_lag_matrix.parquet` via their price series.
