# Research: Lead-Lag Sentiment Analyser — Technical Decisions

**Branch**: `004-network-signals-notebook` | **Date**: 2026-04-20

All decisions below resolve the specific technical questions raised in the planning
request. No unknowns remain.

---

## 1. Pip Dependencies Per Notebook

### Shared Base (`requirements.txt` — install once in VS Code)

```
python-dotenv>=1.0.0
pandas>=2.0.0
pyarrow>=14.0.0
numpy>=1.26.0
```

### notebook_01 — Data Collection

```
kaggle>=1.6.0
yfinance>=0.2.36
pandas-market-calendars>=4.3.0
```

### notebook_02 — Sentiment Scoring

```
torch>=2.2.0
transformers>=4.39.0
lm-ssc>=0.1.0
tqdm>=4.66.0
```

*Note*: For Colab, `torch` is pre-installed. For MPS (Apple Silicon), `torch>=2.0`
with the standard macOS wheel is required — no separate MPS package needed.

### notebook_03 — Granger and Lead-Lag

```
statsmodels>=0.14.0
scipy>=1.12.0
seaborn>=0.13.0
matplotlib>=3.8.0
```

### notebook_04 — Network and Signals

```
networkx>=3.2.0
python-louvain>=0.16
plotly>=5.20.0
```

**Rationale**: Dependencies are split by notebook to minimise install time when
running only a subset. `requirements.txt` covers the shared base; each notebook
cell begins with `%pip install <notebook-specific packages>` for Colab portability.

---

## 2. Kaggle Credential Loading from `.env`

**Decision**: Use `python-dotenv` to load `KAGGLE_USERNAME` and `KAGGLE_KEY` from a
`.env` file at the project root, then set them as `os.environ` variables before
calling the Kaggle API.

**Mechanism**:
1. `load_dotenv()` reads `.env` at the project root (or Colab working directory).
2. `os.environ['KAGGLE_USERNAME']` and `os.environ['KAGGLE_KEY']` are set from the
   loaded values.
3. `kaggle.api.authenticate()` reads those environment variables automatically —
   no `~/.kaggle/kaggle.json` file is required.
4. `kaggle.api.dataset_download_files('ammarali32/all-the-news-2-1', path='data/raw/', unzip=True)`
   downloads and unzips the dataset.

**Colab note**: On Colab, the analyst uploads `.env` to the session working
directory or sets secrets via Colab Secrets — the `load_dotenv()` call is
identical; only the path of `.env` changes.

**Alternatives considered**:
- Hardcoded credentials in notebook — rejected (security risk, not commitable).
- `~/.kaggle/kaggle.json` — rejected (not portable to Colab without extra steps).

---

## 3. FinBERT Batching With MPS / CUDA / CPU Fallback

**Decision**: Device selection runs at notebook startup in strict priority order:
MPS → CUDA → CPU. All subsequent model and tensor operations use the selected
device.

**Mechanism**:

```
Priority 1: torch.backends.mps.is_available()  → device = "mps"
Priority 2: torch.cuda.is_available()           → device = "cuda"
Priority 3: fallback                             → device = "cpu"
```

After device selection, a message is printed: `Using device: {device}`.

**Model loading**:
- `AutoTokenizer.from_pretrained('ProsusAI/finbert')` — downloads and caches on
  first run; uses cache on subsequent runs.
- `AutoModelForSequenceClassification.from_pretrained('ProsusAI/finbert').to(device)`
  — model moved to selected device once at load time.

**Batch loop**:
- Headlines are processed in chunks of 64.
- Each batch is tokenised with `max_length=512`, `truncation=True`, `padding=True`.
- Input tensors are moved to the device with `{k: v.to(device) for k, v in inputs.items()}`.
- Inference runs inside `torch.no_grad()` for memory efficiency.
- Logits are softmax-normalised on CPU after `.cpu()` call.

**Label mapping for ProsusAI/finbert**:
The model's `config.json` defines: `id2label = {0: "positive", 1: "negative", 2: "neutral"}`.
- `argmax == 0` (positive): score = `+probs[0]`
- `argmax == 1` (negative): score = `−probs[1]`
- `argmax == 2` (neutral): score = `0`

**MPS caveat**: Some PyTorch operations fall back to CPU on MPS silently. If a
`NotImplementedError` is raised during inference on MPS, the notebook falls back to
CPU with a printed warning.

**Alternatives considered**:
- `pipeline('text-classification')` wrapper — rejected (less control over batching
  and device placement; harder to extract raw logits reliably).

---

## 4. Loughran-McDonald Scoring via `lm-ssc`

**Decision**: Use the `lm-ssc` package which bundles the LM master dictionary
CSV. Load positive and negative word sets once at notebook startup.

**Mechanism**:
1. `from lm_ssc import LoughranMcDonald` (or equivalent import per package API).
2. Extract `positive_words` and `negative_words` as Python `set` objects for O(1)
   lookup.
3. Per headline: lowercase, whitespace-split → token list.
4. `pos = len([t for t in tokens if t in positive_words])`
5. `neg = len([t for t in tokens if t in negative_words])`
6. `lm_score = 0.0 if len(tokens) == 0 else max(-1.0, min(1.0, (pos - neg) / len(tokens)))`

**Alternatives considered**:
- Downloading the LM CSV directly from the authors' site — rejected (requires
  internet at runtime; breaks offline reproducibility).

---

## 5. Louvain Two-Cluster Enforcement

**Decision**: After `community.best_partition(G)` returns an arbitrary number of
partitions, the result is normalised to exactly two labels ("leader" / "follower")
using net-outflow labelling on the signed lead-lag matrix.

**Mechanism**:

```
partition = community.best_partition(G)   # {ticker: partition_id}
partition_ids = set(partition.values())

Case A — 0 or 1 partition (empty graph or unanimous community):
  All tickers → "follower"; print warning "clustering inconclusive".

Case B — 2 partitions:
  For each partition P:
    net_outflow(P) = sum(L[i][j]) for i in P, j not in P
  Leader = partition with max(net_outflow).
  Follower = the other partition.

Case C — 3+ partitions:
  For each partition P:
    net_outflow(P) = sum(L[i][j]) for i in P, j not in P
  Leader = partition with max(net_outflow).
  Follower = all remaining partitions merged.
```

**Why net outflow**: A partition whose members systematically have positive L(i,j)
scores toward outsiders (meaning they "precede" other tickers in price movement)
has higher net outflow. This is a direct measure of the leader/follower relationship
encoded in the signed matrix.

**Louvain non-determinism**: `community.best_partition` uses a random initialisation
and may produce different partition boundaries across runs. The fixed seed (42) is
applied to the spring layout only. If reproducible clustering is a hard requirement,
set `random_state=42` in the `best_partition` call — this is a future amendment
candidate.

**Alternatives considered**:
- Spectral clustering with 2 clusters — rejected (requires eigendecomposition;
  more complex than Louvain; doesn't leverage the graph community structure).
- Hard-coding k=2 Louvain — `python-louvain` does not expose a `k` parameter;
  the normalisation step above is the canonical workaround.

---

## 6. Plotly Network Graph Construction

**Decision**: Use `networkx.spring_layout(G, seed=42)` for positions, then
construct Plotly `go.Scatter` traces manually (one per edge, one for all nodes).
Save as self-contained HTML with `fig.write_html(..., include_plotlyjs='cdn')` for
small file size, or `full_html=True` for fully offline rendering.

**Recommendation**: Use `include_plotlyjs=True` (embed the JS bundle) to ensure
the file opens without internet access — this aligns with Constitution Principle I
(offline reproducibility).

**Mechanism**:

```
1. pos = nx.spring_layout(G, seed=42)
   → {ticker: [x, y]} for all nodes in G

2. Edge traces: one go.Scatter per edge (mode='lines')
   - width = linear_scale(|L(i,j)|, min_weight, max_weight, out_min=1, out_max=5)
   - color = 'rgba(150,150,150,0.5)'

3. Node trace: single go.Scatter (mode='markers+text')
   - x, y from pos
   - marker size = linear_scale(centrality[t], min_c, max_c, out_min=20, out_max=60)
   - marker color = 'steelblue' if cluster=='leader' else 'darkorange'
   - text = ticker symbol (shown as node label)

4. Linear scale helper:
   scale(v) = out_min + (v - v_min) / (v_max - v_min) * (out_max - out_min)
   Edge case: if v_max == v_min return midpoint of out range.

5. Layout: no axes, white background, title "Lead-Lag Network — {INPUT_TICKER}"

6. Save: fig.write_html('outputs/network_graph.html', include_plotlyjs=True)
   os.makedirs('outputs', exist_ok=True)  # create dir if absent
```

**Alternatives considered**:
- Pyvis — rejected (less control over visual encoding; harder to embed).
- Plotly Express graph_objects wrapper — rejected (spring layout coordinates need
  manual wiring; native go.Scatter is simpler for this use case).

---

## 7. Cross-Correlation vs Granger Data Source Split

**Decision** (from clarification Q5): The two analyses use different data sources:

| Analysis | Data Source | Rationale |
| -------- | ----------- | --------- |
| Granger causality | Merged sentiment+price (inner join on date+ticker) | Tests whether sentiment predicts price; both must exist on same date |
| Cross-correlation | Full `raw_prices.parquet` (all trading days 2013–2020) | Measures price co-movement timing; maximises series length regardless of news coverage |

This means tickers with zero news rows (e.g., energy sector tickers with thin
coverage) still appear in the lead-lag matrix via their full price series, but are
recorded as `granger_verified=False` in Granger results.

---

## 8. Kaggle Dataset Date Coverage

**Confirmed** (from clarification Q3): The `ammarali32/all-the-news-2-1` dataset
covers approximately 2013–2018. Price data is fetched 2013-01-01 to 2020-12-31.
The effective analysis window is the intersection of news dates and price dates,
determined automatically by the notebook_03 inner-join. No explicit date clipping
is performed in notebook_01.
