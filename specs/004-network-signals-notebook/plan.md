# Implementation Plan: Lead-Lag Sentiment Analyser — Full System (All Four Notebooks)

**Branch**: `004-network-signals-notebook` | **Date**: 2026-04-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specifications from `specs/001` through `specs/004` plus clarification session 2026-04-20

## Summary

Four Jupyter notebooks form a sequential pipeline. notebook_01 ingests Kaggle news
and yfinance prices into Parquet checkpoints. notebook_02 scores headlines using a
70/30 FinBERT + Loughran-McDonald hybrid and aggregates to daily sentiment.
notebook_03 runs ADF stationarity checks, Granger causality tests (sentiment →
price), and a pairwise cross-correlation lead-lag matrix. notebook_04 clusters
tickers into leaders/followers via Louvain community detection, renders an
interactive Plotly network graph, and prints a plain-language signal summary for
the analyst's chosen ticker.

All state between notebooks is passed through six Parquet checkpoint files in
`data/`. No shared kernel state, no databases, no APIs beyond Kaggle and yfinance.

## Technical Context

**Language/Version**: Python 3.10+
**Primary Dependencies**: See per-notebook dependency lists in research.md
**Storage**: Flat Parquet files in `data/`; interactive HTML in `outputs/`
**Testing**: Manual cell-by-cell validation per acceptance scenarios in specs
**Target Platform**: VS Code (local) and Google Colab (no code changes required)
**Project Type**: Jupyter notebook pipeline (research/analytics)
**Performance Goals**: notebook_02 FinBERT scoring completes within ~30 min on CPU,
~5 min on GPU/MPS for the ~2013–2018 news corpus
**Constraints**: No paid APIs; no Docker; no internet access required after initial
downloads; Kaggle API credential is the only secret
**Scale/Scope**: ~10 tickers, ~5 years of daily data, ~hundreds of thousands of
headlines from 3 sources

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Requirement | Status |
| --------- | ----------- | ------ |
| I. Notebook-First Reproducibility | Each notebook runs top-to-bottom on clean kernel; state via Parquet only | PASS — six checkpoint files; no cross-notebook in-memory state |
| II. Free Data Sources Only | Kaggle + yfinance only; no paid APIs | PASS — no paid data sources introduced |
| III. Prescribed Sentiment Weighting | FinBERT 70%, LM 30%; both component scores stored | PASS — avg_finbert_score and avg_lm_score columns in sentiment_daily.parquet |
| IV. Statistical Rigour Before Causal Claims | Granger p ≤ 0.05 required; p-values and lag stored | PASS — granger_results.parquet stores p_value_lag1–p_value_lag5 and granger_verified |
| V. Human-Readable Output Required | Plotly graph + plain-language summary | PASS — network_graph.html + printed paragraph per notebook_04 spec |

No violations detected. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/004-network-signals-notebook/
├── plan.md              # This file
├── research.md          # Phase 0: technical decisions and dependency lists
├── data-model.md        # Phase 1: exact Parquet schemas and data flow
├── quickstart.md        # Phase 1: end-to-end run instructions
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
notebook_01_data_collection.ipynb
notebook_02_sentiment_analysis.ipynb
notebook_03_granger_and_leadlag.ipynb
notebook_04_network_and_signals.ipynb

data/
├── raw_news.parquet          # Output of notebook_01
├── raw_prices.parquet        # Output of notebook_01
├── sentiment_daily.parquet   # Output of notebook_02
├── granger_results.parquet   # Output of notebook_03
├── lead_lag_matrix.parquet   # Output of notebook_03
└── cluster_assignments.parquet  # Output of notebook_04

outputs/
└── network_graph.html        # Output of notebook_04

.env                          # KAGGLE_USERNAME and KAGGLE_KEY (not committed)
requirements.txt              # Shared base dependencies
```

**Structure Decision**: Flat notebook layout at repository root. No `src/` package
tree — notebooks are the deliverable, not a library. `data/` and `outputs/` are
excluded from version control. `requirements.txt` lists all shared dependencies;
per-notebook pip installs are documented in research.md for Colab compatibility.

## Complexity Tracking

No constitution violations. No complexity justification required.
