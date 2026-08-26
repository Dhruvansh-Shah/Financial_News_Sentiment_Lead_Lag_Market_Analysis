# Feature Specification: Granger Causality and Lead-Lag Notebook (notebook_03)

**Feature Branch**: `003-granger-leadlag-notebook`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "notebook_03_granger_and_leadlag.ipynb — ADF stationarity tests, Granger causality, and cross-correlation lead-lag matrix"

## Clarifications

### Session 2026-04-20

- Q: How should the `p_values` per-lag data be stored in Parquet (dict, JSON string, or separate columns)? → A: Five separate scalar float columns: `p_lag_1`, `p_lag_2`, `p_lag_3`, `p_lag_4`, `p_lag_5`.
- Q: What is the minimum observations threshold before running the Granger test? → A: 50 observations (raised from 30); tickers below this threshold are skipped with a warning and recorded as `granger_verified = False`.
- Q: Should cross-correlation for the lead-lag matrix use the full price series or only the sentiment-merged date window? → A: Full price series from `raw_prices.parquet` (all trading days 2013–2020); the sentiment merge is used only for Granger inputs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Verify Stationarity and Run Granger Causality Tests (Priority: P1)

An analyst runs the notebook after notebooks 01 and 02 have produced their output
files. The notebook checks whether each ticker's return series is stationary, applies
differencing where needed, then tests whether past sentiment scores have statistically
significant predictive power over future price returns for each ticker. Results are
saved as a structured file so they can be referenced in the visualisation notebook.

**Why this priority**: Constitution Principle IV requires that Granger causality is
verified before any causal claim is surfaced to the user. This is the notebook that
performs that gate check. No downstream output is valid without it.

**Independent Test**: With `data/raw_prices.parquet` and `data/sentiment_daily.parquet`
present, run all cells. Verify `data/granger_results.parquet` is created with
columns `ticker`, `granger_verified`, `optimal_lag`, `p_values`. Spot-check one
ticker: confirm `granger_verified` is `True` if any value in `p_values` is below
0.05, and `optimal_lag` matches the lag key with the minimum p-value.

**Acceptance Scenarios**:

1. **Given** a ticker whose return series fails the ADF test (non-stationary),
   **When** the stationarity cell runs,
   **Then** the series is differenced once before being passed to the Granger test,
   and `is_stationary` is recorded as `False` in the ADF results.
2. **Given** a ticker with at least one Granger p-value below 0.05 across lags 1–5,
   **When** the Granger cell completes,
   **Then** `granger_verified` is `True` and `optimal_lag` equals the lag number
   with the lowest p-value.
3. **Given** a ticker where no Granger p-value is below 0.05,
   **When** the Granger cell completes,
   **Then** `granger_verified` is `False` and `optimal_lag` still records the lag
   with the minimum observed p-value.
4. **Given** all tickers have been tested,
   **When** the save cell runs,
   **Then** `data/granger_results.parquet` contains exactly one row per ticker and
   zero null values in any column.

---

### User Story 2 — Compute Pairwise Lead-Lag Matrix (Priority: P2)

The analyst runs the lead-lag computation cells. For every ordered pair of tickers
the notebook computes a signed lead-lag score from the cross-correlation of their
return series over lags −10 to +10 trading days. The full matrix is saved as a
Parquet file for use by the visualisation notebook.

**Why this priority**: The lead-lag matrix is the core analytical product of the
pipeline. It drives the Louvain clustering and network graph in notebook_04. Without
it the final output cannot be produced.

**Independent Test**: Load `data/lead_lag_matrix.parquet`. Verify it is a square
matrix with one row and one column per ticker in `TICKERS`, that the diagonal
entries are zero (a ticker does not lead/lag itself), and that at least one
off-diagonal entry is non-zero.

**Acceptance Scenarios**:

1. **Given** two tickers with aligned return series,
   **When** the cross-correlation cell runs,
   **Then** the normalised cross-correlation values at lags −10 to +10 sum to
   produce the scalar `L(i,j) = sum(k * corr(k) for k in -10..10)`.
2. **Given** the full ticker universe,
   **When** the matrix save cell runs,
   **Then** `data/lead_lag_matrix.parquet` has shape `(N, N)` where N is the number
   of tickers, with tickers as both row and column labels.
3. **Given** a pair `(i, j)` where ticker i leads ticker j,
   **When** the score is inspected,
   **Then** `L(i,j)` is positive and `L(j,i)` is negative (anti-symmetric property
   is expected but not strictly enforced — document any deviation in Assumptions).

---

### User Story 3 — Display Results as Printed Table and Heatmap (Priority: P3)

The analyst reviews the results inline in the notebook. The Granger results are
displayed as a human-readable table and the lead-lag matrix is rendered as a colour
heatmap, both shown inline without requiring any external viewer.

**Why this priority**: Constitution Principle V requires that results include a
human-readable output. The heatmap and table serve as the intermediate review step
before the final plain-language summary in notebook_04.

**Independent Test**: Run the display cells. Verify that: (a) a tabular summary of
`granger_results.parquet` is printed inline showing at minimum `ticker`,
`granger_verified`, and `optimal_lag`; (b) a colour heatmap of the lead-lag matrix
is rendered inline in the notebook output.

**Acceptance Scenarios**:

1. **Given** `data/granger_results.parquet` is loaded,
   **When** the display cell runs,
   **Then** a table is printed with one row per ticker showing `ticker`,
   `granger_verified`, `optimal_lag`, and the p-value at `optimal_lag`.
2. **Given** `data/lead_lag_matrix.parquet` is loaded,
   **When** the heatmap cell runs,
   **Then** a diverging colour scale is used (positive = one colour, negative =
   another), ticker labels are shown on both axes, and the chart title identifies
   it as the lead-lag matrix.

---

### Edge Cases

- What if `data/sentiment_daily.parquet` is missing? The notebook MUST raise a
  clear error identifying the missing file before any computation begins.
- What if a ticker has fewer than 50 data points after merging and differencing?
  The Granger test MUST be skipped for that ticker with a printed warning; it MUST
  still appear in `granger_results.parquet` with `granger_verified = False` and
  null p-values.
- What if two tickers have no overlapping dates after alignment? The lead-lag score
  for that pair MUST be set to 0.0 and a warning printed.
- What if the ADF test raises an exception for a ticker (e.g., constant series)?
  The notebook MUST catch the exception, record `is_stationary = False`, and
  proceed with differencing.
- What if `data/granger_results.parquet` or `data/lead_lag_matrix.parquet` already
  exist? Both MUST be overwritten without prompting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The notebook MUST read `data/raw_prices.parquet` and
  `data/sentiment_daily.parquet` as inputs; if either file is missing, the notebook
  MUST raise an error identifying the missing file before any computation.
- **FR-002**: The notebook MUST merge the two input files on `date` and `ticker`.
- **FR-003**: For each ticker, the notebook MUST run the Augmented Dickey-Fuller
  (ADF) test on the `log_return` series and record `adf_statistic`, `p_value`, and
  `is_stationary` (True if ADF p-value is below 0.05).
- **FR-004**: If a ticker's `log_return` series is non-stationary (ADF p >= 0.05),
  the notebook MUST apply first-order differencing before passing it to the Granger
  test.
- **FR-005**: For each ticker, the notebook MUST run the Granger causality test
  testing whether past `sentiment_score` values predict `log_return`, at integer
  lags 1 through 5 inclusive, with verbose output suppressed.
- **FR-006**: The notebook MUST record the Granger p-value for each lag (1–5) per
  ticker; `granger_verified` MUST be `True` if any p-value is below 0.05;
  `optimal_lag` MUST be the lag with the minimum p-value.
- **FR-007**: The notebook MUST save `data/granger_results.parquet` with columns:
  `ticker`, `granger_verified`, `optimal_lag`, `p_lag_1`, `p_lag_2`, `p_lag_3`,
  `p_lag_4`, `p_lag_5` — one scalar float column per tested lag (lags 1–5).
- **FR-008**: For every ordered pair `(i, j)` of tickers, the notebook MUST compute
  the lead-lag score `L(i,j)` as the weighted sum of normalised cross-correlation
  values at integer lags −10 to +10, where the weight for each lag is the lag index
  k: `L(i,j) = sum(k * corr(k) for k in range(-10, 11))`. Cross-correlation MUST
  be computed on the full `log_return` series from `data/raw_prices.parquet`
  (all available trading days), independent of the sentiment merge used for Granger.
- **FR-009**: Before computing cross-correlation, the notebook MUST align the two
  ticker return series on their shared trading dates from `raw_prices.parquet`,
  dropping any rows where either series has a NaN value. The sentiment-merged
  dataset is NOT used as the source for cross-correlation inputs.
- **FR-010**: The notebook MUST save the full N×N lead-lag matrix as
  `data/lead_lag_matrix.parquet` with tickers as both row index and column labels.
- **FR-011**: The notebook MUST print a tabular Granger results summary showing at
  minimum `ticker`, `granger_verified`, `optimal_lag`, and the p-value from the
  column corresponding to `optimal_lag` (e.g., `p_lag_2` when `optimal_lag` = 2).
- **FR-012**: The notebook MUST render the lead-lag matrix as an inline heatmap
  with a diverging colour scale, ticker labels on both axes, and a descriptive
  title.
- **FR-013**: Tickers with fewer than 50 observations after merging and differencing
  MUST be skipped for Granger testing with a printed warning; they MUST still appear
  in the results file with `granger_verified = False`.

### Key Entities

- **ADFResult**: Per-ticker record with fields `ticker`, `adf_statistic`,
  `p_value`, `is_stationary`, `differenced` (bool indicating whether differencing
  was applied).
- **GrangerResult**: Per-ticker record with fields `ticker`, `granger_verified`,
  `optimal_lag`, and five scalar p-value columns `p_lag_1`–`p_lag_5`.
- **LeadLagMatrix**: Square N×N numeric matrix keyed by ticker, where entry
  `L(i,j)` is the signed lead-lag score indicating whether ticker i leads or lags
  ticker j.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running all cells on a clean kernel completes without unhandled
  exceptions, given both input files are present.
- **SC-002**: `data/granger_results.parquet` contains exactly one row per ticker,
  with zero null values in `ticker`, `granger_verified`, and `optimal_lag` columns;
  `p_lag_1`–`p_lag_5` may be null only for tickers skipped due to insufficient data.
- **SC-003**: Every `granger_verified` value is consistent with `p_lag_1`–`p_lag_5`:
  `True` if and only if at least one of those five columns is below 0.05.
- **SC-004**: `data/lead_lag_matrix.parquet` has shape `(N, N)` where N equals the
  number of tickers in the merged dataset, with all diagonal entries equal to 0.0.
- **SC-005**: The inline heatmap renders with a diverging colour scale and labelled
  axes, verifiable by visual inspection of the notebook output.
- **SC-006**: The Granger results table is printed inline and contains at least the
  columns `ticker`, `granger_verified`, and `optimal_lag`.

## Assumptions

- Both `data/raw_prices.parquet` and `data/sentiment_daily.parquet` were produced
  by notebooks 01 and 02 respectively and conform to the schemas defined in those
  specs; no additional schema validation is performed in this notebook.
- The Kaggle news data covers approximately 2013–2018; price data extends to
  2020-12-31. The effective analysis window is the intersection of dates present
  in both files after the inner-join merge (FR-002). Granger tests and
  cross-correlation run only on this shared date window.
- The ADF stationarity threshold is p < 0.05; this is not user-configurable in
  this notebook.
- The Granger causality significance threshold is p < 0.05; this matches
  Constitution Principle IV and is not user-configurable.
- First-order differencing is applied at most once; if the differenced series is
  still non-stationary this is noted in the printed output but no further
  differencing is applied.
- Cross-correlation is computed on the full `log_return` series from
  `raw_prices.parquet` (all 2013–2020 trading days), independent of the sentiment
  merge. This maximises statistical power and keeps all tickers in the matrix
  regardless of news coverage. The Granger test uses the shorter sentiment-merged
  series separately.
- The lead-lag score formula `L(i,j) = sum(k * corr(k))` is not strictly
  anti-symmetric in general (it depends on the data), but the anti-symmetric
  property `L(i,j) ≈ -L(j,i)` is expected to hold approximately for most pairs.
- The lag range of −10 to +10 trading days (inclusive, 21 lags total) is fixed and
  not user-configurable in this notebook.
- The notebook overwrites both output files on each run without confirmation.
- Granger testing uses the F-test formulation from `statsmodels.tsa.stattools`;
  the bivariate model regresses `log_return` on its own lags and lags of
  `sentiment_score`.
