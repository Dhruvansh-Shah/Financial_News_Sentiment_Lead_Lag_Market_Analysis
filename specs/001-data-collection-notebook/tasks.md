---
description: "Task list for notebook_01_data_collection.ipynb"
---

# Tasks: Data Collection Notebook (notebook_01)

**Input**: Design documents from `specs/001-data-collection-notebook/`
**Prerequisites**: spec.md (required), plan.md and data-model.md in specs/004-network-signals-notebook/

**Organization**: Tasks map directly to notebook cells in execution order, grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Create the notebook file and supporting directory structure.

- [x] T001 Create `notebook_01_data_collection.ipynb` at repository root as an empty Jupyter notebook with kernel spec `python3`
- [x] T002 Create `data/` directory at repository root; add `data/` entry to `.gitignore` if not already present

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Install dependencies and load credentials — required before any user story work can begin.

- [x] T003 Add Cell 1 in `notebook_01_data_collection.ipynb`: `%pip install -q kaggle yfinance pandas pyarrow pandas_market_calendars python-dotenv` (silent install with `-q` flag for Colab compatibility)
- [x] T004 Add Cell 5 in `notebook_01_data_collection.ipynb`: import `os`, `dotenv`, `kaggle`; call `load_dotenv()`; read `KAGGLE_USERNAME` and `KAGGLE_KEY` from `os.environ`; if either is missing raise `EnvironmentError` with message `"Set KAGGLE_USERNAME and KAGGLE_KEY in .env"`; call `kaggle.api.authenticate()`; print `"Kaggle authenticated successfully"`

**Checkpoint**: Environment ready — user story cells can now be added.

---

## Phase 3: User Story 1 — Configure Ticker and Resolve Peer Universe (Priority: P1)

**Goal**: Analyst sets `INPUT_TICKER` once; `TICKERS` is resolved to 10 peers with deduplication and fallback.

**Independent Test**: Set `INPUT_TICKER = "AAPL"` → `TICKERS` equals `["AAPL","MSFT","GOOGL","AMZN","META","NFLX","AMD","TSLA","NVDA","INTC"]`. Set `INPUT_TICKER = "UNKNOWN"` → `TICKERS` equals default fallback list of 10.

### Implementation for User Story 1

- [x] T005 [US1] Add a markdown cell in `notebook_01_data_collection.ipynb` with heading `## Configuration — set INPUT_TICKER before running`, then add Cell 2 immediately after with the single line `INPUT_TICKER = "AAPL"`
- [x] T006 [US1] Add Cell 3 in `notebook_01_data_collection.ipynb`: define `SECTOR_MAP` as a Python dict with exactly 6 keys (`"technology"`, `"finance"`, `"energy"`, `"healthcare"`, `"consumer"`, `"industrial"`), each mapping to the exact 10-ticker list from spec FR-002:
  - technology: `["AAPL","MSFT","GOOGL","AMZN","META","NFLX","AMD","TSLA","NVDA","INTC"]`
  - finance: `["JPM","GS","MS","BAC","WFC","C","BLK","AXP","BK","SCHW"]`
  - energy: `["XOM","CVX","COP","EOG","SLB","OXY","PSX","VLO","MPC","HAL"]`
  - healthcare: `["JNJ","PFE","MRK","ABBV","BMY","AMGN","GILD","MDT","ABT","LLY"]`
  - consumer: `["WMT","TGT","COST","HD","LOW","NKE","MCD","SBUX","PG","KO"]`
  - industrial: `["CAT","DE","BA","GE","HON","MMM","UPS","FDX","LMT","RTX"]`
- [x] T007 [US1] Add Cell 4 in `notebook_01_data_collection.ipynb`: TICKERS resolution logic —
  1. Initialise `TICKERS = None`
  2. Iterate over `SECTOR_MAP.values()`; if `INPUT_TICKER` is found, set `TICKERS = [INPUT_TICKER] + [t for t in sector_peers if t != INPUT_TICKER]` (INPUT_TICKER first, deduplicated, exactly 10 entries) and `break`
  3. If `TICKERS is None` after the loop: `TICKERS = ["AAPL","MSFT","GOOGL","AMZN","META","NFLX","AMD","TSLA","JPM","GS"]`
  4. Print `f"TICKERS resolved: {TICKERS}"`

**Checkpoint**: User Story 1 independently testable — run Cells 2–4 and assert `len(TICKERS) == 10`.

---

## Phase 4: User Story 2 — Download and Filter News Articles (Priority: P2)

**Goal**: Download Kaggle news, filter sources, map company names to tickers, align dates to NYSE trading days, save `data/raw_news.parquet`.

**Independent Test**: After all US2 cells run, `data/raw_news.parquet` has exactly 4 columns (`date`, `ticker`, `headline`, `source`), zero rows with `source` outside the three allowed values, and zero `date` values on weekends/NYSE holidays.

### Implementation for User Story 2

- [x] T008 [US2] Add Cell 6 in `notebook_01_data_collection.ipynb`: Kaggle download cell — wrap in `if not Path("data/raw/all-the-news-2-1.csv").exists():` guard; inside call `kaggle.api.dataset_download_files("ammarali32/all-the-news-2-1", path="data/raw/", unzip=True)`; print download status; else print skip message
- [x] T009 [US2] Add Cell 7 in `notebook_01_data_collection.ipynb`: CSV read cell — use `glob.glob("data/raw/**/*.csv", recursive=True)` to find the downloaded CSV file(s); read with `pd.read_csv(csv_files[0], low_memory=False)`; print `f"Raw dataset: {len(df_raw)} rows, columns: {list(df_raw.columns)}"`
- [x] T010 [US2] Add Cell 8 in `notebook_01_data_collection.ipynb`: source filter cell — define `ALLOWED_SOURCES = {"Reuters", "Forbes", "Business Insider"}`; keep only rows where the `"publication"` column is in `ALLOWED_SOURCES`; `.copy()` the result into `df_filtered`; print count before and after
- [x] T011 [US2] Add Cell 9 in `notebook_01_data_collection.ipynb`: define `NAME_TO_TICKER` dict mapping all 60 company name regex patterns to tickers per spec FR-007; patterns must be regex-safe strings; multi-name entries use `|` separator (e.g., `r"Google|Alphabet"`, `r"JPMorgan|JP\s+Morgan"`, `r"ExxonMobil|Exxon\s+Mobil|Exxon"`); include all 60 tickers across all 6 sectors
- [x] T012 [US2] Add Cell 10 in `notebook_01_data_collection.ipynb`: entity scanning function — define `def find_tickers(text: str, name_to_ticker: dict) -> list` that: returns `[]` if `text` is not a string; iterates over `name_to_ticker` items; uses `re.search(r'\b(?:' + pattern + r')\b', text, re.IGNORECASE)` for each entry; returns `sorted(set(matched_tickers))`
- [x] T013 [US2] Add Cell 11 in `notebook_01_data_collection.ipynb`: apply entity scanning — combine `title` + `" " + content` columns (fill NaN with `""`) into `df_filtered["full_text"]`; apply `find_tickers` to each row storing result in `df_filtered["matched_tickers"]`; drop rows where `matched_tickers` is empty; print row count after filtering
- [x] T014 [US2] Add Cell 12 in `notebook_01_data_collection.ipynb`: explode cell — `df_exploded = df_filtered.explode("matched_tickers").rename(columns={"matched_tickers": "ticker"})`; keep only rows where `ticker` is in `TICKERS`; print row count after explode and filter
- [x] T015 [US2] Add Cell 13 in `notebook_01_data_collection.ipynb`: NYSE trading day alignment cell —
  1. Import `bisect`, `pandas_market_calendars as mcal`
  2. `nyse = mcal.get_calendar("NYSE")`; `schedule = nyse.schedule(start_date="2013-01-01", end_date="2021-12-31")`; extract `trading_days` as sorted list of `date` objects
  3. Define `next_trading_day(d)` using `bisect.bisect_left` on `trading_days`; return `d` if already a trading day; return `trading_days[idx]` otherwise
  4. Parse `df_exploded["date"]` with `pd.to_datetime(..., errors="coerce")`; drop NaT rows
  5. Apply `next_trading_day` to `.dt.date`; overwrite `df_exploded["date"]`; print number of dates shifted
- [x] T016 [US2] Add Cell 14 in `notebook_01_data_collection.ipynb`: column selection and save cell — select and rename columns to exactly `["date", "ticker", "headline", "source"]` mapping `title` → `headline` and `publication` → `source`; `.copy()` into `df_news`; cast `date` to `datetime64[ns]`; `Path("data").mkdir(exist_ok=True)`; save with `df_news.to_parquet("data/raw_news.parquet", index=False)`; print `f"Saved data/raw_news.parquet — {len(df_news)} rows"`

**Checkpoint**: User Story 2 independently testable — reload `data/raw_news.parquet` and assert columns, source values, and date validity.

---

## Phase 5: User Story 3 — Fetch Price Data and Compute Log Returns (Priority: P3)

**Goal**: Fetch daily OHLCV for all TICKERS 2013–2020, compute log returns, save `data/raw_prices.parquet`.

**Independent Test**: After all US3 cells run, `data/raw_prices.parquet` contains columns `date`, `ticker`, `open`, `high`, `low`, `close`, `volume`, `log_return`; `log_return` is NaN only on the first trading day per ticker; no other nulls.

### Implementation for User Story 3

- [x] T017 [US3] Add Cell 15 in `notebook_01_data_collection.ipynb`: yfinance download cell — import `numpy as np`, `yfinance as yf`; inside try/except call `yf.download(TICKERS, start="2013-01-01", end="2020-12-31", auto_adjust=True)` storing result as `df_wide`; after download loop over `TICKERS` to check for empty Close series and print `WARNING: {ticker} returned empty data` for any empty ticker; print completion message
- [x] T018 [US3] Add Cell 16 in `notebook_01_data_collection.ipynb`: reshape to long format cell — the yfinance result has a two-level column MultiIndex `(metric, ticker)`; call `df_wide.stack(level=1).reset_index()` to get long format; rename columns to lowercase (`Date`→`date`, `Ticker`/level-1-name→`ticker`, `Open`→`open`, `High`→`high`, `Low`→`low`, `Close`→`close`, `Volume`→`volume`); select only `["date", "ticker", "open", "high", "low", "close", "volume"]`; print shape
- [x] T019 [US3] Add Cell 17 in `notebook_01_data_collection.ipynb`: log return cell — sort by `["ticker", "date"]` and reset index; within each ticker group compute `log_return = np.log(close / close.shift(1))` using `.groupby("ticker")["close"].transform(lambda s: np.log(s / s.shift(1)))`; the first row per ticker will be NaN — this is correct; do not fill NaN; print NaN count
- [x] T020 [US3] Add Cell 18 in `notebook_01_data_collection.ipynb`: save cell — copy long df to `df_prices`; cast `date` to `datetime64[ns]`; save with `df_prices.to_parquet("data/raw_prices.parquet", index=False)`; print `f"Saved data/raw_prices.parquet — {len(df_prices)} rows, {df_prices['ticker'].nunique()} tickers"`

**Checkpoint**: User Story 3 independently testable — reload parquet and assert schema and NaN pattern.

---

## Phase 6: Polish and Summary

**Purpose**: Add the final summary cell required by FR-015 and SC-005.

- [x] T021 Add Cell 19 in `notebook_01_data_collection.ipynb`: summary cell — `pd.read_parquet("data/raw_news.parquet")` into `df_news_summary`; `pd.read_parquet("data/raw_prices.parquet")` into `df_prices_summary`; print `"Headlines per ticker:"` followed by `df_news_summary.groupby("ticker").size().sort_values(ascending=False).to_string()`; print `f"Price data: {df_prices_summary['date'].min().date()} to {df_prices_summary['date'].max().date()}"`
- [x] T022 [P] Add `.gitignore` entries for `data/` and `outputs/` at repository root if not already present

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — pip install then .env load
- **US1 (Phase 3)**: Depends on Phase 2 (packages installed) — no data dependency
- **US2 (Phase 4)**: Depends on US1 (TICKERS resolved) and Phase 2 (credentials loaded)
- **US3 (Phase 5)**: Depends on US1 (TICKERS resolved) — independent of US2
- **Polish (Phase 6)**: Depends on US2 and US3 both complete

### Parallel Opportunities

```text
Phase 1 → Phase 2 → US1 → US2 and US3 run in parallel → Phase 6
```

US2 (news ingestion) and US3 (price ingestion) can be developed and tested
independently once US1 is complete. They write to different files and have
no mutual dependency.

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Complete Phase 1 + Phase 2
2. Add Cells 2–4 (US1)
3. Validate: `assert len(TICKERS) == 10 and TICKERS[0] == INPUT_TICKER`

### Full delivery order

1. Phase 1 + Phase 2 (T001–T004)
2. US1: T005–T007 → test TICKERS resolution
3. US2: T008–T016 → test `data/raw_news.parquet`
4. US3: T017–T020 → test `data/raw_prices.parquet`
5. Polish: T021–T022 → verify summary output

---

## Notes

- [P] tasks = different cells/files, no dependencies between them
- Each cell must be independently runnable after its prerequisite cells
- Cells are numbered sequentially to match the execution order in the notebook
- Commit after completing each phase checkpoint
