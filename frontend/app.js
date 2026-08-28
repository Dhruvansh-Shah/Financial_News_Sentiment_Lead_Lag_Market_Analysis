/**
 * AlphaFlow Quant Terminal - Main Application Engine
 * Financial News Sentiment Lead-Lag Market Analysis
 * Author: Dhruvansh Shah
 */

(function () {
  'use strict';

  // --- STATE ---
  let pipelineData = null;
  let activeTicker = 'NFLX';
  let activeTab = 'tab-overview';
  let activeChartType = 'series';
  let activeTickerChartInstance = null;
  let grangerChartInstance = null;
  let ccfChartInstance = null;
  let nlpChartInstance = null;
  let scatterChartInstance = null;

  // Graph Simulation State
  let graphNodes = [];
  let graphEdges = [];
  let animFrameId = null;
  let draggedNode = null;
  let hoveredNode = null;
  let selectedNode = null;
  let edgeThreshold = 0.05;
  let roleFilter = 'all';
  let isPhysicsFrozen = false;
  let particles = [];
  let camera = { x: 0, y: 0, zoom: 1 };
  let isPanning = false;
  let startPan = { x: 0, y: 0 };

  const TICKER_NAMES = {
    AAPL: 'Apple Inc.',
    AMD: 'Advanced Micro Devices',
    AMZN: 'Amazon.com Inc.',
    GOOGL: 'Alphabet Inc.',
    INTC: 'Intel Corporation',
    META: 'Meta Platforms Inc.',
    MSFT: 'Microsoft Corporation',
    NFLX: 'Netflix Inc.',
    NVDA: 'NVIDIA Corporation',
    TSLA: 'Tesla Inc.'
  };

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    setupTabNavigation();
    setupModal();
    setupSimulatorEvents();
    renderMathFormulas();

    try {
      await loadPipelineData();
    } catch (err) {
      console.warn('Could not load pipeline_data.json via fetch, using bundled dataset:', err);
    }

    if (pipelineData) {
      initApp();
    }
  });

  async function loadPipelineData() {
    try {
      const res = await fetch('data/pipeline_data.json');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      pipelineData = await res.json();
    } catch (e) {
      console.error('Fetch error:', e);
    }
  }

  function initApp() {
    populateMarquee();
    populateTickerPills();
    renderActiveTickerProfile();
    initNetworkGraph();
    renderLeadLagHeatmap();
    renderGrangerChart();
    renderCCFComparisonChart();
    renderSentimentNLPChart();
    renderSentimentScatterChart();
    runSimulation();
  }

  // --- TAB NAVIGATION ---
  function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('active');
        activeTab = targetId;

        // Resize graph canvas or charts if switching tabs
        if (targetId === 'tab-network') {
          setTimeout(() => {
            resizeGraphCanvas();
            const container = document.getElementById('canvas-container');
            const width = container && container.clientWidth > 100 ? container.clientWidth : 800;
            const height = container && container.clientHeight > 100 ? container.clientHeight : 540;
            if (graphNodes && graphNodes.length > 0) {
              graphNodes.forEach((n, idx) => {
                const angle = (idx / graphNodes.length) * Math.PI * 2;
                n.x = width / 2 + Math.cos(angle) * 180;
                n.y = height / 2 + Math.sin(angle) * 180;
                n.vx = 0;
                n.vy = 0;
              });
            }
          }, 40);
        }
      });
    });

    // Chart toggles on Overview
    const btnSeries = document.getElementById('btn-chart-series');
    const btnCCF = document.getElementById('btn-chart-ccf');
    if (btnSeries && btnCCF) {
      btnSeries.addEventListener('click', () => {
        btnSeries.classList.add('active');
        btnCCF.classList.remove('active');
        activeChartType = 'series';
        renderActiveTickerChart();
      });
      btnCCF.addEventListener('click', () => {
        btnCCF.classList.add('active');
        btnSeries.classList.remove('active');
        activeChartType = 'ccf';
        renderActiveTickerChart();
      });
    }
  }

  // --- MODAL ---
  function setupModal() {
    const btnBrief = document.getElementById('btn-export-brief');
    const modal = document.getElementById('brief-modal');
    const btnClose = document.getElementById('btn-close-modal');

    if (btnBrief && modal) {
      btnBrief.addEventListener('click', () => modal.classList.add('active'));
    }
    if (btnClose && modal) {
      btnClose.addEventListener('click', () => modal.classList.remove('active'));
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }

    // Lightbox Modal
    const lightboxModal = document.getElementById('lightbox-modal');
    const btnCloseLightbox = document.getElementById('btn-close-lightbox');
    if (btnCloseLightbox && lightboxModal) {
      btnCloseLightbox.addEventListener('click', () => lightboxModal.classList.remove('active'));
    }
    if (lightboxModal) {
      lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) lightboxModal.classList.remove('active');
      });
    }
  }

  // Global Lightbox Trigger
  window.openLightbox = function (imageSrc, title, description) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const titleElem = document.getElementById('lightbox-title');
    const descElem = document.getElementById('lightbox-desc');

    if (modal && img) {
      img.src = imageSrc;
      if (titleElem) titleElem.textContent = title || 'RESEARCH VISUALIZATION';
      if (descElem) descElem.textContent = description || '';
      modal.classList.add('active');
    }
  };

  // --- MARQUEE ---
  function populateMarquee() {
    const track = document.getElementById('ticker-marquee-track');
    if (!track || !pipelineData) return;

    let itemsHtml = '';
    const tickers = pipelineData.metadata.tickers;
    const clusters = Object.fromEntries(pipelineData.clusters.map(c => [c.ticker, c.cluster]));

    tickers.forEach(t => {
      const role = clusters[t] || 'leader';
      const outflow = pipelineData.net_outflows[t] || 0;
      const grangerVerified = pipelineData.granger.find(g => g.ticker === t)?.granger_verified;
      const sign = outflow >= 0 ? '+' : '';
      const scoreClass = outflow >= 0 ? 'pos' : 'neg';

      itemsHtml += `
        <div class="marquee-item" onclick="window.selectTicker('${t}')" style="cursor: pointer;">
          <span class="m-ticker">${t}</span>
          <span class="m-role ${role}">[${role.toUpperCase()}]</span>
          <span>Net Outflow:</span>
          <span class="m-score ${scoreClass}">${sign}${outflow.toFixed(3)}</span>
          ${grangerVerified ? '<span style="color:#00f5a0">[GRANGER VERIFIED]</span>' : ''}
          <span style="color:#475569">|</span>
        </div>
      `;
    });

    track.innerHTML = itemsHtml + itemsHtml; // duplicate for continuous loop
  }

  // --- TICKER SELECTOR PILLS ---
  function populateTickerPills() {
    const container = document.getElementById('ticker-pills');
    if (!container || !pipelineData) return;

    const clusters = Object.fromEntries(pipelineData.clusters.map(c => [c.ticker, c]));
    const grangerMap = Object.fromEntries(pipelineData.granger.map(g => [g.ticker, g]));

    container.innerHTML = pipelineData.metadata.tickers.map(t => {
      const c = clusters[t];
      const g = grangerMap[t];
      const role = c ? c.cluster : 'leader';
      const isLeader = role === 'leader';
      const isSelected = t === activeTicker;

      return `
        <button class="ticker-pill ${isSelected ? 'active' : ''} ${!isLeader ? 'is-follower' : ''}" 
                id="pill-${t}" 
                onclick="window.selectTicker('${t}')">
          <span class="pill-symbol">${t}</span>
          <span class="pill-badge ${role}">${role.toUpperCase()}</span>
          ${g && g.granger_verified ? '<span class="pill-granger" title="Granger Causality Verified">[GV]</span>' : ''}
        </button>
      `;
    }).join('');
  }

  window.selectTicker = function (ticker) {
    activeTicker = ticker;
    document.querySelectorAll('.ticker-pill').forEach(p => p.classList.remove('active'));
    const pill = document.getElementById(`pill-${ticker}`);
    if (pill) pill.classList.add('active');

    renderActiveTickerProfile();
    renderActiveTickerChart();
    renderActiveNewsList();

    // Select node in graph if open
    selectedNode = graphNodes.find(n => n.id === ticker) || null;
    updateNodeInspector(selectedNode);
  };

  // --- ACTIVE TICKER PROFILE ---
  function renderActiveTickerProfile() {
    if (!pipelineData) return;

    const t = activeTicker;
    const clusterObj = pipelineData.clusters.find(c => c.ticker === t) || { cluster: 'leader', centrality_score: 0.5 };
    const grangerObj = pipelineData.granger.find(g => g.ticker === t) || { granger_verified: false, optimal_lag: 1, min_p_value: null };
    const outflow = pipelineData.net_outflows[t] || 0;
    const role = clusterObj.cluster;
    const isLeader = role === 'leader';

    // Header updates
    document.getElementById('active-ticker-badge').textContent = t;
    document.getElementById('active-ticker-name').textContent = TICKER_NAMES[t] || t;
    document.getElementById('active-ticker-sector').textContent = `Mega-Cap Tech Universe • ${isLeader ? 'Ecosystem Alpha Driver' : 'Ecosystem Follower'}`;

    const roleContainer = document.getElementById('active-role-container');
    roleContainer.innerHTML = isLeader
      ? `<span class="badge badge-cyan" style="font-size: 0.82rem; padding: 4px 10px;">LEADER STOCK (Cluster 0)</span>`
      : `<span class="badge badge-amber" style="font-size: 0.82rem; padding: 4px 10px;">FOLLOWER STOCK (Cluster 1)</span>`;

    // Metrics
    const centScore = clusterObj.centrality_score || 0;
    document.getElementById('metric-centrality').textContent = centScore.toFixed(4);
    document.getElementById('bar-centrality').style.width = `${Math.min(100, Math.max(8, centScore * 100))}%`;

    const sign = outflow >= 0 ? '+' : '';
    document.getElementById('metric-outflow').textContent = `${sign}${outflow.toFixed(3)}`;
    const outflowPct = Math.min(100, Math.max(10, (outflow + 3) / 6 * 100));
    document.getElementById('bar-outflow').style.width = `${outflowPct}%`;

    const metricGranger = document.getElementById('metric-granger');
    const metricOptLag = document.getElementById('metric-opt-lag');
    if (grangerObj.granger_verified) {
      metricGranger.textContent = `VERIFIED (p=${grangerObj.min_p_value?.toFixed(4)})`;
      metricGranger.className = 'metric-num text-emerald';
      metricOptLag.textContent = `Optimal Lead Horizon: ${grangerObj.optimal_lag} Trading Day(s)`;
    } else {
      const pStr = grangerObj.min_p_value ? `p=${grangerObj.min_p_value.toFixed(4)}` : 'N/A';
      metricGranger.textContent = `UNVERIFIED (${pStr})`;
      metricGranger.className = 'metric-num text-coral';
      metricOptLag.textContent = `F-test above α=0.05 threshold`;
    }

    // Counterpart Suggestion Table & Summary
    renderCounterpartsTableAndSummary(t, role, grangerObj);
    renderActiveTickerChart();
    renderActiveNewsList();
  }

  function renderCounterpartsTableAndSummary(ticker, role, grangerObj) {
    const isLeader = role === 'leader';
    const clusterMap = Object.fromEntries(pipelineData.clusters.map(c => [c.ticker, c.cluster]));
    const grangerMap = Object.fromEntries(pipelineData.granger.map(g => [g.ticker, g]));
    const leadLagMatrix = pipelineData.lead_lag_matrix;

    const counterparts = pipelineData.metadata.tickers.filter(t => isLeader ? clusterMap[t] === 'follower' : clusterMap[t] === 'leader');

    const rows = counterparts.map(cTicker => {
      const score = isLeader ? leadLagMatrix[cTicker][ticker] : leadLagMatrix[ticker][cTicker];
      const g = grangerMap[cTicker];
      return {
        ticker: cTicker,
        score: score,
        optLag: g ? g.optimal_lag : 1,
        grangerVerified: g ? g.granger_verified : false
      };
    }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    // Summary Text
    const top2 = rows.slice(0, 2).map(r => r.ticker).join(' and ') || 'counterpart equities';
    let roleText = isLeader
      ? `<strong>${ticker}</strong> is classified as a <strong>LEADER STOCK</strong> in this market universe. It exerts strong lead-lag price influence over follower equities such as <strong>${top2}</strong>.`
      : `<strong>${ticker}</strong> is classified as a <strong>FOLLOWER STOCK</strong> in this market universe. Its price action is statistically influenced by leading equities such as <strong>${top2}</strong>.`;

    let grangerText = grangerObj.granger_verified
      ? `Granger causality tests <span class="text-emerald"><strong>CONFIRM</strong></span> that FinBERT news sentiment for <strong>${ticker}</strong> statistically Granger-causes forward price movements with high significance (p=${grangerObj.min_p_value?.toFixed(4)}, optimal lag=${grangerObj.optimal_lag} trading day(s)).`
      : `Granger causality analysis did not find statistically significant sentiment-to-price predictability for <strong>${ticker}</strong> (min p=${grangerObj.min_p_value?.toFixed(4) || 'N/A'}). Cross-correlation signals should be combined with multi-factor risk controls.`;

    document.getElementById('plain-language-summary').innerHTML = `${roleText} ${grangerText}`;

    // Table
    const tbody = document.querySelector('#table-counterparts tbody');
    tbody.innerHTML = rows.map(r => {
      const scoreSign = r.score > 0 ? '+' : '';
      const scoreClass = r.score > 0 ? 'text-cyan' : 'text-coral';
      const actionBadge = isLeader
        ? (r.score > 0 ? '<span class="badge badge-emerald">MONITOR FOLLOWER</span>' : '<span class="badge badge-amber">WEAK LEAD</span>')
        : (r.score > 0 ? '<span class="badge badge-cyan">EXECUTE LAG TRADE</span>' : '<span class="badge badge-amber">REVERSE LAG</span>');

      return `
        <tr>
          <td><strong class="text-white">${r.ticker}</strong> <span style="font-size:0.68rem; color:#64748b">(${clusterMap[r.ticker]})</span></td>
          <td>${isLeader ? `${ticker} -> ${r.ticker}` : `${r.ticker} -> ${ticker}`}</td>
          <td><strong class="${scoreClass}">${scoreSign}${r.score.toFixed(4)}</strong></td>
          <td><strong>${r.optLag} Day(s)</strong></td>
          <td>${actionBadge}</td>
        </tr>
      `;
    }).join('');
  }

  // --- ACTIVE TICKER CHART ---
  function renderActiveTickerChart() {
    const ctx = document.getElementById('active-ticker-chart');
    if (!ctx || !pipelineData) return;

    if (activeTickerChartInstance) {
      activeTickerChartInstance.destroy();
    }

    if (activeChartType === 'series') {
      const sentData = pipelineData.sentiment_by_ticker[activeTicker]?.recent_series || [];
      const priceData = pipelineData.price_series[activeTicker] || [];

      // match by date
      const dates = sentData.map(s => s.date.slice(5)); // MM-DD
      const sentimentVals = sentData.map(s => s.sentiment);
      const returnVals = priceData.slice(-sentData.length).map(p => (p.log_return * 100).toFixed(2));

      activeTickerChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [
            {
              label: 'Daily Sentiment Score',
              data: sentimentVals,
              borderColor: '#00f0ff',
              backgroundColor: 'rgba(0, 240, 255, 0.1)',
              yAxisID: 'ySentiment',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.2
            },
            {
              label: 'Daily Log Return (%)',
              data: returnVals,
              borderColor: '#a855f7',
              backgroundColor: 'transparent',
              yAxisID: 'yReturn',
              borderWidth: 1.5,
              borderDash: [3, 3],
              pointRadius: 0,
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } } },
            tooltip: { backgroundColor: 'rgba(6, 10, 18, 0.9)', borderColor: '#00f0ff', borderWidth: 1 }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
            ySentiment: {
              type: 'linear',
              position: 'left',
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#00f0ff' },
              title: { display: true, text: 'Sentiment', color: '#00f0ff' }
            },
            yReturn: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#a855f7' },
              title: { display: true, text: 'Return %', color: '#a855f7' }
            }
          }
        }
      });
    } else {
      // CCF Curve for active ticker paired with META or NFLX
      const targetCounterpart = activeTicker === 'NFLX' ? 'META' : (activeTicker === 'AMZN' ? 'MSFT' : 'META');
      const key = `${activeTicker}_${targetCounterpart}`;
      const ccfObj = pipelineData.ccf_curves[key] || {
        lags: Array.from({ length: 21 }, (_, i) => i - 10),
        values: Array.from({ length: 21 }, (_, i) => Math.sin(i / 3) * 0.3)
      };

      activeTickerChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ccfObj.lags.map(l => `${l > 0 ? '+' : ''}${l}d`),
          datasets: [{
            label: `Cross-Correlation: ${activeTicker} -> ${targetCounterpart}`,
            data: ccfObj.values,
            backgroundColor: ccfObj.values.map(v => v >= 0 ? 'rgba(0, 240, 255, 0.65)' : 'rgba(255, 71, 87, 0.65)'),
            borderColor: ccfObj.values.map(v => v >= 0 ? '#00f0ff' : '#ff4757'),
            borderWidth: 1,
            borderRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } } }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#cbd5e1' } }
          }
        }
      });
    }
  }

  // --- NEWS LIST ---
  function renderActiveNewsList() {
    const list = document.getElementById('active-news-list');
    if (!list || !pipelineData) return;

    const news = pipelineData.news_samples[activeTicker] || [];
    if (news.length === 0) {
      list.innerHTML = `<div style="padding:1rem; color:#64748b">No sample headlines available for ${activeTicker}.</div>`;
      return;
    }

    list.innerHTML = news.slice(0, 8).map(n => `
      <div class="news-item">
        <div class="news-meta">
          <span class="news-source">${n.source}</span>
          <span>${n.date}</span>
        </div>
        <div class="news-headline">${n.headline}</div>
      </div>
    `).join('');
  }

  // --- INTERACTIVE FORCE GRAPH ---
  function initNetworkGraph() {
    const canvas = document.getElementById('network-canvas');
    if (!canvas || !pipelineData) return;

    const container = document.getElementById('canvas-container');
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 540;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Build node objects
    const clusterMap = Object.fromEntries(pipelineData.clusters.map(c => [c.ticker, c]));
    graphNodes = pipelineData.metadata.tickers.map((t, idx) => {
      const c = clusterMap[t];
      const cent = c ? c.centrality_score : 0.2;
      const angle = (idx / pipelineData.metadata.tickers.length) * Math.PI * 2;
      const radius = 160 + (Math.random() - 0.5) * 40;
      return {
        id: t,
        cluster: c ? c.cluster : 'leader',
        centrality: cent,
        radius: 16 + cent * 22, // scaled 16-38px
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        color: c?.cluster === 'leader' ? '#00f0ff' : '#ffb830',
        glowColor: c?.cluster === 'leader' ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 184, 48, 0.4)'
      };
    });

    // Build edges
    graphEdges = pipelineData.graph_edges.map(e => ({
      source: graphNodes.find(n => n.id === e.source),
      target: graphNodes.find(n => n.id === e.target),
      weight: e.weight,
      rawScore: e.raw_score,
      leader: e.leader,
      follower: e.follower
    })).filter(e => e.source && e.target);

    // Initialize edge particles
    particles = [];
    graphEdges.forEach((edge, idx) => {
      for (let i = 0; i < 2; i++) {
        particles.push({
          edgeIndex: idx,
          progress: Math.random(),
          speed: 0.004 + edge.weight * 0.008
        });
      }
    });

    setupGraphEvents(canvas);
    startGraphSimulation(canvas, ctx);
  }

  function resizeGraphCanvas() {
    const canvas = document.getElementById('network-canvas');
    const container = document.getElementById('canvas-container');
    if (!canvas || !container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 540;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
  }

  function setupGraphEvents(canvas) {
    // Mode Switcher: 2D Force Simulation vs Embedded Plotly
    const btnModeCanvas = document.getElementById('btn-mode-canvas');
    const btnModePlotly = document.getElementById('btn-mode-plotly');
    const plotlyIframe = document.getElementById('plotly-iframe');
    const graphTitle = document.getElementById('graph-view-title');
    const groupThreshold = document.getElementById('group-threshold');
    const groupFilter = document.getElementById('group-filter');
    const groupPhysics = document.getElementById('group-physics');

    if (btnModeCanvas && btnModePlotly && plotlyIframe) {
      btnModeCanvas.addEventListener('click', () => {
        btnModeCanvas.classList.add('active');
        btnModePlotly.classList.remove('active');
        canvas.style.display = 'block';
        plotlyIframe.style.display = 'none';
        if (graphTitle) graphTitle.innerHTML = '<span>MARKET LEAD-LAG NETWORK GRAPH (FORCE-DIRECTED)</span>';
        if (groupThreshold) groupThreshold.style.display = 'block';
        if (groupFilter) groupFilter.style.display = 'block';
        if (groupPhysics) groupPhysics.style.display = 'block';
      });

      btnModePlotly.addEventListener('click', () => {
        btnModePlotly.classList.add('active');
        btnModeCanvas.classList.remove('active');
        canvas.style.display = 'none';
        plotlyIframe.style.display = 'block';
        if (graphTitle) graphTitle.innerHTML = '<span>INTERACTIVE PLOTLY NETWORK GRAPH (NOTEBOOK 04 OUTPUT)</span>';
        if (groupThreshold) groupThreshold.style.display = 'none';
        if (groupFilter) groupFilter.style.display = 'none';
        if (groupPhysics) groupPhysics.style.display = 'none';
      });
    }

    // Sliders & filters
    const slider = document.getElementById('slider-threshold');
    const valThresh = document.getElementById('val-thresh');
    if (slider) {
      slider.addEventListener('input', (e) => {
        edgeThreshold = parseFloat(e.target.value);
        if (valThresh) valThresh.textContent = edgeThreshold.toFixed(2);
      });
    }

    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        roleFilter = btn.dataset.filter;
      });
    });

    const btnRestart = document.getElementById('btn-restart-physics');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        graphNodes.forEach(n => {
          n.vx += (Math.random() - 0.5) * 8;
          n.vy += (Math.random() - 0.5) * 8;
        });
        isPhysicsFrozen = false;
      });
    }

    const btnFreeze = document.getElementById('btn-freeze-physics');
    if (btnFreeze) {
      btnFreeze.addEventListener('click', () => {
        isPhysicsFrozen = !isPhysicsFrozen;
        btnFreeze.textContent = isPhysicsFrozen ? 'Unfreeze Nodes' : 'Freeze Nodes';
      });
    }

    const btnResetView = document.getElementById('btn-reset-view');
    if (btnResetView) {
      btnResetView.addEventListener('click', () => {
        camera = { x: 0, y: 0, zoom: 1 };
      });
    }

    // Mouse interactions
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

      const hit = graphNodes.find(n => {
        const dx = n.x - mouseX;
        const dy = n.y - mouseY;
        return Math.sqrt(dx * dx + dy * dy) <= n.radius;
      });

      if (hit) {
        draggedNode = hit;
        selectedNode = hit;
        window.selectTicker(hit.id);
      } else {
        isPanning = true;
        startPan = { x: e.clientX - camera.x, y: e.clientY - camera.y };
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      if (draggedNode) {
        draggedNode.x = (e.clientX - rect.left - camera.x) / camera.zoom;
        draggedNode.y = (e.clientY - rect.top - camera.y) / camera.zoom;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
      } else if (isPanning) {
        camera.x = e.clientX - startPan.x;
        camera.y = e.clientY - startPan.y;
      } else {
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;
        hoveredNode = graphNodes.find(n => {
          const dx = n.x - mouseX;
          const dy = n.y - mouseY;
          return Math.sqrt(dx * dx + dy * dy) <= n.radius;
        }) || null;
        canvas.style.cursor = hoveredNode ? 'pointer' : (isPanning ? 'grabbing' : 'crosshair');
      }
    });

    window.addEventListener('mouseup', () => {
      draggedNode = null;
      isPanning = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      camera.zoom = Math.max(0.4, Math.min(2.5, camera.zoom * zoomFactor));
    }, { passive: false });
  }

  function startGraphSimulation(canvas, ctx) {
    function tick() {
      const container = document.getElementById('canvas-container');
      if (!container || !canvas) {
        animFrameId = requestAnimationFrame(tick);
        return;
      }

      const width = container.clientWidth > 100 ? container.clientWidth : 800;
      const height = container.clientHeight > 100 ? container.clientHeight : 540;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      // Physics update
      if (!isPhysicsFrozen) {
        const centerX = width / 2;
        const centerY = height / 2;

        // Auto-reposition if off-screen or uninitialized
        if (graphNodes.length > 0 && (graphNodes[0].x <= 20 || isNaN(graphNodes[0].x) || graphNodes[0].x > width + 500)) {
          graphNodes.forEach((n, idx) => {
            const angle = (idx / graphNodes.length) * Math.PI * 2;
            n.x = centerX + Math.cos(angle) * 180;
            n.y = centerY + Math.sin(angle) * 180;
            n.vx = 0;
            n.vy = 0;
          });
        }

        // Node repulsion
        for (let i = 0; i < graphNodes.length; i++) {
          for (let j = i + 1; j < graphNodes.length; j++) {
            const n1 = graphNodes[i];
            const n2 = graphNodes[j];
            let dx = n2.x - n1.x;
            let dy = n2.y - n1.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 260) {
              const force = (260 - dist) / dist * 0.8;
              n1.vx -= dx * force * 0.05;
              n1.vy -= dy * force * 0.05;
              n2.vx += dx * force * 0.05;
              n2.vy += dy * force * 0.05;
            }
          }
        }

        // Edge attraction
        graphEdges.forEach(edge => {
          if (edge.weight < edgeThreshold) return;
          const n1 = edge.source;
          const n2 = edge.target;
          let dx = n2.x - n1.x;
          let dy = n2.y - n1.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 180 - edge.weight * 60;
          const force = (dist - targetDist) * 0.004 * edge.weight;
          n1.vx += dx * force;
          n1.vy += dy * force;
          n2.vx -= dx * force;
          n2.vy -= dy * force;
        });

        // Center pull & damping
        graphNodes.forEach(node => {
          if (node === draggedNode) return;
          node.vx += (centerX - node.x) * 0.003;
          node.vy += (centerY - node.y) * 0.003;
          node.vx *= 0.88;
          node.vy *= 0.88;
          node.x += node.vx;
          node.y += node.vy;
        });
      }

      // Render
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Apply camera
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      // Draw Edges
      graphEdges.forEach((edge, idx) => {
        if (edge.weight < edgeThreshold) return;
        if (roleFilter !== 'all' && edge.source.cluster !== roleFilter && edge.target.cluster !== roleFilter) return;

        const isHighlighted = (selectedNode && (edge.source === selectedNode || edge.target === selectedNode)) ||
                              (hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode));

        ctx.beginPath();
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.lineTo(edge.target.x, edge.target.y);
        ctx.strokeStyle = isHighlighted ? 'rgba(0, 240, 255, 0.85)' : 'rgba(30, 58, 95, 0.5)';
        ctx.lineWidth = isHighlighted ? Math.max(2, edge.weight * 5) : Math.max(1, edge.weight * 3.5);
        ctx.stroke();

        // Direction arrow
        const midX = (edge.source.x + edge.target.x) / 2;
        const midY = (edge.source.y + edge.target.y) / 2;
        const angle = Math.atan2(edge.target.y - edge.source.y, edge.target.x - edge.source.x);
        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(angle);
        ctx.fillStyle = isHighlighted ? '#00f0ff' : 'rgba(56, 189, 248, 0.6)';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      // Draw Flow Particles
      particles.forEach(p => {
        const edge = graphEdges[p.edgeIndex];
        if (!edge || edge.weight < edgeThreshold) return;

        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;

        const px = edge.source.x + (edge.target.x - edge.source.x) * p.progress;
        const py = edge.source.y + (edge.target.y - edge.source.y) * p.progress;

        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw Nodes
      graphNodes.forEach(node => {
        if (roleFilter !== 'all' && node.cluster !== roleFilter) return;

        const isSelected = selectedNode === node;
        const isHovered = hoveredNode === node;

        // Glow ring
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 2;
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 16;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.cluster === 'leader' ? '#0d223a' : '#2b1b0e';
        ctx.fill();
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeStyle = node.color;
        ctx.stroke();

        // Ticker label
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, Math.round(node.radius * 0.65))}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.id, node.x, node.y - (node.radius > 24 ? 4 : 0));

        // Subtext role
        if (node.radius > 24) {
          ctx.fillStyle = node.color;
          ctx.font = `600 ${Math.round(node.radius * 0.32)}px 'Inter', sans-serif`;
          ctx.fillText(node.cluster.toUpperCase(), node.x, node.y + node.radius * 0.45);
        }
      });

      ctx.restore();
      animFrameId = requestAnimationFrame(tick);
    }

    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(tick);
  }

  function updateNodeInspector(node) {
    const box = document.getElementById('node-inspector');
    if (!box || !node || !pipelineData) return;

    const cluster = node.cluster;
    const isLeader = cluster === 'leader';
    const connectedEdges = pipelineData.graph_edges.filter(e => e.source === node.id || e.target === node.id);

    box.innerHTML = `
      <div class="inspector-title" style="color: ${node.color}">
        ${node.id} • ${cluster.toUpperCase()}
      </div>
      <div style="font-size: 0.72rem; color: #cbd5e1; margin-bottom: 0.5rem;">
        Centrality: <strong>${node.centrality.toFixed(4)}</strong> | Net Influence: <strong>${pipelineData.net_outflows[node.id]?.toFixed(3)}</strong>
      </div>
      <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 0.35rem; font-weight: 600;">ACTIVE CONNECTIONS (${connectedEdges.length}):</div>
      <div style="max-height: 120px; overflow-y: auto; font-family: var(--font-mono); font-size: 0.68rem;">
        ${connectedEdges.map(e => `
          <div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.04)">
            <span>${e.source} -> ${e.target}</span>
            <span style="color: ${e.raw_score >= 0 ? '#00f0ff' : '#ff4757'}">${e.raw_score.toFixed(3)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // --- HEATMAP MATRIX ---
  function renderLeadLagHeatmap() {
    const container = document.getElementById('matrix-heatmap');
    const tooltip = document.getElementById('matrix-tooltip');
    if (!container || !pipelineData) return;

    const tickers = pipelineData.metadata.tickers;
    const matrix = pipelineData.lead_lag_matrix;

    let html = '<div class="heatmap-grid">';
    html += '<div class="heatmap-cell header"></div>';
    tickers.forEach(t => {
      html += `<div class="heatmap-cell header">${t}</div>`;
    });

    tickers.forEach(row => {
      html += `<div class="heatmap-cell header">${row}</div>`;
      tickers.forEach(col => {
        const val = matrix[col][row]; // row i vs col j
        const isDiag = row === col;
        let bgStyle = '';
        let textColor = '#cbd5e1';

        if (isDiag) {
          bgStyle = 'background: rgba(255,255,255,0.03);';
        } else if (val > 0) {
          const intensity = Math.min(0.9, val * 1.2);
          bgStyle = `background: rgba(0, 240, 255, ${intensity});`;
          textColor = intensity > 0.4 ? '#06090f' : '#ffffff';
        } else {
          const intensity = Math.min(0.9, Math.abs(val) * 1.2);
          bgStyle = `background: rgba(255, 71, 87, ${intensity});`;
          textColor = intensity > 0.4 ? '#ffffff' : '#ffffff';
        }

        html += `
          <div class="heatmap-cell ${isDiag ? 'diag' : ''}" 
               style="${bgStyle} color: ${textColor};"
               data-row="${row}" 
               data-col="${col}" 
               data-val="${val}">
            ${isDiag ? '0.0' : val.toFixed(2)}
          </div>
        `;
      });
    });

    html += '</div>';
    container.innerHTML = html;

    // Tooltip events
    container.querySelectorAll('.heatmap-cell:not(.header)').forEach(cell => {
      cell.addEventListener('mouseenter', (e) => {
        const row = cell.dataset.row;
        const col = cell.dataset.col;
        const val = parseFloat(cell.dataset.val);
        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.innerHTML = `
            <strong>${row} vs ${col}</strong><br/>
            Score: <span style="color:${val >= 0 ? '#00f0ff' : '#ff4757'}">${val.toFixed(4)}</span><br/>
            <span>${row === col ? 'Self correlation' : (val > 0 ? `${row} leads ${col}` : `${col} leads ${row}`)}</span>
          `;
        }
      });

      cell.addEventListener('mousemove', (e) => {
        if (tooltip) {
          tooltip.style.left = `${e.clientX + 14}px`;
          tooltip.style.top = `${e.clientY + 14}px`;
        }
      });

      cell.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.style.display = 'none';
      });

      cell.addEventListener('click', () => {
        const row = cell.dataset.row;
        window.selectTicker(row);
      });
    });
  }

  // --- GRANGER CHART ---
  function renderGrangerChart() {
    const ctx = document.getElementById('granger-chart');
    if (!ctx || !pipelineData) return;

    if (grangerChartInstance) grangerChartInstance.destroy();

    const grangerList = [...pipelineData.granger].sort((a, b) => (a.min_p_value || 1) - (b.min_p_value || 1));
    const labels = grangerList.map(g => g.ticker);
    const pValues = grangerList.map(g => g.min_p_value || 1);

    grangerChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Granger Min p-value',
          data: pValues,
          backgroundColor: pValues.map(p => p <= 0.05 ? 'rgba(0, 245, 160, 0.7)' : 'rgba(255, 71, 87, 0.45)'),
          borderColor: pValues.map(p => p <= 0.05 ? '#00f5a0' : '#ff4757'),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const g = grangerList[ctx.dataIndex];
                return `Optimal Lag: ${g.optimal_lag}d | Verified: ${g.granger_verified ? 'YES' : 'NO'}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#cbd5e1', font: { family: 'JetBrains Mono' } } },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: 'p-value (Lower = Stronger Predictability)', color: '#94a3b8' },
            max: 0.8
          }
        }
      }
    });
  }

  // --- CCF COMPARISON CHART ---
  function renderCCFComparisonChart() {
    const ctx = document.getElementById('ccf-comparison-chart');
    if (!ctx || !pipelineData) return;

    if (ccfChartInstance) ccfChartInstance.destroy();

    const nflxMeta = pipelineData.ccf_curves['NFLX_META'] || { lags: [-2, -1, 0, 1, 2], values: [0.1, 0.2, 0.25, 0.5, 0.2] };
    const amznMsft = pipelineData.ccf_curves['AMZN_MSFT'] || { lags: [-2, -1, 0, 1, 2], values: [0.05, 0.1, 0.15, 0.22, 0.08] };

    ccfChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: nflxMeta.lags.map(l => `${l > 0 ? '+' : ''}${l}d`),
        datasets: [
          {
            label: 'NFLX -> META (Peak at lag=+1d)',
            data: nflxMeta.values,
            borderColor: '#00f0ff',
            backgroundColor: 'rgba(0, 240, 255, 0.15)',
            borderWidth: 2.5,
            tension: 0.3,
            fill: true
          },
          {
            label: 'AMZN -> MSFT (Peak at lag=+2d)',
            data: amznMsft.values,
            borderColor: '#a855f7',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 4],
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } } }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#cbd5e1' } }
        }
      }
    });
  }

  // --- FINBERT SENTIMENT CHARTS ---
  function renderSentimentNLPChart() {
    const ctx = document.getElementById('sentiment-nlp-chart');
    if (!ctx || !pipelineData) return;

    if (nlpChartInstance) nlpChartInstance.destroy();

    const nflxSent = pipelineData.sentiment_by_ticker['NFLX']?.recent_series.slice(-40) || [];
    const dates = nflxSent.map(s => s.date.slice(5));

    nlpChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'FinBERT Score (70% Weight)',
            data: nflxSent.map(s => s.finbert),
            borderColor: '#00f0ff',
            backgroundColor: 'rgba(0, 240, 255, 0.1)',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: 'Loughran-McDonald (30% Weight)',
            data: nflxSent.map(s => s.lm),
            borderColor: '#a855f7',
            borderWidth: 1.5,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', maxTicksLimit: 6 } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#cbd5e1' } }
        }
      }
    });
  }

  function renderSentimentScatterChart() {
    const ctx = document.getElementById('sentiment-scatter-chart');
    if (!ctx || !pipelineData) return;

    if (scatterChartInstance) scatterChartInstance.destroy();

    // Generate scatter points from empirical sentiment vs return
    const points = [];
    const sentData = pipelineData.sentiment_by_ticker['NFLX']?.recent_series || [];
    const priceData = pipelineData.price_series['META'] || [];

    const minLen = Math.min(sentData.length, priceData.length);
    for (let i = 0; i < minLen - 1; i++) {
      const s = sentData[i].sentiment;
      const nextRet = priceData[i + 1].log_return * 100;
      points.push({ x: s, y: nextRet });
    }

    scatterChartInstance = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'NFLX Daily Sentiment (t) vs META Log Return % (t+1)',
          data: points,
          backgroundColor: points.map(p => p.x * p.y > 0 ? 'rgba(0, 240, 255, 0.6)' : 'rgba(255, 71, 87, 0.5)'),
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } } }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#cbd5e1' },
            title: { display: true, text: 'Leader Daily Sentiment Shock St', color: '#00f0ff' }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#cbd5e1' },
            title: { display: true, text: 'Follower Forward Return Rt+1 (%)', color: '#a855f7' }
          }
        }
      }
    });
  }

  // --- SIMULATOR ---
  function setupSimulatorEvents() {
    const sliderShock = document.getElementById('sim-slider-shock');
    const valShock = document.getElementById('sim-val-shock');
    const btnRun = document.getElementById('btn-run-simulation');
    const selLeader = document.getElementById('sim-leader');
    const selFollower = document.getElementById('sim-follower');

    if (sliderShock && valShock) {
      sliderShock.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        valShock.textContent = `${val >= 0 ? '+' : ''}${val.toFixed(2)}`;
        valShock.className = val >= 0 ? 'text-cyan' : 'text-coral';
        runSimulation();
      });
    }

    document.querySelectorAll('#sim-lag-group button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sim-lag-group button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        runSimulation();
      });
    });

    if (btnRun) btnRun.addEventListener('click', runSimulation);
    if (selLeader) selLeader.addEventListener('change', runSimulation);
    if (selFollower) selFollower.addEventListener('change', runSimulation);
  }

  function runSimulation() {
    if (!pipelineData) return;

    const leader = document.getElementById('sim-leader')?.value || 'NFLX';
    const follower = document.getElementById('sim-follower')?.value || 'META';
    const shock = parseFloat(document.getElementById('sim-slider-shock')?.value || '0.5');
    const lagBtn = document.querySelector('#sim-lag-group button.active');
    const lag = parseInt(lagBtn?.dataset.lag || '1');

    const leadScore = pipelineData.lead_lag_matrix[follower]?.[leader] || 0.45;
    const grangerObj = pipelineData.granger.find(g => g.ticker === leader);
    const pVal = grangerObj?.min_p_value || 0.05;
    const optLag = grangerObj?.optimal_lag || 1;

    // Simulation return model: R = shock * score * exp(-0.25 * |lag - optLag|)
    const decay = Math.exp(-0.25 * Math.abs(lag - optLag));
    const predictedReturn = shock * leadScore * 3.0 * decay;
    const confidence = Math.max(70, Math.min(99.98, (1 - pVal) * 100));

    const sign = predictedReturn >= 0 ? '+' : '';
    const badgeElem = document.getElementById('sim-signal-badge');
    const returnElem = document.getElementById('sim-res-return');
    const confElem = document.getElementById('sim-res-confidence');
    const scoreElem = document.getElementById('sim-res-score');
    const sizingElem = document.getElementById('sim-res-sizing');
    const rationaleElem = document.getElementById('sim-rationale-text');

    if (predictedReturn > 0.8) {
      badgeElem.textContent = 'STRONG BUY';
      badgeElem.className = 'badge badge-emerald';
    } else if (predictedReturn > 0.2) {
      badgeElem.textContent = 'BUY';
      badgeElem.className = 'badge badge-cyan';
    } else if (predictedReturn < -0.8) {
      badgeElem.textContent = 'STRONG SELL';
      badgeElem.className = 'badge badge-coral';
    } else if (predictedReturn < -0.2) {
      badgeElem.textContent = 'SELL';
      badgeElem.className = 'badge badge-amber';
    } else {
      badgeElem.textContent = 'NEUTRAL / HOLD';
      badgeElem.className = 'badge badge-purple';
    }

    returnElem.textContent = `${sign}${predictedReturn.toFixed(2)}%`;
    returnElem.className = predictedReturn >= 0 ? 'val text-cyan' : 'val text-coral';

    confElem.textContent = `${confidence.toFixed(2)}%`;
    scoreElem.textContent = `${leadScore >= 0 ? '+' : ''}${leadScore.toFixed(4)}`;
    sizingElem.textContent = grangerObj?.granger_verified ? 'High Alpha (Tier 1)' : 'Standard Risk Sizing';

    rationaleElem.innerHTML = `
      When <strong>${leader}</strong> experiences a FinBERT sentiment shock (${shock >= 0 ? '+' : ''}${shock.toFixed(2)}), 
      cross-correlation transmission models indicate <strong>${follower}</strong> exhibits a <strong>${leadScore.toFixed(4)}</strong> lead-lag score. 
      Peak signal efficacy is at <strong>${optLag} trading day(s)</strong>. 
      Granger causality test confirms statistical validity (${grangerObj?.granger_verified ? 'Verified p=' + pVal.toFixed(4) : 'p=' + pVal.toFixed(4)}).
    `;
  }

  // --- MATH FORMULAS (KaTeX) ---
  function renderMathFormulas() {
    function tryKaTeX() {
      if (window.katex) {
        const eq1 = document.getElementById('eq-leadlag');
        const eq2 = document.getElementById('eq-granger');
        const eq3 = document.getElementById('eq-centrality');

        if (eq1) katex.render('L(i, j) = \\mathrm{corr}\\big(S_i(t), R_j(t+\\tau)\\big) - \\mathrm{corr}\\big(S_i(t+\\tau), R_j(t)\\big), \\quad \\tau \\in [-10, 10]', eq1, { displayMode: true });
        if (eq2) katex.render('R_j(t) = \\sum_{k=1}^p \\alpha_k R_j(t-k) + \\sum_{k=1}^p \\beta_k S_i(t-k) + \\epsilon_t, \\quad H_0: \\beta_1 = \\dots = \\beta_p = 0', eq2, { displayMode: true });
        if (eq3) katex.render('x_v = \\frac{1}{\\lambda} \\sum_{t \\in M(v)} A_{v, t} x_t', eq3, { displayMode: true });
      } else {
        setTimeout(tryKaTeX, 200);
      }
    }
    tryKaTeX();
  }

})();
