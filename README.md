# Financial News Sentiment & Lead-Lag Market Analysis
Analyzes whether financial news sentiment statistically leads 
stock market returns using NLP and time-series correlation analysis.
<br>
author - Dhruvansh sachin Shah 

Traditional technical analysis ignores news. This project investigates 
whether sentiment extracted from financial headlines can predict 
short-term stock movements — and by how many days news sentiment 
"leads" actual price changes.

## Results
- Identified a dominant market reaction delay of **2–3 days**
- Peak Pearson correlation of **0.2–0.4** between sentiment and returns
- Processed **500+ headlines/day** across **480 trading days**
- Sentiment confirmed as a statistically meaningful **leading indicator**

- ## Pipeline
News API → Raw Headlines
    ↓
NLP Processing (tokenize → filter → score)
    ↓
Daily Sentiment Index
    ↓
Stock Price → Log Returns
    ↓
Lead-Lag Correlation (1–10 day lags)
    ↓
Results & Visualization

## Structure
├── data/              # Raw headlines + stock prices
├── notebooks/         # EDA and analysis notebooks
├── src/
│   ├── scraper.py     # API data collection
│   ├── nlp.py         # Sentiment pipeline
│   ├── analysis.py    # Lead-lag correlation
│   └── visualize.py   # Charts and plots
├── results/           # Output graphs
└── README.md
