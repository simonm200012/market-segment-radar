import React, { FormEvent, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./customerDashboard.css";

type VehicleStatus = "Active" | "Inactive" | "Sold" | "Under repair" | "Archived";
type OwnershipType = "Owned" | "Leased" | "Rented" | "Financed";
type FuelType = "Petrol" | "Diesel" | "Hybrid" | "Electric";
type Transmission = "Manual" | "Automatic" | "CVT" | "Single-speed";
type CostType = "Fuel" | "Maintenance" | "Repairs" | "Insurance" | "Registration" | "Technical inspections" | "Road tax" | "Tolls" | "Parking" | "Car wash" | "Tires" | "Fines" | "Leasing" | "Depreciation" | "Accessories" | "Emergency" | "Other";
type CostStatus = "Draft" | "Approved" | "Paid" | "Reimbursed" | "Rejected";
type TripPurpose = "Business" | "Personal" | "Commute" | "Delivery" | "Service" | "Other";
type Result = "Passed" | "Failed" | "Conditional" | "Pending";
type TaskStatus = "Upcoming" | "Due soon" | "Overdue" | "Completed" | "Skipped";
type View = "Dashboard" | "Vehicles" | "Ledger" | "Trips" | "Fuel" | "Maintenance" | "Inspections" | "Documents" | "Reports" | "Settings";

type Vehicle = {
  id: string;
  make: string;
  model: string;
  nickname?: string;
  year: number;
  registration: string;
  vin: string;
  fuelType: FuelType;
  transmission?: Transmission;
  engineSize?: string;
  ownershipStatus: OwnershipType;
  status?: VehicleStatus;
  purchaseDate?: string;
  purchasePrice?: number;
  estimatedValue?: number;
  assignedDriver?: string;
  department?: string;
  currentOdometer: number;
  registrationExpiry?: string;
  insuranceExpiry?: string;
  inspectionExpiry?: string;
  notes?: string;
  image?: string;
  archived?: boolean;
};

type CostEntry = {
  id: string;
  vehicleId: string;
  date: string;
  type: CostType;
  vendor: string;
  amount: number;
  vat?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  odometer: number;
  driver?: string;
  notes: string;
  attachment?: string;
  status?: CostStatus;
  documentId?: string;
  archived?: boolean;
};

type FuelEntry = {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  quantity: number;
  fuelType: FuelType;
  pricePerUnit: number;
  totalCost: number;
  station: string;
  fullTank: boolean;
  distanceSinceLast: number;
  economy: number;
  costPerKm: number;
  notes: string;
  receipt?: string;
  archived?: boolean;
};

type Trip = {
  id: string;
  vehicleId: string;
  date: string;
  start: string;
  end: string;
  purpose: TripPurpose;
  startOdometer?: number;
  endOdometer?: number;
  kilometers: number;
  driver: string;
  reimbursementRate: number;
  reimbursementAmount?: number;
  clientProject?: string;
  approvalStatus?: "Draft" | "Submitted" | "Approved" | "Rejected";
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
  vendor?: string;
  certificateNumber?: string;
  expiryDate?: string;
  certificate?: string;
  reminderDays: number;
  followUp?: string;
  archived?: boolean;
};

type MaintenanceTask = {
  id: string;
  vehicleId: string;
  item: string;
  intervalKm: number;
  intervalMonths?: number;
  lastDoneKm: number;
  lastDoneDate?: string;
  nextDueKm: number;
  dueDate: string;
  status: TaskStatus;
  vendor?: string;
  partsCost?: number;
  laborCost?: number;
  warranty?: string;
  attachment?: string;
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
  uploadDate?: string;
  expiryDate?: string;
  linkedTo?: string;
  notes?: string;
  reminderDays?: number;
  archived?: boolean;
};

type FleetState = {
  vehicles: Vehicle[];
  costs: CostEntry[];
  fuel: FuelEntry[];
  trips: Trip[];
  inspections: Inspection[];
  maintenance: MaintenanceTask[];
  odometer: OdometerPoint[];
  documents: DocumentRecord[];
  activeVehicleId: string;
};

const storageKey = "professional-vehicle-ledger-v2";
const views: View[] = ["Dashboard", "Vehicles", "Ledger", "Trips", "Fuel", "Maintenance", "Inspections", "Documents", "Reports", "Settings"];
const costTypes: CostType[] = ["Fuel", "Maintenance", "Repairs", "Insurance", "Registration", "Technical inspections", "Road tax", "Tolls", "Parking", "Car wash", "Tires", "Fines", "Leasing", "Depreciation", "Accessories", "Emergency", "Other"];
const fuelTypes: FuelType[] = ["Petrol", "Diesel", "Hybrid", "Electric"];
const ownershipTypes: OwnershipType[] = ["Owned", "Leased", "Rented", "Financed"];
const statuses: VehicleStatus[] = ["Active", "Inactive", "Sold", "Under repair", "Archived"];
const today = new Date().toISOString().slice(0, 10);
const eur = new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const km = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 0 });

const seed: FleetState = {
  activeVehicleId: "veh-1",
  vehicles: [
    { id: "veh-1", nickname: "Sales Cupra", make: "Cupra", model: "Formentor VZ", year: 2022, registration: "LJ FM-221", vin: "VSSZZZKMZNR000221", fuelType: "Petrol", transmission: "Automatic", engineSize: "2.0 TSI", ownershipStatus: "Owned", status: "Active", purchaseDate: "2023-04-15", purchasePrice: 36500, estimatedValue: 25500, assignedDriver: "Simon", department: "Management", currentOdometer: 96153, registrationExpiry: "2026-06-18", insuranceExpiry: "2027-01-02", inspectionExpiry: "2026-06-18", notes: "Primary management and client vehicle.", image: "cupra.jpg" },
    { id: "veh-2", nickname: "Delivery Van", make: "Volkswagen", model: "Crafter 35", year: 2020, registration: "LJ FL-918", vin: "WV1ZZZSYZL9012455", fuelType: "Diesel", transmission: "Manual", engineSize: "2.0 TDI", ownershipStatus: "Leased", status: "Under repair", purchaseDate: "2021-02-01", purchasePrice: 0, estimatedValue: 18500, assignedDriver: "Marko", department: "Logistics", currentOdometer: 144820, registrationExpiry: "2026-08-12", insuranceExpiry: "2026-10-01", inspectionExpiry: "2026-05-20", notes: "High-mileage delivery vehicle.", image: "crafter.jpg" },
    { id: "veh-3", nickname: "EV Shuttle", make: "Tesla", model: "Model Y", year: 2023, registration: "LJ EV-404", vin: "XP7YGCEK8PB014404", fuelType: "Electric", transmission: "Single-speed", engineSize: "Dual motor", ownershipStatus: "Financed", status: "Active", purchaseDate: "2024-01-10", purchasePrice: 52900, estimatedValue: 43800, assignedDriver: "Ana", department: "Sales", currentOdometer: 38240, registrationExpiry: "2026-09-02", insuranceExpiry: "2027-04-02", inspectionExpiry: "2026-09-02", notes: "Low operating cost EV for regional trips.", image: "model-y.jpg" },
  ],
  costs: [
    { id: "c1", vehicleId: "veh-1", date: "2026-05-18", type: "Fuel", vendor: "Petrol", amount: 82.4, vat: 14.86, paymentMethod: "Company card", invoiceNumber: "P-2026-7781", odometer: 96153, driver: "Simon", notes: "Premium fuel", attachment: "petrol-receipt.jpg", status: "Paid" },
    { id: "c2", vehicleId: "veh-1", date: "2026-05-06", type: "Maintenance", vendor: "Porsche Inter Auto", amount: 642, vat: 115.7, paymentMethod: "Bank transfer", invoiceNumber: "PIA-44192", odometer: 94880, driver: "Simon", notes: "Oil, filters, inspection", attachment: "cupra-service-may.pdf", status: "Approved", documentId: "d4" },
    { id: "c3", vehicleId: "veh-2", date: "2026-05-14", type: "Tolls", vendor: "DARS", amount: 126, vat: 22.7, paymentMethod: "Fleet card", invoiceNumber: "DARS-5542", odometer: 144210, driver: "Marko", notes: "Highway tolls", status: "Paid" },
    { id: "c4", vehicleId: "veh-2", date: "2026-04-28", type: "Repairs", vendor: "Fleet Service", amount: 1180, vat: 212.78, paymentMethod: "Bank transfer", invoiceNumber: "FS-22018", odometer: 143020, driver: "Marko", notes: "Brake pads and discs", attachment: "crafter-brakes.pdf", status: "Approved" },
    { id: "c5", vehicleId: "veh-3", date: "2026-05-20", type: "Fuel", vendor: "Ionity", amount: 31.7, vat: 5.72, paymentMethod: "EV card", invoiceNumber: "ION-9921", odometer: 38240, driver: "Ana", notes: "Charging session", status: "Paid" },
    { id: "c6", vehicleId: "veh-3", date: "2026-04-02", type: "Insurance", vendor: "Zavarovalnica", amount: 920, vat: 0, paymentMethod: "Bank transfer", invoiceNumber: "INS-2026-443", odometer: 36100, driver: "Ana", notes: "Annual premium", attachment: "tesla-insurance.pdf", status: "Paid", documentId: "d2" },
    { id: "c7", vehicleId: "veh-2", date: "2026-05-03", type: "Car wash", vendor: "Avtopralnica BTC", amount: 18, vat: 3.25, paymentMethod: "Cash", invoiceNumber: "CW-118", odometer: 142840, driver: "Marko", notes: "Exterior wash", status: "Approved" },
  ],
  fuel: [
    { id: "f1", vehicleId: "veh-1", date: "2026-05-18", odometer: 96153, quantity: 54.2, fuelType: "Petrol", pricePerUnit: 1.52, totalCost: 82.4, station: "Petrol", fullTank: true, distanceSinceLast: 641, economy: 8.45, costPerKm: 0.13, notes: "Full tank", receipt: "petrol-receipt.jpg" },
    { id: "f2", vehicleId: "veh-2", date: "2026-05-11", odometer: 143940, quantity: 72.8, fuelType: "Diesel", pricePerUnit: 1.43, totalCost: 104.1, station: "OMV", fullTank: true, distanceSinceLast: 612, economy: 11.9, costPerKm: 0.17, notes: "Delivery route refuel", receipt: "omv-van.pdf" },
    { id: "f3", vehicleId: "veh-3", date: "2026-05-20", odometer: 38240, quantity: 43.1, fuelType: "Electric", pricePerUnit: 0.74, totalCost: 31.7, station: "Ionity", fullTank: false, distanceSinceLast: 286, economy: 15.1, costPerKm: 0.11, notes: "Fast charge", receipt: "ionity.pdf" },
  ],
  trips: [
    { id: "t1", vehicleId: "veh-2", date: "2026-05-22", start: "Ljubljana", end: "Maribor", purpose: "Delivery", startOdometer: 144120, endOdometer: 144252, kilometers: 132, driver: "Marko", reimbursementRate: 0.43, reimbursementAmount: 56.76, clientProject: "Client A materials", approvalStatus: "Approved", notes: "Materials delivered" },
    { id: "t2", vehicleId: "veh-1", date: "2026-05-21", start: "Ljubljana", end: "Koper", purpose: "Business", startOdometer: 95892, endOdometer: 96106, kilometers: 214, driver: "Simon", reimbursementRate: 0.43, reimbursementAmount: 92.02, clientProject: "Coastal site visit", approvalStatus: "Submitted", notes: "Inspection meeting" },
    { id: "t3", vehicleId: "veh-3", date: "2026-05-18", start: "Celje", end: "Zagreb", purpose: "Business", startOdometer: 37998, endOdometer: 38236, kilometers: 238, driver: "Ana", reimbursementRate: 0.39, reimbursementAmount: 92.82, clientProject: "Sales meeting", approvalStatus: "Approved", notes: "Cross-border trip" },
  ],
  inspections: [
    { id: "i1", vehicleId: "veh-1", type: "Annual technical inspection", dueDate: "2026-06-18", completedDate: "2025-06-18", result: "Passed", vendor: "AMZS", certificateNumber: "TI-2025-1882", expiryDate: "2026-06-18", certificate: "inspection-cupra.pdf", reminderDays: 30, followUp: "Renew registration after pass" },
    { id: "i2", vehicleId: "veh-2", type: "Commercial safety check", dueDate: "2026-05-20", completedDate: "2025-11-20", result: "Conditional", vendor: "Fleet Compliance", certificateNumber: "CS-8841", expiryDate: "2026-05-20", certificate: "crafter-safety.pdf", reminderDays: 14, followUp: "Brake follow-up required" },
    { id: "i3", vehicleId: "veh-3", type: "Registration inspection", dueDate: "2026-09-02", completedDate: "2025-09-02", result: "Passed", vendor: "Technical Center Ljubljana", certificateNumber: "EV-5529", expiryDate: "2026-09-02", certificate: "model-y-inspection.pdf", reminderDays: 30, followUp: "None" },
  ],
  maintenance: [
    { id: "m1", vehicleId: "veh-1", item: "Oil change", intervalKm: 15000, intervalMonths: 12, lastDoneKm: 94880, lastDoneDate: "2026-05-06", nextDueKm: 109880, dueDate: "2026-10-10", status: "Upcoming", vendor: "Porsche Inter Auto", partsCost: 180, laborCost: 120, warranty: "12 months", notes: "Use 0W-30 approved oil" },
    { id: "m2", vehicleId: "veh-2", item: "Brake check", intervalKm: 20000, intervalMonths: 6, lastDoneKm: 124000, lastDoneDate: "2025-10-12", nextDueKm: 144000, dueDate: "2026-05-10", status: "Overdue", vendor: "Fleet Service", partsCost: 420, laborCost: 260, warranty: "Parts warranty 24 months", notes: "Heavy-use van" },
    { id: "m3", vehicleId: "veh-3", item: "Tire rotation", intervalKm: 12000, intervalMonths: 6, lastDoneKm: 28000, lastDoneDate: "2025-12-11", nextDueKm: 40000, dueDate: "2026-06-01", status: "Due soon", vendor: "EV Tire Center", partsCost: 0, laborCost: 55, warranty: "N/A", notes: "Check rear wear" },
    { id: "m4", vehicleId: "veh-1", item: "Cabin filter", intervalKm: 30000, intervalMonths: 24, lastDoneKm: 94880, lastDoneDate: "2026-05-06", nextDueKm: 124880, dueDate: "2027-02-01", status: "Upcoming", vendor: "Porsche Inter Auto", partsCost: 45, laborCost: 35, warranty: "12 months", notes: "Combine with service" },
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
    { id: "d1", vehicleId: "veh-1", type: "Registration", title: "Cupra registration", fileName: "cupra-registration.pdf", uploadDate: "2025-06-18", expiryDate: "2026-06-18", linkedTo: "i1", notes: "Current registration document", reminderDays: 30 },
    { id: "d2", vehicleId: "veh-3", type: "Insurance", title: "Model Y insurance", fileName: "tesla-insurance.pdf", uploadDate: "2026-04-02", expiryDate: "2027-04-02", notes: "Annual policy", reminderDays: 45 },
    { id: "d3", vehicleId: "veh-2", type: "Warranty", title: "Crafter extended warranty", fileName: "crafter-warranty.pdf", uploadDate: "2024-12-31", expiryDate: "2026-12-31", notes: "Lease warranty papers", reminderDays: 45 },
    { id: "d4", vehicleId: "veh-1", type: "Invoice", title: "Cupra May service invoice", fileName: "cupra-service-may.pdf", uploadDate: "2026-05-06", linkedTo: "c2", notes: "Service receipt", reminderDays: 0 },
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
  if (["Due soon", "Conditional", "Leased", "Financed", "Under repair", "Draft", "Pending"].includes(value)) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["Completed", "Passed", "Owned", "Active", "Paid", "Approved"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["Archived", "Inactive", "Sold", "Rejected"].includes(value)) return "bg-slate-200 text-slate-700 ring-slate-300";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone || badgeTone(String(children))}`}>{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-0.5 text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
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
      ownershipStatus: String(form.get("ownershipStatus") || "Owned") as OwnershipType,
      status: "Active",
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
      vat: Number(form.get("vat") || 0),
      paymentMethod: String(form.get("paymentMethod") || ""),
      invoiceNumber: String(form.get("invoiceNumber") || ""),
      odometer: Number(form.get("odometer") || activeVehicle.currentOdometer),
      driver: String(form.get("driver") || activeVehicle.assignedDriver || ""),
      notes: String(form.get("notes") || ""),
      attachment: String(form.get("attachment") || ""),
      status: String(form.get("status") || "Draft") as CostStatus,
    };
    persist({ ...state, costs: [cost, ...state.costs] });
    event.currentTarget.reset();
  }

  function addFuel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const odometer = Number(form.get("odometer") || activeVehicle.currentOdometer);
    const quantity = Number(form.get("quantity") || 0);
    const pricePerUnit = Number(form.get("pricePerUnit") || 0);
    const totalCost = Number(form.get("totalCost") || quantity * pricePerUnit);
    const previous = state.fuel
      .filter((item) => !item.archived && item.vehicleId === activeVehicle.id && item.odometer < odometer)
      .sort((a, b) => b.odometer - a.odometer)[0];
    const distanceSinceLast = Math.max(odometer - (previous?.odometer || activeVehicle.currentOdometer), 0);
    const fuel: FuelEntry = {
      id: uid("fuel"),
      vehicleId: activeVehicle.id,
      date: String(form.get("date") || today),
      odometer,
      quantity,
      fuelType: String(form.get("fuelType") || activeVehicle.fuelType) as FuelType,
      pricePerUnit,
      totalCost,
      station: String(form.get("station") || "Unknown station"),
      fullTank: form.get("fullTank") === "on",
      distanceSinceLast,
      economy: distanceSinceLast ? (quantity / distanceSinceLast) * 100 : 0,
      costPerKm: distanceSinceLast ? totalCost / distanceSinceLast : 0,
      notes: String(form.get("notes") || ""),
      receipt: String(form.get("receipt") || ""),
    };
    const cost: CostEntry = {
      id: uid("cost"),
      vehicleId: activeVehicle.id,
      date: fuel.date,
      type: "Fuel",
      vendor: fuel.station,
      amount: fuel.totalCost,
      odometer: fuel.odometer,
      driver: activeVehicle.assignedDriver || "",
      notes: fuel.notes || `${fuel.quantity} ${fuel.fuelType === "Electric" ? "kWh" : "L"} at ${eur2.format(fuel.pricePerUnit)}`,
      attachment: fuel.receipt,
      status: "Paid",
    };
    persist({
      ...state,
      fuel: [fuel, ...state.fuel],
      costs: [cost, ...state.costs],
      vehicles: state.vehicles.map((vehicle) => vehicle.id === activeVehicle.id ? { ...vehicle, currentOdometer: Math.max(vehicle.currentOdometer, odometer) } : vehicle),
    });
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
      purpose: String(form.get("purpose") || "Business") as TripPurpose,
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
      status: String(form.get("status") || "Upcoming") as TaskStatus,
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
    const doc: DocumentRecord = { id: uid("doc"), vehicleId: activeVehicle.id, type: String(form.get("type") || "Document"), title: String(form.get("title") || "Document"), fileName: String(form.get("fileName") || "file.pdf"), uploadDate: today, expiryDate: String(form.get("expiryDate") || ""), notes: String(form.get("notes") || ""), reminderDays: Number(form.get("reminderDays") || 30) };
    persist({ ...state, documents: [doc, ...state.documents] });
    event.currentTarget.reset();
  }

  function markMaintenanceDone(id: string) {
    persist({ ...state, maintenance: state.maintenance.map((item) => item.id === id ? { ...item, status: "Completed", lastDoneKm: activeVehicle.currentOdometer, nextDueKm: activeVehicle.currentOdometer + item.intervalKm } : item) });
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto grid w-full max-w-[1400px] gap-3 px-3 py-3 lg:px-5">
        <header className="sticky top-0 z-20 rounded-xl border border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[250px_minmax(260px,1fr)_auto] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Vehicle ledger</p>
              <h1 className="text-xl font-bold tracking-tight text-slate-950">Fleet operations dashboard</h1>
            </div>
            <SelectInput value={activeVehicle.id} onChange={(event) => persist({ ...state, activeVehicleId: event.target.value })}>
              {state.vehicles.filter((vehicle) => !vehicle.archived).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.registration}</option>)}
            </SelectInput>
            <button onClick={exportCsv} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">Export CSV</button>
          </div>
          <div className="mt-3">
            <nav className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
              {views.map((item) => <button key={item} onClick={() => setView(item)} className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold ${view === item ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}>{item}</button>)}
            </nav>
          </div>
        </header>

        <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <Kpi label="Monthly costs" value={eur.format(analytics.monthlyCost)} detail={analytics.month} />
          <Kpi label="Km driven" value={`${km.format(analytics.vehicleKm)} km`} detail={`${km.format(analytics.fleetKm)} fleet km`} />
          <Kpi label="Upcoming inspections" value={String(analytics.inspectionsDue.length)} detail="Due or inside reminder window" tone="amber" />
          <Kpi label="Overdue tasks" value={String(analytics.overdue.length)} detail="Maintenance requiring action" tone={analytics.overdue.length ? "rose" : "emerald"} />
          <Kpi label="Cost per km" value={eur2.format(analytics.vehicleCost / Math.max(analytics.vehicleKm, 1))} detail={`${eur.format(analytics.vehicleCost)} total on selected vehicle`} />
        </section>

        <section className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="grid gap-3 self-start">
            <Panel>
              <SectionTitle eyebrow="Vehicle profile" title={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`} action={<Badge>{activeVehicle.ownershipStatus}</Badge>} />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Registration" value={activeVehicle.registration} />
                <Info label="Fuel" value={activeVehicle.fuelType} />
                <Info label="Odometer" value={`${km.format(activeVehicle.currentOdometer)} km`} />
                <Info label="VIN" value={activeVehicle.vin} wide />
              </dl>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setEditingVehicle(activeVehicle)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                <button onClick={() => persist({ ...state, vehicles: state.vehicles.map((item) => item.id === activeVehicle.id ? { ...item, archived: true, status: "Archived" } : item) })} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">Archive</button>
              </div>
            </Panel>

            <Panel>
              <details>
                <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">Add vehicle profile</summary>
              <form onSubmit={addVehicle} className="mt-3 grid gap-3">
                <div className="grid grid-cols-2 gap-2"><Field label="Make"><TextInput name="make" placeholder="Toyota" /></Field><Field label="Model"><TextInput name="model" placeholder="Hilux" /></Field></div>
                <div className="grid grid-cols-2 gap-2"><Field label="Year"><TextInput name="year" type="number" placeholder="2024" /></Field><Field label="Registration"><TextInput name="registration" placeholder="LJ AB-123" /></Field></div>
                <Field label="VIN"><TextInput name="vin" placeholder="Vehicle identification number" /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Fuel"><SelectInput name="fuelType">{fuelTypes.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field>
                  <Field label="Ownership"><SelectInput name="ownershipStatus">{ownershipTypes.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field>
                </div>
                <Field label="Current odometer"><TextInput name="currentOdometer" type="number" placeholder="0" /></Field>
                <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Create vehicle</button>
              </form>
              </details>
            </Panel>

            <Panel>
              <SectionTitle eyebrow="Alerts" title="Attention queue" />
              <div className="grid gap-2">
                {alerts.length ? alerts.map((alert) => <article key={`${alert.title}-${alert.detail}`} className={`rounded-xl border p-3 ${alert.tone === "critical" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}><strong className="text-sm">{alert.title}</strong><p className="mt-1 text-sm text-slate-600">{alert.detail}</p></article>) : <EmptyState title="No urgent alerts" detail="Inspections, insurance, and service tasks are currently under control." />}
              </div>
            </Panel>
          </aside>

          <section className="grid gap-4">
            {view === "Dashboard" && <Dashboard analytics={analytics} state={state} activeVehicle={activeVehicle} costs={activeCosts} trips={activeTrips} inspections={activeInspections} maintenance={activeMaintenance} setView={setView} />}
            {view === "Ledger" && <LedgerView costs={filteredCosts} query={query} setQuery={setQuery} filter={costFilter} setFilter={setCostFilter} addCost={addCost} archive={archive} remove={remove} />}
            {view === "Trips" && <TripsView trips={activeTrips} addTrip={addTrip} archive={archive} remove={remove} />}
            {view === "Vehicles" && <VehiclesView state={state} setActive={(id: string) => persist({ ...state, activeVehicleId: id })} restore={(id: string) => persist({ ...state, vehicles: state.vehicles.map((vehicle) => vehicle.id === id ? { ...vehicle, archived: false, status: "Active" } : vehicle) })} />}
            {view === "Inspections" && <InspectionsView inspections={activeInspections} addInspection={addInspection} archive={archive} remove={remove} markDone={markInspectionDone} />}
            {view === "Maintenance" && <MaintenanceView tasks={activeMaintenance} addMaintenance={addMaintenance} archive={archive} remove={remove} markDone={markMaintenanceDone} />}
            {view === "Fuel" && <FuelView fuel={state.fuel.filter((item) => !item.archived && item.vehicleId === activeVehicle.id)} activeVehicle={activeVehicle} addFuel={addFuel} archive={archive} remove={remove} />}
            {view === "Documents" && <DocumentsView docs={activeDocuments} addDocument={addDocument} archive={archive} remove={remove} />}
            {view === "Reports" && <AnalyticsView state={state} activeVehicle={activeVehicle} analytics={analytics} />}
            {view === "Settings" && <SettingsView state={state} onReset={() => persist(seed)} />}
          </section>
        </section>
      </div>

      {editingVehicle ? <VehicleEditor vehicle={editingVehicle} onClose={() => setEditingVehicle(null)} onSave={updateVehicle} /> : null}
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">{children}</section>;
}

function Kpi({ label, value, detail, tone = "slate" }: { label: string; value: string; detail: string; tone?: "slate" | "amber" | "rose" | "emerald" }) {
  const colors = { slate: "border-l-slate-400", amber: "border-l-amber-400", rose: "border-l-rose-400", emerald: "border-l-emerald-500" };
  return <article className={`min-h-24 rounded-xl border border-l-4 border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${colors[tone]}`}><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><strong className="mt-2 block text-2xl font-bold text-slate-950">{value}</strong><span className="mt-1 block text-sm leading-5 text-slate-500">{detail}</span></article>;
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "col-span-2" : ""}><dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt><dd className="mt-1 break-words font-medium text-slate-800">{value}</dd></div>;
}

function Dashboard({ analytics, state, activeVehicle, costs, trips, inspections, maintenance, setView }: any) {
  const maxMonthly = Math.max(...analytics.monthlyByType.map((row: any) => row.total), 1);
  const monthFuel = costs.filter((item: CostEntry) => item.type === "Fuel" && monthOf(item.date) === analytics.month).reduce((sum: number, item: CostEntry) => sum + item.amount, 0);
  const monthMaintenance = costs.filter((item: CostEntry) => ["Maintenance", "Repairs", "Tires"].includes(item.type) && monthOf(item.date) === analytics.month).reduce((sum: number, item: CostEntry) => sum + item.amount, 0);
  const expiringDocuments = state.documents.filter((doc: DocumentRecord) => !doc.archived && doc.expiryDate && daysUntil(doc.expiryDate) <= (doc.reminderDays || 30));
  const attentionVehicles = state.vehicles.filter((vehicle: Vehicle) => !vehicle.archived && (vehicle.status === "Under repair" || daysUntil(vehicle.registrationExpiry || "2999-12-31") <= 30 || daysUntil(vehicle.insuranceExpiry || "2999-12-31") <= 30));
  return (
    <>
      <Panel>
        <SectionTitle eyebrow="Operations snapshot" title="Current vehicle activity" action={<div className="flex flex-wrap gap-2">{(["Ledger", "Fuel", "Trips", "Maintenance", "Inspections", "Documents"] as View[]).map((item) => <button key={item} onClick={() => setView(item)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Add {item === "Ledger" ? "expense" : item}</button>)}</div>} />
        <div className="grid gap-2 lg:grid-cols-4">
          <SummaryCard label="Costs logged" value={String(costs.length)} detail={eur.format(costs.reduce((sum: number, item: CostEntry) => sum + item.amount, 0))} />
          <SummaryCard label="Trips logged" value={String(trips.length)} detail={`${km.format(trips.reduce((sum: number, item: Trip) => sum + item.kilometers, 0))} km`} />
          <SummaryCard label="Inspections" value={String(inspections.length)} detail={`${inspections.filter((item: Inspection) => daysUntil(item.dueDate) <= item.reminderDays).length} need attention`} />
          <SummaryCard label="Maintenance" value={String(maintenance.length)} detail={`${maintenance.filter((item: MaintenanceTask) => item.status !== "Completed" && item.status !== "Skipped").length} open tasks`} />
        </div>
      </Panel>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Fuel this month" value={eur.format(monthFuel)} detail="Fuel and electric charging" />
        <SummaryCard label="Service this month" value={eur.format(monthMaintenance)} detail="Maintenance, repairs, and tires" />
        <SummaryCard label="Expiring documents" value={String(expiringDocuments.length)} detail="Inside reminder windows" />
        <SummaryCard label="Vehicles needing attention" value={String(attentionVehicles.length)} detail="Repair, registration, or insurance risk" />
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Panel>
          <SectionTitle eyebrow="Monthly spending" title={`${analytics.month} cost mix`} />
          {analytics.monthlyByType.length ? <div className="grid min-h-56 grid-cols-2 items-end gap-3 md:grid-cols-5 lg:grid-cols-10">{analytics.monthlyByType.map((row: any) => <div key={row.type} className="grid h-full content-end gap-2 text-center"><div className="rounded-t-md bg-teal-700" style={{ height: `${Math.max((row.total / maxMonthly) * 150, 14)}px` }} /><strong className="text-xs">{eur.format(row.total)}</strong><span className="text-[11px] text-slate-500">{row.type}</span></div>)}</div> : <EmptyState title="No spend this month" detail="Add fuel, service, insurance, tolls, or other ledger entries." />}
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Fleet list" title="Vehicles" />
          <div className="grid gap-2">
            {state.vehicles.filter((vehicle: Vehicle) => !vehicle.archived).map((vehicle: Vehicle) => <article key={vehicle.id} className={`rounded-lg border p-3 ${vehicle.id === activeVehicle.id ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"}`}><strong className="text-sm">{vehicle.year} {vehicle.make} {vehicle.model}</strong><p className="text-sm text-slate-500">{vehicle.registration} · {km.format(vehicle.currentOdometer)} km</p></article>)}
          </div>
        </Panel>
      </div>
    </>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p><strong className="mt-1.5 block text-xl font-bold text-slate-950">{value}</strong><span className="text-sm leading-5 text-slate-500">{detail}</span></article>;
}

function LedgerView({ costs, query, setQuery, filter, setFilter, addCost, archive, remove }: any) {
  return <Panel><SectionTitle eyebrow="Cost ledger" title="Expenses and invoices" action={<div className="flex gap-2"><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ledger" /><SelectInput value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option>{costTypes.map((type) => <option key={type}>{type}</option>)}</SelectInput></div>} /><CostForm onSubmit={addCost} /><Table headers={["Date", "Type", "Vendor", "Amount", "Odometer", "Notes", "Actions"]}>{costs.map((item: CostEntry) => <tr key={item.id}><td>{item.date}</td><td><Badge>{item.type}</Badge></td><td>{item.vendor}</td><td className="font-bold">{eur2.format(item.amount)}</td><td>{km.format(item.odometer)} km</td><td>{item.notes}</td><td><Actions onArchive={() => archive("costs", item.id)} onDelete={() => remove("costs", item.id)} /></td></tr>)}</Table>{!costs.length ? <EmptyState title="No matching costs" detail="Try a different filter or add a new expense." /> : null}</Panel>;
}

function CostForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-10"><Field label="Date"><TextInput name="date" type="date" defaultValue={today} /></Field><Field label="Type"><SelectInput name="type">{costTypes.map((type) => <option key={type}>{type}</option>)}</SelectInput></Field><Field label="Vendor"><TextInput name="vendor" placeholder="Supplier" /></Field><Field label="Amount"><TextInput name="amount" type="number" step="0.01" /></Field><Field label="VAT"><TextInput name="vat" type="number" step="0.01" /></Field><Field label="Invoice"><TextInput name="invoiceNumber" placeholder="INV-001" /></Field><Field label="Payment"><TextInput name="paymentMethod" placeholder="Card" /></Field><Field label="Status"><SelectInput name="status"><option>Draft</option><option>Approved</option><option>Paid</option><option>Reimbursed</option><option>Rejected</option></SelectInput></Field><Field label="Odometer"><TextInput name="odometer" type="number" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add cost</button><Field label="Notes"><TextInput name="notes" placeholder="Details" /></Field><Field label="Receipt"><TextInput name="attachment" placeholder="receipt.pdf" /></Field><Field label="Driver"><TextInput name="driver" placeholder="Driver" /></Field></form>;
}

function TripsView({ trips, addTrip, archive, remove }: any) {
  return <Panel><SectionTitle eyebrow="Trip log" title="Business, personal, and reimbursable travel" /><form onSubmit={addTrip} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-8"><Field label="Date"><TextInput name="date" type="date" defaultValue={today} /></Field><Field label="Start"><TextInput name="start" /></Field><Field label="End"><TextInput name="end" /></Field><Field label="Purpose"><TextInput name="purpose" /></Field><Field label="Km"><TextInput name="kilometers" type="number" /></Field><Field label="Driver"><TextInput name="driver" /></Field><Field label="Rate"><TextInput name="reimbursementRate" type="number" step="0.01" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add trip</button></form><Table headers={["Date", "Route", "Purpose", "Km", "Driver", "Reimbursement", "Actions"]}>{trips.map((trip: Trip) => <tr key={trip.id}><td>{trip.date}</td><td>{trip.start} → {trip.end}</td><td>{trip.purpose}</td><td>{km.format(trip.kilometers)}</td><td>{trip.driver}</td><td>{eur2.format(trip.kilometers * trip.reimbursementRate)}</td><td><Actions onArchive={() => archive("trips", trip.id)} onDelete={() => remove("trips", trip.id)} /></td></tr>)}</Table></Panel>;
}

function VehiclesView({ state, setActive, restore }: any) {
  const rows = state.vehicles.map((vehicle: Vehicle) => {
    const costs = state.costs.filter((cost: CostEntry) => !cost.archived && cost.vehicleId === vehicle.id).reduce((sum: number, cost: CostEntry) => sum + cost.amount, 0);
    const distance = state.trips.filter((trip: Trip) => !trip.archived && trip.vehicleId === vehicle.id).reduce((sum: number, trip: Trip) => sum + trip.kilometers, 0);
    const nextMaintenance = state.maintenance.filter((item: MaintenanceTask) => !item.archived && item.vehicleId === vehicle.id).sort((a: MaintenanceTask, b: MaintenanceTask) => a.nextDueKm - b.nextDueKm)[0];
    return { vehicle, costs, distance, nextMaintenance };
  });
  return <Panel><SectionTitle eyebrow="Vehicle register" title="Profiles, compliance, drivers, and ownership" /><Table headers={["Vehicle", "Status", "Driver", "Cost center", "Odometer", "Insurance", "Inspection", "Total cost", "Next service", "Actions"]}>{rows.map((row: any) => <tr key={row.vehicle.id} className={row.vehicle.archived ? "opacity-60" : ""}><td><strong>{row.vehicle.nickname || `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}`}</strong><p className="text-xs text-slate-500">{row.vehicle.registration} · {row.vehicle.vin}</p></td><td><div className="flex flex-wrap gap-1"><Badge>{row.vehicle.status || "Active"}</Badge><Badge>{row.vehicle.ownershipStatus}</Badge></div></td><td>{row.vehicle.assignedDriver || "Unassigned"}</td><td>{row.vehicle.department || "General"}</td><td>{km.format(row.vehicle.currentOdometer)} km</td><td>{row.vehicle.insuranceExpiry || "Missing"}</td><td>{row.vehicle.inspectionExpiry || "Missing"}</td><td className="font-bold">{eur.format(row.costs)}</td><td>{row.nextMaintenance ? `${row.nextMaintenance.item} at ${km.format(row.nextMaintenance.nextDueKm)} km` : "No schedule"}</td><td>{row.vehicle.archived ? <button onClick={() => restore(row.vehicle.id)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Restore</button> : <button onClick={() => setActive(row.vehicle.id)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Open</button>}</td></tr>)}</Table></Panel>;
}

function FuelView({ fuel, activeVehicle, addFuel, archive, remove }: any) {
  const totalCost = fuel.reduce((sum: number, item: FuelEntry) => sum + item.totalCost, 0);
  const totalQuantity = fuel.reduce((sum: number, item: FuelEntry) => sum + item.quantity, 0);
  const totalDistance = fuel.reduce((sum: number, item: FuelEntry) => sum + item.distanceSinceLast, 0);
  return <Panel><SectionTitle eyebrow="Fuel and charging" title="Consumption, fill-ups, and energy cost" /><div className="mb-4 grid gap-3 md:grid-cols-3"><SummaryCard label="Energy spend" value={eur.format(totalCost)} detail={`${fuel.length} fuel or charging sessions`} /><SummaryCard label={activeVehicle.fuelType === "Electric" ? "kWh charged" : "Liters purchased"} value={km.format(totalQuantity)} detail={activeVehicle.fuelType === "Electric" ? "Electric charging" : "Fuel quantity"} /><SummaryCard label="Average economy" value={totalDistance ? `${(totalQuantity / totalDistance * 100).toFixed(1)} ${activeVehicle.fuelType === "Electric" ? "kWh" : "L"}/100 km` : "0"} detail={`${km.format(totalDistance)} km between entries`} /></div><form onSubmit={addFuel} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-10"><Field label="Date"><TextInput name="date" type="date" defaultValue={today} /></Field><Field label="Odometer"><TextInput name="odometer" type="number" /></Field><Field label={activeVehicle.fuelType === "Electric" ? "kWh" : "Liters"}><TextInput name="quantity" type="number" step="0.01" /></Field><Field label="Unit price"><TextInput name="pricePerUnit" type="number" step="0.01" /></Field><Field label="Total"><TextInput name="totalCost" type="number" step="0.01" /></Field><Field label="Type"><SelectInput name="fuelType" defaultValue={activeVehicle.fuelType}>{fuelTypes.map((type) => <option key={type}>{type}</option>)}</SelectInput></Field><Field label="Station"><TextInput name="station" placeholder="Vendor" /></Field><Field label="Receipt"><TextInput name="receipt" placeholder="receipt.pdf" /></Field><Field label="Full tank"><input name="fullTank" type="checkbox" className="h-10 w-5 accent-teal-700" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add fuel</button><Field label="Notes"><TextInput name="notes" placeholder="Route, pump, charger" /></Field></form><Table headers={["Date", "Odometer", "Quantity", "Unit price", "Total", "Vendor", "Distance", "Economy", "Cost/km", "Actions"]}>{fuel.map((item: FuelEntry) => <tr key={item.id}><td>{item.date}</td><td>{km.format(item.odometer)} km</td><td>{item.quantity.toFixed(2)} {item.fuelType === "Electric" ? "kWh" : "L"}</td><td>{eur2.format(item.pricePerUnit)}</td><td className="font-bold">{eur2.format(item.totalCost)}</td><td>{item.station}</td><td>{km.format(item.distanceSinceLast)} km</td><td>{item.economy.toFixed(1)} {item.fuelType === "Electric" ? "kWh" : "L"}/100 km</td><td>{eur2.format(item.costPerKm)}</td><td><Actions onArchive={() => archive("fuel", item.id)} onDelete={() => remove("fuel", item.id)} /></td></tr>)}</Table>{!fuel.length ? <EmptyState title="No fuel records yet" detail="Add the first fill-up or charging session to calculate efficiency." /> : null}</Panel>;
}

function InspectionsView({ inspections, addInspection, archive, remove, markDone }: any) {
  return <Panel><SectionTitle eyebrow="Inspection calendar" title="Due dates, certificates, and reminders" /><form onSubmit={addInspection} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-7"><Field label="Type"><TextInput name="type" /></Field><Field label="Due"><TextInput name="dueDate" type="date" /></Field><Field label="Completed"><TextInput name="completedDate" type="date" /></Field><Field label="Result"><SelectInput name="result"><option>Passed</option><option>Conditional</option><option>Failed</option><option>Pending</option></SelectInput></Field><Field label="Certificate"><TextInput name="certificate" placeholder="file.pdf" /></Field><Field label="Reminder"><TextInput name="reminderDays" type="number" defaultValue={30} /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add</button></form><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{inspections.map((item: Inspection) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><strong>{item.type}</strong><Badge tone={badgeTone(daysUntil(item.dueDate) < 0 ? "Expired" : item.result || "Pending")}>{daysUntil(item.dueDate) < 0 ? "Expired" : item.result || "Pending"}</Badge></div><p className="mt-2 text-sm text-slate-500">Due {item.dueDate} · reminder {item.reminderDays} days</p><p className="text-sm text-slate-500">Certificate: {item.certificate || "Not uploaded"}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => markDone(item.id)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Mark complete</button><Actions onArchive={() => archive("inspections", item.id)} onDelete={() => remove("inspections", item.id)} /></div></article>)}</div></Panel>;
}

function MaintenanceView({ tasks, addMaintenance, archive, remove, markDone }: any) {
  return <Panel><SectionTitle eyebrow="Maintenance schedule" title="Service tasks and mileage intervals" /><form onSubmit={addMaintenance} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-8"><Field label="Item"><TextInput name="item" placeholder="Oil change" /></Field><Field label="Interval km"><TextInput name="intervalKm" type="number" /></Field><Field label="Last done"><TextInput name="lastDoneKm" type="number" /></Field><Field label="Next due"><TextInput name="nextDueKm" type="number" /></Field><Field label="Due date"><TextInput name="dueDate" type="date" /></Field><Field label="Status"><SelectInput name="status"><option>Upcoming</option><option>Due soon</option><option>Overdue</option><option>Completed</option><option>Skipped</option></SelectInput></Field><Field label="Notes"><TextInput name="notes" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add</button></form><Table headers={["Item", "Status", "Last done", "Next due", "Due date", "Notes", "Actions"]}>{tasks.map((task: MaintenanceTask) => <tr key={task.id}><td className="font-bold">{task.item}</td><td><Badge>{task.status}</Badge></td><td>{km.format(task.lastDoneKm)} km</td><td>{km.format(task.nextDueKm)} km</td><td>{task.dueDate}</td><td>{task.notes}</td><td><div className="flex flex-wrap gap-2"><button onClick={() => markDone(task.id)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Complete</button><Actions onArchive={() => archive("maintenance", task.id)} onDelete={() => remove("maintenance", task.id)} /></div></td></tr>)}</Table></Panel>;
}

function OdometerView({ points, addOdometer, remove }: any) {
  return <Panel><SectionTitle eyebrow="Odometer history" title="Mileage updates and distance calculations" /><form onSubmit={addOdometer} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-5"><Field label="Date"><TextInput name="date" type="date" defaultValue={today} /></Field><Field label="Odometer"><TextInput name="odometer" type="number" /></Field><Field label="Driver"><TextInput name="driver" /></Field><Field label="Notes"><TextInput name="notes" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add update</button></form><Table headers={["Date", "Odometer", "Delta", "Driver", "Notes", "Actions"]}>{points.map((point: OdometerPoint, index: number) => <tr key={point.id}><td>{point.date}</td><td>{km.format(point.odometer)} km</td><td>{index ? `${km.format(point.odometer - points[index - 1].odometer)} km` : "Baseline"}</td><td>{point.driver}</td><td>{point.notes}</td><td><button onClick={() => remove("odometer", point.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Delete</button></td></tr>)}</Table></Panel>;
}

function DocumentsView({ docs, addDocument, archive, remove }: any) {
  return <Panel><SectionTitle eyebrow="Document vault" title="Registration, insurance, invoices, inspections, warranty papers" /><form onSubmit={addDocument} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-7"><Field label="Type"><SelectInput name="type"><option>Registration</option><option>Insurance</option><option>Inspection certificate</option><option>Service invoice</option><option>Fuel receipt</option><option>Warranty</option><option>Lease agreement</option><option>Tax document</option></SelectInput></Field><Field label="Title"><TextInput name="title" /></Field><Field label="File"><TextInput name="fileName" placeholder="file.pdf" /></Field><Field label="Expiry"><TextInput name="expiryDate" type="date" /></Field><Field label="Reminder"><TextInput name="reminderDays" type="number" defaultValue={30} /></Field><Field label="Notes"><TextInput name="notes" /></Field><button className="self-end rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Add document</button></form><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{docs.map((doc: DocumentRecord) => <article key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-4 rounded-lg bg-slate-900 p-4 text-white"><span className="text-xs font-bold uppercase tracking-wide text-white/60">{doc.fileName.split(".").pop() || "doc"}</span><strong className="mt-8 block text-lg">{doc.type}</strong></div><strong>{doc.title}</strong><p className="mt-1 text-sm text-slate-500">{doc.fileName}</p><p className="text-sm text-slate-500">{doc.expiryDate ? `Expires ${doc.expiryDate}` : "No expiry"}</p><p className="text-sm text-slate-500">Uploaded {doc.uploadDate || "today"} · reminder {doc.reminderDays || 0} days</p><div className="mt-4"><Actions onArchive={() => archive("documents", doc.id)} onDelete={() => remove("documents", doc.id)} /></div></article>)}</div>{!docs.length ? <EmptyState title="No documents yet" detail="Add insurance, registration, invoices, or receipts to keep a complete vehicle file." /> : null}</Panel>;
}

function SettingsView({ state, onReset }: any) {
  function exportJson() {
    download("vehicle-ledger-backup.json", JSON.stringify(state, null, 2), "application/json");
  }

  function printReport() {
    window.print();
  }

  return <Panel><SectionTitle eyebrow="Settings" title="Data, export, and prototype controls" /><div className="grid gap-4 lg:grid-cols-3"><article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Local persistence</p><strong className="mt-2 block text-2xl">{state.vehicles.length} vehicles</strong><p className="mt-2 text-sm text-slate-600">This prototype saves to this browser with localStorage. Use the JSON backup before clearing browser data.</p></article><article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Exports</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={exportJson} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Download backup</button><button onClick={printReport} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">Print / PDF</button></div></article><article className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-rose-600">Reset sample data</p><p className="mt-2 text-sm text-slate-700">Restore the realistic demo fleet and clear all edits stored in this browser.</p><button onClick={onReset} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white">Reset demo</button></article></div></Panel>;
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
  return <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[900px] border-collapse bg-white text-left text-sm text-slate-700"><thead className="bg-slate-50 text-[11px] uppercase tracking-[0.08em] text-slate-500"><tr>{headers.map((header) => <th key={header} className="sticky top-0 border-b border-slate-200 px-3 py-2.5 font-bold">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 tabular-nums [&_tr:hover]:bg-slate-50 [&_td]:px-3 [&_td]:py-2.5">{children}</tbody></table></div>;
}

function Actions({ onArchive, onDelete }: { onArchive: () => void; onDelete: () => void }) {
  return <div className="flex flex-wrap gap-2"><button onClick={onArchive} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">Archive</button><button onClick={onDelete} className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">Delete</button></div>;
}

function VehicleEditor({ vehicle, onClose, onSave }: { vehicle: Vehicle; onClose: () => void; onSave: (vehicle: Vehicle) => void }) {
  const [draft, setDraft] = useState(vehicle);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl"><SectionTitle eyebrow="Edit vehicle" title={`${vehicle.make} ${vehicle.model}`} /><div className="grid gap-3 md:grid-cols-2"><Field label="Nickname"><TextInput value={draft.nickname || ""} onChange={(event) => setDraft({ ...draft, nickname: event.target.value })} /></Field><Field label="Make"><TextInput value={draft.make} onChange={(event) => setDraft({ ...draft, make: event.target.value })} /></Field><Field label="Model"><TextInput value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></Field><Field label="Year"><TextInput type="number" value={draft.year} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })} /></Field><Field label="Registration"><TextInput value={draft.registration} onChange={(event) => setDraft({ ...draft, registration: event.target.value })} /></Field><Field label="VIN"><TextInput value={draft.vin} onChange={(event) => setDraft({ ...draft, vin: event.target.value })} /></Field><Field label="Odometer"><TextInput type="number" value={draft.currentOdometer} onChange={(event) => setDraft({ ...draft, currentOdometer: Number(event.target.value) })} /></Field><Field label="Fuel"><SelectInput value={draft.fuelType} onChange={(event) => setDraft({ ...draft, fuelType: event.target.value as FuelType })}>{fuelTypes.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="Transmission"><SelectInput value={draft.transmission || "Manual"} onChange={(event) => setDraft({ ...draft, transmission: event.target.value as Transmission })}><option>Manual</option><option>Automatic</option><option>CVT</option><option>Single-speed</option></SelectInput></Field><Field label="Engine"><TextInput value={draft.engineSize || ""} onChange={(event) => setDraft({ ...draft, engineSize: event.target.value })} /></Field><Field label="Ownership"><SelectInput value={draft.ownershipStatus} onChange={(event) => setDraft({ ...draft, ownershipStatus: event.target.value as OwnershipType })}>{ownershipTypes.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="Status"><SelectInput value={draft.status || "Active"} onChange={(event) => setDraft({ ...draft, status: event.target.value as VehicleStatus })}>{statuses.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="Assigned driver"><TextInput value={draft.assignedDriver || ""} onChange={(event) => setDraft({ ...draft, assignedDriver: event.target.value })} /></Field><Field label="Department"><TextInput value={draft.department || ""} onChange={(event) => setDraft({ ...draft, department: event.target.value })} /></Field><Field label="Insurance expiry"><TextInput type="date" value={draft.insuranceExpiry || ""} onChange={(event) => setDraft({ ...draft, insuranceExpiry: event.target.value })} /></Field><Field label="Inspection expiry"><TextInput type="date" value={draft.inspectionExpiry || ""} onChange={(event) => setDraft({ ...draft, inspectionExpiry: event.target.value })} /></Field></div><Field label="Notes"><TextInput value={draft.notes || ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button><button onClick={() => onSave(draft)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">Save changes</button></div></div></div>;
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.href), { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
