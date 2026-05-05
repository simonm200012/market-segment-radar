const summaryNode = document.getElementById("investments-summary");
const stripNode = document.getElementById("investments-strip");
const connectionNode = document.getElementById("connection-card");
const allocationNode = document.getElementById("allocation-list");
const pnlNode = document.getElementById("pnl-list");
const holdingsNode = document.getElementById("holdings-table");
const refreshButton = document.getElementById("refresh-button");

function formatMoney(value, currency = "EUR") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatQuantity(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function toneClass(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "neutral";
  }
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function renderStrip(payload) {
  const currency = payload.account.currency;
  const items = [
    `Account: ${payload.account.id ?? "N/A"}`,
    `Environment: ${payload.meta.environment}`,
    `Positions: ${payload.meta.positionCount}`,
    `Total value: ${formatMoney(payload.account.totalValue, currency)}`,
  ];

  stripNode.innerHTML = items.map((item) => `<div class="hero-pill">${item}</div>`).join("");
}

function renderConnection(payload) {
  connectionNode.innerHTML = `
    <div class="status-title">Connected</div>
    <div class="status-detail">${payload.meta.baseUrl}</div>
  `;
}

function renderSummary(payload) {
  const currency = payload.account.currency;
  const cards = [
    {
      label: "Portfolio value",
      value: formatMoney(payload.account.investments.currentValue, currency),
      detail: "Current market value of invested holdings",
    },
    {
      label: "Cash available",
      value: formatMoney(payload.account.cash.availableToTrade, currency),
      detail: "Cash ready to deploy",
    },
    {
      label: "Unrealized P/L",
      value: formatMoney(payload.account.investments.unrealizedProfitLoss, currency),
      detail: "Open gain or loss on current positions",
      tone: toneClass(payload.account.investments.unrealizedProfitLoss),
    },
    {
      label: "Realized P/L",
      value: formatMoney(payload.account.investments.realizedProfitLoss, currency),
      detail: "Closed gain or loss reported by Trading 212",
      tone: toneClass(payload.account.investments.realizedProfitLoss),
    },
  ];

  summaryNode.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <div class="summary-topline">${card.label}</div>
          <div class="value ${card.tone || ""}">${card.value}</div>
          <div class="summary-detail">${card.detail}</div>
        </article>
      `
    )
    .join("");
}

function renderAllocation(payload) {
  const currency = payload.account.currency;
  const topPositions = payload.positions.slice(0, 8);

  allocationNode.innerHTML = topPositions
    .map(
      (position) => `
        <article class="allocation-card">
          <div class="allocation-topline">
            <div>
              <strong>${position.ticker}</strong>
              <span>${position.name}</span>
            </div>
            <strong>${position.allocationPercent.toFixed(2)}%</strong>
          </div>
          <div class="allocation-bar">
            <span style="width:${Math.min(position.allocationPercent, 100)}%"></span>
          </div>
          <div class="allocation-foot">
            <span>${formatMoney(position.marketValue, currency)}</span>
            <span>${formatQuantity(position.quantity)} shares</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderPnl(payload) {
  const currency = payload.account.currency;
  const ranked = [...payload.positions]
    .sort((left, right) => (right.unrealizedProfitLoss || 0) - (left.unrealizedProfitLoss || 0))
    .slice(0, 8);

  pnlNode.innerHTML = ranked
    .map(
      (position) => `
        <article class="allocation-card">
          <div class="allocation-topline">
            <div>
              <strong>${position.ticker}</strong>
              <span>${position.name}</span>
            </div>
            <strong class="${toneClass(position.unrealizedProfitLoss)}">
              ${formatMoney(position.unrealizedProfitLoss, currency)}
            </strong>
          </div>
          <div class="allocation-foot">
            <span>${formatPercent(position.unrealizedProfitLossPercent)}</span>
            <span>${formatMoney(position.currentPrice, currency)} now</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderHoldings(payload) {
  const currency = payload.account.currency;

  if (!payload.positions.length) {
    holdingsNode.innerHTML = `
      <div class="empty-state">
        <h3>No open positions</h3>
        <p>Your Trading 212 account responded successfully, but there are no open stock positions right now.</p>
      </div>
    `;
    return;
  }

  holdingsNode.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Name</th>
          <th>Quantity</th>
          <th>Avg price</th>
          <th>Current price</th>
          <th>Market value</th>
          <th>Unrealized P/L</th>
          <th>Allocation</th>
        </tr>
      </thead>
      <tbody>
        ${payload.positions
          .map(
            (position) => `
              <tr>
                <td>${position.ticker}</td>
                <td>${position.name}</td>
                <td>${formatQuantity(position.quantity)}</td>
                <td>${formatMoney(position.averagePricePaid, currency)}</td>
                <td>${formatMoney(position.currentPrice, currency)}</td>
                <td>${formatMoney(position.marketValue, currency)}</td>
                <td>
                  <span class="${toneClass(position.unrealizedProfitLoss)}">
                    ${formatMoney(position.unrealizedProfitLoss, currency)}
                  </span>
                  <div class="cell-subtle">${formatPercent(position.unrealizedProfitLossPercent)}</div>
                </td>
                <td>${position.allocationPercent.toFixed(2)}%</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderError(message) {
  connectionNode.innerHTML = `
    <div class="status-title error">Connection failed</div>
    <div class="status-detail">${message}</div>
  `;

  summaryNode.innerHTML = "";
  stripNode.innerHTML = "";
  allocationNode.innerHTML = "";
  pnlNode.innerHTML = "";
  holdingsNode.innerHTML = `
    <div class="empty-state">
      <h3>Trading 212 data unavailable</h3>
      <p>${message}</p>
      <p>Set <code>T212_API_KEY</code>, <code>T212_API_SECRET</code>, and optionally <code>T212_ENV=demo</code> before starting the server.</p>
    </div>
  `;
}

async function loadInvestments() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing...";

  try {
    const response = await fetch("/api/investments");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unknown Trading 212 error");
    }

    renderStrip(payload);
    renderConnection(payload);
    renderSummary(payload);
    renderAllocation(payload);
    renderPnl(payload);
    renderHoldings(payload);
  } catch (error) {
    renderError(error.message);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh snapshot";
  }
}

refreshButton.addEventListener("click", () => {
  loadInvestments();
});

loadInvestments();
