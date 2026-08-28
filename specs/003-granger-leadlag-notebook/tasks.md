---
description: "Task list for notebook_03_granger_and_leadlag.ipynb"
---

# Tasks: Granger Causality and Lead-Lag Notebook (notebook_03)

**Input**: Design documents from `specs/003-granger-leadlag-notebook/`
**Prerequisites**: spec.md (required)
**Dependency**: `data/raw_prices.parquet` (notebook_01) and `data/sentiment_daily.parquet` (notebook_02)

**Note on spec vs prompt discrepancies**:
- Spec FR-007 specifies `p_lag_1`–`p_lag_5` as columns; user prompt also requests `min_p_value`. Both are included.
- Spec says minimum 50 rows for Granger; user prompt says 60. **60 rows** is used (user prompt takes precedence).
- Spec uses `granger_verified = False` for insufficient data; user prompt uses `insufficient_data` label. `granger_verified = False` is stored in the parquet; a `skip_reason` column captures `"insufficient_data"`.

**Organization**: Tasks map directly to notebook cells in execution order, grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Create the notebook file.

- [x] T001 Create `notebook_03_granger_and_leadlag.ipynb` at repository root as an empty Jupyter notebook with kernel spec `python3`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Install dependencies, load and validate both input files, merge them — required before any analysis can begin.

- [x] T002 Add Cell 1 in `notebook_03_granger_and_leadlag.ipynb`: `%pip install -q pandas pyarrow numpy statsmodels seaborn matplotlib`
- [x] T003 Add Cell 2 in `notebook_03_granger_and_leadlag.ipynb`: load and validate inputs — `import pandas as pd, numpy as np, os` and `from pathlib import Path`; for each of `"data/raw_prices.parquet"` and `"data/sentiment_daily.parquet"`: if not `Path(f).exists()` raise `FileNotFoundError(f"{f} not found — run notebook_0{1 or 2} first")`; load both: `df_prices = pd.read_parquet("data/raw_prices.parquet")`, `df_sentiment = pd.read_parquet("data/sentiment_daily.parquet")`; print shape and column names of each
- [x] T004 Add Cell 3 in `notebook_03_granger_and_leadlag.ipynb`: merge and prepare — inner join `df_prices` and `df_sentiment` on `["date", "ticker"]`; assign result to `df_merged`; ensure `date` column is `datetime64` via `pd.to_datetime`; sort by `["ticker", "date"]` and reset index; extract `TICKERS = sorted(df_merged["ticker"].unique().tolist())`; print `f"Merged dataset: {len(df_merged)} rows, {len(TICKERS)} tickers"`

**Checkpoint**: Input data loaded and merged — stationarity and Granger testing can begin.

---

## Phase 3: User Story 1 — Stationarity Tests and Granger Causality (Priority: P1)

**Goal**: ADF stationarity test per ticker with differencing if needed, Granger causality per ticker at lags 1–5, save `data/granger_results.parquet`.

**Independent Test**: After all cells run, `data/granger_results.parquet` exists with columns `ticker`, `granger_verified`, `optimal_lag`, `min_p_value`, `p_value_lag1`–`p_value_lag5`, `skip_reason`. One row per ticker, zero nulls in `ticker`/`granger_verified`/`optimal_lag`. For any ticker with `granger_verified = True`, at least one of `p_value_lag1`–`p_value_lag5` is below 0.05.

### Implementation for User Story 1

- [x] T005 [US1] Add Cell 4 in `notebook_03_granger_and_leadlag.ipynb`: ADF stationarity test — `from statsmodels.tsa.stattools import adfuller`; define `def run_adf(series)` that: drops NaN from series; if `len(series) < 2` returns `(np.nan, np.nan, False)`; calls `adfuller(series, autolag="AIC")`; returns `(adf_stat, p_value, p_value < 0.05)`; iterate over `TICKERS`, call `run_adf(df_merged.loc[df_merged["ticker"]==t, "log_return"])`, collect into `adf_records` list of dicts with keys `ticker`, `adf_statistic`, `p_value`, `is_stationary`; `df_adf = pd.DataFrame(adf_records)`; print `df_adf.to_string(index=False)`; wrap in try-except that prints `[ERROR] ExceptionType: message` and `raise SystemExit(1) from None`
- [x] T006 [US1] Add Cell 5 in `notebook_03_granger_and_leadlag.ipynb`: Granger causality loop — `from statsmodels.tsa.stattools import grangercausalitytests`; define `MIN_ROWS = 60`; `MAXLAG = 5`; iterate over `TICKERS`; for each ticker: get `sub = df_merged[df_merged["ticker"] == t][["log_return", "sentiment_score"]].copy()`; if `df_adf.loc[df_adf["ticker"]==t, "is_stationary"].values[0] == False`: apply `.diff()` to `sub["log_return"]`; `sub = sub.dropna()`; if `len(sub) < MIN_ROWS`: print warning `f"WARNING: {t} has {len(sub)} rows — skipping (insufficient_data)"`; append record with `granger_verified=False, optimal_lag=None, min_p_value=None, p_lag_1..p_lag_5=None, skip_reason="insufficient_data"`; continue; run `results = grangercausalitytests(sub[["log_return","sentiment_score"]], maxlag=MAXLAG, verbose=False)`; extract p-values: `p_vals = {lag: results[lag][0]["ssr_ftest"][1] for lag in range(1, MAXLAG+1)}`; `min_p = min(p_vals.values())`; `opt_lag = min(p_vals, key=p_vals.get)`; append record with `granger_verified=(min_p < 0.05), optimal_lag=opt_lag, min_p_value=min_p, p_lag_1=p_vals[1], p_lag_2=p_vals[2], p_lag_3=p_vals[3], p_lag_4=p_vals[4], p_lag_5=p_vals[5], skip_reason=None`; assign `df_granger = pd.DataFrame(granger_records)`; wrap entire cell in try-except with `[ERROR]` print and `raise SystemExit(1) from None`
- [x] T007 [US1] Add Cell 6 in `notebook_03_granger_and_leadlag.ipynb`: save Granger results — `os.makedirs("data", exist_ok=True)`; enforce column order `["ticker","granger_verified","optimal_lag","min_p_value","p_lag_1","p_lag_2","p_lag_3","p_lag_4","p_lag_5","skip_reason"]`; `df_granger.to_parquet("data/granger_results.parquet", index=False)`; print `f"Saved data/granger_results.parquet — {len(df_granger)} rows"`; wrap in try-except

**Checkpoint**: User Story 1 independently testable — reload parquet and check one ticker's `granger_verified` against its p-values.

---

## Phase 4: User Story 2 — Pairwise Lead-Lag Matrix (Priority: P2)

**Goal**: For all ordered ticker pairs compute cross-correlation at lags −10 to +10 on the full `raw_prices.parquet` series, compute `L(i,j) = sum(k * corr(k) for k in -10..10)`, save `data/lead_lag_matrix.parquet` as N×N DataFrame with ticker row/column labels.

**Independent Test**: Load `data/lead_lag_matrix.parquet`. Verify shape is `(N, N)`, all diagonal entries are 0.0, and at least one off-diagonal is non-zero.

### Implementation for User Story 2

- [x] T008 [US2] Add Cell 7 in `notebook_03_granger_and_leadlag.ipynb`: cross-correlation function — `df_prices_full = pd.read_parquet("data/raw_prices.parquet")`; ensure `date` is `datetime64`; pivot to wide format with `df_pivot = df_prices_full.pivot(index="date", columns="ticker", values="log_return")`; define `def lead_lag_score(s_i, s_j)`: `combined = pd.DataFrame({"i": s_i, "j": s_j}).dropna()`; if `len(combined) < 2`: return `0.0`; `n = len(combined)`; `score = 0.0`; for `k` in `range(-10, 11)`: `corr = combined["i"].corr(combined["j"].shift(k))` if not NaN else 0.0; `score += k * corr / n`; return `score`; print `"lead_lag_score defined"`; wrap in try-except
- [x] T009 [US2] Add Cell 8 in `notebook_03_granger_and_leadlag.ipynb`: compute full N×N matrix — import `from tqdm import tqdm` (add to pip install note: tqdm already installed from nb02); `matrix = {i: {} for i in TICKERS}`; for each ordered pair `(ti, tj)` in `[(i,j) for i in TICKERS for j in TICKERS]` with tqdm outer loop over `TICKERS`: for each `tj` in `TICKERS`: if `ti == tj`: `matrix[ti][tj] = 0.0`; else if `ti` not in `df_pivot.columns` or `tj` not in `df_pivot.columns`: print warning; `matrix[ti][tj] = 0.0`; else: `matrix[ti][tj] = lead_lag_score(df_pivot[ti], df_pivot[tj])`; `df_ll = pd.DataFrame(matrix, index=TICKERS, columns=TICKERS)`; print `f"Lead-lag matrix shape: {df_ll.shape}"`; print `f"Diagonal sum (should be 0): {df_ll.values.diagonal().sum():.4f}"`; wrap in try-except
- [x] T010 [US2] Add Cell 9 in `notebook_03_granger_and_leadlag.ipynb`: save lead-lag matrix — `os.makedirs("data", exist_ok=True)`; `df_ll.to_parquet("data/lead_lag_matrix.parquet")`; print `f"Saved data/lead_lag_matrix.parquet — {df_ll.shape[0]}x{df_ll.shape[1]} matrix"`; wrap in try-except

**Checkpoint**: User Story 2 independently testable — reload parquet, check shape, diagonal, off-diagonal non-zero.

---

## Phase 5: User Story 3 — Results Table and Heatmap (Priority: P3)

**Goal**: Print a formatted Granger results table and render the lead-lag matrix as an inline seaborn heatmap.

**Independent Test**: Run display cells — verify (a) tabular output with `ticker`, `granger_verified`, `optimal_lag`, and p-value at optimal lag; (b) diverging-colour heatmap with labelled axes rendered inline.

### Implementation for User Story 3

- [x] T011 [US3] Add Cell 10 in `notebook_03_granger_and_leadlag.ipynb`: Granger results table — reload: `df_gr = pd.read_parquet("data/granger_results.parquet")`; build display frame: `df_display = df_gr[["ticker","granger_verified","optimal_lag","min_p_value","skip_reason"]].copy()`; `df_display["min_p_value"] = df_display["min_p_value"].map(lambda x: f"{x:.4f}" if pd.notna(x) else "—")`; print header `"\n=== Granger Causality Results ==="` then `df_display.to_string(index=False)`; also print summary counts: `verified = df_gr["granger_verified"].sum()`; print `f"\n{verified}/{len(df_gr)} tickers show Granger-verified sentiment lead"`; wrap in try-except
- [x] T012 [US3] Add Cell 11 in `notebook_03_granger_and_leadlag.ipynb`: seaborn heatmap — `import seaborn as sns`; `import matplotlib.pyplot as plt`; `df_ll_plot = pd.read_parquet("data/lead_lag_matrix.parquet")`; `fig, ax = plt.subplots(figsize=(12, 10))`; `sns.heatmap(df_ll_plot, cmap="RdBu_r", center=0, annot=True, fmt=".3f", linewidths=0.5, ax=ax)`; `ax.set_title("Lead-Lag Matrix: L(i,j) = Σ k·corr(k), lags −10 to +10", fontsize=13)`; `ax.set_xlabel("Lags Behind →")`; `ax.set_ylabel("← Leads")`; `plt.tight_layout()`; `plt.show()`; wrap in try-except

**Checkpoint**: User Story 3 independently testable — table and heatmap both visible in notebook output.

---

## Phase 6: Polish

- [x] T013 [P] Verify `.gitignore` at repository root contains `data/` and `outputs/` entries (already present; no change needed if present)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 (Phase 3)**: Depends on Phase 2 (merged data available)
- **US2 (Phase 4)**: Depends on Phase 2 (prices available) — independent of US1
- **US3 (Phase 5)**: Depends on US1 (granger_results.parquet) and US2 (lead_lag_matrix.parquet)
- **Polish (Phase 6)**: Depends on all phases complete

### Parallel Opportunities

```text
Phase 1 → Phase 2 (T002→T003→T004 sequential) → US1 (T005→T006→T007) ─┐
                                                → US2 (T008→T009→T010) ─┤→ US3 → Polish
```

T005–T007 (Granger) and T008–T010 (lead-lag) can be developed in parallel as they use different data sources.

---

## Implementation Strategy

### MVP (Minimum: US1 + US2)

1. T001–T004 (setup + data load)
2. T005–T007 (ADF + Granger + save)
3. T008–T010 (cross-correlation + save)
4. T011–T012 (display)
5. Validate: reload both parquets, check schemas

### Full delivery order

1. T001–T004: environment + data merge
2. T005–T007: stationarity + Granger (US1)
3. T008–T010: lead-lag matrix (US2)
4. T011–T012: display (US3)
5. T013: gitignore check

---

## Notes

- `grangercausalitytests` returns a dict keyed by lag int; p-value is at `results[lag][0]["ssr_ftest"][1]` (index 1 is p-value of the F-test)
- ADF null hypothesis: series has a unit root (non-stationary). Reject (p < 0.05) = stationary
- The minimum rows threshold is **60** (overrides spec's 50 — user prompt is authoritative)
- `lead_lag_score` uses `series.shift(k)` — positive k means j is shifted forward (i leads j when score is positive)
- Cross-correlation normalised by series length `n` per the spec: `score += k * corr / n`
- tqdm is available from notebook_02's pip install; include in T002 install cell regardless for standalone operation
- Constitution Principle IV: Granger p-values MUST be stored so downstream notebook can verify causality claims
