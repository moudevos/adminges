export const MAIN_WAREHOUSE = "KIOSKO MALL IQUITOS - KIO37";

export type InventoryValidationError = {
  row: number | null;
  code: string;
  message: string;
  sku?: string;
  serial?: string;
};

export type RawInventoryRow = {
  rowNumber: number;
  sku: string;
  serial: string;
  product: string;
  quantity: string;
  availableQuantity: string;
  warehouse: string;
  location: string;
  category: string;
};

export type NormalizedInventoryRow = {
  rowNumber: number;
  sku: string;
  serial: string | null;
  descripcionOriginal: string;
  descripcion: string;
  cantidadFisica: number;
  cantidadDisponible: number;
  cantidadOperativa: number;
  almacen: string;
  ubicacion: string;
  categoriaOriginal: string;
  categoriaPrincipal: string;
  categoriaVenta: string | null;
  familia: string | null;
  variante: string | null;
};

export type ComparableInventoryRow = {
  sku: string;
  serial: string | null;
  cantidadFisica: number;
  cantidadDisponible: number;
  cantidadOperativa: number;
  almacen: string;
  ubicacion: string;
};

export type InventoryLocationSummary = {
  name: string;
  current: number;
  candidate: number;
  difference: number;
};

export type InventorySnapshotSummary = {
  current: {
    skuCount: number;
    units: number;
  };
  candidate: {
    skuCount: number;
    units: number;
    series: number;
  };
  difference: {
    skuCount: number;
    units: number;
  };
  newSkus: number;
  exhaustedSkus: number;
  warningLargeDifference: boolean;
  locations: InventoryLocationSummary[];
};

export type SnapshotHistoryRow = {
  id: string;
  snapshotDate: string;
  fileName: string;
  status: string;
  skuCount: number;
  unitCount: number;
  seriesCount: number;
  newSkuCount: number;
  exhaustedSkuCount: number;
  createdAt: string;
};

export type PreparedSnapshot = InventorySnapshotSummary & {
  id: string;
  snapshotDate: string;
  fileName: string;
};

export type InventoryStockRow = {
  rowKey: string;
  id: string;
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  categoriaPrincipal: string | null;
  categoriaVenta: string | null;
  costo: number;
  precio: number;
  stockMinimo: number;
  isActive: boolean;
  cantidadFisica: number;
  cantidadDisponible: number;
  stockActual: number;
  valorStock: number;
  seriesCount: number;
  serials: string[];
  almacen: string | null;
  ubicacion: string | null;
};


export type InventoryKardexMovement = {
  id: number;
  fecha: string;
  sku: string;
  descripcion: string;
  serial: string | null;
  direccion: "entrada" | "salida" | "traslado";
  tipo: "snapshot_inicial" | "reconciliacion" | "traslado" | "venta";
  clasificacion: "confirmado" | "pendiente_venta";
  cantidad: number;
  almacenOrigen: string | null;
  ubicacionOrigen: string | null;
  almacenDestino: string | null;
  ubicacionDestino: string | null;
};

export type InventoryMovementSearchResult = {
  mode: "sku" | "imei";
  query: string;
  sku: string;
  descripcion: string;
  serial: string | null;
  movements: InventoryKardexMovement[];
  total: number;
};

export type InventoryMovementSearchResponse =
  | {
      status: "found";
      result: InventoryMovementSearchResult;
    }
  | {
      status: "not-found";
      query: string;
    }
  | {
      status: "error";
      query: string;
      message: string;
    };
