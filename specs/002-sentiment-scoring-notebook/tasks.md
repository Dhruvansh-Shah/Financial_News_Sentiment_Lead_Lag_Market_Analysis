---
description: "Task list for notebook_02_sentiment_analysis.ipynb"
---

# Tasks: Sentiment Scoring Notebook (notebook_02)

**Input**: Design documents from `specs/002-sentiment-scoring-notebook/`
**Prerequisites**: spec.md (required), plan.md and research.md in specs/004-network-signals-notebook/
**Dependency**: `data/raw_news.parquet` produced by notebook_01

**Organization**: Tasks map directly to notebook cells in execution order, grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Create the notebook file.

- [x] T001 Create `notebook_02_sentiment_analysis.ipynb` at repository root as an empty Jupyter notebook with kernel spec `python3`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Install dependencies, select compute device, load models and word lists, load input data — required before any scoring can begin.

- [x] T002 Add Cell 1 in `notebook_02_sentiment_analysis.ipynb`: `%pip install -q transformers torch pysentiment2 pandas pyarrow tqdm` (note: `pysentiment2` provides the Loughran-McDonald word lists; `lm-ssc` is not a valid PyPI package)
- [x] T003 [US3] Add Cell 2 in `notebook_02_sentiment_analysis.ipynb`: device selection — import `torch`; check in strict priority order: `torch.backends.mps.is_available()` → `"mps"`, then `torch.cuda.is_available()` → `"cuda"`, else `"cpu"`; assign to `DEVICE`; print `f"Using device: {DEVICE}"`
- [x] T004 [US1] Add Cell 3 in `notebook_02_sentiment_analysis.ipynb`: load FinBERT — `from transformers import AutoTokenizer, AutoModelForSequenceClassification`; `TOKENIZER = AutoTokenizer.from_pretrained("ProsusAI/finbert")`; `MODEL = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert").to(DEVICE)`; `MODEL.eval()`; print `"FinBERT loaded"`
- [x] T005 [US1] Add Cell 4 in `notebook_02_sentiment_analysis.ipynb`: load LM word lists — `import pysentiment2 as ps`; `_lm = ps.LM()`; expose `LM_POS = _lm._posset` and `LM_NEG = _lm._negset` as module-level sets; print `f"LM word lists loaded: {len(LM_POS)} positive, {len(LM_NEG)} negative words"`
- [x] T006 [US1] Add Cell 5 in `notebook_02_sentiment_analysis.ipynb`: load input data — `import pandas as pd`; `from pathlib import Path`; if `not Path("data/raw_news.parquet").exists()`: raise `FileNotFoundError("data/raw_news.parquet not found — run notebook_01 first")`; `df_news = pd.read_parquet("data/raw_news.parquet")`; drop rows where `headline` is null/empty (print count dropped); print `f"Loaded {len(df_news)} headlines across {df_news['ticker'].nunique()} tickers"`

**Checkpoint**: Models loaded, data available — scoring can now begin.

---

## Phase 3: User Story 1 — Score All Headlines and Produce Daily Sentiment File (Priority: P1)

**Goal**: Score every headline with FinBERT and LM, compute composite scores, aggregate by date+ticker, save `data/sentiment_daily.parquet`.

**Independent Test**: After all cells run, `data/sentiment_daily.parquet` exists, has exactly 6 columns (`date`, `ticker`, `sentiment_score`, `article_count`, `avg_finbert_score`, `avg_lm_score`), zero nulls, and all `sentiment_score` values within `[-1.0, +1.0]`.

### Implementation for User Story 1

- [x] T007 [US1] Add Cell 6 in `notebook_02_sentiment_analysis.ipynb`: LM scoring function — define `def lm_score(text: str) -> float` that: returns `0.0` if text is not a non-empty string; lowercases and whitespace-splits text into `tokens`; counts `pos = sum(1 for t in tokens if t in LM_POS)` and `neg = sum(1 for t in tokens if t in LM_NEG)`; returns `0.0` if `len(tokens) == 0`, else `max(-1.0, min(1.0, (pos - neg) / len(tokens)))`
- [x] T008 [US1] Add Cell 7 in `notebook_02_sentiment_analysis.ipynb`: FinBERT batch scoring function — define `def finbert_scores(texts: list[str]) -> list[float]` that: imports `torch`, `torch.nn.functional as F`; tokenizes the batch with `TOKENIZER(texts, max_length=512, truncation=True, padding=True, return_tensors="pt")`; moves inputs to `DEVICE`; runs `MODEL(**inputs)` inside `torch.no_grad()`; applies `F.softmax(logits.cpu(), dim=1)` to get probs `(N, 3)`; for each row maps label by `argmax`: label index 0 ("positive") → `+probs[0]`, index 1 ("negative") → `-probs[1]`, index 2 ("neutral") → `0.0`, any unknown index → logs `f"WARNING: unknown FinBERT label {idx}"` and returns `0.0`; returns list of floats; catches `NotImplementedError` on MPS and retries on CPU with a printed warning
- [x] T009 [US1] Add Cell 8 in `notebook_02_sentiment_analysis.ipynb`: main scoring loop — import `numpy as np`; `from tqdm import tqdm`; `BATCH_SIZE = 64`; iterate over `df_news` in batches of `BATCH_SIZE` using `tqdm(range(0, len(df_news), BATCH_SIZE), desc="Scoring batches")`; within each batch: extract headline list (fill NaN with `""`), call `finbert_scores(batch_texts)` and `lm_score(t)` for each text; collect results into `all_finbert` and `all_lm` lists; after loop assign `df_news["finbert_score"] = all_finbert` and `df_news["lm_score"] = all_lm`; print `f"Scored {len(df_news)} headlines"`
- [x] T010 [US2] Add Cell 9 in `notebook_02_sentiment_analysis.ipynb`: composite score — `df_news["final_score"] = 0.70 * df_news["finbert_score"] + 0.30 * df_news["lm_score"]`; add a spot-check print showing 3 sample rows with `finbert_score`, `lm_score`, `final_score` to allow manual audit
- [x] T011 [US1] Add Cell 10 in `notebook_02_sentiment_analysis.ipynb`: aggregate by date/ticker — `df_daily = df_news.groupby(["date", "ticker"]).agg(sentiment_score=("final_score", "mean"), article_count=("final_score", "count"), avg_finbert_score=("finbert_score", "mean"), avg_lm_score=("lm_score", "mean")).reset_index()`; ensure column order is exactly `["date", "ticker", "sentiment_score", "article_count", "avg_finbert_score", "avg_lm_score"]`; cast `article_count` to `int64`; print shape
- [x] T012 [US1] Add Cell 11 in `notebook_02_sentiment_analysis.ipynb`: save — `import os`; `os.makedirs("data", exist_ok=True)`; `df_daily.to_parquet("data/sentiment_daily.parquet", index=False)`; print `f"Saved data/sentiment_daily.parquet — {len(df_daily)} stock-day rows"`

**Checkpoint**: User Story 1 independently testable — reload parquet and assert columns, null-free, scores within [-1, +1].

---

## Phase 4: User Story 2 — Transparent Component Score Audit (Priority: P2)

**Goal**: `avg_finbert_score` and `avg_lm_score` are stored as separate columns alongside `sentiment_score` so the 70/30 weighting can be audited per Constitution Principle III.

*No additional cells required*: T010 (composite print) and T011 (aggregation storing both means) fully satisfy US2. The audit columns are written by T012.

**Checkpoint**: Verify in parquet: `abs(sentiment_score - (0.70*avg_finbert_score + 0.30*avg_lm_score)) < 1e-6` for every row.

---

## Phase 5: User Story 3 — Progress Visibility During Long Scoring Run (Priority: P3)

**Goal**: Device selection is printed before scoring begins; tqdm shows batch progress; summary is printed after completion.

*Device print covered by T003. Tqdm covered by T009.*

- [x] T013 [US3] Add Cell 12 in `notebook_02_sentiment_analysis.ipynb`: summary cell — `df_out = pd.read_parquet("data/sentiment_daily.parquet")`; print `f"Total headlines processed: {len(df_news)}"`; print `f"Stock-day rows in output: {len(df_out)}"`; print `f"Date range: {df_out['date'].min().date()} to {df_out['date'].max().date()}"`

**Checkpoint**: User Story 3 independently testable — device line in output, tqdm bar visible during scoring, summary at end.

---

## Phase 6: Polish

- [x] T014 [P] Verify `.gitignore` at repository root contains `data/` and `outputs/` entries (already present from notebook_01 setup; no change needed if present)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1 — installs, device, models, data load
- **US1 (Phase 3)**: Depends on Phase 2 (models + data loaded)
- **US2 (Phase 4)**: Satisfied by US1 tasks T010–T012 — no extra cells needed
- **US3 (Phase 5)**: T003 in Phase 2, T009 in Phase 3, T013 in Phase 5
- **Polish (Phase 6)**: Depends on all phases complete

### Parallel Opportunities

```text
Phase 1 → Phase 2 (T002→T003→T004→T005→T006 sequential) → Phase 3 → Phase 5 → Phase 6
```

T007 (LM function) and T008 (FinBERT function) can be developed in parallel as they are independent functions.

---

## Implementation Strategy

### MVP (Minimum: US1)

1. T001–T006 (setup + models + data)
2. T007–T012 (score + aggregate + save)
3. Validate: reload parquet, check 6 columns, no nulls, scores in [-1, +1]

### Full delivery order

1. T001–T006: environment + data load
2. T007–T009: scoring functions + main loop
3. T010–T012: composite + aggregate + save (US1 + US2 complete)
4. T013: summary print (US3 complete)
5. T014: gitignore check

---

## Notes

- `lm-ssc` is not a real PyPI package — use `pysentiment2` which provides `ps.LM()` with `._posset` and `._negset` as the Loughran-McDonald word sets
- `pysentiment2.LM._posset` uses stemmed forms — `tokenize()` applies stemming before matching, which is why we use `_posset`/`_negset` directly with the pre-stemmed tokenizer
- FinBERT label indices: 0=positive, 1=negative, 2=neutral (from ProsusAI/finbert config)
- Constitution Principle III is satisfied by storing `avg_finbert_score` and `avg_lm_score` as separate columns
- Commit after Phase 3 checkpoint
