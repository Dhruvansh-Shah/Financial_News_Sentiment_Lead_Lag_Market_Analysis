# Feature Specification: Network Graph and Signals Notebook (notebook_04)

**Feature Branch**: `004-network-signals-notebook`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "notebook_04_network_and_signals.ipynb — Louvain community detection, interactive Plotly network graph, and plain-language trading signals"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cluster Stocks Into Leaders and Followers (Priority: P1)

An analyst sets `INPUT_TICKER` at the top of the notebook (matching the value used
in notebook_01), then runs all cells. The notebook partitions the ticker universe
into a leader cluster and a follower cluster using community detection on the
lead-lag graph, computes an influence score for each stock, and saves the cluster
assignments for inspection.

**Why this priority**: The cluster assignments are the foundation of the
plain-language output. Without them, the notebook cannot determine whether
`INPUT_TICKER` leads or follows, and the suggestion table cannot be built.

**Independent Test**: Run all cells with any valid `INPUT_TICKER`. Verify
`data/cluster_assignments.parquet` is created with columns `ticker`, `cluster`,
`centrality_score`. Verify the `cluster` column contains exactly two distinct
values (e.g., "leader" and "follower") and that every ticker from the lead-lag
matrix is assigned to one of them.

**Acceptance Scenarios**:

1. **Given** `data/lead_lag_matrix.parquet` is loaded,
   **When** the graph-building cell runs,
   **Then** only ticker pairs whose absolute lead-lag score exceeds 0.05 appear as
   edges in the graph, and edge weights equal the absolute lead-lag scores.
2. **Given** the undirected graph is built,
   **When** the community-detection cell runs,
   **Then** all tickers are assigned to a partition by the Louvain algorithm.
3. **Given** two partitions are detected,
   **When** the cluster-labelling cell runs,
   **Then** the partition with higher net outflow (sum of signed `L(i,j)` from
   members to non-members) is labelled "leader" and the other "follower".
4. **Given** cluster labels are assigned,
   **When** the centrality cell runs,
   **Then** every ticker has a `centrality_score` between 0.0 and 1.0.

---

### User Story 2 — Generate Interactive Network Graph (Priority: P2)

The analyst runs the visualisation cells and receives an interactive HTML file that
maps the full ticker network. Nodes are coloured by cluster role (leader vs.
follower), sized by influence score, and connected by edges whose thickness
reflects the strength of the lead-lag relationship. The file can be opened in any
browser without additional software.

**Why this priority**: Constitution Principle V mandates that a network graph is
produced for every run. This is the interactive deliverable that satisfies that
requirement.

**Independent Test**: Run all cells. Verify `outputs/network_graph.html` is created
and is non-empty. Open the file in a browser and confirm: leader nodes are
steel-blue, follower nodes are dark-orange, node labels show ticker symbols, and
hovering/panning/zooming works.

**Acceptance Scenarios**:

1. **Given** cluster assignments and centrality scores are computed,
   **When** the layout cell runs,
   **Then** node positions are determined by the spring-layout algorithm with a
   fixed random seed, producing a deterministic layout across runs.
2. **Given** node positions are available,
   **When** the graph render cell runs,
   **Then** leader nodes are rendered in steel-blue and follower nodes in
   dark-orange; node diameter scales linearly from the minimum to maximum
   centrality score, mapped to the range 20–60 pixels.
3. **Given** the graph is rendered,
   **When** edges are drawn,
   **Then** edge thickness scales linearly from the minimum to maximum absolute
   lead-lag score among displayed edges, mapped to the range 1–5 pixels.
4. **Given** the graph is complete,
   **When** the save cell runs,
   **Then** the interactive chart is written to `outputs/network_graph.html` as a
   self-contained HTML file requiring no external dependencies to render.

---

### User Story 3 — Print Plain-Language Suggestion for INPUT_TICKER (Priority: P3)

After the graph is saved, the notebook prints a human-readable table and a
plain-language paragraph tailored to `INPUT_TICKER`. If the ticker is a leader, the
output identifies which follower stocks it influences and the estimated lag. If it
is a follower, the output identifies which leader stocks influence it. The summary
explicitly states whether the Granger test validated a causal link for
`INPUT_TICKER`.

**Why this priority**: Constitution Principle V requires that a plain-language
summary accompany every network graph. This is the non-negotiable final output.

**Independent Test**: Run the notebook with two different `INPUT_TICKER` values —
one known leader, one known follower. Verify that: (a) a tabular suggestion is
printed listing related tickers with their `L` score and `optimal_lag`; (b) a
paragraph is printed that includes the words "leads" or "follows", the ticker
symbol, and an explicit statement about Granger verification status.

**Acceptance Scenarios**:

1. **Given** `INPUT_TICKER` is classified as a leader,
   **When** the suggestion cell runs,
   **Then** the table lists all follower tickers with their signed `L(INPUT_TICKER, follower)`
   score and the `optimal_lag` from `granger_results.parquet`, sorted by absolute
   `L` score descending.
2. **Given** `INPUT_TICKER` is classified as a follower,
   **When** the suggestion cell runs,
   **Then** the table lists all leader tickers with their signed
   `L(leader, INPUT_TICKER)` score and the leader's `optimal_lag`, sorted by
   absolute `L` score descending.
3. **Given** `INPUT_TICKER`'s `granger_verified` is `True`,
   **When** the plain-language paragraph is printed,
   **Then** the text explicitly states that sentiment for `INPUT_TICKER` was found
   to Granger-cause its price movement, and names the optimal lag in trading days.
4. **Given** `INPUT_TICKER`'s `granger_verified` is `False`,
   **When** the plain-language paragraph is printed,
   **Then** the text explicitly states that no statistically significant Granger
   causality was detected, and cautions the analyst accordingly.

---

### Edge Cases

- What if `INPUT_TICKER` is not present in the lead-lag matrix? The notebook MUST
  raise a clear error before building the graph, prompting the analyst to check that
  notebook_01 was run with the same ticker.
- What if the Louvain algorithm produces more than two partitions? The notebook
  MUST merge all partitions into exactly two groups by labelling the highest
  net-outflow partition as "leader" and combining all others into "follower".
- What if the Louvain algorithm produces only one partition (all tickers in one
  community)? The notebook MUST print a warning stating clustering was inconclusive,
  set all tickers to "follower", and still produce all output files.
- What if eigenvector centrality fails to converge within 1000 iterations? The
  notebook MUST fall back to degree centrality with a printed warning, rather than
  raising an exception.
- What if no edges meet the 0.05 absolute threshold? The notebook MUST print a
  warning that the graph is empty, skip clustering, and set all tickers to
  "follower" before continuing to the output steps.
- What if `outputs/` directory does not exist? The notebook MUST create it before
  saving `network_graph.html`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The notebook MUST expose `INPUT_TICKER` as the first user-settable
  variable in the top configuration cell.
- **FR-002**: The notebook MUST read `data/lead_lag_matrix.parquet`,
  `data/granger_results.parquet`, and `data/sentiment_daily.parquet`; if any file
  is missing, the notebook MUST raise an error identifying the missing file.
- **FR-003**: The notebook MUST raise an error before graph construction if
  `INPUT_TICKER` is not present in the lead-lag matrix.
- **FR-004**: The notebook MUST build an undirected graph where an edge between
  tickers i and j is added only when `|L(i,j)| > 0.05`, with edge weight set to
  `|L(i,j)|`.
- **FR-005**: The notebook MUST run Louvain community detection on the undirected
  graph and assign every ticker to a partition.
- **FR-006**: The notebook MUST label partitions using net outflow computed from the
  signed lead-lag matrix: net outflow of partition P = sum of `L(i,j)` for all i in
  P and j not in P. The partition with the highest net outflow is labelled "leader";
  all others are merged into "follower".
- **FR-007**: The notebook MUST compute eigenvector centrality for all nodes with a
  maximum of 1000 iterations; if convergence fails, it MUST fall back to degree
  centrality with a warning.
- **FR-008**: The notebook MUST save `data/cluster_assignments.parquet` with exactly
  three columns: `ticker`, `cluster` (values "leader" or "follower"),
  `centrality_score`.
- **FR-009**: The notebook MUST determine node layout using a spring-layout
  algorithm with a fixed random seed of 42, producing a deterministic layout.
- **FR-010**: The notebook MUST render a Plotly network graph where: leader nodes
  are steel-blue, follower nodes are dark-orange, node size scales linearly between
  20 and 60 (mapped from min to max centrality), edge thickness scales linearly
  between 1 and 5 (mapped from min to max absolute lead-lag score of displayed
  edges), and every node is labelled with its ticker symbol.
- **FR-011**: The notebook MUST save the interactive graph as a self-contained HTML
  file at `outputs/network_graph.html`, creating the `outputs/` directory if it
  does not exist.
- **FR-012**: The notebook MUST print a suggestion table for `INPUT_TICKER`:
  - If `INPUT_TICKER` is a leader: list follower tickers, their `L(INPUT_TICKER,
    follower)` score, and `optimal_lag`, sorted by descending absolute `L` score.
  - If `INPUT_TICKER` is a follower: list leader tickers, their
    `L(leader, INPUT_TICKER)` score, and the leader's `optimal_lag`, sorted by
    descending absolute `L` score.
- **FR-013**: The notebook MUST print a plain-language paragraph for `INPUT_TICKER`
  that: names the ticker's role (leader or follower), lists the top related tickers,
  states the typical lag in trading days, and explicitly references whether Granger
  causality was verified for `INPUT_TICKER` (citing the p-value significance result).

### Key Entities

- **ClusterAssignment**: Per-ticker record with fields `ticker`, `cluster`
  ("leader" or "follower"), `centrality_score` (float between 0.0 and 1.0).
- **NetworkGraph**: An undirected weighted graph where nodes are tickers and edges
  connect pairs with `|L(i,j)| > 0.05`; stored as an in-memory structure and
  exported as an interactive HTML file.
- **SuggestionRow**: A row in the plain-language suggestion table, with fields
  `related_ticker`, `lead_lag_score`, `optimal_lag_days`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running all cells on a clean kernel completes without unhandled
  exceptions, given all three input files are present and `INPUT_TICKER` is in the
  lead-lag matrix.
- **SC-002**: `data/cluster_assignments.parquet` contains exactly one row per
  ticker with zero null values, and the `cluster` column contains only the values
  "leader" and "follower".
- **SC-003**: `outputs/network_graph.html` is a non-empty self-contained HTML file
  that renders correctly when opened in a browser with no external network
  dependencies.
- **SC-004**: The suggestion table printed inline contains at least one row and
  includes columns for the related ticker, lead-lag score, and lag in trading days.
- **SC-005**: The plain-language paragraph explicitly mentions `INPUT_TICKER` by
  symbol, its role, and whether Granger causality was verified — verifiable by text
  search of the printed output.
- **SC-006**: Running the notebook twice with the same `INPUT_TICKER` produces
  identical cluster assignments and an identical network graph layout (deterministic
  output due to fixed seed).

## Assumptions

- `INPUT_TICKER` in this notebook MUST match the value used in notebook_01; no
  cross-notebook validation is performed — the analyst is responsible for
  consistency.
- All three input files (`lead_lag_matrix.parquet`, `granger_results.parquet`,
  `sentiment_daily.parquet`) are produced by earlier notebooks and conform to the
  schemas defined in specs 001–003; no additional schema validation is performed.
- The Louvain algorithm is non-deterministic by nature; results may vary slightly
  across runs. The fixed seed applies to the graph layout only, not to the community
  detection. If reproducible clustering is required this can be addressed in a
  future amendment.
- When the Louvain algorithm produces more than two partitions, all non-maximum
  net-outflow partitions are merged into "follower". This may occasionally group
  tickers with different behaviour; it is an accepted simplification.
- The `optimal_lag` values shown in the suggestion table are sourced from
  `granger_results.parquet` (notebook_03 output) and represent the lag at which the
  Granger F-test p-value was minimised, not the cross-correlation peak lag.
- The edge threshold of 0.05 (absolute lead-lag score) is fixed and not
  user-configurable in this notebook.
- Node size and edge thickness are scaled linearly using min-max normalisation
  within the current run; absolute values are not preserved across runs.
- The notebook overwrites both output files (`cluster_assignments.parquet` and
  `network_graph.html`) on each run without confirmation.
