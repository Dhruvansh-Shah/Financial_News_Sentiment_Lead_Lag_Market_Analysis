# Feature Specification: Data Collection Notebook (notebook_01)

**Feature Branch**: `001-data-collection-notebook`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "notebook_01_data_collection.ipynb — ticker-based news ingestion and price data pipeline"

## Clarifications

### Session 2026-04-20

- Q: The company-name mapping originally covered only 10 tickers; ~50 sector tickers would have had zero news matches. Should the mapping be extended to cover all 60 sector tickers? → A: Yes — extend to all 60 sector tickers with appropriate company name patterns for each.
- Q: The Kaggle dataset only covers ~2013–2018, not 2013–2020 as assumed. How should the date range mismatch be handled? → A: Keep price fetch as 2013–2020; let the notebook_03 inner-join on date naturally define the usable analysis window. Assumptions updated to reflect actual Kaggle coverage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Configure Ticker and Resolve Peer Universe (Priority: P1)

An analyst opens the notebook, sets `INPUT_TICKER` (e.g., `"AAPL"`) in the
configuration cell at the top, and runs all cells. The notebook automatically
determines the correct set of 10 peer tickers from the sector map and makes that
universe available to all downstream cells.

**Why this priority**: Every downstream operation — news filtering, price fetching,
entity matching — depends on the resolved ticker list. Nothing else can run
correctly without this.

**Independent Test**: Set `INPUT_TICKER = "AAPL"` and run the configuration cell.
Verify `TICKERS` contains exactly `["AAPL", "MSFT", "GOOGL", "AMZN", "META",
"NFLX", "AMD", "TSLA", "NVDA", "INTC"]` (technology sector peers, deduplicated).
Then set `INPUT_TICKER = "XYZ"` (unknown ticker) and verify `TICKERS` falls back to
the default 10-ticker list.

**Acceptance Scenarios**:

1. **Given** `INPUT_TICKER = "JPM"`, **When** the configuration cell runs,
   **Then** `TICKERS` equals the finance sector list with `JPM` first, deduplicated,
   containing exactly 10 entries.
2. **Given** `INPUT_TICKER = "UNKNOWN"`, **When** the configuration cell runs,
   **Then** `TICKERS` equals the default fallback list:
   `["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NFLX", "AMD", "TSLA", "JPM", "GS"]`.
3. **Given** `INPUT_TICKER` is already the first element in its sector,
   **When** the configuration cell runs,
   **Then** `TICKERS` contains that ticker exactly once (no duplicates).

---

### User Story 2 — Download and Filter News Articles (Priority: P2)

The analyst runs the news-ingestion cells. The notebook authenticates with Kaggle
using credentials from a `.env` file, downloads the All The News 2 dataset, filters
to Reuters/Forbes/Business Insider articles, maps article text to tickers using
company-name regex, aligns dates to NYSE trading days, and saves the cleaned news
data as a Parquet file.

**Why this priority**: The news data is one of two primary inputs to the lead-lag
pipeline. It must be available before sentiment scoring (notebook 2) can run.

**Independent Test**: With valid Kaggle credentials and a freshly cleared `data/`
directory, run all news-ingestion cells. Verify `data/raw_news.parquet` exists,
its `source` column contains only `{"Reuters", "Forbes", "Business Insider"}`, its
`ticker` column contains only values from `TICKERS`, and its columns are exactly
`["date", "ticker", "headline", "source"]`.

**Acceptance Scenarios**:

1. **Given** valid `KAGGLE_USERNAME` and `KAGGLE_KEY` in `.env`,
   **When** the download cell runs,
   **Then** the dataset is fetched from `ammarali32/all-the-news-2-1` without error.
2. **Given** the raw dataset is available,
   **When** the source-filter cell runs,
   **Then** articles from all publications other than Reuters, Forbes, and Business
   Insider are discarded.
3. **Given** filtered articles,
   **When** the entity-mapping cell runs,
   **Then** each article row is expanded to one row per matched ticker, and only
   articles mentioning at least one ticker in `TICKERS` are retained.
4. **Given** a date that falls on a Saturday, Sunday, or NYSE holiday,
   **When** the trading-day alignment cell runs,
   **Then** that article's `date` is moved forward to the next NYSE trading day.

---

### User Story 3 — Fetch Price Data and Compute Log Returns (Priority: P3)

The analyst runs the price-ingestion cells. The notebook fetches 7 years of daily
OHLCV data for all tickers in `TICKERS` from 2013-01-01 to 2020-12-31, computes the
log return for each ticker/day, and saves the result as a Parquet file.

**Why this priority**: Price data is the second primary input. It must exist before
Granger causality testing (notebook 3) can run. It does not depend on the news data.

**Independent Test**: Run all price-ingestion cells. Verify `data/raw_prices.parquet`
exists, contains a row for every ticker in `TICKERS` for each trading day between
2013-01-01 and 2020-12-31, and has a `log_return` column with no NaN values except
for the first trading day of each ticker (where there is no prior close).

**Acceptance Scenarios**:

1. **Given** `TICKERS` is resolved,
   **When** the price-fetch cell runs,
   **Then** OHLCV data is retrieved via yfinance for all tickers covering
   2013-01-01 to 2020-12-31.
2. **Given** OHLCV data is available,
   **When** the log-return cell runs,
   **Then** `log_return = ln(close / previous_close)` is computed per ticker
   per trading day, stored in the `log_return` column.
3. **Given** all cells have run,
   **When** the summary cell executes,
   **Then** a printed summary shows the headline count per ticker and the min/max
   date range of the price data.

---

### Edge Cases

- What happens when `INPUT_TICKER` appears in the sector map but is not the first
  element — does it still deduplicate correctly? (Expected: yes, deduplicate and
  place `INPUT_TICKER` first.)
- How does the entity-mapping handle articles that mention multiple tickers in
  `TICKERS`? (Expected: each match produces a separate row.)
- What if yfinance returns no data for a ticker in `TICKERS` (e.g., delisted)?
  The notebook MUST print a warning and continue rather than raising an exception.
- What if the Kaggle download fails due to invalid credentials?
  The notebook MUST surface a clear error message referencing `.env` configuration.
- What if `data/raw_news.parquet` already exists from a prior run?
  The notebook MUST overwrite it without prompting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The notebook MUST expose a single `INPUT_TICKER` variable in the
  top configuration cell that the analyst sets before running all cells.
- **FR-002**: The notebook MUST define `SECTOR_MAP` with exactly 6 sectors
  (technology, finance, energy, healthcare, consumer, industrial), each containing
  exactly 10 tickers as specified.
- **FR-003**: The notebook MUST resolve `TICKERS` as `INPUT_TICKER` plus its 9
  sector peers, deduplicated, with `INPUT_TICKER` first; if `INPUT_TICKER` is not in
  any sector, `TICKERS` MUST equal the 10-ticker default fallback list.
- **FR-004**: The notebook MUST load `KAGGLE_USERNAME` and `KAGGLE_KEY` from a
  `.env` file using `python-dotenv` and use them to authenticate with the Kaggle
  API.
- **FR-005**: The notebook MUST download dataset `ammarali32/all-the-news-2-1` from
  Kaggle if not already present locally.
- **FR-006**: The notebook MUST filter articles to only those from Reuters, Forbes,
  or Business Insider; all other sources MUST be discarded.
- **FR-007**: The notebook MUST scan each article's headline and body using
  case-insensitive word-boundary regex to map company name mentions to tickers per
  the name-to-ticker mapping table below.
- **FR-008**: The notebook MUST retain only articles that mention at least one
  ticker present in `TICKERS`; unmatched articles MUST be discarded.
- **FR-009**: The notebook MUST expand multi-ticker articles into one row per
  matched ticker.
- **FR-010**: The notebook MUST align article dates to the next NYSE trading day
  using `pandas_market_calendars` for any date that falls on a weekend or NYSE
  holiday.
- **FR-011**: The news output MUST be saved to `data/raw_news.parquet` with exactly
  four columns: `date`, `ticker`, `headline`, `source`.
- **FR-012**: The notebook MUST fetch daily OHLCV data for all tickers in `TICKERS`
  via `yfinance` covering 2013-01-01 to 2020-12-31.
- **FR-013**: The notebook MUST compute `log_return = ln(close / previous_close)`
  per ticker per trading day and store it in the price DataFrame.
- **FR-014**: The price output MUST be saved to `data/raw_prices.parquet`.
- **FR-015**: The notebook MUST print a summary showing headline count per ticker
  and the min/max date range of the price data.
- **FR-016**: If yfinance returns no data for a ticker, the notebook MUST print a
  warning and continue without raising an unhandled exception.

### Company Name-to-Ticker Mapping

All 60 sector tickers MUST have at least one name pattern. Patterns are
case-insensitive word-boundary matches against headline and article body.

| Company Name Pattern                        | Ticker |
|---------------------------------------------|--------|
| Apple                                       | AAPL   |
| Microsoft                                   | MSFT   |
| Google, Alphabet                            | GOOGL  |
| Amazon                                      | AMZN   |
| Facebook, Meta                              | META   |
| Netflix                                     | NFLX   |
| AMD, Advanced Micro Devices                 | AMD    |
| Tesla                                       | TSLA   |
| NVIDIA, Nvidia                              | NVDA   |
| Intel                                       | INTC   |
| JPMorgan, JP Morgan                         | JPM    |
| Goldman Sachs                               | GS     |
| Morgan Stanley                              | MS     |
| Bank of America                             | BAC    |
| Wells Fargo                                 | WFC    |
| Citigroup, Citi                             | C      |
| BlackRock                                   | BLK    |
| American Express                            | AXP    |
| BNY Mellon, Bank of New York                | BK     |
| Charles Schwab, Schwab                      | SCHW   |
| ExxonMobil, Exxon Mobil, Exxon              | XOM    |
| Chevron                                     | CVX    |
| ConocoPhillips, Conoco Phillips             | COP    |
| EOG Resources                               | EOG    |
| Schlumberger, SLB                           | SLB    |
| Occidental Petroleum, Occidental            | OXY    |
| Phillips 66                                 | PSX    |
| Valero Energy, Valero                       | VLO    |
| Marathon Petroleum, Marathon                | MPC    |
| Halliburton                                 | HAL    |
| Johnson & Johnson, Johnson and Johnson      | JNJ    |
| Pfizer                                      | PFE    |
| Merck                                       | MRK    |
| AbbVie                                      | ABBV   |
| Bristol-Myers Squibb, Bristol Myers         | BMY    |
| Amgen                                       | AMGN   |
| Gilead Sciences, Gilead                     | GILD   |
| Medtronic                                   | MDT    |
| Abbott Laboratories, Abbott                 | ABT    |
| Eli Lilly, Lilly                            | LLY    |
| Walmart                                     | WMT    |
| Target                                      | TGT    |
| Costco                                      | COST   |
| Home Depot                                  | HD     |
| Lowe's, Lowes                               | LOW    |
| Nike                                        | NKE    |
| McDonald's, McDonalds                       | MCD    |
| Starbucks                                   | SBUX   |
| Procter & Gamble, Procter and Gamble        | PG     |
| Coca-Cola, Coca Cola                        | KO     |
| Caterpillar                                 | CAT    |
| Deere, John Deere                           | DE     |
| Boeing                                      | BA     |
| General Electric                            | GE     |
| Honeywell                                   | HON    |
| 3M                                          | MMM    |
| UPS, United Parcel Service                  | UPS    |
| FedEx                                       | FDX    |
| Lockheed Martin                             | LMT    |
| Raytheon                                    | RTX    |

### Key Entities

- **SECTOR_MAP**: Dictionary mapping sector name → list of 10 ticker strings.
- **TICKERS**: Ordered list of up to 10 ticker strings derived from `INPUT_TICKER`
  and its sector peers, or the default fallback list.
- **Article**: A news record with fields `date` (NYSE trading-day aligned),
  `ticker`, `headline`, `source`.
- **PriceRecord**: A daily OHLCV record with an additional `log_return` field,
  keyed by ticker and date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running all cells top-to-bottom on a clean kernel completes without
  unhandled exceptions for any valid or invalid `INPUT_TICKER` value.
- **SC-002**: `data/raw_news.parquet` contains zero rows where `source` is not one
  of Reuters, Forbes, or Business Insider.
- **SC-003**: `data/raw_news.parquet` contains zero `date` values that fall on a
  weekend or NYSE holiday.
- **SC-004**: `data/raw_prices.parquet` covers all NYSE trading days from 2013-01-01
  to 2020-12-31 for every ticker in `TICKERS`, with no missing `log_return` values
  except the first trading day per ticker.
- **SC-005**: The printed summary headline counts match the actual row counts
  verifiable by reloading the Parquet file in a subsequent cell.
- **SC-006**: The notebook runs without code modification in both VS Code (local
  Python environment) and Google Colab, requiring only that `.env` credentials are
  present.

## Assumptions

- The All The News 2 Kaggle dataset (`ammarali32/all-the-news-2-1`) covers
  approximately 2013–2018; coverage beyond 2018 is sparse or absent. The price
  fetch range of 2013-01-01 to 2020-12-31 is intentionally wider so no price data
  is lost. The effective analysis window (used in notebook_03) is determined by the
  inner-join of news and price dates — no explicit date clipping is required in
  this notebook. All news articles are retained regardless of date.
- The analyst has a `.env` file at the project root containing valid
  `KAGGLE_USERNAME` and `KAGGLE_KEY` before running the notebook.
- yfinance can retrieve historical OHLCV data for all 10 tickers in `TICKERS`; for
  any ticker with missing or empty data the notebook warns and skips that ticker.
- The `data/` directory is excluded from version control.
- The name-to-ticker mapping covers all 60 sector tickers. Each ticker has at least
  one name pattern; matching is case-insensitive word-boundary regex on headline and
  body text. Ticker symbol matching (e.g., bare "NVDA" in text) is not used — only
  the company name patterns in the mapping table are matched.
- Date alignment moves article dates forward only (never backward) to the next valid
  NYSE trading day.
- The notebook overwrites output Parquet files on each run with no confirmation
  prompt.
