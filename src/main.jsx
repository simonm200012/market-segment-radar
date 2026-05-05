import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./customerDashboard.css";

const number = (value) => Number(value || 0);
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const moneyExact = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function pct(part, whole) {
  return whole ? `${((part / whole) * 100).toFixed(1)}%` : "0%";
}

function maxOf(rows, key) {
  return Math.max(...rows.map((row) => number(row[key])), 1);
}

function BarList({ rows, labelKey, valueKey, valueFormat = compact.format, subFormat }) {
  const max = maxOf(rows, valueKey);
  return (
    <div className="bar-list">
      {rows.map((row) => {
        const value = number(row[valueKey]);
        return (
          <div className="bar-row" key={row[labelKey]}>
            <div className="bar-label">
              <span>{row[labelKey] || "Unknown"}</span>
              <strong>{valueFormat(value)}</strong>
            </div>
            <div className="bar-track" aria-hidden="true">
              <span style={{ width: `${Math.max((value / max) * 100, 2)}%` }} />
            </div>
            {subFormat ? <p>{subFormat(row)}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ rows, labelKey, valueKey }) {
  const total = rows.reduce((sum, row) => sum + number(row[valueKey]), 0);
  let offset = 25;
  const colors = ["#176b87", "#2d9c7c", "#d7923f", "#8f5f3d", "#6e7781", "#a85547"];
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 42 42" className="donut" role="img" aria-label="Share chart">
        <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#e4ebe7" strokeWidth="5" />
        {rows.slice(0, 6).map((row, index) => {
          const share = total ? (number(row[valueKey]) / total) * 100 : 0;
          const segment = (
            <circle
              key={row[labelKey]}
              cx="21"
              cy="21"
              r="15.9"
              fill="transparent"
              stroke={colors[index % colors.length]}
              strokeWidth="5"
              strokeDasharray={`${share} ${100 - share}`}
              strokeDashoffset={offset}
            />
          );
          offset -= share;
          return segment;
        })}
      </svg>
      <div className="donut-legend">
        {rows.slice(0, 6).map((row, index) => (
          <div key={row[labelKey]}>
            <span style={{ background: colors[index % colors.length] }} />
            <p>{row[labelKey]}</p>
            <strong>{pct(number(row[valueKey]), total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnChart({ rows, labelKey, valueKey, valueFormat = compact.format }) {
  const max = maxOf(rows, valueKey);
  return (
    <div className="column-chart">
      {rows.map((row) => (
        <div className="column" key={row[labelKey]}>
          <strong>{valueFormat(number(row[valueKey]))}</strong>
          <span style={{ height: `${Math.max((number(row[valueKey]) / max) * 100, 4)}%` }} />
          <p>{row[labelKey]}</p>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, note }) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function DataTable({ rows, columns }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[columns[0].key]}-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard(force = false) {
    setError("");
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch(`/api/customer-dashboard${force ? "?refresh=1" : ""}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Dashboard request failed");
      setPayload(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const model = useMemo(() => {
    if (!payload) return null;
    const summary = payload.summary || {};
    const customers = number(summary.customers);
    const sales = number(summary.total_sales);
    const active90 = (payload.recency || []).find((row) => row.recency_bucket === "0-90 days") || {};
    const topMarket = (payload.markets || [])[0] || {};
    return { summary, customers, sales, active90, topMarket };
  }, [payload]);

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="loading-panel">Loading BigQuery dashboard...</section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard-shell">
        <section className="error-panel">
          <p>BigQuery connection needs attention</p>
          <h1>Could not load the customer dashboard.</h1>
          <pre>{error}</pre>
          <button onClick={() => loadDashboard(true)}>Retry</button>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <nav className="customer-nav">
        <a href="/">Radar</a>
        <a href="/investments">Investments</a>
        <a className="active" href="/customers">Customers</a>
      </nav>

      <section className="hero">
        <div>
          <p className="eyebrow">BigQuery customer intelligence</p>
          <h1>Customer dashboard for revenue, retention, and CRM quality.</h1>
          <p className="lede">
            Aggregate dashboard from {payload.table}. It avoids raw customer records and focuses on
            segments that can guide growth, reactivation, and email operations.
          </p>
        </div>
        <div className="hero-aside">
          <span>Last purchase</span>
          <strong>{model.summary.last_purchase_max}</strong>
          <span>Loaded {new Date(payload.loaded_at).toLocaleString()}</span>
          <button disabled={refreshing} onClick={() => loadDashboard(true)}>
            {refreshing ? "Refreshing..." : "Refresh BigQuery"}
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Customers" value={integer.format(model.customers)} note="Rows in customer_modified" />
        <StatCard label="Total sales" value={money.format(model.sales)} note={`Avg ${moneyExact.format(number(model.summary.avg_customer_sales))} per customer`} />
        <StatCard label="Median customer" value={moneyExact.format(number(model.summary.median_customer_sales))} note={`AOV ${moneyExact.format(number(model.summary.avg_aov))}`} />
        <StatCard label="Active in 90 days" value={integer.format(number(model.active90.customers))} note={`${pct(number(model.active90.sales), model.sales)} of sales`} />
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-card wide">
          <div className="section-title">
            <p>Market mix</p>
            <h2>Revenue by market</h2>
          </div>
          <div className="chart-table-split">
            <DonutChart rows={payload.markets || []} labelKey="market" valueKey="sales" />
            <DataTable
              rows={payload.markets || []}
              columns={[
                { key: "market", label: "Market" },
                { key: "customers", label: "Customers", render: (row) => integer.format(number(row.customers)) },
                { key: "sales", label: "Sales", render: (row) => money.format(number(row.sales)) },
                { key: "avg_aov", label: "AOV", render: (row) => moneyExact.format(number(row.avg_aov)) },
              ]}
            />
          </div>
        </article>

        <article className="panel chart-card">
          <div className="section-title">
            <p>Lifecycle</p>
            <h2>Recency value</h2>
          </div>
          <BarList
            rows={payload.recency || []}
            labelKey="recency_bucket"
            valueKey="sales"
            valueFormat={money.format}
            subFormat={(row) => `${integer.format(number(row.customers))} customers, ${moneyExact.format(number(row.avg_sales))} avg sales`}
          />
        </article>

        <article className="panel chart-card">
          <div className="section-title">
            <p>Product signals</p>
            <h2>Product affinity revenue</h2>
          </div>
          <ColumnChart
            rows={payload.product_affinity || []}
            labelKey="segment"
            valueKey="sales"
            valueFormat={money.format}
          />
        </article>

        <article className="panel chart-card">
          <div className="section-title">
            <p>CRM hygiene</p>
            <h2>Email status by customers</h2>
          </div>
          <BarList
            rows={payload.email_status || []}
            labelKey="email_status"
            valueKey="customers"
            valueFormat={integer.format}
            subFormat={(row) => money.format(number(row.sales))}
          />
        </article>

        <article className="panel chart-card">
          <div className="section-title">
            <p>CLV distribution</p>
            <h2>Value tiers by revenue</h2>
          </div>
          <DataTable
            rows={payload.clv_ranges || []}
            columns={[
              { key: "clv_range", label: "Range" },
              { key: "customers", label: "Customers", render: (row) => integer.format(number(row.customers)) },
              { key: "sales", label: "Sales", render: (row) => money.format(number(row.sales)) },
              { key: "avg_orders", label: "Orders", render: (row) => Number(number(row.avg_orders).toFixed(1)) },
            ]}
          />
        </article>

        <article className="panel chart-card wide">
          <div className="section-title">
            <p>Acquisition cohorts</p>
            <h2>New customers by first purchase year</h2>
          </div>
          <ColumnChart
            rows={payload.acquisition || []}
            labelKey="year"
            valueKey="new_customers"
            valueFormat={compact.format}
          />
        </article>
      </section>

      <section className="panel insight-board">
        <div className="section-title">
          <p>Executive readout</p>
          <h2>What the data is saying</h2>
        </div>
        <div className="insight-grid">
          {(payload.insights || []).map((insight) => (
            <article className="insight-card" key={insight.title}>
              <h2>{insight.title}</h2>
              <p>{insight.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <p>Geography</p>
          <h2>Top regions</h2>
        </div>
        <DataTable
          rows={payload.regions || []}
          columns={[
            { key: "region", label: "Region" },
            { key: "customers", label: "Customers", render: (row) => integer.format(number(row.customers)) },
            { key: "sales", label: "Sales", render: (row) => money.format(number(row.sales)) },
            { key: "avg_sales", label: "Avg / customer", render: (row) => moneyExact.format(number(row.avg_sales)) },
          ]}
        />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
