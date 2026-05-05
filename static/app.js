const summaryGrid = document.getElementById("summary-grid");
const sectorTable = document.getElementById("sector-table");
const longList = document.getElementById("long-list");
const shortList = document.getElementById("short-list");
const watchList = document.getElementById("watch-list");
const disclaimer = document.getElementById("disclaimer");
const heroStrip = document.getElementById("hero-strip");
const strategySelect = document.getElementById("strategy");
const sourceSelect = document.getElementById("source");
const sourceSummary = document.getElementById("source-summary");
const warningList = document.getElementById("warning-list");

function toneClass(stance) {
  if (stance.includes("long")) return "long";
  if (stance.includes("short")) return "short";
  return "watch";
}

function renderSummaryCards(payload) {
  const spread = payload.summary.averageLongShortSpread;
  const cards = [
    {
      label: "Universe size",
      value: payload.summary.universeSize,
      detail: "Stocks in the current scoring universe",
    },
    {
      label: "Strongest sector",
      value: payload.summary.topLongSector || "N/A",
      detail: "Best average long score",
    },
    {
      label: "Weakest sector",
      value: payload.summary.topShortSector || "N/A",
      detail: "Highest average short pressure",
    },
    {
      label: "Signal spread",
      value: typeof spread === "number" ? spread.toFixed(1) : "N/A",
      detail: "Average long score minus short score",
    },
  ];

  summaryGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <div class="summary-topline">${card.label}</div>
          <div class="value">${card.value}</div>
          <div class="summary-detail">${card.detail}</div>
        </article>
      `
    )
    .join("");
}

function renderHeroStrip(payload) {
  const items = [
    `Profile: ${payload.strategy}`,
    `Data: ${payload.dataSource.active}`,
    `Top long: ${payload.topLongs[0]?.ticker || "N/A"}`,
    `Top short: ${payload.topShorts[0]?.ticker || "N/A"}`,
  ];

  heroStrip.innerHTML = items
    .map((item) => `<div class="hero-pill">${item}</div>`)
    .join("");
}

function renderSectorTable(sectors) {
  sectorTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Sector</th>
          <th>Stocks</th>
          <th>Avg long</th>
          <th>Avg short</th>
          <th>Outlook</th>
        </tr>
      </thead>
      <tbody>
        ${sectors
          .map(
            (sector) => `
              <tr>
                <td>
                  <div class="sector-name">${sector.sector}</div>
                  <div class="sector-bar">
                    <span class="sector-bar-long" style="width:${sector.avgLongScore}%"></span>
                    <span class="sector-bar-short" style="width:${sector.avgShortScore}%"></span>
                  </div>
                </td>
                <td>${sector.stockCount}</td>
                <td>${sector.avgLongScore}</td>
                <td>${sector.avgShortScore}</td>
                <td><span class="table-pill">${sector.outlook}</span></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderSourceSummary(dataSource) {
  sourceSummary.innerHTML = `
    <article class="source-card">
      <div class="source-kicker">Active feed</div>
      <h3>${dataSource.active}</h3>
      <p>${dataSource.next.join(" · ")}</p>
    </article>
  `;
}

function renderWarnings(warnings) {
  warningList.innerHTML = warnings
    .map((warning) => `<div class="warning">${warning}</div>`)
    .join("");
}

function formatPrice(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 2,
  }).format(value);
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDelta(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value > 0 ? "+" : ""}${formatPrice(value)}`;
}

function toneFromNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }

  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function upsideToTarget(stock) {
  if (
    typeof stock.currentPrice !== "number" ||
    typeof stock.analystTargetPrice !== "number" ||
    !stock.currentPrice
  ) {
    return null;
  }

  return ((stock.analystTargetPrice - stock.currentPrice) / stock.currentPrice) * 100;
}

function renderStockList(node, stocks) {
  node.innerHTML = stocks
    .map(
      (stock) => {
        const targetGap = upsideToTarget(stock);
        return `
        <article class="stock-card">
          <div class="header">
            <div>
              <div class="ticker-row">
                <h3>${stock.ticker}</h3>
                <p class="company-name">${stock.name}</p>
              </div>
              <p class="meta">${stock.sector} / ${stock.industry}</p>
            </div>
            <span class="pill ${toneClass(stock.stance)}">${stock.stance}</span>
          </div>
          <div class="price-row">
            <div>
              <div class="price-label">Current price</div>
              <div class="price-value">${formatPrice(stock.currentPrice)}</div>
            </div>
            <div class="intraday ${toneFromNumber(stock.dayChangePercent)}">
              <strong>${formatDelta(stock.dayChange)}</strong>
              <span>${formatPercent(stock.dayChangePercent)}</span>
            </div>
          </div>
          <div class="scores">
            <div class="score-chip">
              <span>Target</span>
              <strong>${formatPrice(stock.analystTargetPrice)}</strong>
              <small>${targetGap === null ? "No target" : `${formatPercent(targetGap)} to target`}</small>
            </div>
            <div class="score-chip">
              <span>Long score</span>
              <strong>${stock.longScore}</strong>
            </div>
            <div class="score-chip">
              <span>Short score</span>
              <strong>${stock.shortScore}</strong>
            </div>
            <div class="score-chip">
              <span>Mkt cap</span>
              <strong>${stock.marketCapB}B</strong>
            </div>
          </div>
          <div class="bias-bar">
            <div class="bias-track">
              <span class="bias-long" style="width:${stock.longScore}%"></span>
              <span class="bias-short" style="width:${stock.shortScore}%"></span>
            </div>
          </div>
          <div class="reason-title">Why it is ranked here</div>
          <ul class="reasons">
            ${stock.reasons.map((reason) => `<li>${reason}</li>`).join("")}
          </ul>
        </article>
      `;
      }
    )
    .join("");
}

async function loadDashboard(strategy, source) {
  const response = await fetch(
    `/api/dashboard?strategy=${encodeURIComponent(strategy)}&source=${encodeURIComponent(source)}`
  );
  const payload = await response.json();
  renderHeroStrip(payload);
  renderSummaryCards(payload);
  renderSourceSummary(payload.dataSource);
  renderWarnings(payload.warnings || []);
  renderSectorTable(payload.sectors);
  renderStockList(longList, payload.topLongs);
  renderStockList(shortList, payload.topShorts);
  renderStockList(watchList, payload.watchlist);
  disclaimer.textContent = payload.disclaimer;
}

strategySelect.addEventListener("change", (event) => {
  loadDashboard(event.target.value, sourceSelect.value);
});

sourceSelect.addEventListener("change", (event) => {
  loadDashboard(strategySelect.value, event.target.value);
});

loadDashboard(strategySelect.value, sourceSelect.value);
