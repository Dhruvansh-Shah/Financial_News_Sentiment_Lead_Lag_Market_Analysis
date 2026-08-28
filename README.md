# Financial News Sentiment Lead-Lag Market Analysis & Alpha Terminal

A high-performance quantitative research platform and 4-tier pipeline combining FinBERT NLP sentiment analysis, Granger causality testing, and graph theory to discover predictive lead-lag relationships across US equity markets.

---

## ⚡ Quant Alpha Terminal (Web Application)

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
1. Collects historical price data and financial news articles
2. Scores each article with FinBERT sentiment (positive / negative / neutral)
3. Computes a lead-lag score matrix and runs Granger causality tests
4. Builds an interactive network graph showing leader and follower stocks

---

## Pipeline Architecture

```
notebook_01  →  data/prices.parquet
             →  data/sentiment_raw.parquet

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
- Outputs `data/prices.parquet` and `data/sentiment_raw.parquet`

**Requires:** `.env` file with Kaggle credentials (see Setup below)

### `notebook_02_sentiment_analysis.ipynb`
- Runs each article headline through **FinBERT** (a finance-domain BERT model) to produce a daily average sentiment score per ticker
- Uses Apple MPS acceleration where available, falls back to CPU
- Outputs `data/sentiment_daily.parquet`

### `notebook_03_granger_and_leadlag.ipynb`
- Computes a **lead-lag score** for every ticker pair using lagged cross-correlations (lags −10 to +10 days)
- Runs **Granger causality tests** at lags 1–5 to verify whether sentiment Granger-causes price returns
- Outputs `data/lead_lag_matrix.parquet` and `data/granger_results.parquet`
- Displays a correlation heatmap

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

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/Dhruvansh-Shah/Financial_News_Sentiment_Lead_Lag_Market_Analysis.git
cd Financial_News_Sentiment_Lead_Lag_Market_Analysis
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Kaggle credentials
Create a `.env` file in the project root:
```
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_api_key
```
Get your API key from [kaggle.com/settings](https://www.kaggle.com/settings) → API → Create New Token.

### 4. Run notebooks in order
Open each notebook in Jupyter or VS Code and run all cells top to bottom:
```
notebook_01 → notebook_02 → notebook_03 → notebook_04
```

Set `INPUT_TICKER` at the top of notebook_04 to any ticker (e.g. `"NFLX"`) to see its leader/follower analysis.

---

## Key Results

Running the full pipeline on 2013–2021 data (10 tickers):

| Ticker | Role | Granger p-value | Centrality |
|--------|------|-----------------|------------|
| NFLX   | Leader | 0.0003 | High |
| AMZN   | Leader | — | High |
| NVDA   | Leader | — | High |
| META   | Follower | — | Medium |
| MSFT   | Follower | — | Medium |

NFLX has the strongest Granger-verified sentiment lead (p = 0.0003, lag = 1 day), meaning its news sentiment predicts the price returns of follower stocks one trading day later.

---

## Tech Stack

| Component | Library |
|-----------|---------|
| Data collection | `yfinance`, `kaggle` |
| Sentiment analysis | `transformers` (FinBERT), `torch` |
| Statistical testing | `statsmodels` (Granger causality) |
| Network analysis | `networkx`, `python-louvain` |
| Visualisation | `plotly`, `seaborn`, `matplotlib` |
| Data storage | `pandas`, `pyarrow` (Parquet) |

---

## Project Structure

```
.
├── notebook_01_data_collection.ipynb
├── notebook_02_sentiment_analysis.ipynb
├── notebook_03_granger_and_leadlag.ipynb
├── notebook_04_network_and_signals.ipynb
├── requirements.txt
├── data/                  # generated at runtime (not tracked in git)
│   ├── prices.parquet
│   ├── sentiment_raw.parquet
│   ├── sentiment_daily.parquet
│   ├── lead_lag_matrix.parquet
│   ├── granger_results.parquet
│   └── cluster_assignments.parquet
└── outputs/               # generated at runtime (not tracked in git)
    └── network_graph.html
```

---

## Author

Dhruvansh Shah
