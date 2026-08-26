# Feature Specification: Sentiment Scoring Notebook (notebook_02)

**Feature Branch**: `002-sentiment-scoring-notebook`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "notebook_02_sentiment_analysis.ipynb — FinBERT + Loughran-McDonald hybrid sentiment scoring pipeline"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Score All Headlines and Produce Daily Sentiment File (Priority: P1)

An analyst runs all cells in the notebook after notebook_01 has produced
`data/raw_news.parquet`. The notebook scores every headline using a hybrid of a
deep-learning financial model and a domain-specific financial vocabulary, then
aggregates scores to one row per ticker per trading day, and writes the result as
a Parquet file ready for causality testing in notebook_03.

**Why this priority**: The daily sentiment file is the sole output of this notebook
and the direct input to the lead-lag analysis. Without it, no downstream analysis
can proceed.

**Independent Test**: With `data/raw_news.parquet` present, run all cells. Verify
`data/sentiment_daily.parquet` is created, contains exactly five columns
(`date`, `ticker`, `sentiment_score`, `article_count`, `avg_finbert_score`,
`avg_lm_score`), that `sentiment_score` values are bounded between -1.0 and +1.0,
and that `article_count` is a positive integer for every row.

**Acceptance Scenarios**:

1. **Given** `data/raw_news.parquet` exists with at least one headline,
   **When** all cells run,
   **Then** `data/sentiment_daily.parquet` is written with the five required columns
   and zero null values in any column.
2. **Given** a batch of headlines,
   **When** scoring completes,
   **Then** each row's `sentiment_score` equals `0.70 × finbert_score + 0.30 × lm_score`,
   verifiable by spot-checking three rows against manually computed values.
3. **Given** multiple headlines for the same ticker on the same date,
   **When** aggregation runs,
   **Then** the output contains exactly one row for that ticker/date combination,
   with `sentiment_score` equal to the mean of individual scores and `article_count`
   equal to the number of headlines.

---

### User Story 2 — Transparent Component Score Audit (Priority: P2)

An analyst wants to audit how the composite score is formed. They can inspect the
intermediate `avg_finbert_score` and `avg_lm_score` columns in the output file to
understand how much each model component contributed to the daily sentiment for any
ticker/date combination.

**Why this priority**: Constitution Principle III (Prescribed Sentiment Weighting)
requires that both component scores be stored alongside the composite so the
weighting can be audited and validated. This is a compliance requirement, not a
nice-to-have.

**Independent Test**: Load `data/sentiment_daily.parquet` and verify that for every
row: `abs(sentiment_score - (0.70 × avg_finbert_score + 0.30 × avg_lm_score)) < 1e-6`
(floating-point tolerance). Also verify `avg_finbert_score` and `avg_lm_score` are
both independently bounded between -1.0 and +1.0.

**Acceptance Scenarios**:

1. **Given** the output file,
   **When** a row is inspected,
   **Then** `avg_finbert_score` equals the mean of the per-headline FinBERT scores
   for that ticker/date group.
2. **Given** a headline with no LM word matches,
   **When** the LM score is computed,
   **Then** the LM score is exactly 0.0 (zero, not NaN), and this flows through to
   `avg_lm_score` without breaking aggregation.

---

### User Story 3 — Progress Visibility During Long Scoring Run (Priority: P3)

An analyst running the notebook on a large dataset (potentially hundreds of
thousands of headlines) needs to know which device is being used for model
inference and approximately how much work remains, so they can estimate completion
time and confirm the correct hardware accelerator is active.

**Why this priority**: Scoring can take many minutes on CPU. Without progress
feedback the analyst cannot distinguish a running notebook from a hung one.

**Independent Test**: Run the notebook and verify: (a) a device-selection message
is printed before any scoring begins, identifying which of MPS/CUDA/CPU is in use;
(b) a final summary is printed after all cells complete showing total headlines
processed and the min/max date range from the output file.

**Acceptance Scenarios**:

1. **Given** the notebook runs on a machine with no GPU or MPS,
   **When** the device-selection cell runs,
   **Then** the printed message reads "Using device: cpu".
2. **Given** all cells complete,
   **When** the summary cell runs,
   **Then** the printed output shows the total number of headlines processed
   (matching the row count in `data/raw_news.parquet`) and the earliest and latest
   `date` values in `data/sentiment_daily.parquet`.

---

### Edge Cases

- What happens when a headline is empty or null? The notebook MUST skip that row
  and count it as unprocessed in the summary rather than raising an exception.
- What if `data/raw_news.parquet` does not exist? The notebook MUST raise a clear
  error referencing the missing file before attempting any scoring.
- What if a headline exceeds the model's maximum token length? Truncation is applied
  at the tokenization step; no error should be raised.
- What if the LM word lists cannot be loaded? The notebook MUST raise a clear error
  before processing any headlines.
- What if `data/sentiment_daily.parquet` already exists? The notebook MUST
  overwrite it without prompting.
- What if a ticker/date group has only one headline? `article_count` MUST be 1
  and mean scores equal the single headline's scores.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The notebook MUST read `data/raw_news.parquet` as its primary input
  before any scoring begins; if the file does not exist, the notebook MUST raise
  an error with a message identifying the missing file.
- **FR-002**: The notebook MUST detect and print the available compute device,
  selecting in strict priority order: MPS (Apple Silicon) first, CUDA (NVIDIA GPU)
  second, CPU as fallback.
- **FR-003**: The notebook MUST load the FinBERT model for financial sentiment
  classification from HuggingFace.
- **FR-004**: The notebook MUST load the Loughran-McDonald positive and negative
  financial word lists from the `lm-ssc` package.
- **FR-005**: The notebook MUST process headlines in batches of 64.
- **FR-006**: For each headline, the notebook MUST compute a FinBERT component score
  by: tokenizing with max length 512 and truncation enabled, running inference,
  applying softmax to logits, then mapping the result to a scalar as:
  `+confidence` if positive label wins, `-confidence` if negative label wins,
  `0` if neutral label wins.
- **FR-007**: For each headline, the notebook MUST compute an LM component score by:
  lowercasing and whitespace-tokenizing the headline, counting matched positive
  words (`pos`) and negative words (`neg`), computing
  `(pos - neg) / total_tokens` clamped to [-1, +1], returning `0` if total tokens
  is zero.
- **FR-008**: The notebook MUST compute a composite score for each headline as
  `final_score = 0.70 × finbert_score + 0.30 × lm_score`.
- **FR-009**: The notebook MUST aggregate per-headline scores by `(date, ticker)`
  group, computing: `sentiment_score` (mean of final scores), `article_count`
  (count of headlines), `avg_finbert_score` (mean of FinBERT component scores),
  `avg_lm_score` (mean of LM component scores).
- **FR-010**: The notebook MUST save the aggregated output to
  `data/sentiment_daily.parquet` with exactly these five columns: `date`, `ticker`,
  `sentiment_score`, `article_count`, `avg_finbert_score`, `avg_lm_score`.
- **FR-011**: The notebook MUST print a summary after saving, showing total
  headlines processed and the min/max date range present in the output file.
- **FR-012**: Empty or null headlines MUST be skipped without raising an unhandled
  exception; the summary count MUST reflect only successfully processed headlines.

### Sentiment Score Computation Summary

| Step        | Input           | Method                                    | Output range |
|-------------|-----------------|-------------------------------------------|--------------|
| FinBERT     | Headline text   | Softmax, winning label score signed       | [-1.0, +1.0] |
| LM          | Headline text   | (pos - neg) / tokens, clamped             | [-1.0, +1.0] |
| Composite   | Both scores     | weighted sum: 70pct FinBERT, 30pct LM     | [-1.0, +1.0] |
| Aggregation | Per-date/ticker | Mean of composite; component means stored | [-1.0, +1.0] |

### Key Entities

- **HeadlineSentiment**: A per-headline record with fields `date`, `ticker`,
  `headline`, `finbert_score`, `lm_score`, `final_score`.
- **DailySentiment**: An aggregated record keyed by `(date, ticker)` with fields
  `sentiment_score`, `article_count`, `avg_finbert_score`, `avg_lm_score`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running all cells top-to-bottom on a clean kernel completes without
  unhandled exceptions, provided `data/raw_news.parquet` exists.
- **SC-002**: `data/sentiment_daily.parquet` contains exactly five columns with zero
  null values in any column.
- **SC-003**: Every `sentiment_score` value in the output is within [-1.0, +1.0]
  inclusive.
- **SC-004**: For every row, the identity
  `sentiment_score ≈ 0.70 × avg_finbert_score + 0.30 × avg_lm_score`
  holds within floating-point tolerance (1e-6).
- **SC-005**: The printed summary headline count matches the row count of
  `data/raw_news.parquet` minus any skipped null/empty rows, verifiable by spot
  check.
- **SC-006**: The notebook runs without code modification on MPS, CUDA, and CPU
  hardware; device selection is automatic and printed before scoring begins.

## Assumptions

- `data/raw_news.parquet` was produced by notebook_01 and contains at minimum the
  columns `date`, `ticker`, `headline`; no other validation of its schema is
  performed.
- `data/raw_prices.parquet` is read for reference (date range awareness) but is
  not required for scoring; if absent a warning is printed and scoring proceeds
  using only the news date range.
- The `lm-ssc` package is installed in the environment and its word lists are
  accessible without network access at runtime.
- The FinBERT model is downloaded from HuggingFace on first run and cached locally;
  subsequent runs use the local cache.
- Batch size of 64 is fixed; no configuration cell exposes it as a user-settable
  variable in this notebook.
- The three FinBERT output labels are named "positive", "negative", "neutral" in
  that model's label mapping; this is the standard ProsusAI/finbert label ordering.
- The notebook overwrites `data/sentiment_daily.parquet` on each run without
  confirmation.
- The notebook does not read `INPUT_TICKER` — it scores all tickers present in the
  input news file, making it reusable across any run of notebook_01.
