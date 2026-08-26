---
description: "Task list for notebook_04_network_and_signals.ipynb"
---

# Tasks: Network Graph and Signals Notebook (notebook_04)

**Input**: Design documents from `specs/004-network-signals-notebook/`
**Prerequisites**: spec.md (required), plan.md (required), research.md, data-model.md
**Dependency**: `data/lead_lag_matrix.parquet` + `data/granger_results.parquet` (notebook_03), `data/sentiment_daily.parquet` (notebook_02)

**Organization**: Tasks map directly to notebook cells in execution order, grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Create the notebook file.

- [x] T001 Create `notebook_04_network_and_signals.ipynb` at repository root as an empty Jupyter notebook with kernel spec `python3`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Install dependencies, expose `INPUT_TICKER`, load and validate all three input files — required before any analysis can begin.

- [x] T002 Add Cell 1 in `notebook_04_network_and_signals.ipynb`: `%pip install -q networkx python-louvain plotly pandas pyarrow numpy`
- [x] T003 Add Cell 2 in `notebook_04_network_and_signals.ipynb`: configuration — `INPUT_TICKER = "AAPL"` as the first user-settable variable; add a comment `# ← Set this to match the ticker used in notebook_01`; wrap nothing (this cell is plain config, no try-except needed)
- [x] T004 Add Cell 3 in `notebook_04_network_and_signals.ipynb`: load and validate inputs — `import pandas as pd, numpy as np, os` and `from pathlib import Path`; for each of `"data/lead_lag_matrix.parquet"`, `"data/granger_results.parquet"`, `"data/sentiment_daily.parquet"`: if not `Path(f).exists()` raise `FileNotFoundError(f"{f} not found — run notebook_0X first")`; load: `df_ll = pd.read_parquet("data/lead_lag_matrix.parquet", index_col=0)` (preserve ticker row/col labels), `df_granger = pd.read_parquet("data/granger_results.parquet")`, `df_sentiment = pd.read_parquet("data/sentiment_daily.parquet")`; print shape of each; wrap in try-except with `[ERROR]` print and `raise SystemExit(1) from None`
- [x] T005 Add Cell 4 in `notebook_04_network_and_signals.ipynb`: validate INPUT_TICKER and extract TICKERS — `TICKERS = list(df_ll.index)`; if `INPUT_TICKER not in TICKERS`: raise `ValueError(f"INPUT_TICKER '{INPUT_TICKER}' not found in lead-lag matrix. Re-run notebook_01 with this ticker.")`; print `f"INPUT_TICKER: {INPUT_TICKER}"`; print `f"Ticker universe: {TICKERS}"`; wrap in try-except

**Checkpoint**: All three inputs loaded, INPUT_TICKER validated — graph construction can begin.

---

## Phase 3: User Story 1 — Cluster Stocks Into Leaders and Followers (Priority: P1)

**Goal**: Build undirected NetworkX graph, run Louvain, label partitions by net outflow (leaders = highest net outflow), compute eigenvector centrality, save `data/cluster_assignments.parquet`.

**Independent Test**: After all cells run, `data/cluster_assignments.parquet` exists with exactly columns `ticker`, `cluster`, `centrality_score`. `cluster` column contains only "leader" and "follower". Every ticker from `df_ll.index` has an assignment.

### Implementation for User Story 1

- [x] T006 [US1] Add Cell 5 in `notebook_04_network_and_signals.ipynb`: build undirected graph — `import networkx as nx`; `G = nx.Graph()`; `G.add_nodes_from(TICKERS)`; iterate over all ordered pairs `(i, j)` where `i != j` and `i < j` (upper triangle to avoid duplicate undirected edges): `w = abs(df_ll.loc[i, j])`; if `w > 0.05`: `G.add_edge(i, j, weight=w)`; print `f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges (|L| > 0.05 threshold)"`; if `G.number_of_edges() == 0`: print `"WARNING: no edges meet the 0.05 threshold — all tickers set to follower"`; `cluster_map = {t: 'follower' for t in TICKERS}`; handle this downstream; wrap in try-except
- [x] T007 [US1] Add Cell 6 in `notebook_04_network_and_signals.ipynb`: Louvain community detection — `import community as community_louvain`; if `G.number_of_edges() == 0`: `partition = {t: 0 for t in TICKERS}`; else: `partition = community_louvain.best_partition(G)`; `n_partitions = len(set(partition.values()))`; print `f"Louvain detected {n_partitions} partition(s)"`; if `n_partitions == 1`: print `"WARNING: only one partition detected — clustering inconclusive, all tickers set to follower"`; wrap in try-except
- [x] T008 [US1] Add Cell 7 in `notebook_04_network_and_signals.ipynb`: label partitions by net outflow — if `n_partitions <= 1`: `cluster_map = {t: 'follower' for t in TICKERS}`; else: get all partition IDs `part_ids = set(partition.values())`; for each `pid` in `part_ids`: `members = [t for t, p in partition.items() if p == pid]`; `non_members = [t for t in TICKERS if t not in members]`; `net_outflow = sum(df_ll.loc[i, j] for i in members for j in non_members)`; record `(pid, net_outflow, members)`; identify `leader_pid` as the pid with highest net_outflow; `cluster_map = {t: ('leader' if partition[t] == leader_pid else 'follower') for t in TICKERS}`; print summary: number of leaders, number of followers, which partition was chosen as leaders; wrap in try-except
- [x] T009 [US1] Add Cell 8 in `notebook_04_network_and_signals.ipynb`: eigenvector centrality with fallback — try `centrality = nx.eigenvector_centrality(G, max_iter=1000, weight='weight')`; except `nx.PowerIterationFailedConvergence`: print `"WARNING: eigenvector centrality failed to converge — falling back to degree centrality"`; `centrality = nx.degree_centrality(G)`; normalize centrality values to `[0.0, 1.0]` using min-max: `min_c = min(centrality.values())`; `max_c = max(centrality.values())`; if `max_c == min_c`: `centrality_norm = {t: 0.5 for t in TICKERS}`; else: `centrality_norm = {t: (centrality[t] - min_c) / (max_c - min_c) for t in TICKERS}`; wrap outer in try-except
- [x] T010 [US1] Add Cell 9 in `notebook_04_network_and_signals.ipynb`: save cluster assignments — `df_clusters = pd.DataFrame([{"ticker": t, "cluster": cluster_map[t], "centrality_score": centrality_norm[t]} for t in TICKERS])`; `os.makedirs("data", exist_ok=True)`; `df_clusters.to_parquet("data/cluster_assignments.parquet", index=False)`; print `f"Saved data/cluster_assignments.parquet — {len(df_clusters)} tickers"`; print `df_clusters.groupby("cluster").size().to_string()`; wrap in try-except

**Checkpoint**: User Story 1 independently testable — reload parquet, verify columns, two distinct cluster values, no nulls.

---

## Phase 4: User Story 2 — Interactive Network Graph (Priority: P2)

**Goal**: Compute spring layout (seed 42), build Plotly figure with node colours by cluster, node size by centrality (scaled 20–60), edge thickness by |L| score (scaled 1–5), save `outputs/network_graph.html`.

**Independent Test**: Run cells; verify `outputs/network_graph.html` exists and is non-empty (> 1 KB). Open in browser: leaders are steel-blue, followers dark-orange, every node labelled with ticker symbol.

### Implementation for User Story 2

- [x] T011 [US2] Add Cell 10 in `notebook_04_network_and_signals.ipynb`: compute layout — `pos = nx.spring_layout(G, seed=42)`; if any TICKERS not in `pos` (isolated nodes with no edges): assign a default position e.g. `pos.setdefault(t, (0.0, 0.0))`; print `f"Spring layout computed for {len(pos)} nodes (seed=42)"`; wrap in try-except
- [x] T012 [US2] Add Cell 11 in `notebook_04_network_and_signals.ipynb`: build Plotly figure — `import plotly.graph_objects as go`; helper: `def scale_to_range(val, vmin, vmax, out_min, out_max): return out_min if vmax == vmin else out_min + (val - vmin) * (out_max - out_min) / (vmax - vmin)`; --- EDGES: `edge_traces = []`; for each edge `(u, v, d)` in `G.edges(data=True)`: compute `thickness = scale_to_range(d["weight"], min_edge_w, max_edge_w, 1, 5)` where `min_edge_w = min(d["weight"] for *_, d in G.edges(data=True))` and `max_edge_w = max(...)` (compute before loop); create a `go.Scatter` trace with `x=[pos[u][0], pos[v][0], None]`, `y=[pos[u][1], pos[v][1], None]`, `mode="lines"`, `line=dict(width=thickness, color="#aaaaaa")`, `hoverinfo="none"`; append to `edge_traces`; --- NODES: `node_x = [pos[t][0] for t in TICKERS]`; `node_y = [pos[t][1] for t in TICKERS]`; `node_colors = ["steelblue" if cluster_map[t] == "leader" else "darkorange" for t in TICKERS]`; `node_sizes = [scale_to_range(centrality_norm[t], 0.0, 1.0, 20, 60) for t in TICKERS]`; `node_trace = go.Scatter(x=node_x, y=node_y, mode="markers+text", text=TICKERS, textposition="top center", marker=dict(size=node_sizes, color=node_colors, line=dict(width=1, color="#333333")), hovertext=[f"{t} ({cluster_map[t]}, centrality={centrality_norm[t]:.3f})" for t in TICKERS], hoverinfo="text")`; --- FIGURE: `fig = go.Figure(data=edge_traces + [node_trace], layout=go.Layout(title=f"Lead-Lag Network — {INPUT_TICKER} highlighted", showlegend=False, hovermode="closest", xaxis=dict(showgrid=False, zeroline=False, showticklabels=False), yaxis=dict(showgrid=False, zeroline=False, showticklabels=False), margin=dict(l=20, r=20, t=40, b=20)))`; wrap in try-except
- [x] T013 [US2] Add Cell 12 in `notebook_04_network_and_signals.ipynb`: save HTML — `os.makedirs("outputs", exist_ok=True)`; `fig.write_html("outputs/network_graph.html", full_html=True)`; `size_kb = Path("outputs/network_graph.html").stat().st_size / 1024`; print `f"Saved outputs/network_graph.html — {size_kb:.1f} KB"`; wrap in try-except

**Checkpoint**: User Story 2 independently testable — file exists, non-empty, renders in browser.

---

## Phase 5: User Story 3 — Suggestion Table and Plain-Language Summary (Priority: P3)

**Goal**: Print a suggestion table for `INPUT_TICKER` (follower stocks if leader; leader stocks if follower, with `L` scores and `optimal_lag`), then print a plain-language paragraph referencing Granger verification.

**Independent Test**: Run cells with a leader ticker and a follower ticker. Verify: (a) table has at least one row with `related_ticker`, `lead_lag_score`, `optimal_lag_days`; (b) paragraph mentions `INPUT_TICKER` by symbol, its role, and explicitly states Granger verification status.

### Implementation for User Story 3

- [x] T014 [US3] Add Cell 13 in `notebook_04_network_and_signals.ipynb`: suggestion table — determine `input_role = cluster_map[INPUT_TICKER]`; if `input_role == "leader"`: `counterparts = [t for t in TICKERS if cluster_map[t] == "follower"]`; `rows = [{"related_ticker": t, "lead_lag_score": df_ll.loc[INPUT_TICKER, t], "optimal_lag_days": df_granger.loc[df_granger["ticker"] == t, "optimal_lag"].values[0] if len(df_granger.loc[df_granger["ticker"] == t]) > 0 else None} for t in counterparts]`; else: `counterparts = [t for t in TICKERS if cluster_map[t] == "leader"]`; `rows = [{"related_ticker": t, "lead_lag_score": df_ll.loc[t, INPUT_TICKER], "optimal_lag_days": df_granger.loc[df_granger["ticker"] == t, "optimal_lag"].values[0] if len(df_granger.loc[df_granger["ticker"] == t]) > 0 else None} for t in counterparts]`; `df_suggestion = pd.DataFrame(rows).sort_values("lead_lag_score", ascending=False if input_role == "leader" else True, key=abs).reset_index(drop=True)`; print `f"\n=== Suggestion Table for {INPUT_TICKER} ({input_role.upper()}) ==="`; `pd.set_option("display.max_rows", None)`; print `df_suggestion.to_string(index=False)`; wrap in try-except
- [x] T015 [US3] Add Cell 14 in `notebook_04_network_and_signals.ipynb`: plain-language summary — get Granger row: `granger_row = df_granger[df_granger["ticker"] == INPUT_TICKER]`; `granger_verified = bool(granger_row["granger_verified"].values[0]) if len(granger_row) > 0 else False`; `opt_lag = granger_row["optimal_lag"].values[0] if len(granger_row) > 0 else None`; `min_p = granger_row["min_p_value"].values[0] if len(granger_row) > 0 else None`; top counterpart: `top_related = df_suggestion["related_ticker"].iloc[0] if len(df_suggestion) > 0 else "N/A"`; if `input_role == "leader"`: `role_text = f"{INPUT_TICKER} is a LEADER stock in this universe."`; `direction_text = f"It leads follower stocks such as {top_related}."` ; else: `role_text = f"{INPUT_TICKER} is a FOLLOWER stock in this universe."` ; `direction_text = f"It is influenced by leader stocks such as {top_related}."` ; if `granger_verified`: `granger_text = f"Granger causality analysis CONFIRMS that sentiment for {INPUT_TICKER} statistically predicts its price movement (p={min_p:.4f}, optimal lag={int(opt_lag)} trading day(s))."` ; else: `granger_text = f"Granger causality analysis did NOT find statistically significant sentiment-to-price predictability for {INPUT_TICKER} (min p={min_p:.4f if min_p is not None else 'N/A'}). Treat these signals with caution."` ; print `f"\n=== Plain-Language Summary ==="`; print `f"{role_text} {direction_text}"`; print `f"{granger_text}"`; wrap in try-except

**Checkpoint**: User Story 3 independently testable — table printed, paragraph contains ticker symbol, role, and Granger statement.

---

## Phase 6: Polish

- [x] T016 [P] Verify `.gitignore` at repository root contains `data/` and `outputs/` entries (already present from earlier notebooks; no change needed if present)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1 — installs, config, data load
- **US1 (Phase 3)**: Depends on Phase 2 — graph needs loaded data
- **US2 (Phase 4)**: Depends on US1 — layout and rendering need cluster_map and centrality_norm
- **US3 (Phase 5)**: Depends on US1 (cluster_map) and US2 (fig written, for display context)
- **Polish (Phase 6)**: Depends on all phases complete

### Parallel Opportunities

```text
Phase 1 → Phase 2 (T002→T003→T004→T005 sequential) →
  US1 (T006→T007→T008→T009→T010 sequential) →
    US2 (T011→T012→T013 sequential) →
      US3 (T014→T015 sequential) → Polish
```

All cells are sequential — each cell depends on variables defined by the previous cell.

---

## Implementation Strategy

### MVP (Minimum: US1 + US2 + US3 — all required by Constitution)

1. T001–T005 (setup + data load)
2. T006–T010 (graph + clustering + centrality + save)
3. T011–T013 (layout + Plotly + save HTML)
4. T014–T015 (suggestion table + plain-language summary)
5. T016 (gitignore check)

### Validation after full run

- Reload `data/cluster_assignments.parquet`: check 3 columns, 2 distinct cluster values, no nulls
- Verify `outputs/network_graph.html` exists and is > 1 KB
- Check printed output contains `INPUT_TICKER` symbol in both table and summary

---

## Notes

- `community.best_partition` is from `python-louvain`; import as `import community as community_louvain`
- Net outflow formula: `sum(df_ll.loc[i, j] for i in members for j in non_members)` — uses SIGNED L values from the original matrix, not absolute edge weights
- `spring_layout(G, seed=42)` only places nodes that are in the graph G; isolated nodes (no edges) need a default position added manually
- `fig.write_html(..., full_html=True)` produces a standalone HTML with embedded Plotly JS — no CDN required
- `df_ll` must be loaded with `index_col=0` (or equivalent) to preserve ticker labels as both row and column index
- `optimal_lag_days` in the suggestion table comes from `granger_results.parquet` `optimal_lag` column (the lag at which Granger F-test p-value was minimised)
- Edge loop uses `i < j` to avoid processing each undirected pair twice; the graph is undirected so `G.add_edge(i, j)` and `G.add_edge(j, i)` are equivalent
- Constitution Principle V is satisfied by both the Plotly HTML (US2) and the plain-language paragraph (US3) — both are required
