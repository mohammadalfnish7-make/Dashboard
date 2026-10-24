export type SheetRow = {
  date: string;
  shipment: string;
  mark: string;
  /** Raw Customer-column mark code (4455, EM5565, MO001), if present. */
  markCode?: string;
  /** Shop / company name without the mark code. */
  shop?: string;
  kg: number | null;
  cartons: number | null;
  status: string;
  delivered: boolean;
  lane?: string;
};

export type MarkStat = {
  mark: string;
  kg: number;
  rows: number;
  deliveries: number;
  shipments: number;
};

export type DayStat = {
  key: string;
  label: string;
  kg: number;
  rows: number;
  deliveries: number;
};

export type NamedStat = {
  label: string;
  kg: number;
  rows: number;
};

export type SheetPayload = {
  source: "google" | "local";
  title: string;
  tab: string;
  tabs: string[];
  fetchedAt: string;
  from: string;
  to: string;
  rangeLabel: string;
  totalRows: number;
  usedRows: number;
  warning?: string;
  headline: string;
  metrics: {
    deliveries: number;
    open: number;
    totalKg: number;
    kgRows: number;
    shipments: number;
    marks: MarkStat[];
    marksTop: MarkStat[];
    byDay: DayStat[];
    byStatus: NamedStat[];
    byShipment: NamedStat[];
    byLane: NamedStat[];
    warehouse: {
      kg: number;
      lines: number;
      cartons: number;
      markCount: number;
      marks: NamedStat[];
      byLane: NamedStat[];
    };
  };
  rows: SheetRow[];
  warehouseRows: SheetRow[];
};
