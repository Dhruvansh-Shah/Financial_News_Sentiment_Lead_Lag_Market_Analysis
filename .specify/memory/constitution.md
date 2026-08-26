<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0 (initial ratification — all placeholders replaced)

Modified principles: N/A (first fill from template)

Added sections:
- Core Principles (5 principles)
- Technical Constraints
- Development Workflow
- Governance

Removed sections: None (template comments stripped after replacement)

Templates reviewed:
- ✅ .specify/templates/plan-template.md — Constitution Check section present; aligns with principles
- ✅ .specify/templates/spec-template.md — FR/SC pattern compatible with principles
- ✅ .specify/templates/tasks-template.md — Phase structure supports notebook-per-phase decomposition
- ⚠ .specify/templates/commands/ — No command files found; no updates needed

Deferred TODOs: None
-->

# Lead-Lag Sentiment Analyser Constitution

## Core Principles

### I. Notebook-First Reproducibility

Every analysis stage MUST live in one of the four designated Jupyter notebooks.
Each notebook MUST run top-to-bottom with a fresh kernel without error, given only
the Kaggle API credential and a ticker symbol as inputs. Cross-notebook state MUST
be passed exclusively through persisted checkpoint files (e.g., Parquet, CSV, or
pickle in a `data/` directory) — no in-memory globals or hidden kernel dependencies
between notebooks are permitted.

**Rationale**: Reproducibility is the primary quality gate for research tooling.
Any result that cannot be re-derived from scratch on a clean environment is
untrustworthy.

### II. Free Data Sources Only

The system MUST source all data from Kaggle (All The News 2 dataset by Andrew
Thompson, filtered to Reuters, Forbes, and Business Insider) and yfinance. No paid
APIs, subscribed data feeds, or vendor-specific credentials beyond the Kaggle API
key may be introduced. Adding a paid data source requires a MAJOR version amendment
to this constitution.

**Rationale**: Accessibility — the tool must run without a budget. Paid APIs break
reproducibility for users who cannot afford the same subscription.

### III. Prescribed Sentiment Weighting

Sentiment scoring MUST combine FinBERT output at exactly 70% weight and the
Loughran-McDonald dictionary score at exactly 30% weight. The composite formula and
both component scores MUST be stored in the checkpoint file produced by notebook 2
so downstream notebooks can audit the calculation. Changes to weights or model
substitutions require a MINOR version amendment and explicit justification.

**Rationale**: The weighting reflects deliberate domain calibration. Silent drift
would invalidate all prior analyses and comparative benchmarks.

### IV. Statistical Rigour Before Causal Claims

The system MUST run Granger causality tests before reporting any claim that
sentiment leads price. Results surfaces to the user MUST include the p-value, the
lag window tested, and whether the null hypothesis of no Granger causality was
rejected. Cross-correlation lag scores MUST be accompanied by the correlation
coefficient and lag in trading days. Outputs MUST NOT assert directional causality
without a statistically significant Granger result (p ≤ 0.05).

**Rationale**: Unvalidated causal language in a financial context is misleading and
potentially harmful. Every claim must be traceable to a specific statistical test
result stored in the checkpoint.

### V. Human-Readable Output Required

Every analysis run MUST produce both a Plotly network graph (leaders/followers
clusters via Louvain community detection) AND a plain-language text summary
identifying which stocks follow the input ticker, the estimated lag in trading days,
and the confidence level. The network graph alone is not a sufficient deliverable.

**Rationale**: The target user is an analyst, not a data scientist. Visualisations
without text explanations shift interpretation burden onto the user.

## Technical Constraints

- **Runtime**: Python 3.10+. MUST run in both VS Code (local) and Google Colab
  without modification beyond credential paths.
- **Key dependencies**: `yfinance`, `transformers` (FinBERT), `statsmodels`
  (Granger causality), `python-louvain` / `community`, `plotly`, `kaggle`.
- **Credentials**: Only the Kaggle API credential (`~/.kaggle/kaggle.json` or
  environment variable) is permitted. No other secrets or API keys.
- **No infrastructure**: No Docker, no microservices, no web servers, no databases.
  Flat file I/O only.
- **Notebook count**: Exactly four notebooks. Adding a fifth requires a MINOR
  amendment with documented justification.

## Development Workflow

Notebooks execute in the following fixed order; each MUST be independently
re-runnable from cell 1:

1. `01_data_ingestion.ipynb` — Downloads Kaggle dataset; filters to target
   sources; fetches price data via yfinance; writes raw checkpoint.
2. `02_sentiment_scoring.ipynb` — Loads raw checkpoint; runs FinBERT and
   Loughran-McDonald scoring; writes scored checkpoint with both component scores
   and composite.
3. `03_lead_lag_analysis.ipynb` — Loads scored checkpoint; runs Granger causality
   and cross-correlation; writes analysis checkpoint with p-values and lag scores.
4. `04_visualization.ipynb` — Loads analysis checkpoint; builds Louvain clusters;
   renders Plotly network graph; prints plain-language summary.

All intermediate data MUST be written to and read from `data/checkpoints/`. Raw
downloaded data MUST be written to `data/raw/`. Neither directory is committed to
version control.

## Governance

This constitution supersedes all other development guidelines for this project.
Amendments MUST:

1. Update this file with the change rationale.
2. Increment `CONSTITUTION_VERSION` according to semantic versioning:
   - **MAJOR**: Removal or redefinition of a Core Principle (e.g., adding a paid API,
     changing the weighting rule).
   - **MINOR**: New principle, section added, or notebook architecture change.
   - **PATCH**: Clarifications, wording improvements, non-semantic refinements.
3. Update `LAST_AMENDED_DATE` to the date of the change.
4. Record the change in the Sync Impact Report comment at the top of this file.

All implementation plans and feature specifications MUST include a Constitution
Check gate verifying compliance with the five Core Principles before work begins.

**Version**: 1.0.0 | **Ratified**: 2026-04-20 | **Last Amended**: 2026-04-20
