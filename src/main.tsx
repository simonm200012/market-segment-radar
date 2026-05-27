import React, { FormEvent, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./customerDashboard.css";

type VehicleStatus = "Owned" | "Leased" | "Financed" | "Archived";
type FuelType = "Petrol" | "Diesel" | "Hybrid" | "Electric";
type CostType = "Fuel" | "Maintenance" | "Repairs" | "Insurance" | "Registration" | "Tolls" | "Parking" | "Washing" | "Tires" | "Other";
type Result = "Passed" | "Failed" | "Advisory";
type TaskStatus = "Scheduled" | "Due soon" | "Overdue" | "Complete";
type View = "Dashboard" | "Ledger" | "Trips" | "Inspections" | "Maintenance" | "Odometer" | "Documents" | "Analytics";

type Vehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  registration: string;
  vin: string;
  fuelType: FuelType;
  ownershipStatus: VehicleStatus;
  currentOdometer: number;
  archived?: boolean;
};

type CostEntry = {
  id: string;
  vehicleId: string;
  date: string;
  type: CostType;
  vendor: string;
  amount: number;
  odometer: number;
  notes: string;
  documentId?: string;
  archived?: boolean;
};

type Trip = {
  id: string;
  vehicleId: string;
  date: string;
  start: string;
  end: string;
  purpose: string;
  kilometers: number;
  driver: string;
  reimbursementRate: number;
  notes: string;
  archived?: boolean;
};

type Inspection = {
  id: string;
  vehicleId: string;
  type: string;
  dueDate: string;
  completedDate?: string;
  result?: Result;
  certificate?: string;
  reminderDays: number;
  archived?: boolean;
};

type MaintenanceTask = {
  id: string;
  vehicleId: string;
  item: string;
  intervalKm: number;
  lastDoneKm: number;
  nextDueKm: number;
  dueDate: string;
  status: TaskStatus;
  notes: string;
  archived?: boolean;
};

type OdometerPoint = {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  driver: string;
  notes: string;
};

type DocumentRecord = {
  id: string;
  vehicleId: string;
  type: string;
  title: string;
  fileName: string;
  expiryDate?: string;
  linkedTo?: string;
  archived?: boolean;
};

type FleetState = {
  vehicles: Vehicle[];
  costs: CostEntry[];
  trips: Trip[];
  inspections: Inspection[];
  maintenance: MaintenanceTask[];
  odometer: OdometerPoint[];
  documents: DocumentRecord[];
  activeVehicleId: string;
};

const storageKey = "professional-vehicle-ledger-v1";
const views: View[] = ["Dashboard", "Ledger", "Trips", "Inspections", "Maintenance", "Odometer", "Documents", "Analytics"];
const costTypes: CostType[] = ["Fuel", "Maintenance", "Repairs", "Insurance", "Registration", "Tolls", "Parking", "Washing", "Tires", "Other"];
const fuelTypes: FuelType[] = ["Petrol", "Diesel", "Hybrid", "Electric"];
const statuses: VehicleStatus[] = ["Owned", "Leased", "Financed", "Archived"];
const today = new Date().toISOString().slice(0, 10);
const eur = new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const km = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 0 });

const seed: FleetState = {
  activeVehicleId: "veh-1",
  vehicles: [
    { id: "veh-1", make: "Cupra", model: "Formentor VZ", year: 2022, registration: "LJ FM-221", vin: "VSSZZZKMZNR000221", fuelType: "Petrol", ownershipStatus: "Owned", currentOdometer: 96153 },
    { id: "veh-2", make: "Volkswagen", model: "Crafter 35", year: 2020, registration: "LJ FL-918", vin: "WV1ZZZSYZL9012455", fuelType: "Diesel", ownershipStatus: "Leased", currentOdometer: 144820 },
    { id: "veh-3", make: "Tesla", model: "Model Y", year: 2023, registration: "LJ EV-404", vin: "XP7YGCEK8PB014404", fuelType: "Electric", ownershipStatus: "Financed", currentOdometer: 38240 },
  ],
  costs: [
    { id: "c1", vehicleId: "veh-1", date: "2026-05-18", type: "Fuel", vendor: "Petrol", amount: 82.4, odometer: 96153, notes: "Premium fuel" },
    { id: "c2", vehicleId: "veh-1", date: "2026-05-06", type: "Maintenance", vendor: "Porsche Inter Auto", amount: 642, odometer: 94880, notes: "Oil, filters, inspection", documentId: "d4" },
    { id: "c3", vehicleId: "veh-2", date: "2026-05-14", type: "Tolls", vendor: "DARS", amount: 126, odometer: 144210, notes: "Highway tolls" },
    { id: "c4", vehicleId: "veh-2", date: "2026-04-28", type: "Repairs", vendor: "Fleet Service", amount: 1180, odometer: 143020, notes: "Brake pads and discs" },
    { id: "c5", vehicleId: "veh-3", date: "2026-05-20", type: "Fuel", vendor: "Ionity", amount: 31.7, odometer: 38240, notes: "Charging session" },
    { id: "c6", vehicleId: "veh-3", date: "2026-04-02", type: "Insurance", vendor: "Zavarovalnica", amount: 920, odometer: 36100, notes: "Annual premium", documentId: "d2" },
  ],
  trips: [
    { id: "t1", vehicleId: "veh-2", date: "2026-05-22", start: "Ljubljana", end: "Maribor", purpose: "Client delivery", kilometers: 132, driver: "Marko", reimbursementRate: 0.43, notes: "Materials delivered" },
    { id: "t2", vehicleId: "veh-1", date: "2026-05-21", start: "Ljubljana", end: "Koper", purpose: "Site visit", kilometers: 214, driver: "Simon", reimbursementRate: 0.43, notes: "Inspection meeting" },
    { id: "t3", vehicleId: "veh-3", date: "2026-05-18", start: "Celje", end: "Zagreb", purpose: "Sales meeting", kilometers: 238, driver: "Ana", reimbursementRate: 0.39, notes: "Cross-border trip" },
  ],
  inspections: [
    { id: "i1", vehicleId: "veh-1", type: "Annual technical inspection", dueDate: "2026-06-18", completedDate: "2025-06-18", result: "Passed", certificate: "inspection-cupra.pdf", reminderDays: 30 },
    { id: "i2", vehicleId: "veh-2", type: "Commercial safety check", dueDate: "2026-05-20", completedDate: "2025-11-20", result: "Advisory", certificate: "crafter-safety.pdf", reminderDays: 14 },
    { id: "i3", vehicleId: "veh-3", type: "Registration inspection", dueDate: "2026-09-02", completedDate: "2025-09-02", result: "Passed", certificate: "model-y-inspection.pdf", reminderDays: 30 },
  ],
  maintenance: [
    { id: "m1", vehicleId: "veh-1", item: "Oil change", intervalKm: 15000, lastDoneKm: 94880, nextDueKm: 109880, dueDate: "2026-10-10", status: "Scheduled", notes: "Use 0W-30 approved oil" },
    { id: "m2", vehicleId: "veh-2", item: "Brake check", intervalKm: 20000, lastDoneKm: 124000, nextDueKm: 144000, dueDate: "2026-05-10", status: "Overdue", notes: "Heavy-use van" },
    { id: "m3", vehicleId: "veh-3", item: "Tire rotation", intervalKm: 12000, lastDoneKm: 28000, nextDueKm: 40000, dueDate: "2026-06-01", status: "Due soon", notes: "Check rear wear" },
    { id: "m4", vehicleId: "veh-1", item: "Cabin filter", intervalKm: 30000, lastDoneKm: 94880, nextDueKm: 124880, dueDate: "2027-02-01", status: "Scheduled", notes: "Combine with service" },
  ],
  odometer: [
    { id: "o1", vehicleId: "veh-1", date: "2026-05-01", odometer: 94380, driver: "Simon", notes: "Month start" },
    { id: "o2", vehicleId: "veh-1", date: "2026-05-27", odometer: 96153, driver: "Simon", notes: "Current" },
    { id: "o3", vehicleId: "veh-2", date: "2026-05-01", odometer: 141930, driver: "Marko", notes: "Month start" },
    { id: "o4", vehicleId: "veh-2", date: "2026-05-27", odometer: 144820, driver: "Marko", notes: "Current" },
    { id: "o5", vehicleId: "veh-3", date: "2026-05-01", odometer: 37120, driver: "Ana", notes: "Month start" },
    { id: "o6", vehicleId: "veh-3", date: "2026-05-27", odometer: 38240, driver: "Ana", notes: "Current" },
  ],
  documents: [
    { id: "d1", vehicleId: "veh-1", type: "Registration", title: "Cupra registration", fileName: "cupra-registration.pdf", expiryDate: "2026-06-18", linkedTo: "i1" },
    { id: "d2", vehicleId: "veh-3", type: "Insurance", title: "Model Y insurance", fileName: "tesla-insurance.pdf", expiryDate: "2027-04-02" },
    { id: "d3", vehicleId: "veh-2", type: "Warranty", title: "Crafter extended warranty", fileName: "crafter-warranty.pdf", expiryDate: "2026-12-31" },
    { id: "d4", vehicleId: "veh-1", type: "Invoice", title: "Cupra May service invoice", fileName: "cupra-service-may.pdf", linkedTo: "c2" },
  ],
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState(): FleetState {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : seed;
  } catch {
    return seed;
  }
}

function saveState(state: FleetState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - new Date(today).getTime()) / 86400000);
}

function monthOf(date: string) {
  return date.slice(0, 7);
}

function download(filename: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function badgeTone(value: string) {
  if (["Overdue", "Failed", "Expired"].includes(value)) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (["Due soon", "Advisory", "Leased", "Financed"].includes(value)) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["Complete", "Passed", "Owned"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${tone || badgeTone(String(children))}`}>{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100" />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100" />;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function App() {
  const [state, setState] = useState<FleetState>(loadState);
  const [view, setView] = useState<View>("Dashboard");
  const [query, setQuery] = useState("");
  const [costFilter, setCostFilter] = useState<CostType | "All">("All");
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const persist = (next: FleetState) => {
    setState(next);
    saveState(next);
  };

  const activeVehicle = state.vehicles.find((vehicle) => vehicle.id === state.activeVehicleId) || state.vehicles[0];
  const activeCosts = state.costs.filter((item) => !item.archived && item.vehicleId === activeVehicle.id);
  const activeTrips = state.trips.filter((item) => !item.archived && item.vehicleId === activeVehicle.id);
  const activeInspections = state.inspections.filter((item) => !item.archived && item.vehicleId === activeVehicle.id);
  const activeMaintenance = state.maintenance.filter((item) => !item.archived && item.vehicleId === activeVehicle.id);
  const activeOdometer = state.odometer.filter((item) => item.vehicleId === activeVehicle.id).sort((a, b) => a.odometer - b.odometer);
  const activeDocuments = state.documents.filter((item) => !item.archived && item.vehicleId === activeVehicle.id);

  const analytics = useMemo(() => {
    const month = today.slice(0, 7);
    const monthlyCosts = state.costs.filter((cost) => !cost.archived && monthOf(cost.date) === month);
    const vehicleCost = activeCosts.reduce((sum, item) => sum + item.amount, 0);
    const fleetCost = state.costs.filter((item) => !item.archived).reduce((sum, item) => sum + item.amount, 0);
    const vehicleKm = activeTrips.reduce((sum, trip) => sum + trip.kilometers, 0);
    const fleetKm = state.trips.filter((trip) => !trip.archived).reduce((sum, trip) => sum + trip.kilometers, 0);
    const overdue = state.maintenance.filter((item) => !item.archived && item.status === "Overdue");
    const inspectionsDue = state.inspections.filter((item) => !item.archived && daysUntil(item.dueDate) <= item.reminderDays);
    const monthlyByType = costTypes.map((type) => ({ type, total: monthlyCosts.filter((cost) => cost.type === type).reduce((sum, cost) => sum + cost.amount, 0) })).filter((row) => row.total);
    return { month, monthlyCost: monthlyCosts.reduce((sum, item) => sum + item.amount, 0), vehicleCost, fleetCost, vehicleKm, fleetKm, overdue, inspectionsDue, monthlyByType };
  }, [state, activeVehicle.id]);

  const alerts = [
    ...activeInspections.filter((item) => daysUntil(item.dueDate) <= item.reminderDays).map((item) => ({ title: item.type, detail: `${daysUntil(item.dueDate) < 0 ? "Expired" : "Due"} ${item.dueDate}`, tone: daysUntil(item.dueDate) < 0 ? "critical" : "warning" })),
    ...activeMaintenance.filter((item) => item.status === "Overdue" || item.status === "Due soon").map((item) => ({ title: item.item, detail: `${item.status} at ${km.format(item.nextDueKm)} km`, tone: item.status === "Overdue" ? "critical" : "warning" })),
    ...activeCosts.filter((item) => item.amount > 900).map((item) => ({ title: "Abnormal cost", detail: `${item.vendor}: ${eur.format(item.amount)}`, tone: "warning" })),
  ].slice(0, 6);

  const filteredCosts = activeCosts.filter((item) => {
    const haystack = `${item.vendor} ${item.notes} ${item.type}`.toLowerCase();
    return (costFilter === "All" || item.type === costFilter) && (!query || haystack.includes(query.toLowerCase()));
  });

  const archive = (collection: keyof FleetState, id: string) => {
    const list = state[collection];
    if (!Array.isArray(list)) return;
    persist({ ...state, [collection]: list.map((item: any) => item.id === id ? { ...item, archived: true } : item) });
  };

  const remove = (collection: keyof FleetState, id: string) => {
    const list = state[collection];
    if (!Array.isArray(list)) return;
    persist({ ...state, [collection]: list.filter((item: any) => item.id !== id) });
  };

  function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vehicle: Vehicle = {
      id: uid("veh"),
      make: String(form.get("make") || "New"),
      model: String(form.get("model") || "Vehicle"),
      year: Number(form.get("year") || new Date().getFullYear()),
      registration: String(form.get("registration") || "UNREGISTERED"),
      vin: String(form.get("vin") || "VIN pending"),
      fuelType: String(form.get("fuelType") || "Petrol") as FuelType,
      ownershipStatus: String(form.get("ownershipStatus") || "Owned") as VehicleStatus,
      currentOdometer: Number(form.get("currentOdometer") || 0),
    };
    persist({ ...state, activeVehicleId: vehicle.id, vehicles: [...state.vehicles, vehicle] });
    event.currentTarget.reset();
  }

  function updateVehicle(vehicle: Vehicle) {
    persist({ ...state, vehicles: state.vehicles.map((item) => item.id === vehicle.id ? vehicle : item) });
    setEditingVehicle(null);
  }

  function addCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cost: CostEntry = {
      id: uid("cost"),
      vehicleId: activeVehicle.id,
      date: String(form.get("date") || today),
      type: String(form.get("type") || "Other") as CostType,
      vendor: String(form.get("vendor") || "Unknown vendor"),
      amount: Number(form.get("amount") || 0),
      odometer: Number(form.get("odometer") || activeVehicle.currentOdometer),
      notes: String(form.get("notes") || ""),
    };
    persist({ ...state, costs: [cost, ...state.costs] });
    event.currentTarget.reset();
  }

  function addTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const trip: Trip = {
      id: uid("trip"),
      vehicleId: activeVehicle.id,
      date: String(form.get("date") || today),
      start: String(form.get("start") || ""),
      end: String(form.get("end") || ""),
      purpose: String(form.get("purpose") || "Business"),
      kilometers: Number(form.get("kilometers") || 0),
      driver: String(form.get("driver") || ""),
      reimbursementRate: Number(form.get("reimbursementRate") || 0),
      notes: String(form.get("notes") || ""),
    };
    persist({ ...state, trips: [trip, ...state.trips] });
    event.currentTarget.reset();
  }

  function addInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const inspection: Inspection = {
      id: uid("inspection"),
      vehicleId: activeVehicle.id,
      type: String(form.get("type") || "Inspection"),
      dueDate: String(form.get("dueDate") || today),
      completedDate: String(form.get("completedDate") || ""),
      result: String(form.get("result") || "Passed") as Result,
      certificate: String(form.get("certificate") || ""),
      reminderDays: Number(form.get("reminderDays") || 30),
    };
    persist({ ...state, inspections: [inspection, ...state.inspections] });
    event.currentTarget.reset();
  }

  function addMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const task: MaintenanceTask = {
      id: uid("maintenance"),
      vehicleId: activeVehicle.id,
      item: String(form.get("item") || "Service item"),
      intervalKm: Number(form.get("intervalKm") || 10000),
      lastDoneKm: Number(form.get("lastDoneKm") || activeVehicle.currentOdometer),
      nextDueKm: Number(form.get("nextDueKm") || activeVehicle.currentOdometer + 10000),
      dueDate: String(form.get("dueDate") || today),
      status: String(form.get("status") || "Scheduled") as TaskStatus,
      notes: String(form.get("notes") || ""),
    };
    persist({ ...state, maintenance: [task, ...state.maintenance] });
    event.currentTarget.reset();
  }

  function addOdometer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = Number(form.get("odometer") || activeVehicle.currentOdometer);
    const point: OdometerPoint = { id: uid("odo"), vehicleId: activeVehicle.id, date: String(form.get("date") || today), odometer: value, driver: String(form.get("driver") || ""), notes: String(form.get("notes") || "") };
    persist({
      ...state,
      vehicles: state.vehicles.map((vehicle) => vehicle.id === activeVehicle.id ? { ...vehicle, currentOdometer: Math.max(vehicle.currentOdometer, value) } : vehicle),
      odometer: [point, ...state.odometer],
    });
    event.currentTarget.reset();
  }

  function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const doc: DocumentRecord = { id: uid("doc"), vehicleId: activeVehicle.id, type: String(form.get("type") || "Document"), title: String(form.get("title") || "Document"), fileName: String(form.get("fileName") || "file.pdf"), expiryDate: String(form.get("expiryDate") || "") };
    persist({ ...state, documents: [doc, ...state.documents] });
    event.currentTarget.reset();
  }

  function markMaintenanceDone(id: string) {
    persist({ ...state, maintenance: state.maintenance.map((item) => item.id === id ? { ...item, status: "Complete", lastDoneKm: activeVehicle.currentOdometer, nextDueKm: activeVehicle.currentOdometer + item.intervalKm } : item) });
  }

  function markInspectionDone(id: string) {
    persist({ ...state, inspections: state.inspections.map((item) => item.id === id ? { ...item, completedDate: today, result: "Passed" } : item) });
  }

  function exportCsv() {
    const header = "vehicle,date,type,vendor,amount,odometer,notes\n";
    const rows = state.costs.filter((item) => !item.archived).map((item) => {
      const vehicle = state.vehicles.find((entry) => entry.id === item.vehicleId);
      return [vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : item.vehicleId, item.date, item.type, item.vendor, item.amount, item.odometer, item.notes].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
    }).join("\n");
    download("vehicle-ledger-costs.csv", header + rows);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto grid w-full max-w-[1500px] gap-4 px-4 py-4 lg:px-6">
        <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-100/90 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
          <div className="grid gap-3 xl:grid-cols-[280px_minmax(280px,360px)_1fr_auto] xl:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Vehicle ledger</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Fleet operations dashboard</h1>
            </div>
            <SelectInput value={activeVehicle.id} onChange={(event) => persist({ ...state, activeVehicleId: event.target.value })}>
              {state.vehicles.filter((vehicle) => !vehicle.archived).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.registration}</option>)}
            </SelectInput>
            <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
              {views.map((item) => <button key={item} onClick={() => setView(item)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${view === item ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{item}</button>)}
            </nav>
            <button onClick={exportCsv} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">Export CSV</button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Kpi label="Monthly costs" value={eur.format(analytics.monthlyCost)} detail={analytics.month} />
          <Kpi label="Km driven" value={`${km.format(analytics.vehicleKm)} km`} detail={`${km.format(analytics.fleetKm)} fleet km`} />
          <Kpi label="Upcoming inspections" value={String(analytics.inspectionsDue.length)} detail="Due or inside reminder window" tone="amber" />
          <Kpi label="Overdue tasks" value={String(analytics.overdue.length)} detail="Maintenance requiring action" tone={analytics.overdue.length ? "rose" : "emerald"} />
          <Kpi label="Cost per km" value={eur2.format(analytics.vehicleCost / Math.max(analytics.vehicleKm, 1))} detail={`${eur.format(analytics.vehicleCost)} total on selected vehicle`} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="grid gap-4 self-start">
            <Panel>
              <SectionTitle eyebrow="Vehicle profile" title={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`} action={<Badge>{activeVehicle.ownershipStatus}</Badge>} />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Registration" value={activeVehicle.registration} />
                <Info label="Fuel" value={activeVehicle.fuelType} />
                <Info label="Odometer" value={`${km.format(activeVehicle.currentOdometer)} km`} />
                <Info label="VIN" value={activeVehicle.vin} wide />
              </dl>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setEditingVehicle(activeVehicle)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Edit</button>
                <button onClick={() => persist({ ...state, vehicles: state.vehicles.map((item) => item.id === activeVehicle.id ? { ...item, archived: true, ownershipStatus: "Archived" } : item) })} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">Archive</button>
              </div>
            </Panel>

            <Panel>
              <SectionTitle eyebrow="Add vehicle" title="New profile" />
              <form onSubmit={addVehicle} className="grid gap-3">
                <div className="grid grid-cols-2 gap-2"><Field label="Make"><TextInput name="make" placeholder="Toyota" /></Field><Field label="Model"><TextInput name="model" placeholder="Hilux" /></Field></div>
                <div className="grid grid-cols-2 gap-2"><Field label="Year"><TextInput name="year" type="number" placeholder="2024" /></Field><Field label="Registration"><TextInput name="registration" placeholder="LJ AB-123" /></Field></div>
                <Field label="VIN"><TextInput name="vin" placeholder="Vehicle identification number" /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Fuel"><SelectInput name="fuelType">{fuelTypes.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field>
                  <Field label="Status"><SelectInput name="ownershipStatus">{statuses.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field>
                </div>
                <Field label="Current odometer"><TextInput name="currentOdometer" type="number" placeholder="0" /></Field>
                <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">Create vehicle</button>
              </form>
            </Panel>

            <Panel>
              <SectionTitle eyebrow="Alerts" title="Attention queue" />
              <div className="grid gap-2">
                {alerts.length ? alerts.map((alert) => <article key={`${alert.title}-${alert.detail}`} className={`rounded-xl border p-3 ${alert.tone === "critical" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}><strong className="text-sm">{alert.title}</strong><p className="mt-1 text-sm text-slate-600">{alert.detail}</p></article>) : <EmptyState title="No urgent alerts" detail="Inspections, insurance, and service tasks are currently under control." />}
              </div>
            </Panel>
          </aside>

          <section className="grid gap-4">
            {view === "Dashboard" && <Dashboard analytics={analytics} state={state} activeVehicle={activeVehicle} costs={activeCosts} trips={activeTrips} inspections={activeInspections} maintenance={activeMaintenance} />}
            {view === "Ledger" && <LedgerView costs={filteredCosts} query={query} setQuery={setQuery} filter={costFilter} setFilter={setCostFilter} addCost={addCost} archive={archive} remove={remove} />}
            {view === "Trips" && <TripsView trips={activeTrips} addTrip={addTrip} archive={archive} remove={remove} />}
            {view === "Inspections" && <InspectionsView inspections={activeInspections} addInspection={addInspection} archive={archive} remove={remove} markDone={markInspectionDone} />}
            {view === "Maintenance" && <MaintenanceView tasks={activeMaintenance} addMaintenance={addMaintenance} archive={archive} remove={remove} markDone={markMaintenanceDone} />}
            {view === "Odometer" && <OdometerView points={activeOdometer} addOdometer={addOdometer} remove={remove} />}
            {view === "Documents" && <DocumentsView docs={activeDocuments} addDocument={addDocument} archive={archive} remove={remove} />}
            {view === "Analytics" && <AnalyticsView state={state} activeVehicle={activeVehicle} analytics={analytics} />}
          </section>
        </section>
      </div>

      {editingVehicle ? <VehicleEditor vehicle={editingVehicle} onClose={() => setEditingVehicle(null)} onSave={updateVehicle} /> : null}
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{children}</section>;
}

function Kpi({ label, value, detail, tone = "slate" }: { label: string; value: string; detail: string; tone?: "slate" | "amber" | "rose" | "emerald" }) {
  const colors = { slate: "border-slate-200 bg-white", amber: "border-amber-200 bg-amber-50", rose: "border-rose-200 bg-rose-50", emerald: "border-emerald-200 bg-emerald-50" };
  return <article className={`min-h-28 rounded-2xl border p-4 shadow-sm ${colors[tone]}`}><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><strong className="mt-3 block text-3xl font-black text-slate-950">{value}</strong><span className="mt-1 block text-sm text-slate-500">{detail}</span></article>;
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "col-span-2" : ""}><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-800">{value}</dd></div>;
}

function Dashboard({ analytics, state, activeVehicle, costs, trips, inspections, maintenance }: any) {
  const maxMonthly = Math.max(...analytics.monthlyByType.map((row: any) => row.total), 1);
  return (
    <>
      <Panel>
        <SectionTitle eyebrow="Operations snapshot" title="Current vehicle activity" />
        <div className="grid gap-3 lg:grid-cols-4">
          <SummaryCard label="Costs logged" value={String(costs.length)} detail={eur.format(costs.reduce((sum: number, item: CostEntry) => sum + item.amount, 0))} />
          <SummaryCard label="Trips logged" value={String(trips.length)} detail={`${km.format(trips.reduce((sum: number, item: Trip) => sum + item.kilometers, 0))} km`} />
          <SummaryCard label="Inspections" value={String(inspections.length)} detail={`${inspections.filter((item: Inspection) => daysUntil(item.dueDate) <= item.reminderDays).length} need attention`} />
          <SummaryCard label="Maintenance" value={String(maintenance.length)} detail={`${maintenance.filter((item: MaintenanceTask) => item.status !== "Complete").length} open tasks`} />
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <SectionTitle eyebrow="Monthly spending" title={`${analytics.month} cost mix`} />
          {analytics.monthlyByType.length ? <div className="grid min-h-64 grid-cols-2 items-end gap-3 md:grid-cols-5 lg:grid-cols-10">{analytics.monthlyByType.map((row: any) => <div key={row.type} className="grid h-full content-end gap-2 text-center"><div className="rounded-t-lg bg-teal-700" style={{ height: `${Math.max((row.total / maxMonthly) * 180, 16)}px` }} /><strong className="text-sm">{eur.format(row.total)}</strong><span className="text-xs text-slate-500">{row.type}</span></div>)}</div> : <EmptyState title="No spend this month" detail="Add fuel, service, insurance, tolls, or other ledger entries." />}
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Fleet list" title="Vehicles" />
          <div className="grid gap-2">
            {state.vehicles.filter((vehicle: Vehicle) => !vehicle.archived).map((vehicle: Vehicle) => <article key={vehicle.id} className={`rounded-xl border p-3 ${vehicle.id === activeVehicle.id ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"}`}><strong>{vehicle.year} {vehicle.make} {vehicle.model}</strong><p className="text-sm text-slate-500">{vehicle.registration} · {km.format(vehicle.currentOdometer)} km</p></article>)}
          </div>
        </Panel>
      </div>
    </>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><strong className="mt-2 block text-2xl font-black">{value}</strong><span className="text-sm text-slate-500">{detail}</span></article>;
}

function LedgerView({ costs, query, setQuery, filter, setFilter, addCost, archive, remove }: any) {
  return <Panel><SectionTitle eyebrow="Cost ledger" title="Expenses and invoices" action={<div className="flex gap-2"><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ledger" /><SelectInput value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option>{costTypes.map((type) => <option key={type}>{type}</option>)}</SelectInput></div>} /><CostForm onSubmit={addCost} /><Table headers={["Date", "Type", "Vendor", "Amount", "Odometer", "Notes", "Actions"]}>{costs.map((item: CostEntry) => <tr key={item.id}><td>{item.date}</td><td><Badge>{item.type}</Badge></td><td>{item.vendor}</td><td className="font-bold">{eur2.format(item.amount)}</td><td>{km.format(item.odometer)} km</td><td>{item.notes}</td><td><Actions onArchive={() => archive("costs", item.id)} onDelete={() => remove("costs", item.id)} /></td></tr>)}</Table>{!costs.length ? <EmptyState title="No matching costs" detail="Try a different filter or add a new expense." /> : null}</Panel>;
}

function CostForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-7"><Field label="Date"><TextInput name="date" type="date" defaultValue={today} /></Field><Field label="Type"><SelectInput name="type">{costTypes.map((type) => <option key={type}>{type}</option>)}</SelectInput></Field><Field label="Vendor"><TextInput name="vendor" placeholder="Supplier" /></Field><Field label="Amount"><TextInput name="amount" type="number" step="0.01" /></Field><Field label="Odometer"><TextInput name="odometer" type="number" /></Field><Field label="Notes"><TextInput name="notes" placeholder="Details" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add cost</button></form>;
}

function TripsView({ trips, addTrip, archive, remove }: any) {
  return <Panel><SectionTitle eyebrow="Trip log" title="Business, personal, and reimbursable travel" /><form onSubmit={addTrip} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-8"><Field label="Date"><TextInput name="date" type="date" defaultValue={today} /></Field><Field label="Start"><TextInput name="start" /></Field><Field label="End"><TextInput name="end" /></Field><Field label="Purpose"><TextInput name="purpose" /></Field><Field label="Km"><TextInput name="kilometers" type="number" /></Field><Field label="Driver"><TextInput name="driver" /></Field><Field label="Rate"><TextInput name="reimbursementRate" type="number" step="0.01" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add trip</button></form><Table headers={["Date", "Route", "Purpose", "Km", "Driver", "Reimbursement", "Actions"]}>{trips.map((trip: Trip) => <tr key={trip.id}><td>{trip.date}</td><td>{trip.start} → {trip.end}</td><td>{trip.purpose}</td><td>{km.format(trip.kilometers)}</td><td>{trip.driver}</td><td>{eur2.format(trip.kilometers * trip.reimbursementRate)}</td><td><Actions onArchive={() => archive("trips", trip.id)} onDelete={() => remove("trips", trip.id)} /></td></tr>)}</Table></Panel>;
}

function InspectionsView({ inspections, addInspection, archive, remove, markDone }: any) {
  return <Panel><SectionTitle eyebrow="Inspection calendar" title="Due dates, certificates, and reminders" /><form onSubmit={addInspection} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-7"><Field label="Type"><TextInput name="type" /></Field><Field label="Due"><TextInput name="dueDate" type="date" /></Field><Field label="Completed"><TextInput name="completedDate" type="date" /></Field><Field label="Result"><SelectInput name="result"><option>Passed</option><option>Advisory</option><option>Failed</option></SelectInput></Field><Field label="Certificate"><TextInput name="certificate" placeholder="file.pdf" /></Field><Field label="Reminder"><TextInput name="reminderDays" type="number" defaultValue={30} /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add</button></form><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{inspections.map((item: Inspection) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><strong>{item.type}</strong><Badge tone={badgeTone(daysUntil(item.dueDate) < 0 ? "Expired" : item.result || "Scheduled")}>{daysUntil(item.dueDate) < 0 ? "Expired" : item.result || "Scheduled"}</Badge></div><p className="mt-2 text-sm text-slate-500">Due {item.dueDate} · reminder {item.reminderDays} days</p><p className="text-sm text-slate-500">Certificate: {item.certificate || "Not uploaded"}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => markDone(item.id)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Mark complete</button><Actions onArchive={() => archive("inspections", item.id)} onDelete={() => remove("inspections", item.id)} /></div></article>)}</div></Panel>;
}

function MaintenanceView({ tasks, addMaintenance, archive, remove, markDone }: any) {
  return <Panel><SectionTitle eyebrow="Maintenance schedule" title="Service tasks and mileage intervals" /><form onSubmit={addMaintenance} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-8"><Field label="Item"><TextInput name="item" placeholder="Oil change" /></Field><Field label="Interval km"><TextInput name="intervalKm" type="number" /></Field><Field label="Last done"><TextInput name="lastDoneKm" type="number" /></Field><Field label="Next due"><TextInput name="nextDueKm" type="number" /></Field><Field label="Due date"><TextInput name="dueDate" type="date" /></Field><Field label="Status"><SelectInput name="status"><option>Scheduled</option><option>Due soon</option><option>Overdue</option><option>Complete</option></SelectInput></Field><Field label="Notes"><TextInput name="notes" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add</button></form><Table headers={["Item", "Status", "Last done", "Next due", "Due date", "Notes", "Actions"]}>{tasks.map((task: MaintenanceTask) => <tr key={task.id}><td className="font-bold">{task.item}</td><td><Badge>{task.status}</Badge></td><td>{km.format(task.lastDoneKm)} km</td><td>{km.format(task.nextDueKm)} km</td><td>{task.dueDate}</td><td>{task.notes}</td><td><div className="flex flex-wrap gap-2"><button onClick={() => markDone(task.id)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Complete</button><Actions onArchive={() => archive("maintenance", task.id)} onDelete={() => remove("maintenance", task.id)} /></div></td></tr>)}</Table></Panel>;
}

function OdometerView({ points, addOdometer, remove }: any) {
  return <Panel><SectionTitle eyebrow="Odometer history" title="Mileage updates and distance calculations" /><form onSubmit={addOdometer} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-5"><Field label="Date"><TextInput name="date" type="date" defaultValue={today} /></Field><Field label="Odometer"><TextInput name="odometer" type="number" /></Field><Field label="Driver"><TextInput name="driver" /></Field><Field label="Notes"><TextInput name="notes" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add update</button></form><Table headers={["Date", "Odometer", "Delta", "Driver", "Notes", "Actions"]}>{points.map((point: OdometerPoint, index: number) => <tr key={point.id}><td>{point.date}</td><td>{km.format(point.odometer)} km</td><td>{index ? `${km.format(point.odometer - points[index - 1].odometer)} km` : "Baseline"}</td><td>{point.driver}</td><td>{point.notes}</td><td><button onClick={() => remove("odometer", point.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Delete</button></td></tr>)}</Table></Panel>;
}

function DocumentsView({ docs, addDocument, archive, remove }: any) {
  return <Panel><SectionTitle eyebrow="Document vault" title="Registration, insurance, invoices, inspections, warranty papers" /><form onSubmit={addDocument} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-6"><Field label="Type"><TextInput name="type" placeholder="Insurance" /></Field><Field label="Title"><TextInput name="title" /></Field><Field label="File"><TextInput name="fileName" placeholder="file.pdf" /></Field><Field label="Expiry"><TextInput name="expiryDate" type="date" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white lg:col-span-2">Add document</button></form><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{docs.map((doc: DocumentRecord) => <article key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-4 rounded-lg bg-slate-900 p-4 text-white"><span className="text-xs font-bold uppercase tracking-wide text-white/60">{doc.fileName.split(".").pop() || "doc"}</span><strong className="mt-8 block text-lg">{doc.type}</strong></div><strong>{doc.title}</strong><p className="mt-1 text-sm text-slate-500">{doc.fileName}</p><p className="text-sm text-slate-500">{doc.expiryDate ? `Expires ${doc.expiryDate}` : "No expiry"}</p><div className="mt-4"><Actions onArchive={() => archive("documents", doc.id)} onDelete={() => remove("documents", doc.id)} /></div></article>)}</div></Panel>;
}

function AnalyticsView({ state, activeVehicle, analytics }: any) {
  const vehicleRows = state.vehicles.filter((vehicle: Vehicle) => !vehicle.archived).map((vehicle: Vehicle) => {
    const costs = state.costs.filter((cost: CostEntry) => !cost.archived && cost.vehicleId === vehicle.id).reduce((sum: number, item: CostEntry) => sum + item.amount, 0);
    const trips = state.trips.filter((trip: Trip) => !trip.archived && trip.vehicleId === vehicle.id).reduce((sum: number, item: Trip) => sum + item.kilometers, 0);
    return { vehicle, costs, trips, costPerKm: costs / Math.max(trips, 1) };
  });
  return <Panel><SectionTitle eyebrow="Analytics" title="Fleet cost and utilization report" /><div className="mb-4 grid gap-3 md:grid-cols-3"><SummaryCard label="Fleet cost" value={eur.format(analytics.fleetCost)} detail="All active cost entries" /><SummaryCard label="Fleet distance" value={`${km.format(analytics.fleetKm)} km`} detail="Logged trips" /><SummaryCard label="Selected vehicle" value={activeVehicle.registration} detail={`${activeVehicle.make} ${activeVehicle.model}`} /></div><Table headers={["Vehicle", "Status", "Costs", "Trip km", "Cost/km"]}>{vehicleRows.map((row: any) => <tr key={row.vehicle.id}><td>{row.vehicle.year} {row.vehicle.make} {row.vehicle.model}</td><td><Badge>{row.vehicle.ownershipStatus}</Badge></td><td>{eur.format(row.costs)}</td><td>{km.format(row.trips)} km</td><td>{eur2.format(row.costPerKm)}</td></tr>)}</Table></Panel>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[840px] border-collapse bg-white text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map((header) => <th key={header} className="border-b border-slate-200 px-4 py-3 font-black">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 [&_td]:px-4 [&_td]:py-3">{children}</tbody></table></div>;
}

function Actions({ onArchive, onDelete }: { onArchive: () => void; onDelete: () => void }) {
  return <div className="flex flex-wrap gap-2"><button onClick={onArchive} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Archive</button><button onClick={onDelete} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Delete</button></div>;
}

function VehicleEditor({ vehicle, onClose, onSave }: { vehicle: Vehicle; onClose: () => void; onSave: (vehicle: Vehicle) => void }) {
  const [draft, setDraft] = useState(vehicle);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"><SectionTitle eyebrow="Edit vehicle" title={`${vehicle.make} ${vehicle.model}`} /><div className="grid gap-3 md:grid-cols-2"><Field label="Make"><TextInput value={draft.make} onChange={(event) => setDraft({ ...draft, make: event.target.value })} /></Field><Field label="Model"><TextInput value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></Field><Field label="Year"><TextInput type="number" value={draft.year} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })} /></Field><Field label="Registration"><TextInput value={draft.registration} onChange={(event) => setDraft({ ...draft, registration: event.target.value })} /></Field><Field label="VIN"><TextInput value={draft.vin} onChange={(event) => setDraft({ ...draft, vin: event.target.value })} /></Field><Field label="Odometer"><TextInput type="number" value={draft.currentOdometer} onChange={(event) => setDraft({ ...draft, currentOdometer: Number(event.target.value) })} /></Field><Field label="Fuel"><SelectInput value={draft.fuelType} onChange={(event) => setDraft({ ...draft, fuelType: event.target.value as FuelType })}>{fuelTypes.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="Status"><SelectInput value={draft.ownershipStatus} onChange={(event) => setDraft({ ...draft, ownershipStatus: event.target.value as VehicleStatus })}>{statuses.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field></div><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button><button onClick={() => onSave(draft)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">Save changes</button></div></div></div>;
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.href), { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
