import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./customerDashboard.css";

const currency = new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const currencyExact = new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 2 });
const today = new Date().toISOString().slice(0, 10);
const storageKey = "garage-ledger-v2";
const backupKey = "garage-ledger-v2-backups";
const maxBackups = 12;
const syncConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  id: import.meta.env.VITE_GARAGE_SYNC_ID || "default-garage",
  bucket: import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "garage-documents",
};
const categories = ["Service", "Fuel", "Charge", "Insurance", "Registration", "Tires", "Repairs", "Parking", "Loan", "Other"];
const views = ["Overview", "Records", "Vault", "Costs", "Timeline", "Sell prep", "Garage"];
const mobileViews = ["Overview", "Records", "Vault", "Costs", "Garage"];
const categoryColors = {
  Service: "#2f7f72",
  Fuel: "#c2653a",
  Charge: "#7c3aed",
  Insurance: "#31688e",
  Registration: "#8d6b2f",
  Tires: "#665f73",
  Repairs: "#b64d3d",
  Parking: "#4f7c8a",
  Loan: "#252b2f",
  Other: "#8a94a6",
};

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    const swUrl = new URL(`${base}sw.js`, window.location.href);
    navigator.serviceWorker.register(swUrl, { scope: base }).catch(() => {});
  });
}

const servicePlan = [
  { km: 30000, label: "Oil and cabin filters" },
  { km: 60000, label: "Brake fluid, DSG/Haldex check" },
  { km: 90000, label: "Major service window" },
  { km: 120000, label: "Spark plugs, belts, suspension check" },
  { km: 150000, label: "Long-term ownership inspection" },
];

const seedVehicle = {
  id: "formentor",
  name: "2022 Cupra Formentor VZ",
  purchaseDate: "2023-04-15",
  purchasePrice: 36500,
  currentKilometers: 68980,
  purchaseKilometers: 18990,
  estimatedValue: 25500,
  targetSellKilometers: 132000,
  annualKilometers: 22500,
  maintenanceReserve: 1800,
  records: [
    { id: 1, type: "Service", vendor: "Porsche Inter Auto", date: "2026-04-10", amount: 642, odometer: 67882, liters: "", notes: "Oil, filters, inspection", fileName: "service_2026_04.pdf" },
    { id: 2, type: "Fuel", vendor: "Petrol", date: "2026-05-14", amount: 76.42, odometer: 68835, liters: 56.4, notes: "Premium fuel", fileName: "petrol_receipt.jpg" },
    { id: 8, type: "Charge", vendor: "Ionity", date: "2026-05-18", amount: 18.9, odometer: 68920, liters: "", kwh: 31.5, notes: "Fast charge", fileName: "ionity_receipt.pdf" },
    { id: 3, type: "Insurance", vendor: "Zavarovalnica", date: "2026-01-02", amount: 1280, odometer: 61493, liters: "", notes: "Annual premium", fileName: "policy_renewal.pdf" },
    { id: 4, type: "Registration", vendor: "Upravna enota", date: "2025-11-21", amount: 218, odometer: 58741, liters: "", notes: "Annual registration", fileName: "registration.pdf" },
    { id: 5, type: "Tires", vendor: "Gume servis", date: "2025-09-03", amount: 914, odometer: 54107, liters: "", notes: "All-season set", fileName: "tires.pdf" },
    { id: 6, type: "Fuel", vendor: "OMV", date: "2026-04-30", amount: 71.1, odometer: 68252, liters: 53.8, notes: "Road trip", fileName: "omv.png" },
    { id: 7, type: "Repairs", vendor: "Independent shop", date: "2025-12-12", amount: 486, odometer: 60741, liters: "", notes: "Brake pads", fileName: "brakes.pdf" },
  ],
  recurring: [
    { id: "insurance", name: "Insurance", cadence: "Annual", nextDue: "2027-01-02", amount: 1280 },
    { id: "registration", name: "Registration", cadence: "Annual", nextDue: "2026-11-21", amount: 218 },
    { id: "tires", name: "Tyre reserve", cadence: "Annual", nextDue: "2026-09-03", amount: 450 },
    { id: "parking", name: "Parking", cadence: "Monthly", nextDue: "2026-06-01", amount: 85 },
  ],
  reviewQueue: [],
};

const seedGarage = {
  activeVehicleId: seedVehicle.id,
  updatedAt: "2026-05-23T00:00:00.000Z",
  vehicles: [
    seedVehicle,
    {
      ...seedVehicle,
      id: "golf",
      name: "2018 VW Golf 1.5 TSI",
      purchaseDate: "2022-08-10",
      purchasePrice: 16200,
      currentKilometers: 118400,
      purchaseKilometers: 82500,
      estimatedValue: 11200,
      targetSellKilometers: 165000,
      annualKilometers: 16000,
      maintenanceReserve: 1200,
      records: [],
      recurring: [
        { id: "insurance-golf", name: "Insurance", cadence: "Annual", nextDue: "2026-10-12", amount: 740 },
        { id: "registration-golf", name: "Registration", cadence: "Annual", nextDue: "2026-08-20", amount: 185 },
      ],
      reviewQueue: [],
    },
  ],
};

function toNumber(value) {
  return Number.parseFloat(value) || 0;
}

function cleanNumber(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim().replace(/[€\s]/g, "");
  if (!text) return "";
  const normalized = text.includes(",") && !text.includes(".") ? text.replace(",", ".") : text.replace(/,/g, "");
  return Number.parseFloat(normalized) || "";
}

function formatKm(value) {
  return `${integer.format(value)} km`;
}

function monthsBetween(start, end = today) {
  const a = new Date(start);
  const b = new Date(end);
  return Math.max((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + (b.getDate() - a.getDate()) / 30, 1);
}

function normalizeDate(raw) {
  const value = String(raw || "").trim().replaceAll("/", "-");
  if (!value) return today;
  if (/^20\d{2}-/.test(value)) return value.split("-").map((part, index) => (index ? part.padStart(2, "0") : part)).join("-");
  const [first, second, year] = value.split("-");
  if (!first || !second || !year) return today;
  const europeanDate = Number(first) > 12 || Number(second) <= 12;
  const day = europeanDate ? first : second;
  const month = europeanDate ? second : first;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function addMonths(date, count) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next.toISOString().slice(0, 10);
}

function parseUploadedText(text, fileName, extra = {}) {
  const lower = `${fileName} ${text}`.toLowerCase();
  const amountMatch = text.match(/(?:total|amount|paid|premium|due|skupaj|znesek)?\s*(?:€|eur)?\s*([0-9]{1,5}(?:[.,][0-9]{2})?)/i);
  const odometerMatch = text.match(/(?:odometer|mileage|kilometers|kilometres|km)\D{0,12}([0-9]{2,7})/i);
  const litersMatch = text.match(/(?:liters|litres|liter|litre|l)\D{0,8}([0-9]{1,3}(?:[.,]\d+)?)/i);
  const kwhMatch = text.match(/(?:kwh|kw h|kilowatt)\D{0,8}([0-9]{1,3}(?:[.,]\d+)?)/i);
  const dateMatch = text.match(/(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})/);
  let type = "Other";
  if (/charge|charging|charger|ionity|tesla|supercharger|electr|kwh|kw h/.test(lower)) type = "Charge";
  else if (/gas|fuel|petrol|omv|shell|chevron|exxon|bp|liter|litre/.test(lower)) type = "Fuel";
  else if (/insurance|policy|premium|zavar/.test(lower)) type = "Insurance";
  else if (/registration|dmv|tag|plate|registr/.test(lower)) type = "Registration";
  else if (/tire|tyre|wheel|gume/.test(lower)) type = "Tires";
  else if (/repair|brake|battery|alternator/.test(lower)) type = "Repairs";
  else if (/service|oil|filter|inspection|dealer|servis/.test(lower)) type = "Service";

  const fields = [amountMatch, odometerMatch, litersMatch, kwhMatch, dateMatch].filter(Boolean).length;
  return {
    id: Date.now() + Math.random(),
    type,
    vendor: fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").slice(0, 32) || "Uploaded record",
    date: dateMatch ? normalizeDate(dateMatch[1]) : today,
    amount: amountMatch ? amountMatch[1].replace(",", ".") : "",
    odometer: odometerMatch ? odometerMatch[1] : "",
    liters: litersMatch ? litersMatch[1].replace(",", ".") : "",
    kwh: kwhMatch ? kwhMatch[1].replace(",", ".") : "",
    notes: "Imported from upload. Review extracted fields before relying on it.",
    fileName,
    fileUrl: extra.fileUrl || "",
    storagePath: extra.storagePath || "",
    storageStatus: extra.storageStatus || "",
    mimeType: extra.mimeType || "",
    confidence: Math.min(95, 35 + fields * 15 + (type !== "Other" ? 15 : 0)),
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function csvCell(record, names) {
  return names.map((name) => record[normalizeHeader(name)]).find((value) => value !== undefined) || "";
}

function normalizeRecordType(type, record) {
  const combined = `${type} ${csvCell(record, ["vendor", "notes", "description"])} ${csvCell(record, ["kwh", "kw h"])}`.toLowerCase();
  if (/charge|charging|electric|ev|kwh|kw h/.test(combined)) return "Charge";
  if (/fuel|gas|petrol|diesel|litre|liter|mol|omv|shell|bp/.test(combined)) return "Fuel";
  if (/insurance|zavar|policy/.test(combined)) return "Insurance";
  if (/registration|registr|plate|road tax/.test(combined)) return "Registration";
  if (/tire|tyre|gume/.test(combined)) return "Tires";
  if (/repair|repairs|brake|fix|battery/.test(combined)) return "Repairs";
  if (/service|oil|filter|inspection|servis/.test(combined)) return "Service";
  if (/parking|park|easypark/.test(combined)) return "Parking";
  if (/loan|finance|leasing/.test(combined)) return "Loan";
  return categories.includes(type) ? type : "Other";
}

function parseLedgerCsv(text, fileName) {
  const rows = parseCsv(text);
  const headers = rows[0]?.map(normalizeHeader) || [];
  if (!headers.length || !headers.includes("type") || !headers.some((header) => ["amount", "amounteur", "eur", "cost"].includes(header))) return [];

  return rows.slice(1).map((cells, index) => {
    const record = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]?.trim() || ""]));
    const type = normalizeRecordType(csvCell(record, ["type", "category"]), record);
    const amount = cleanNumber(csvCell(record, ["amount eur", "amount, eur", "amount", "eur", "cost", "price"]));
    const date = normalizeDate(csvCell(record, ["date", "transaction date", "paid date"]));
    const vendor = csvCell(record, ["vendor", "merchant", "supplier", "station"]);
    const notes = csvCell(record, ["notes", "description", "memo"]);
    const odometer = cleanNumber(csvCell(record, ["odometer", "km", "kilometers", "kilometres", "mileage"]));
    const liters = cleanNumber(csvCell(record, ["litres", "liters", "l"]));
    const kwh = cleanNumber(csvCell(record, ["kwh", "kw h"]));

    if (!amount || !date) return null;
    return {
      id: Date.now() + index,
      type,
      vendor: vendor || type,
      date,
      amount,
      odometer,
      liters,
      kwh,
      notes,
      fileName,
    };
  }).filter(Boolean);
}

function recordKey(record) {
  return [record.type, record.vendor, record.date, toNumber(record.amount).toFixed(2), record.notes || ""].join("|").toLowerCase();
}

function loadGarage() {
  if (typeof localStorage === "undefined") return seedGarage;
  try {
    const saved = normalizeGarage(JSON.parse(localStorage.getItem(storageKey)));
    if (saved?.vehicles?.length) return saved;
  } catch {
    return loadLatestBackup();
  }
  return loadLatestBackup() || seedGarage;
}

function normalizeGarage(garage) {
  if (!garage?.vehicles?.length) return null;
  return {
    ...garage,
    updatedAt: garage.updatedAt || "2026-05-23T00:00:00.000Z",
    vehicles: garage.vehicles.map((vehicle) => ({
      ...vehicle,
      records: vehicle.records || [],
      recurring: vehicle.recurring || [],
      reviewQueue: vehicle.reviewQueue || [],
    })),
  };
}

function isNewerGarage(candidate, current) {
  return new Date(candidate?.updatedAt || 0).getTime() > new Date(current?.updatedAt || 0).getTime();
}

function stampGarage(garage) {
  return { ...garage, updatedAt: new Date().toISOString() };
}

function loadBackups() {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(backupKey)) || [];
  } catch {
    return [];
  }
}

function loadLatestBackup() {
  const backups = loadBackups();
  return normalizeGarage(backups[0]?.data);
}

function saveLocalGarage(garage) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(garage));
  const backups = loadBackups();
  const latest = backups[0];
  const shouldSnapshot = !latest || latest.updatedAt !== garage.updatedAt;
  if (!shouldSnapshot) return;
  localStorage.setItem(backupKey, JSON.stringify([
    { updatedAt: garage.updatedAt, data: garage },
    ...backups,
  ].slice(0, maxBackups)));
}

function canCloudSync() {
  return Boolean(syncConfig.url && syncConfig.anonKey);
}

function canStoreDocuments() {
  return Boolean(syncConfig.url && syncConfig.anonKey && syncConfig.bucket);
}

function safePathPart(value) {
  return String(value || "file").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-|-$/g, "") || "file";
}

async function uploadDocumentFile(file, vehicleId) {
  if (!canStoreDocuments()) {
    return { fileUrl: "", storagePath: "", storageStatus: "local metadata only" };
  }

  const storagePath = `${safePathPart(syncConfig.id)}/${safePathPart(vehicleId)}/${Date.now()}-${safePathPart(file.name)}`;
  const response = await fetch(`${syncConfig.url}/storage/v1/object/${encodeURIComponent(syncConfig.bucket)}/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: syncConfig.anonKey,
      Authorization: `Bearer ${syncConfig.anonKey}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!response.ok) throw new Error("Document storage upload failed");

  return {
    fileUrl: `${syncConfig.url}/storage/v1/object/public/${encodeURIComponent(syncConfig.bucket)}/${storagePath}`,
    storagePath,
    storageStatus: "stored in cloud",
  };
}

async function fetchCloudGarage() {
  if (!canCloudSync()) return null;
  const response = await fetch(`${syncConfig.url}/rest/v1/garage_states?id=eq.${encodeURIComponent(syncConfig.id)}&select=data`, {
    headers: {
      apikey: syncConfig.anonKey,
      Authorization: `Bearer ${syncConfig.anonKey}`,
    },
  });
  if (!response.ok) throw new Error("Cloud sync read failed");
  const rows = await response.json();
  return normalizeGarage(rows[0]?.data) || null;
}

async function saveCloudGarage(garage) {
  if (!canCloudSync()) return;
  const response = await fetch(`${syncConfig.url}/rest/v1/garage_states`, {
    method: "POST",
    headers: {
      apikey: syncConfig.anonKey,
      Authorization: `Bearer ${syncConfig.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ id: syncConfig.id, data: garage, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("Cloud sync write failed");
}

function createVehicle(index) {
  return {
    ...seedVehicle,
    id: `vehicle-${Date.now()}`,
    name: `Vehicle ${index}`,
    purchaseDate: today,
    purchasePrice: 0,
    currentKilometers: 0,
    purchaseKilometers: 0,
    estimatedValue: 0,
    targetSellKilometers: 150000,
    annualKilometers: 15000,
    maintenanceReserve: 1200,
    records: [],
    recurring: [],
    reviewQueue: [],
  };
}

function downloadGarageBackup(garage) {
  const blob = new Blob([JSON.stringify(garage, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `garage-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[match]));
}

function fileExtension(fileName = "") {
  return (fileName.split(".").pop() || "doc").slice(0, 4).toUpperCase();
}

function documentPreviewType(fileName = "") {
  if (/\.(jpg|jpeg|png|webp|heic)$/i.test(fileName)) return "image";
  if (/\.pdf$/i.test(fileName)) return "pdf";
  if (/\.csv$/i.test(fileName)) return "csv";
  return "doc";
}

function buildSetupSteps(vehicle, model, syncState) {
  return [
    {
      title: "Vehicle profile",
      detail: "Confirm purchase price, market value and current kilometers.",
      complete: toNumber(vehicle.purchasePrice) > 0 && toNumber(vehicle.currentKilometers) > 0,
      view: "Garage",
    },
    {
      title: "Import ledger",
      detail: "Bring in service, fuel, charge, insurance and registration history.",
      complete: (vehicle.records || []).length >= 8,
      view: "Records",
    },
    {
      title: "Document vault",
      detail: "Add insurance and registration files so the ownership file is complete.",
      complete: model.documentCompleteness >= 100,
      view: "Vault",
    },
    {
      title: "Cloud sync",
      detail: "Keep the garage available on every device.",
      complete: syncState === "Synced",
      view: "Garage",
    },
  ];
}

function exportOwnershipReport(vehicle, model) {
  const generatedAt = new Date().toLocaleString("sl-SI");
  const topCategories = model.categoriesBySpend.slice(0, 6);
  const recentRecords = model.sortedRecords.slice(0, 12);
  const requiredDocs = model.documentVault.documents.filter((doc) => ["Insurance", "Registration"].includes(doc.type));
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(vehicle.name)} ownership report</title>
  <style>
    body { margin: 0; padding: 40px; color: #1f2933; background: #f4f6f8; font-family: Inter, Arial, sans-serif; }
    main { max-width: 980px; margin: auto; background: #fff; border: 1px solid #d7dde4; border-radius: 14px; overflow: hidden; }
    header { padding: 34px; color: #fff; background: #17231f; }
    p { color: #697586; line-height: 1.5; }
    header p { color: rgba(255, 255, 255, 0.72); }
    h1 { margin: 0 0 10px; font-size: 42px; line-height: 1; }
    h2 { margin: 0 0 14px; font-size: 18px; }
    section { padding: 26px 34px; border-top: 1px solid #e5e8ec; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .card { padding: 15px; border: 1px solid #d7dde4; border-radius: 10px; }
    .card span, th { color: #697586; font-size: 11px; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
    .card strong { display: block; margin-top: 8px; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #edf0f3; text-align: left; }
    .pill { display: inline-block; padding: 5px 8px; border-radius: 999px; background: #eef5f3; color: #2f7f72; font-weight: 800; }
    @media print { body { padding: 0; background: #fff; } main { border: 0; border-radius: 0; } }
  </style>
</head>
<body>
  <main>
    <header>
      <p>Garage Ledger ownership report · ${escapeHtml(generatedAt)}</p>
      <h1>${escapeHtml(vehicle.name)}</h1>
      <p>${escapeHtml(formatKm(toNumber(vehicle.currentKilometers)))} · ${escapeHtml(currencyExact.format(model.costPerKm))}/km · ${escapeHtml(currency.format(model.totalCost))} total ownership cost</p>
    </header>
    <section class="grid">
      <article class="card"><span>Total cost</span><strong>${escapeHtml(currency.format(model.totalCost))}</strong></article>
      <article class="card"><span>Cost per km</span><strong>${escapeHtml(currencyExact.format(model.costPerKm))}</strong></article>
      <article class="card"><span>Monthly burn</span><strong>${escapeHtml(currency.format(model.monthlyCost))}</strong></article>
      <article class="card"><span>Sell score</span><strong>${escapeHtml(model.sellScore)}</strong></article>
    </section>
    <section>
      <h2>Ownership summary</h2>
      <p>Cash spend is ${escapeHtml(currency.format(model.directSpend))}, depreciation is ${escapeHtml(currency.format(model.depreciation))}, and document completeness is ${escapeHtml(model.documentCompleteness)}%.</p>
    </section>
    <section>
      <h2>Top cost categories</h2>
      <table><tbody>${topCategories.map((row) => `<tr><td><span class="pill">${escapeHtml(row.type)}</span></td><td>${escapeHtml(currency.format(row.total))}</td><td>${escapeHtml(currencyExact.format(row.total / Math.max(model.kilometersOwned, 1)))}/km</td></tr>`).join("")}</tbody></table>
    </section>
    <section>
      <h2>Required documents</h2>
      <table><tbody>${requiredDocs.map((doc) => `<tr><td>${escapeHtml(doc.type)}</td><td>${escapeHtml(doc.title)}</td><td>${escapeHtml(doc.status)}</td><td>${escapeHtml(doc.nextDue || doc.date || "")}</td></tr>`).join("")}</tbody></table>
    </section>
    <section>
      <h2>Recent records</h2>
      <table><thead><tr><th>Date</th><th>Type</th><th>Vendor</th><th>Amount</th></tr></thead><tbody>${recentRecords.map((record) => `<tr><td>${escapeHtml(record.date)}</td><td>${escapeHtml(record.type)}</td><td>${escapeHtml(record.vendor || record.fileName)}</td><td>${escapeHtml(currencyExact.format(toNumber(record.amount)))}</td></tr>`).join("")}</tbody></table>
    </section>
  </main>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${vehicle.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-ownership-report.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Stat({ label, value, sub, tone = "" }) {
  return (
    <article className={`stat ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{sub}</span>
    </article>
  );
}

function Disclosure({ title, kicker, children, open = false }) {
  return (
    <details className="disclosure" open={open}>
      <summary>
        <span>
          {kicker ? <small>{kicker}</small> : null}
          <strong>{title}</strong>
        </span>
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

function Bar({ label, value, max, color = "#2f7f72", detail }) {
  return (
    <div className="bar-item">
      <div className="bar-meta">
        <span>{label}</span>
        <strong>{currency.format(value)}</strong>
      </div>
      <div className="bar-rail"><span style={{ width: `${Math.max((value / max) * 100, 3)}%`, background: color }} /></div>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function MonthlySpendChart({ rows }) {
  const max = Math.max(...rows.map((row) => row.total), 1);
  const peak = rows.reduce((highest, row) => (row.total > highest.total ? row : highest), rows[0] || { total: 0 });
  const latest = rows[rows.length - 1];
  return (
    <div className="monthly-chart">
      {rows.map((row, index) => {
        const dominant = row.segments[0];
        const previous = rows[index - 1];
        const monthDelta = previous ? row.total - previous.total : 0;
        const isLatest = latest?.month === row.month;
        const isPeak = peak?.month === row.month && peak.total > 0;

        return (
          <article
            key={row.month}
            className={`${isLatest ? "is-latest" : ""} ${isPeak ? "is-peak" : ""}`.trim()}
            title={`${row.month}: ${currencyExact.format(row.total)}`}
          >
            {isLatest ? <em>{monthDelta >= 0 ? "+" : ""}{currency.format(monthDelta)}</em> : null}
            <div className="monthly-stack" style={{ height: `${Math.max((row.total / max) * 100, 8)}%` }}>
              {row.segments.map((segment) => (
                <span
                  key={segment.type}
                  style={{
                    height: `${row.total ? Math.max((segment.total / row.total) * 100, 6) : 6}%`,
                    background: categoryColors[segment.type] || categoryColors.Other,
                  }}
                  title={`${segment.type}: ${currencyExact.format(segment.total)}`}
                />
              ))}
              {dominant ? (
                <i>
                  {dominant.type}
                </i>
              ) : null}
            </div>
            {isPeak ? <b>Peak</b> : null}
            <strong>{currency.format(row.total)}</strong>
            <small>{row.month}</small>
          </article>
        );
      })}
    </div>
  );
}

function MiniTrend({ rows }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  const latest = rows[rows.length - 1];
  return (
    <div className="mini-trend">
      {rows.map((row) => (
        <div
          key={row.id}
          className={latest?.id === row.id ? "is-latest" : ""}
          title={`${row.label}: ${row.detail}`}
        >
          <span style={{ height: `${Math.max((row.value / max) * 100, 8)}%` }} />
          <small>{row.label}<b>{row.detail}</b></small>
        </div>
      ))}
    </div>
  );
}

function monthlySpendTrend(records) {
  const months = records.reduce((acc, record) => {
    const month = (record.date || today).slice(0, 7);
    const bucket = acc.get(month) || { month, total: 0, byType: {} };
    const amount = toNumber(record.amount);
    bucket.total += amount;
    bucket.byType[record.type] = (bucket.byType[record.type] || 0) + amount;
    acc.set(month, bucket);
    return acc;
  }, new Map());

  return [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((month) => ({
      ...month,
      segments: Object.entries(month.byType)
        .map(([type, total]) => ({ type, total }))
        .sort((a, b) => b.total - a.total),
    }));
}

function monthlyEnergyTrend(rows, unit) {
  const months = rows.reduce((acc, record) => {
    const month = (record.date || today).slice(0, 7);
    const bucket = acc.get(month) || { month, amount: 0, quantity: 0, count: 0 };
    bucket.amount += toNumber(record.amount);
    bucket.quantity += toNumber(unit === "kWh" ? record.kwh : record.liters);
    bucket.count += 1;
    acc.set(month, bucket);
    return acc;
  }, new Map());

  return [...months.values()]
    .filter((month) => month.quantity > 0)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((month) => {
      const value = month.amount / month.quantity;
      return {
        id: `${unit}-${month.month}`,
        label: month.month,
        value,
        detail: `${currencyExact.format(value)}/${unit}`,
        count: month.count,
      };
    });
}

function buildAnomalies({ monthlySpend, fuelTrend, chargeTrend, reserveTrend, vehicle, sellScore }) {
  const alerts = [];
  const recentMonths = monthlySpend.slice(-6);
  const averageMonthly = recentMonths.reduce((sum, month) => sum + month.total, 0) / Math.max(recentMonths.length, 1);
  const latestMonth = monthlySpend.at(-1);
  if (latestMonth && averageMonthly && latestMonth.total > averageMonthly * 1.45 && latestMonth.total > 150) {
    alerts.push({
      tone: "warning",
      title: "Monthly spend jumped",
      detail: `${latestMonth.month} is ${currencyExact.format(latestMonth.total)}, above the recent ${currencyExact.format(averageMonthly)} average.`,
    });
  }

  const fuelAverage = fuelTrend.reduce((sum, row) => sum + row.value, 0) / Math.max(fuelTrend.length, 1);
  const latestFuel = fuelTrend.at(-1);
  if (latestFuel && fuelAverage && latestFuel.value > fuelAverage * 1.2) {
    alerts.push({
      tone: "watch",
      title: "Fuel price is running high",
      detail: `${latestFuel.label} averages ${latestFuel.detail}, above your recent trend.`,
    });
  }

  const chargeAverage = chargeTrend.reduce((sum, row) => sum + row.value, 0) / Math.max(chargeTrend.length, 1);
  const latestCharge = chargeTrend.at(-1);
  if (latestCharge && chargeAverage && latestCharge.value > chargeAverage * 1.2) {
    alerts.push({
      tone: "watch",
      title: "Charging price is running high",
      detail: `${latestCharge.label} averages ${latestCharge.detail}, above your recent trend.`,
    });
  }

  if (reserveTrend > toNumber(vehicle.maintenanceReserve)) {
    alerts.push({
      tone: "warning",
      title: "Maintenance reserve pressure",
      detail: `Service, repair and tyre trend is ${currency.format(reserveTrend)} against a ${currency.format(toNumber(vehicle.maintenanceReserve))} reserve.`,
    });
  }

  if (sellScore >= 78) {
    alerts.push({
      tone: "critical",
      title: "Sale window is opening",
      detail: "The sell score is high enough to start preparing the listing packet.",
    });
  }

  if (!alerts.length) {
    alerts.push({
      tone: "good",
      title: "No major anomalies",
      detail: "Recent costs look consistent with your current ownership pattern.",
    });
  }
  return alerts;
}

function buildDocumentVault(records, recurring) {
  const required = ["Insurance", "Registration"];
  const docs = records
    .filter((record) => record.fileName)
    .map((record) => {
      const recurringItem = recurring.find((item) => item.name.toLowerCase().includes(record.type.toLowerCase()));
      const daysUntilDue = recurringItem?.nextDue ? Math.ceil((new Date(recurringItem.nextDue) - new Date(today)) / 86400000) : null;
      const status = daysUntilDue !== null && daysUntilDue < 0 ? "expired" : daysUntilDue !== null && daysUntilDue <= 45 ? "expiring soon" : ["Insurance", "Registration"].includes(record.type) ? "valid" : "filed";
      return {
        id: record.id,
        type: record.type,
        title: record.fileName,
        vendor: record.vendor || record.type,
        date: record.date,
        amount: toNumber(record.amount),
        status,
        nextDue: recurringItem?.nextDue || "",
        record,
        fileUrl: record.fileUrl || "",
        storagePath: record.storagePath || "",
        storageStatus: record.storageStatus || "",
        mimeType: record.mimeType || "",
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const missing = required
    .filter((type) => !docs.some((doc) => doc.type === type))
    .map((type) => ({
      id: `missing-${type}`,
      type,
      title: `${type} document`,
      vendor: "Missing",
      date: "",
      amount: 0,
      status: "missing",
      nextDue: recurring.find((item) => item.name.toLowerCase().includes(type.toLowerCase()))?.nextDue || "",
      record: null,
    }));

  const counts = [...docs, ...missing].reduce((acc, doc) => {
    acc[doc.status] = (acc[doc.status] || 0) + 1;
    return acc;
  }, {});

  return { documents: [...missing, ...docs], counts };
}

function buildMonthlyDigest(model) {
  const month = model.latestMonth?.month || today.slice(0, 7);
  const topCategory = model.latestMonth?.segments?.[0];
  const fileCount = model.documentVault.documents.filter((doc) => doc.status !== "missing").length;
  const dueSoon = model.documentVault.documents.find((doc) => doc.status === "expiring soon" || doc.status === "expired");
  return {
    month,
    spend: model.latestMonth?.total || 0,
    delta: model.previousMonth ? model.monthlyDelta : null,
    topCategory,
    recordCount: model.sortedRecords.filter((record) => (record.date || "").startsWith(month)).length,
    fileCount,
    dueSoon,
    headline: topCategory ? `${topCategory.type} led ${month} spend` : "Monthly recap will appear after records are added",
  };
}

function buildNextActions({ anomalies, documentVault, upcomingRecurring, nextHeavyService, sellScore, reviewQueue }) {
  const actions = [];
  const missingDoc = documentVault.documents.find((doc) => doc.status === "missing");
  const expiringDoc = documentVault.documents.find((doc) => doc.status === "expiring soon" || doc.status === "expired");
  if (missingDoc) actions.push({ title: `Add ${missingDoc.type.toLowerCase()} document`, detail: "Complete the required vehicle file.", view: "Vault", tone: "critical" });
  if (expiringDoc) actions.push({ title: `Review ${expiringDoc.type.toLowerCase()} renewal`, detail: expiringDoc.nextDue ? `Due ${expiringDoc.nextDue}.` : "Renewal date needs attention.", view: "Vault", tone: "warning" });
  if (reviewQueue?.length) actions.push({ title: "Approve imported documents", detail: `${reviewQueue.length} item${reviewQueue.length === 1 ? "" : "s"} waiting in review.`, view: "Records", tone: "warning" });
  const anomaly = anomalies.find((item) => item.tone !== "good");
  if (anomaly) actions.push({ title: anomaly.title, detail: anomaly.detail, view: "Overview", tone: anomaly.tone });
  if (sellScore >= 55) actions.push({ title: "Prepare sell packet", detail: nextHeavyService, view: "Sell prep", tone: "watch" });
  const nextDue = upcomingRecurring[0];
  if (nextDue) actions.push({ title: `Plan ${nextDue.name.toLowerCase()} payment`, detail: `${nextDue.nextDue} · ${currency.format(toNumber(nextDue.amount))}`, view: "Garage", tone: "good" });
  if (!actions.length) actions.push({ title: "Keep logging costs", detail: "The vehicle file is healthy. Add the next receipt when it comes in.", view: "Records", tone: "good" });
  return actions.slice(0, 4);
}

function buildModel(vehicle) {
  const records = vehicle.records || [];
  const kilometersOwned = Math.max(toNumber(vehicle.currentKilometers) - toNumber(vehicle.purchaseKilometers), 1);
  const directSpend = records.reduce((sum, record) => sum + toNumber(record.amount), 0);
  const depreciation = Math.max(toNumber(vehicle.purchasePrice) - toNumber(vehicle.estimatedValue), 0);
  const totalCost = directSpend + depreciation;
  const costPerKm = totalCost / kilometersOwned;
  const fuelRows = records.filter((record) => record.type === "Fuel").sort((a, b) => toNumber(a.odometer) - toNumber(b.odometer));
  const chargeRows = records.filter((record) => record.type === "Charge").sort((a, b) => toNumber(a.odometer) - toNumber(b.odometer));
  const fuelSpend = fuelRows.reduce((sum, record) => sum + toNumber(record.amount), 0);
  const chargeSpend = chargeRows.reduce((sum, record) => sum + toNumber(record.amount), 0);
  const liters = fuelRows.reduce((sum, record) => sum + toNumber(record.liters), 0);
  const kwh = chargeRows.reduce((sum, record) => sum + toNumber(record.kwh), 0);
  const fuelOdometers = fuelRows.map((record) => toNumber(record.odometer)).filter(Boolean);
  const chargeOdometers = chargeRows.map((record) => toNumber(record.odometer)).filter(Boolean);
  const fuelDistance = fuelOdometers.length > 1 ? Math.max(...fuelOdometers) - Math.min(...fuelOdometers) : 0;
  const chargeDistance = chargeOdometers.length > 1 ? Math.max(...chargeOdometers) - Math.min(...chargeOdometers) : 0;
  const avgFuelPrice = liters ? fuelSpend / liters : 0;
  const avgChargePrice = kwh ? chargeSpend / kwh : 0;
  const consumption = liters && fuelDistance ? (liters / fuelDistance) * 100 : 0;
  const chargeConsumption = kwh && chargeDistance ? (kwh / chargeDistance) * 100 : 0;
  const ownershipMonths = monthsBetween(vehicle.purchaseDate);
  const monthlyCost = totalCost / ownershipMonths;
  const remainingKilometers = Math.max(toNumber(vehicle.targetSellKilometers) - toNumber(vehicle.currentKilometers), 0);
  const sellInMonths = toNumber(vehicle.annualKilometers) ? Math.round((remainingKilometers / toNumber(vehicle.annualKilometers)) * 12) : 0;
  const reserveTrend = records.filter((record) => ["Service", "Repairs", "Tires"].includes(record.type)).reduce((sum, record) => sum + toNumber(record.amount), 0) / Math.max(ownershipMonths / 12, 1);
  const sellScore = Math.min(100, Math.round((toNumber(vehicle.currentKilometers) / Math.max(toNumber(vehicle.targetSellKilometers), 1)) * 58 + (costPerKm / 0.6) * 24 + (reserveTrend / Math.max(toNumber(vehicle.maintenanceReserve), 1)) * 18));
  const categoriesBySpend = categories.map((type) => ({
    type,
    total: records.filter((record) => record.type === type).reduce((sum, record) => sum + toNumber(record.amount), 0),
  })).filter((row) => row.total > 0).sort((a, b) => b.total - a.total);
  const maxCategory = Math.max(...categoriesBySpend.map((row) => row.total), 1);
  const nextMilestone = servicePlan.find((item) => item.km > toNumber(vehicle.currentKilometers)) || servicePlan.at(-1);
  const nextHeavyService = nextMilestone.km <= toNumber(vehicle.currentKilometers) ? "Major service window is open now" : `${integer.format(nextMilestone.km - toNumber(vehicle.currentKilometers))} km until ${integer.format(nextMilestone.km)} km service`;
  const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
  const lastRecord = sortedRecords[0];
  const recurring12 = (vehicle.recurring || []).reduce((sum, item) => sum + (item.cadence === "Monthly" ? toNumber(item.amount) * 12 : toNumber(item.amount)), 0);
  const timeline = [
    ...servicePlan.map((item) => ({ ...item, source: "plan", complete: toNumber(vehicle.currentKilometers) >= item.km })),
    ...records.filter((record) => ["Service", "Repairs", "Tires"].includes(record.type)).map((record) => ({
      km: toNumber(record.odometer),
      label: `${record.type}: ${record.vendor || record.fileName}`,
      date: record.date,
      source: "record",
      complete: true,
    })),
  ].sort((a, b) => a.km - b.km);
  const fuelTrend = monthlyEnergyTrend(fuelRows, "L");
  const chargeTrend = monthlyEnergyTrend(chargeRows, "kWh");
  const monthlySpend = monthlySpendTrend(records);
  const anomalies = buildAnomalies({ monthlySpend, fuelTrend, chargeTrend, reserveTrend, vehicle, sellScore });
  const documentVault = buildDocumentVault(records, vehicle.recurring || []);
  const latestMonth = monthlySpend.at(-1);
  const previousMonth = monthlySpend.at(-2);
  const monthlyDelta = latestMonth && previousMonth ? latestMonth.total - previousMonth.total : 0;
  const upcomingRecurring = [...(vehicle.recurring || [])].sort((a, b) => new Date(a.nextDue) - new Date(b.nextDue));
  const vaultRequired = documentVault.documents.filter((doc) => ["Insurance", "Registration"].includes(doc.type));
  const documentCompleteness = Math.round((vaultRequired.filter((doc) => doc.status !== "missing" && doc.status !== "expired").length / Math.max(vaultRequired.length, 1)) * 100);
  const healthScores = {
    cost: Math.max(0, Math.min(100, Math.round(100 - costPerKm * 95))),
    documents: documentCompleteness,
    maintenance: Math.max(0, Math.min(100, Math.round(100 - (reserveTrend / Math.max(toNumber(vehicle.maintenanceReserve), 1)) * 55))),
    sell: Math.max(0, Math.min(100, 100 - sellScore)),
  };
  const nextActions = buildNextActions({ anomalies, documentVault, upcomingRecurring, nextHeavyService, sellScore, reviewQueue: vehicle.reviewQueue || [] });
  const monthlyInsight = latestMonth?.segments?.[0] ? `${latestMonth.segments[0].type} drove ${Math.round((latestMonth.segments[0].total / Math.max(latestMonth.total, 1)) * 100)}% of ${latestMonth.month} spend.` : "Add records to generate monthly insight.";
  const monthlyDigest = buildMonthlyDigest({ documentVault, latestMonth, monthlyDelta, previousMonth, sortedRecords });
  return { kilometersOwned, directSpend, depreciation, totalCost, costPerKm, liters, kwh, avgFuelPrice, avgChargePrice, consumption, chargeConsumption, monthlyCost, sellInMonths, sellScore, categoriesBySpend, maxCategory, nextHeavyService, sortedRecords, lastRecord, remainingKilometers, reserveTrend, recurring12, timeline, fuelTrend, chargeTrend, monthlySpend, anomalies, documentVault, documentCompleteness, healthScores, nextActions, monthlyInsight, latestMonth, previousMonth, monthlyDelta, upcomingRecurring, monthlyDigest };
}

function App() {
  const [garage, setGarage] = useState(loadGarage);
  const [syncState, setSyncState] = useState(canCloudSync() ? "Connecting" : "Local only");
  const [cloudLoaded, setCloudLoaded] = useState(!canCloudSync());
  const [form, setForm] = useState({ type: "Service", vendor: "", date: today, amount: "", odometer: "", liters: "", kwh: "", notes: "" });
  const [activeView, setActiveView] = useState("Overview");
  const [scenarioKm, setScenarioKm] = useState(132000);
  const [scenarioValue, setScenarioValue] = useState(22000);
  const [importMessage, setImportMessage] = useState("");
  const [storageMessage, setStorageMessage] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState("All");
  const [recordSearch, setRecordSearch] = useState("");
  const [recurringForm, setRecurringForm] = useState({ name: "", cadence: "Monthly", nextDue: today, amount: "" });
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const fileInput = useRef(null);
  const importInput = useRef(null);
  const hasStoredGarage = useRef(typeof localStorage !== "undefined" && Boolean(localStorage.getItem(storageKey)));

  const vehicle = garage.vehicles.find((item) => item.id === garage.activeVehicleId) || garage.vehicles[0];
  const model = useMemo(() => buildModel(vehicle), [vehicle]);
  const selectedRecord = (vehicle.records || []).find((record) => record.id === selectedRecordId);
  const sellState = model.sellScore >= 78 ? "Sell soon" : model.sellScore >= 55 ? "Plan exit" : "Hold";
  const setupSteps = buildSetupSteps(vehicle, model, syncState);
  const setupComplete = setupSteps.filter((step) => step.complete).length;
  const nextSetupStep = setupSteps.find((step) => !step.complete);
  const filteredRecords = model.sortedRecords.filter((record) => {
    const typeMatch = recordTypeFilter === "All" || record.type === recordTypeFilter;
    const search = recordSearch.trim().toLowerCase();
    const searchMatch = !search || `${record.vendor} ${record.notes} ${record.fileName}`.toLowerCase().includes(search);
    return typeMatch && searchMatch;
  });

  useEffect(() => {
    saveLocalGarage(garage);
    if (!cloudLoaded || !canCloudSync()) return;
    const timer = window.setTimeout(() => {
      setSyncState("Saving");
      saveCloudGarage(garage).then(() => setSyncState("Synced")).catch(() => setSyncState("Sync error"));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [garage, cloudLoaded]);

  useEffect(() => {
    let alive = true;
    if (!canCloudSync()) return;
    fetchCloudGarage()
      .then((cloudGarage) => {
        if (!alive) return;
        if (cloudGarage?.vehicles?.length && (!hasStoredGarage.current || isNewerGarage(cloudGarage, garage))) {
          setGarage(cloudGarage);
          saveLocalGarage(cloudGarage);
        } else if (garage?.vehicles?.length) {
          saveCloudGarage(garage).catch(() => setSyncState("Sync error"));
        }
        setSyncState("Synced");
      })
      .catch(() => {
        if (alive) setSyncState("Sync error");
      })
      .finally(() => {
        if (alive) setCloudLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  function mutateGarage(updater) {
    setGarage((current) => stampGarage(updater(current)));
  }

  useEffect(() => {
    setScenarioKm(toNumber(vehicle.targetSellKilometers));
    setScenarioValue(Math.max(toNumber(vehicle.estimatedValue) - 3500, 0));
  }, [vehicle.id, vehicle.targetSellKilometers, vehicle.estimatedValue]);

  function updateVehicle(key, value) {
    mutateGarage((current) => ({
      ...current,
      vehicles: current.vehicles.map((item) => item.id === vehicle.id ? { ...item, [key]: value } : item),
    }));
  }

  function updateVehicleList(nextVehicle) {
    mutateGarage((current) => ({
      ...current,
      vehicles: current.vehicles.map((item) => item.id === nextVehicle.id ? nextVehicle : item),
    }));
  }

  function selectVehicle(id) {
    mutateGarage((current) => ({ ...current, activeVehicleId: id }));
    setSelectedRecordId(null);
  }

  function addRecord(event) {
    event.preventDefault();
    if (!form.amount || !form.date) return;
    updateVehicleList({ ...vehicle, records: [{ ...form, id: Date.now(), fileName: "Manual entry" }, ...(vehicle.records || [])] });
    setForm({ type: "Service", vendor: "", date: today, amount: "", odometer: "", liters: "", kwh: "", notes: "" });
  }

  function removeRecord(id) {
    updateVehicleList({ ...vehicle, records: (vehicle.records || []).filter((record) => record.id !== id) });
    if (selectedRecordId === id) setSelectedRecordId(null);
  }

  function updateRecord(id, key, value) {
    updateVehicleList({
      ...vehicle,
      records: (vehicle.records || []).map((record) => record.id === id ? { ...record, [key]: value } : record),
    });
  }

  function updateReview(id, key, value) {
    updateVehicleList({
      ...vehicle,
      reviewQueue: (vehicle.reviewQueue || []).map((item) => item.id === id ? { ...item, [key]: value } : item),
    });
  }

  function approveReview(item) {
    const { confidence, ...record } = item;
    updateVehicleList({
      ...vehicle,
      records: [{ ...record, notes: record.notes.replace("Imported from upload. ", "") }, ...(vehicle.records || [])],
      reviewQueue: (vehicle.reviewQueue || []).filter((review) => review.id !== item.id),
    });
  }

  function discardReview(id) {
    updateVehicleList({ ...vehicle, reviewQueue: (vehicle.reviewQueue || []).filter((review) => review.id !== id) });
  }

  function addRecurring(event) {
    event.preventDefault();
    if (!recurringForm.name || !recurringForm.amount) return;
    updateVehicleList({
      ...vehicle,
      recurring: [{ ...recurringForm, id: `recurring-${Date.now()}` }, ...(vehicle.recurring || [])],
    });
    setRecurringForm({ name: "", cadence: "Monthly", nextDue: today, amount: "" });
  }

  function updateRecurring(id, key, value) {
    updateVehicleList({
      ...vehicle,
      recurring: (vehicle.recurring || []).map((item) => item.id === id ? { ...item, [key]: value } : item),
    });
  }

  function removeRecurring(id) {
    updateVehicleList({
      ...vehicle,
      recurring: (vehicle.recurring || []).filter((item) => item.id !== id),
    });
  }

  async function handleFiles(files) {
    const fileList = Array.from(files || []);
    setStorageMessage("");
    const ledgerRecords = (await Promise.all(fileList
      .filter((file) => /\.csv$/i.test(file.name))
      .map(async (file) => parseLedgerCsv(await file.text(), file.name))))
      .flat();

    const documentFiles = fileList.filter((file) => !/\.csv$/i.test(file.name));
    const uploaded = await Promise.all(documentFiles.map(async (file) => {
      const text = file.type.startsWith("text/") || /\.(csv|txt|json)$/i.test(file.name) ? await file.text() : "";
      let storage = { fileUrl: "", storagePath: "", storageStatus: "local metadata only" };
      try {
        storage = await uploadDocumentFile(file, vehicle.id);
      } catch {
        storage = { fileUrl: "", storagePath: "", storageStatus: "storage upload failed" };
      }
      return parseUploadedText(text, file.name, { ...storage, mimeType: file.type });
    }));

    const existingKeys = new Set((vehicle.records || []).map(recordKey));
    const newLedgerRecords = ledgerRecords.filter((record) => !existingKeys.has(recordKey(record)));

    updateVehicleList({
      ...vehicle,
      records: [...newLedgerRecords, ...(vehicle.records || [])],
      reviewQueue: [...uploaded, ...(vehicle.reviewQueue || [])],
    });
    if (newLedgerRecords.length || uploaded.length) {
      const imported = newLedgerRecords.length ? `${newLedgerRecords.length} spreadsheet rows imported` : "";
      const queued = uploaded.length ? `${uploaded.length} documents queued` : "";
      setImportMessage([imported, queued].filter(Boolean).join(" · "));
      const stored = uploaded.filter((item) => item.fileUrl).length;
      if (uploaded.length) setStorageMessage(stored ? `${stored}/${uploaded.length} files stored in Supabase Storage` : "Files queued as metadata. Add a public Supabase Storage bucket for cross-device file opening.");
    } else {
      setImportMessage("No new rows found. Existing spreadsheet records were skipped.");
    }
    setActiveView("Records");
    if (fileInput.current) fileInput.current.value = "";
  }

  function addVehicle() {
    const nextVehicle = createVehicle(garage.vehicles.length + 1);
    mutateGarage((current) => ({ ...current, activeVehicleId: nextVehicle.id, vehicles: [...current.vehicles, nextVehicle] }));
    setActiveView("Garage");
  }

  async function importGarageBackup(files) {
    const file = files?.[0];
    if (!file) return;
    const parsed = normalizeGarage(JSON.parse(await file.text()));
    if (!parsed) return;
    setGarage(stampGarage(parsed));
    setSyncState(canCloudSync() ? "Saving" : "Local only");
  }

  const scenarioDistance = Math.max(toNumber(scenarioKm) - toNumber(vehicle.currentKilometers), 1);
  const scenarioDepreciation = Math.max(toNumber(vehicle.purchasePrice) - toNumber(scenarioValue), 0);
  const projectedCostPerKm = (model.directSpend + scenarioDepreciation + scenarioDistance * Math.max(model.costPerKm * 0.42, 0.08)) / Math.max(toNumber(scenarioKm) - toNumber(vehicle.purchaseKilometers), 1);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <strong>Garage Ledger</strong>
          <span>Ownership costs, documents and sale timing</span>
        </div>
        <label className="vehicle-select">Vehicle<select value={vehicle.id} onChange={(event) => selectVehicle(event.target.value)}>
          {garage.vehicles.map((item) => <option key={item.id} value={item.id}>{item.name} · {integer.format(toNumber(item.currentKilometers))} km</option>)}
        </select></label>
        <nav aria-label="Dashboard sections">
          {views.map((view) => (
            <button key={view} className={activeView === view ? "active" : ""} onClick={() => setActiveView(view)}>{view}</button>
          ))}
        </nav>
        <label className="view-select">View<select value={activeView} onChange={(event) => setActiveView(event.target.value)}>
          {views.map((view) => <option key={view}>{view}</option>)}
        </select></label>
        <div className="top-actions">
          <span className={`sync-pill ${syncState.toLowerCase().replace(/\s/g, "-")}`}>{syncState}</span>
          <details className="add-menu">
            <summary>+ Add</summary>
            <div>
              <button type="button" onClick={() => { setActiveView("Records"); fileInput.current?.click(); }}>Upload document</button>
              <button type="button" onClick={() => setActiveView("Records")}>Add record</button>
              <button type="button" onClick={() => setActiveView("Garage")}>Add recurring cost</button>
              <button type="button" onClick={() => exportOwnershipReport(vehicle, model)}>Export report</button>
              <button type="button" onClick={() => downloadGarageBackup(garage)}>Download backup</button>
              <button type="button" onClick={addVehicle}>Add vehicle</button>
            </div>
          </details>
        </div>
      </header>

      <section className="cockpit-hero">
        <div className="cockpit-main">
          <p>Ownership cockpit</p>
          <h1>{vehicle.name}</h1>
          <strong>{formatKm(toNumber(vehicle.currentKilometers))} · {currencyExact.format(model.costPerKm)}/km · {sellState}{model.sellInMonths ? ` in ${model.sellInMonths} months` : " now"}</strong>
          <div className="health-track" aria-label="Ownership health">
            {Object.entries(model.healthScores).map(([key, value]) => (
              <span key={key} style={{ "--value": `${value}%` }}><b>{key}</b></span>
            ))}
          </div>
        </div>
        <div className="cockpit-side">
          <div className="score-chip" style={{ "--score": `${model.sellScore}%` }}><strong>{model.sellScore}</strong><span>sell score</span></div>
          <div className="document-ring" style={{ "--complete": `${model.documentCompleteness * 3.6}deg` }}>
            <strong>{model.documentCompleteness}%</strong>
            <span>documents</span>
          </div>
        </div>
      </section>

      <section className="kpi-strip">
        <Stat label="Cost per km" value={currencyExact.format(model.costPerKm)} sub={`${formatKm(model.kilometersOwned)} owned`} tone="primary" />
        <Stat label="Total cost" value={currency.format(model.totalCost)} sub={`${currency.format(model.directSpend)} cash + ${currency.format(model.depreciation)} depreciation`} />
        <Stat label="Monthly burn" value={currency.format(model.monthlyCost)} sub="Ownership cost normalized by time" />
        <Stat label="Recurring 12 mo" value={currency.format(model.recurring12)} sub={`${integer.format((vehicle.records || []).length)} records · ${integer.format((vehicle.reviewQueue || []).length)} to review`} />
        <Stat
          label="Energy average"
          value={model.avgChargePrice ? `${currencyExact.format(model.avgChargePrice)}/kWh` : (model.avgFuelPrice ? `${currencyExact.format(model.avgFuelPrice)}/L` : "0,00 €")}
          sub={`${decimal.format(model.liters)} L · ${decimal.format(model.kwh)} kWh${model.chargeConsumption ? ` · ${decimal.format(model.chargeConsumption)} kWh/100 km` : model.consumption ? ` · ${decimal.format(model.consumption)} L/100 km` : ""}`}
        />
      </section>

      <section className="workbench">
        <aside className="panel upload-panel">
          <Disclosure title="Assumptions" kicker="Vehicle filters" open>
          <div className="settings-panel">
            <label className="vehicle-name">Vehicle<input value={vehicle.name} onChange={(event) => updateVehicle("name", event.target.value)} /></label>
            <div className="form-pair">
              <label>Current km<input type="number" value={vehicle.currentKilometers} onChange={(event) => updateVehicle("currentKilometers", event.target.value)} /></label>
              <label>Annual km<input type="number" value={vehicle.annualKilometers} onChange={(event) => updateVehicle("annualKilometers", event.target.value)} /></label>
            </div>
            <div className="form-pair">
              <label>Purchase price<input type="number" value={vehicle.purchasePrice} onChange={(event) => updateVehicle("purchasePrice", event.target.value)} /></label>
              <label>Purchase km<input type="number" value={vehicle.purchaseKilometers} onChange={(event) => updateVehicle("purchaseKilometers", event.target.value)} /></label>
            </div>
            <div className="form-pair">
              <label>Market value<input type="number" value={vehicle.estimatedValue} onChange={(event) => updateVehicle("estimatedValue", event.target.value)} /></label>
              <label>Sell target km<input type="number" value={vehicle.targetSellKilometers} onChange={(event) => updateVehicle("targetSellKilometers", event.target.value)} /></label>
            </div>
          </div>
          </Disclosure>

          <Disclosure title="Upload documents" kicker="Capture">
          <button className="upload-zone" onClick={() => fileInput.current?.click()} onDrop={(event) => { event.preventDefault(); handleFiles(event.dataTransfer.files); }} onDragOver={(event) => event.preventDefault()}>
            <span>+</span>
            <strong>Add documents</strong>
            <small>CSV ledgers import directly. Receipts land in review.</small>
          </button>
          <input ref={fileInput} type="file" multiple hidden accept=".csv,.txt,.json,.pdf,.jpg,.jpeg,.png" onChange={(event) => handleFiles(event.target.files)} />
          {importMessage ? <p className="import-message">{importMessage}</p> : null}
          {storageMessage ? <p className="import-message muted">{storageMessage}</p> : null}
          </Disclosure>

          <Disclosure title="Manual record" kicker="Quick add">
          <form onSubmit={addRecord} className="record-form">
            <label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{categories.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Vendor<input value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} placeholder="Shop, insurer, station" /></label>
            <div className="form-pair">
              <label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
              <label>Amount, EUR<input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
            </div>
            <div className="form-pair">
              <label>Odometer km<input type="number" value={form.odometer} onChange={(event) => setForm({ ...form, odometer: event.target.value })} /></label>
              <label>Litres<input type="number" step="0.01" value={form.liters} onChange={(event) => setForm({ ...form, liters: event.target.value })} /></label>
            </div>
            <label>kWh<input type="number" step="0.01" value={form.kwh} onChange={(event) => setForm({ ...form, kwh: event.target.value })} /></label>
            <label>Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="What happened?" /></label>
            <button type="submit">Save record</button>
          </form>
          </Disclosure>
        </aside>

        <section className="panel main-panel">
          {activeView === "Overview" && (
            <>
              <div className="section-title"><p>Overview mode</p><h2>What changed and what needs attention</h2></div>
              {setupComplete < setupSteps.length ? (
                <section className="setup-wizard">
                  <div className="setup-wizard-head">
                    <div>
                      <p>Setup guide</p>
                      <h2>{nextSetupStep?.title}</h2>
                      <span>{nextSetupStep?.detail}</span>
                    </div>
                    <button type="button" onClick={() => setActiveView(nextSetupStep?.view || "Records")}>Continue</button>
                  </div>
                  <div className="setup-progress" style={{ "--progress": `${(setupComplete / setupSteps.length) * 100}%` }}>
                    <span />
                  </div>
                  <div className="setup-steps">
                    {setupSteps.map((step) => (
                      <button
                        key={step.title}
                        type="button"
                        className={step.complete ? "complete" : ""}
                        onClick={() => setActiveView(step.view)}
                      >
                        <i>{step.complete ? "✓" : setupSteps.indexOf(step) + 1}</i>
                        <strong>{step.title}</strong>
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="setup-wizard complete">
                  <div className="setup-wizard-head">
                    <div>
                      <p>Setup complete</p>
                      <h2>Your garage is report-ready</h2>
                      <span>Everything needed for tracking, documents and cloud sync is in place.</span>
                    </div>
                    <button type="button" onClick={() => exportOwnershipReport(vehicle, model)}>Export report</button>
                  </div>
                </section>
              )}
              <section className="next-action-panel">
                <div>
                  <p>Next best action</p>
                  <h2>{model.nextActions[0]?.title}</h2>
                  <span>{model.nextActions[0]?.detail}</span>
                </div>
                <button type="button" onClick={() => setActiveView(model.nextActions[0]?.view || "Records")}>Open</button>
              </section>
              <section className="monthly-digest">
                <div>
                  <p>Monthly digest</p>
                  <h2>{model.monthlyDigest.month}</h2>
                  <strong>{model.monthlyDigest.headline}</strong>
                </div>
                <article>
                  <span>Spend</span>
                  <b>{currency.format(model.monthlyDigest.spend)}</b>
                  <small>{model.monthlyDigest.delta === null ? "No baseline yet" : `${model.monthlyDigest.delta >= 0 ? "+" : ""}${currency.format(model.monthlyDigest.delta)} vs previous month`}</small>
                </article>
                <article>
                  <span>Records</span>
                  <b>{integer.format(model.monthlyDigest.recordCount)}</b>
                  <small>{model.monthlyDigest.topCategory ? `${model.monthlyDigest.topCategory.type} was largest` : "Add records to enrich this"}</small>
                </article>
                <article>
                  <span>Vault</span>
                  <b>{integer.format(model.monthlyDigest.fileCount)}</b>
                  <small>{model.monthlyDigest.dueSoon ? `${model.monthlyDigest.dueSoon.type} ${model.monthlyDigest.dueSoon.status}` : "No urgent document issue"}</small>
                </article>
              </section>
              <div className="insight-strip">
                <article>
                  <span>This month</span>
                  <strong>{model.latestMonth ? currency.format(model.latestMonth.total) : "No spend"}</strong>
                  <small>{model.latestMonth?.month || "Add records to start tracking"}</small>
                </article>
                <article>
                  <span>Month change</span>
                  <strong>{model.previousMonth ? `${model.monthlyDelta >= 0 ? "+" : ""}${currency.format(model.monthlyDelta)}` : "No baseline"}</strong>
                  <small>{model.previousMonth ? `vs ${model.previousMonth.month}` : "Needs two months"}</small>
                </article>
                <article>
                  <span>Top category</span>
                  <strong>{model.categoriesBySpend[0]?.type || "None"}</strong>
                  <small>{model.categoriesBySpend[0] ? currency.format(model.categoriesBySpend[0].total) : "No costs yet"}</small>
                </article>
                <article>
                  <span>Next due</span>
                  <strong>{model.upcomingRecurring[0]?.name || "None"}</strong>
                  <small>{model.upcomingRecurring[0] ? `${model.upcomingRecurring[0].nextDue} · ${currency.format(toNumber(model.upcomingRecurring[0].amount))}` : "No recurring costs"}</small>
                </article>
              </div>
              <div className="overview-grid enhanced">
                <section className="overview-main">
                  <div className="section-title compact-title"><p>Monthly cost view</p><h2>Spend by month</h2></div>
                  {model.monthlySpend.length ? <MonthlySpendChart rows={model.monthlySpend} /> : <p className="empty-note">Add records to build a monthly spend view.</p>}
                  <div className="chart-footnote">
                    <span>{model.monthlyInsight}</span>
                    <div>{model.categoriesBySpend.slice(0, 4).map((row) => <b key={row.type}><i style={{ background: categoryColors[row.type] || categoryColors.Other }} />{row.type}</b>)}</div>
                  </div>
                  <div className="overview-split">
                    <section>
                      <div className="section-title compact-title"><p>Categories</p><h2>Top spend</h2></div>
                      <div className="compact-list">
                        {model.categoriesBySpend.slice(0, 5).map((row) => (
                          <article key={row.type}>
                            <span style={{ background: categoryColors[row.type] || categoryColors.Other }} />
                            <strong>{row.type}</strong>
                            <b>{currency.format(row.total)}</b>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section>
                      <div className="section-title compact-title"><p>Activity</p><h2>Recent records</h2></div>
                      <div className="compact-list activity-list">
                        {model.sortedRecords.slice(0, 5).map((record) => (
                          <article key={record.id}>
                            <span className={`type-dot ${record.type.toLowerCase()}`} />
                            <strong>{record.vendor || record.type}<small>{record.date} · {record.type}</small></strong>
                            <b>{currencyExact.format(toNumber(record.amount))}</b>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>
                </section>
                <section className="overview-rail">
                  <div className="section-title compact-title"><p>Guidance</p><h2>Action queue</h2></div>
                  <div className="action-list">
                    {model.nextActions.map((action) => (
                      <button key={action.title} type="button" className={action.tone} onClick={() => setActiveView(action.view)}>
                        <strong>{action.title}</strong>
                        <span>{action.detail}</span>
                      </button>
                    ))}
                  </div>
                  <div className="section-title compact-title"><p>Anomaly alerts</p><h2>What needs attention</h2></div>
                  <div className="alert-list">
                    {model.anomalies.map((alert) => (
                      <article key={alert.title} className={`alert-card ${alert.tone}`}>
                        <strong>{alert.title}</strong>
                        <p>{alert.detail}</p>
                      </article>
                    ))}
                  </div>
                  <div className="section-title compact-title with-gap"><p>Recurring costs</p><h2>Next payments</h2></div>
                  <div className="schedule-list compact-schedule">
                    {model.upcomingRecurring.slice(0, 4).map((item) => (
                      <article key={item.id}>
                        <div><strong>{item.name}</strong><small>{item.cadence} · next {item.nextDue}</small></div>
                        <b>{currency.format(toNumber(item.amount))}</b>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {activeView === "Records" && (
            <>
              <Disclosure title={`Imported documents (${integer.format((vehicle.reviewQueue || []).length)})`} kicker="Review queue">
                <div className="review-list review-workflow">
                  {(vehicle.reviewQueue || []).length ? vehicle.reviewQueue.map((item) => (
                    <article className="review-row" key={item.id}>
                      <div className={`review-preview ${documentPreviewType(item.fileName)}`}>
                        <span>{fileExtension(item.fileName)}</span>
                        <b>{item.confidence}%</b>
                      </div>
                      <div className="review-fields">
                        <label>Vendor<input value={item.vendor || ""} onChange={(event) => updateReview(item.id, "vendor", event.target.value)} /></label>
                        <label>Type<select value={item.type} onChange={(event) => updateReview(item.id, "type", event.target.value)}>{categories.map((type) => <option key={type}>{type}</option>)}</select></label>
                        <label>Date<input type="date" value={item.date || today} onChange={(event) => updateReview(item.id, "date", event.target.value)} /></label>
                        <label>Amount<input type="number" step="0.01" value={item.amount || ""} onChange={(event) => updateReview(item.id, "amount", event.target.value)} /></label>
                        <label>Odometer<input type="number" value={item.odometer || ""} onChange={(event) => updateReview(item.id, "odometer", event.target.value)} /></label>
                        <label>File<input value={item.fileName || ""} onChange={(event) => updateReview(item.id, "fileName", event.target.value)} /></label>
                      </div>
                      <p>{item.storageStatus || "local metadata only"}{item.fileUrl ? " · opens across devices" : ""}</p>
                      <div className="review-actions">
                        {item.fileUrl ? <a href={item.fileUrl} target="_blank" rel="noreferrer">Preview file</a> : null}
                        <button onClick={() => approveReview(item)}>Approve</button>
                        <button className="ghost-button" onClick={() => discardReview(item.id)}>Discard</button>
                      </div>
                    </article>
                  )) : <p className="empty-note">No documents waiting for review.</p>}
                </div>
              </Disclosure>

              <div className="section-title with-gap"><p>Ledger</p><h2>Ownership documents and costs</h2></div>
              <div className="ledger-toolbar">
                <label>Type<select value={recordTypeFilter} onChange={(event) => setRecordTypeFilter(event.target.value)}>
                  <option>All</option>
                  {categories.map((type) => <option key={type}>{type}</option>)}
                </select></label>
                <label>Search<input value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Vendor, note, file" /></label>
                <span>{integer.format(filteredRecords.length)} shown</span>
              </div>
              <div className="record-list">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Vendor</th>
                      <th>Details</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className={selectedRecordId === record.id ? "selected" : ""} onClick={() => setSelectedRecordId(record.id)}>
                        <td>{record.date}</td>
                        <td><span className={`type-pill ${record.type.toLowerCase()}`}>{record.type}</span></td>
                        <td><strong>{record.vendor || record.type}</strong><small>{record.fileName}</small></td>
                        <td>{record.notes}<small>{record.odometer ? `${formatKm(toNumber(record.odometer))}` : ""}{record.liters ? ` · ${decimal.format(toNumber(record.liters))} L` : ""}{record.kwh ? ` · ${decimal.format(toNumber(record.kwh))} kWh` : ""}</small></td>
                        <td><b>{currencyExact.format(toNumber(record.amount))}</b></td>
                        <td>
                          <button className="ghost-button table-action" type="button" onClick={(event) => { event.stopPropagation(); setSelectedRecordId(record.id); }}>Open</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredRecords.length ? <p className="empty-note">No records match the current filters.</p> : null}
              </div>
            </>
          )}

          {activeView === "Vault" && (
            <>
              <div className="section-title"><p>Document vault</p><h2>Vehicle files and required documents</h2></div>
              <div className="vault-summary">
                <article><span>Total files</span><strong>{integer.format(model.documentVault.documents.filter((doc) => doc.status !== "missing").length)}</strong></article>
                <article><span>Valid</span><strong>{integer.format(model.documentVault.counts.valid || 0)}</strong></article>
                <article><span>Expiring soon</span><strong>{integer.format(model.documentVault.counts["expiring soon"] || 0)}</strong></article>
                <article><span>Missing</span><strong>{integer.format(model.documentVault.counts.missing || 0)}</strong></article>
              </div>
              <div className="vault-grid">
                {model.documentVault.documents.map((doc) => {
                  const previewType = documentPreviewType(doc.title);
                  return (
                    <article key={doc.id} className={`vault-card ${doc.status.replace(/\s/g, "-")}`}>
                      <div className={`vault-preview ${previewType}`}>
                        <span>{doc.status === "missing" ? "Need" : fileExtension(doc.title)}</span>
                        <b>{doc.type}</b>
                      </div>
                      <div className="vault-card-head">
                        <span className={`type-pill ${doc.type.toLowerCase()}`}>{doc.type}</span>
                        <b>{doc.status}</b>
                      </div>
                      <strong>{doc.title}</strong>
                      <small>{doc.vendor}{doc.date ? ` · ${doc.date}` : ""}{doc.nextDue ? ` · due ${doc.nextDue}` : ""}</small>
                      <p>{doc.record?.notes || (doc.status === "missing" ? "Add or import this document to complete the vehicle file." : "Stored from ledger record.")}</p>
                      {doc.storageStatus ? <small>{doc.storageStatus}</small> : null}
                      <div className="vault-card-actions">
                        {doc.fileUrl ? <a href={doc.fileUrl} target="_blank" rel="noreferrer">Open file</a> : null}
                        {doc.record ? <button type="button" onClick={() => { setSelectedRecordId(doc.record.id); setActiveView("Records"); }}>Open record</button> : <button type="button" onClick={() => { setActiveView("Records"); fileInput.current?.click(); }}>Upload file</button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {activeView === "Costs" && (
            <>
              <div className="section-title"><p>Cost stack</p><h2>Where the money goes</h2></div>
              <div className="cost-layout">
                <div className="bar-list">
                  {model.categoriesBySpend.map((row, index) => <Bar key={row.type} label={row.type} value={row.total} max={model.maxCategory} color={["#2f7f72", "#c2653a", "#31688e", "#8d6b2f", "#665f73"][index % 5]} detail={`${currencyExact.format(row.total / model.kilometersOwned)} per km`} />)}
                  <Bar label="Depreciation" value={model.depreciation} max={Math.max(model.maxCategory, model.depreciation)} color="#252b2f" detail="Market value estimate vs purchase" />
                </div>
                <div className="meter-card">
                  <span>{currencyExact.format(model.costPerKm)}</span>
                  <p>Every kilometre carries fuel, maintenance, paperwork, insurance, and depreciation.</p>
                </div>
              </div>
              <div className="section-title with-gap"><p>Monthly cost view</p><h2>Spend by month</h2></div>
              {model.monthlySpend.length ? <MonthlySpendChart rows={model.monthlySpend} /> : <p className="empty-note">Add records to build a monthly spend view.</p>}
              <div className="section-title with-gap"><p>Energy trend</p><h2>Fuel and electric charging</h2></div>
              {model.fuelTrend.length ? <MiniTrend rows={model.fuelTrend} /> : <p className="empty-note">Add fuel receipts with km and litres to chart consumption.</p>}
              {model.chargeTrend.length ? <MiniTrend rows={model.chargeTrend} /> : <p className="empty-note">Add charge receipts with km and kWh to chart charging efficiency.</p>}
            </>
          )}

          {activeView === "Timeline" && (
            <>
              <div className="section-title"><p>Service timeline</p><h2>Past work and upcoming milestones</h2></div>
              <div className="timeline-list">
                {model.timeline.map((item) => (
                  <article key={`${item.source}-${item.km}-${item.label}`} className={item.complete ? "complete" : ""}>
                    <span>{formatKm(item.km)}</span>
                    <div><strong>{item.label}</strong><small>{item.date || (item.complete ? "Reached" : "Upcoming")}</small></div>
                  </article>
                ))}
              </div>
            </>
          )}

          {activeView === "Sell prep" && (
            <>
              <div className="section-title"><p>Exit model</p><h2>When to sell</h2></div>
              <div className="sell-grid">
                <div className="timeline-card"><span style={{ width: `${Math.min((toNumber(vehicle.currentKilometers) / Math.max(toNumber(vehicle.targetSellKilometers), 1)) * 100, 100)}%` }} /><strong>{formatKm(toNumber(vehicle.currentKilometers))}</strong><small>Target: {formatKm(toNumber(vehicle.targetSellKilometers))}</small></div>
                <article><strong>{sellState}</strong><p>{model.sellScore >= 78 ? "The car is close to the kilometre target and the next expensive maintenance window can erase remaining value." : model.sellScore >= 55 ? "Start preparing sale photos, title, and maintenance packet while you still have optionality." : "Costs are controlled enough to keep driving, as long as repairs stay within reserve."}</p></article>
                <article><strong>{currency.format(toNumber(vehicle.maintenanceReserve))}</strong><p>Annual maintenance reserve. Current service, repair and tyre trend should stay below this line.</p></article>
              </div>
              <div className="scenario-panel">
                <div className="section-title"><p>Scenario sliders</p><h2>Projected exit cost</h2></div>
                <label>Sell at km<input type="range" min={Math.max(toNumber(vehicle.currentKilometers), 1000)} max="220000" step="5000" value={scenarioKm} onChange={(event) => setScenarioKm(event.target.value)} /><strong>{formatKm(toNumber(scenarioKm))}</strong></label>
                <label>Expected resale<input type="range" min="0" max={Math.max(toNumber(vehicle.purchasePrice), 10000)} step="500" value={scenarioValue} onChange={(event) => setScenarioValue(event.target.value)} /><strong>{currency.format(toNumber(scenarioValue))}</strong></label>
                <div className="scenario-result"><span>Projected cost per km</span><strong>{currencyExact.format(projectedCostPerKm)}</strong></div>
              </div>
            </>
          )}

          {activeView === "Garage" && (
            <>
              <div className="section-title"><p>Data safety</p><h2>Backups and sync</h2></div>
              <div className="backup-panel">
                <div>
                  <strong>{syncState}</strong>
                  <span>Last local save: {garage.updatedAt ? new Date(garage.updatedAt).toLocaleString() : "Unknown"}</span>
                </div>
                <button onClick={() => downloadGarageBackup(garage)}>Export backup</button>
                <button className="ghost-button" onClick={() => importInput.current?.click()}>Import backup</button>
                <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(event) => importGarageBackup(event.target.files)} />
              </div>

              <div className="section-title with-gap"><p>Recurring schedule</p><h2>Upcoming ownership costs</h2></div>
              <Disclosure title="Add recurring cost" kicker="Editor">
              <form className="recurring-form" onSubmit={addRecurring}>
                <label>Name<input value={recurringForm.name} onChange={(event) => setRecurringForm({ ...recurringForm, name: event.target.value })} placeholder="Insurance, parking, tyres" /></label>
                <label>Cadence<select value={recurringForm.cadence} onChange={(event) => setRecurringForm({ ...recurringForm, cadence: event.target.value })}>
                  <option>Monthly</option>
                  <option>Annual</option>
                  <option>One-time</option>
                </select></label>
                <label>Next due<input type="date" value={recurringForm.nextDue} onChange={(event) => setRecurringForm({ ...recurringForm, nextDue: event.target.value })} /></label>
                <label>Amount<input type="number" step="0.01" value={recurringForm.amount} onChange={(event) => setRecurringForm({ ...recurringForm, amount: event.target.value })} /></label>
                <button type="submit">Add</button>
              </form>
              </Disclosure>
              <div className="schedule-list">
                {(vehicle.recurring || []).map((item) => (
                  <article key={item.id} className="schedule-row">
                    <div><strong>{item.name}</strong><small>{item.cadence} · next {item.nextDue}</small></div>
                    <b>{currency.format(toNumber(item.amount))}</b>
                    <details className="row-menu">
                      <summary aria-label={`Edit ${item.name}`}>Manage</summary>
                      <div className="row-menu-body recurring-row">
                        <label>Name<input value={item.name} onChange={(event) => updateRecurring(item.id, "name", event.target.value)} /></label>
                        <label>Cadence<select value={item.cadence} onChange={(event) => updateRecurring(item.id, "cadence", event.target.value)}>
                          <option>Monthly</option>
                          <option>Annual</option>
                          <option>One-time</option>
                        </select></label>
                        <label>Next due<input type="date" value={item.nextDue} onChange={(event) => updateRecurring(item.id, "nextDue", event.target.value)} /></label>
                        <label>Amount<input type="number" step="0.01" value={item.amount} onChange={(event) => updateRecurring(item.id, "amount", event.target.value)} /></label>
                        <button className="danger-button" type="button" onClick={() => removeRecurring(item.id)}>Remove</button>
                      </div>
                    </details>
                  </article>
                ))}
              </div>
              <div className="section-title with-gap"><p>Garage</p><h2>Vehicles</h2></div>
              <div className="vehicle-list">
                {garage.vehicles.map((item) => (
                  <article key={item.id} className={item.id === vehicle.id ? "active" : ""}>
                    <div><strong>{item.name}</strong><small>{formatKm(toNumber(item.currentKilometers))} · {currency.format(toNumber(item.estimatedValue))}</small></div>
                    <button onClick={() => mutateGarage((current) => ({ ...current, activeVehicleId: item.id }))}>Open</button>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </section>
      <nav className="mobile-tabbar" aria-label="Mobile dashboard sections">
        {mobileViews.map((view) => (
          <button key={view} type="button" className={activeView === view ? "active" : ""} onClick={() => setActiveView(view)}>
            <span>{view === "Overview" ? "⌂" : view === "Records" ? "+" : view === "Vault" ? "▣" : view === "Costs" ? "€" : "⋯"}</span>
            <b>{view}</b>
          </button>
        ))}
      </nav>
      {selectedRecord ? (
        <aside className="record-drawer" aria-label="Record details">
          <div className="drawer-head">
            <div>
              <p>Record detail</p>
              <h2>{selectedRecord.vendor || selectedRecord.type}</h2>
              <span>{selectedRecord.date} · {currencyExact.format(toNumber(selectedRecord.amount))}</span>
            </div>
            <button type="button" onClick={() => setSelectedRecordId(null)}>Close</button>
          </div>
          <div className="drawer-summary">
            <article><span>Type</span><strong>{selectedRecord.type}</strong></article>
            <article><span>Amount</span><strong>{currencyExact.format(toNumber(selectedRecord.amount))}</strong></article>
            <article><span>Odometer</span><strong>{selectedRecord.odometer ? formatKm(toNumber(selectedRecord.odometer)) : "No km"}</strong></article>
          </div>
          <div className="drawer-form">
            <label>Type<select value={selectedRecord.type} onChange={(event) => updateRecord(selectedRecord.id, "type", event.target.value)}>{categories.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Vendor<input value={selectedRecord.vendor || ""} onChange={(event) => updateRecord(selectedRecord.id, "vendor", event.target.value)} /></label>
            <label>Date<input type="date" value={selectedRecord.date || today} onChange={(event) => updateRecord(selectedRecord.id, "date", event.target.value)} /></label>
            <label>Amount, EUR<input type="number" step="0.01" value={selectedRecord.amount || ""} onChange={(event) => updateRecord(selectedRecord.id, "amount", event.target.value)} /></label>
            <label>Odometer km<input type="number" value={selectedRecord.odometer || ""} onChange={(event) => updateRecord(selectedRecord.id, "odometer", event.target.value)} /></label>
            <label>Litres<input type="number" step="0.01" value={selectedRecord.liters || ""} onChange={(event) => updateRecord(selectedRecord.id, "liters", event.target.value)} /></label>
            <label>kWh<input type="number" step="0.01" value={selectedRecord.kwh || ""} onChange={(event) => updateRecord(selectedRecord.id, "kwh", event.target.value)} /></label>
            <label>Document / file<input value={selectedRecord.fileName || ""} onChange={(event) => updateRecord(selectedRecord.id, "fileName", event.target.value)} /></label>
            <label className="drawer-wide">Notes<textarea value={selectedRecord.notes || ""} onChange={(event) => updateRecord(selectedRecord.id, "notes", event.target.value)} /></label>
          </div>
          <div className="drawer-actions">
            {selectedRecord.fileUrl ? <a href={selectedRecord.fileUrl} target="_blank" rel="noreferrer">Open document</a> : null}
            <button className="danger-button" type="button" onClick={() => removeRecord(selectedRecord.id)}>Delete record</button>
            <button type="button" onClick={() => setSelectedRecordId(null)}>Done</button>
          </div>
        </aside>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
