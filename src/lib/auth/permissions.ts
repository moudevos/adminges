export const PERMISSIONS = {
  peopleRead: "people.read",
  peopleCreate: "people.create",
  peopleUpdate: "people.update",
  usersRead: "users.read",
  usersCreate: "users.create",
  usersUpdate: "users.update",
  storesRead: "stores.read",
  storesCreate: "stores.create",
  storesUpdate: "stores.update",
  storesAssign: "stores.assign",
  promotersRead: "promoters.read",
  promotersCreate: "promoters.create",
  promotersUpdate: "promoters.update",
  territoryRead: "territory.read",
  territoryManage: "territory.manage",
  sessionsRead: "sessions.read",
  sessionsRevoke: "sessions.revoke",
  inventoryRead: "inventory.read",
  inventoryManage: "inventory.manage",
  salesRead: "sales.read",
  salesCreate: "sales.create",
  schedulesRead: "schedules.read",
  schedulesManage: "schedules.manage",
  quotasRead: "quotas.read",
  quotasManage: "quotas.manage",
  analyticsRead: "analytics.read",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const MODULE_PERMISSIONS: Record<string, readonly PermissionKey[] | null> = {
  resumen: null,
  personal: [PERMISSIONS.peopleRead],
  tiendas: [PERMISSIONS.storesRead],
  territorio: [PERMISSIONS.territoryRead],
  seguridad: [PERMISSIONS.sessionsRead],
  inventario: [PERMISSIONS.inventoryRead],
  ventas: [PERMISSIONS.salesRead],
  horarios: [PERMISSIONS.schedulesRead],
  cuotas: [PERMISSIONS.quotasRead],
  analisis: [PERMISSIONS.analyticsRead],
};

export function hasPermission(permissions: readonly string[], permission: PermissionKey) {
  return permissions.includes(permission);
}

export function canAccessModule(permissions: readonly string[], module: string) {
  const required = MODULE_PERMISSIONS[module];
  return required === null || (required?.some((permission) => permissions.includes(permission)) ?? false);
}
