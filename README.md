# Financial News Sentiment Lead-Lag Market Analysis & Alpha Terminal

A high-performance quantitative research platform and 4-tier pipeline combining FinBERT NLP sentiment analysis, Granger causality testing, and graph theory to discover predictive lead-lag relationships across US equity markets.

---

## Quant Alpha Terminal (Web Application)

An interactive, dark-mode Bloomberg-style quantitative terminal built for recruiters, researchers, and portfolio managers to inspect live lead-lag signals, force-directed network topology, Granger econometrics, and run interactive alpha shock simulations.

### Quick Start (Launch in 5 seconds):
```bash
# Option 1: Zero-dependency Python server
python3 serve.py

# Option 2: Vite development server
npm run dev

# Option 3: Build production bundle
npm run build
```
Open **http://localhost:8080** (or http://localhost:3000) in your browser.

### One-Click Cloud Deployment:
- **Vercel**: Deploy directly with `vercel` (uses included [vercel.json](file:///Users/dhruvansh/Documents/Claude/Projects/Lead%20Lag-2/vercel.json))
- **Netlify**: Deploy with `netlify deploy --prod` (uses included [netlify.toml](file:///Users/dhruvansh/Documents/Claude/Projects/Lead%20Lag-2/netlify.toml))

---

## Project Overview

This project answers the question: **Does news sentiment about one stock predict price movements of another stock days later?**

The pipeline:
1. Collects historical price data and financial news articles (73,936 articles across 10 US mega-caps)
2. Scores each article with FinBERT domain NLP sentiment (70% FinBERT + 30% Loughran-McDonald)
3. Computes a lead-lag score matrix and runs Granger causality Vector Autoregression F-tests
4. Builds an interactive network graph showing leader and follower stocks with Louvain modularity clustering

---

## Pipeline Architecture

```
notebook_01  →  data/raw_prices.parquet
             →  data/raw_news.parquet

notebook_02  →  data/sentiment_daily.parquet

notebook_03  →  data/lead_lag_matrix.parquet
             →  data/granger_results.parquet

notebook_04  →  data/cluster_assignments.parquet
             →  outputs/network_graph.html
```

---

## Notebooks

### `notebook_01_data_collection.ipynb`
- Downloads stock price data for 10 tickers (AAPL, MSFT, GOOGL, AMZN, META, TSLA, NVDA, INTC, AMD, NFLX) via `yfinance`
- Downloads the *All The News 2.1* dataset from Kaggle (~8 GB) and filters articles mentioning each ticker
- Generates 5 EDA charts for price trajectories and headline volumes
- Outputs `data/raw_prices.parquet` and `data/raw_news.parquet`

### `notebook_02_sentiment_analysis.ipynb`
- Runs each article headline through **FinBERT** (a finance-domain BERT model) combined with Loughran-McDonald lexicon scoring
- Uses Apple Metal (MPS) acceleration where available, falls back to CPU
- Generates EDA charts for sentiment distribution boxplots and return scatter
- Outputs `data/sentiment_daily.parquet`

### `notebook_03_granger_and_leadlag.ipynb`
- Computes a **lead-lag score** for every ticker pair using lagged cross-correlations (lags −10 to +10 days)
- Runs **Granger causality tests** at lags 1–5 to verify whether sentiment Granger-causes price returns
- Generates EDA charts for Granger p-values, CCF curves, and ranked scores
- Outputs `data/lead_lag_matrix.parquet` and `data/granger_results.parquet`

### `notebook_04_network_and_signals.ipynb`
- Builds an undirected NetworkX graph from the lead-lag matrix (edges where |L(i,j)| > 0.05)
- Runs **Louvain community detection** to partition tickers into leader and follower clusters
- Computes **eigenvector centrality** (max_iter=1000) as an influence score
- Saves `data/cluster_assignments.parquet`
- Renders an interactive **Plotly network graph** (spring layout, seed 42):
  - Leaders → steelblue nodes
  - Followers → darkorange nodes
  - Node size ∝ centrality (scaled 20–60)
  - Edge width ∝ lead-lag score (scaled 1–5)
- Saves `outputs/network_graph.html`
- Prints a suggestion table and plain-language summary for any ticker set as `INPUT_TICKER`

---

## Key Results

Running the full pipeline on 2013–2021 data (10 tickers):

| Ticker | Role | Granger p-value | Centrality | Optimal Lag |
|--------|------|-----------------|------------|-------------|
| NFLX   | Leader | 0.000340 | 0.6271 | 1 Day |
| AMZN   | Leader | 0.031245 | 0.6750 | 2 Days |
| INTC   | Follower | 0.032600 | 0.1650 | 1 Day |
| NVDA   | Leader | 0.114000 | 0.0000 | 1 Day |
| AAPL   | Leader | 0.352000 | 0.1420 | 1 Day |
| TSLA   | Leader | 0.395000 | 0.3140 | 1 Day |
| META   | Follower | 0.120000 | 1.0000 | 1 Day |
| MSFT   | Follower | 0.587000 | 0.3590 | 1 Day |
| GOOGL  | Follower | 0.590000 | 0.6140 | 1 Day |
| AMD    | Follower | 0.720000 | 0.2310 | 1 Day |

**NFLX** has the strongest Granger-verified sentiment lead (p = 0.0003, lag = 1 day), meaning its news sentiment statistically predicts the price returns of follower stocks one trading day later.

---

## Tech Stack

| Component | Library |
|-----------|---------|
| Data collection | `yfinance`, `kaggle` |
| Sentiment analysis | `transformers` (FinBERT), `torch` |
| Statistical testing | `statsmodels` (Granger causality) |
| Network analysis | `networkx`, `python-louvain` |
| Visualisation & UI | `plotly`, `seaborn`, `matplotlib`, `Vite`, `Chart.js`, `Canvas` |
| Data storage | `pandas`, `pyarrow` (Parquet) |

---

## Author

Dhruvansh Shah
