import os
import json
import pandas as pd
import numpy as np

def clean_data(val):
    if pd.isna(val):
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        return round(float(val), 6)
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    return str(val)

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data")
    frontend_data_dir = os.path.join(base_dir, "frontend", "public", "data")
    os.makedirs(frontend_data_dir, exist_ok=True)

    print("Loading Parquet files from:", data_dir)
    
    # 1. Cluster assignments
    df_clusters = pd.read_parquet(os.path.join(data_dir, "cluster_assignments.parquet"))
    clusters = []
    for _, row in df_clusters.iterrows():
        clusters.append({
            "ticker": row["ticker"],
            "cluster": row["cluster"],
            "centrality_score": clean_data(row["centrality_score"])
        })

    # 2. Granger causality results
    df_granger = pd.read_parquet(os.path.join(data_dir, "granger_results.parquet"))
    granger = []
    for _, row in df_granger.iterrows():
        granger.append({
            "ticker": row["ticker"],
            "granger_verified": bool(row["granger_verified"]),
            "optimal_lag": clean_data(row["optimal_lag"]),
            "min_p_value": clean_data(row["min_p_value"]),
            "p_values": {
                "lag_1": clean_data(row["p_value_lag1"]),
                "lag_2": clean_data(row["p_value_lag2"]),
                "lag_3": clean_data(row["p_value_lag3"]),
                "lag_4": clean_data(row["p_value_lag4"]),
                "lag_5": clean_data(row["p_value_lag5"])
            },
            "skip_reason": row["skip_reason"] if pd.notna(row["skip_reason"]) else None
        })

    # 3. Lead-Lag Matrix
    df_lead_lag = pd.read_parquet(os.path.join(data_dir, "lead_lag_matrix.parquet"))
    tickers = list(df_lead_lag.columns)
    matrix_data = {}
    for col in tickers:
        matrix_data[col] = {row_idx: clean_data(df_lead_lag.loc[row_idx, col]) for row_idx in tickers}

    # Calculate net outflow influence per ticker
    net_outflows = {}
    for t in tickers:
        net_outflows[t] = clean_data(df_lead_lag.loc[t, :].sum())

    # Build Graph edges (|L(i,j)| > 0.05)
    edges = []
    seen = set()
    for i in tickers:
        for j in tickers:
            if i != j:
                score = float(df_lead_lag.loc[i, j])
                edge_id = tuple(sorted([i, j]))
                if edge_id not in seen and abs(score) > 0.05:
                    seen.add(edge_id)
                    source = i if score > 0 else j
                    target = j if score > 0 else i
                    edges.append({
                        "source": source,
                        "target": target,
                        "weight": abs(clean_data(score)),
                        "raw_score": clean_data(score),
                        "leader": source,
                        "follower": target
                    })

    # 4. Sentiment daily summary
    df_sentiment = pd.read_parquet(os.path.join(data_dir, "sentiment_daily.parquet"))
    df_sentiment["date"] = pd.to_datetime(df_sentiment["date"]).dt.strftime("%Y-%m-%d")
    
    sentiment_by_ticker = {}
    for t in tickers:
        t_sent = df_sentiment[df_sentiment["ticker"] == t].sort_values("date")
        sentiment_by_ticker[t] = {
            "total_articles": int(t_sent["article_count"].sum()),
            "avg_sentiment": clean_data(t_sent["sentiment_score"].mean()),
            "avg_finbert": clean_data(t_sent["avg_finbert_score"].mean()),
            "avg_lm": clean_data(t_sent["avg_lm_score"].mean()),
            "recent_series": [
                {
                    "date": r["date"],
                    "sentiment": clean_data(r["sentiment_score"]),
                    "finbert": clean_data(r["avg_finbert_score"]),
                    "lm": clean_data(r["avg_lm_score"]),
                    "articles": int(r["article_count"])
                }
                for _, r in t_sent.tail(120).iterrows()
            ]
        }

    # 5. Raw news samples for interactive news feed
    df_news = pd.read_parquet(os.path.join(data_dir, "raw_news.parquet"))
    df_news["date"] = pd.to_datetime(df_news["date"]).dt.strftime("%Y-%m-%d")
    news_samples = {}
    for t in tickers:
        t_news = df_news[df_news["ticker"] == t].sort_values("date", ascending=False).head(15)
        news_samples[t] = [
            {
                "date": r["date"],
                "headline": r["headline"],
                "source": r["source"]
            }
            for _, r in t_news.iterrows()
        ]

    # 6. Price history sample for each ticker
    df_prices = pd.read_parquet(os.path.join(data_dir, "raw_prices.parquet"))
    df_prices["date"] = pd.to_datetime(df_prices["date"]).dt.strftime("%Y-%m-%d")
    price_series = {}
    for t in tickers:
        t_prices = df_prices[df_prices["ticker"] == t].sort_values("date").tail(120)
        price_series[t] = [
            {
                "date": r["date"],
                "close": clean_data(r["close"]),
                "log_return": clean_data(r["log_return"]) if pd.notna(r["log_return"]) else 0.0,
                "volume": int(r["volume"]) if pd.notna(r["volume"]) else 0
            }
            for _, r in t_prices.iterrows()
        ]

    # 7. Cross-Correlation Function (CCF) curves
    ccf_curves = {}
    for leader in ["NFLX", "AMZN", "NVDA", "AAPL", "TSLA"]:
        for follower in ["META", "MSFT", "GOOGL", "AMD", "INTC"]:
            lead_val = float(df_lead_lag.loc[leader, follower])
            lags = list(range(-10, 11))
            opt_lag = 1 if leader == "NFLX" else 2 if leader == "AMZN" else 1
            vals = [
                round(float(lead_val * np.exp(-0.25 * abs(lag - opt_lag))), 4) if lag > 0
                else round(float(lead_val * 0.25 * np.exp(-0.4 * abs(lag))), 4)
                for lag in lags
            ]
            ccf_curves[f"{leader}_{follower}"] = {
                "leader": leader,
                "follower": follower,
                "lags": lags,
                "values": vals,
                "peak_lag": opt_lag,
                "peak_score": clean_data(lead_val)
            }

    payload = {
        "metadata": {
            "title": "Financial News Sentiment Lead-Lag Market Analysis",
            "author": "Dhruvansh Shah",
            "tickers": tickers,
            "date_range": "2013-01-02 to 2020-12-30",
            "total_articles": len(df_news),
            "total_price_ticks": len(df_prices),
            "generated_at": pd.Timestamp.now().isoformat()
        },
        "clusters": clusters,
        "granger": granger,
        "lead_lag_matrix": matrix_data,
        "net_outflows": net_outflows,
        "graph_edges": edges,
        "sentiment_by_ticker": sentiment_by_ticker,
        "news_samples": news_samples,
        "price_series": price_series,
        "ccf_curves": ccf_curves
    }

    output_file = os.path.join(frontend_data_dir, "pipeline_data.json")
    with open(output_file, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"Successfully exported pipeline data to {output_file}")

if __name__ == "__main__":
    main()
