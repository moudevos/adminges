import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBoxesStacked,
  faBullseye,
  faPeopleGroup,
  faReceipt,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";

export type NavigationChild = {
  key: string;
  label: string;
  href: string;
};

export type NavigationItem = {
  key: string;
  label: string;
  icon: IconDefinition;
  children: NavigationChild[];
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

export type NavigationState = {
  activeModule: string;
  activeView?: string;
  moduleLabel: string;
  viewLabel?: string;
};

export const DEFAULT_APP_HREF = "/inventario/stock";

export const SHELL_NAVIGATION: NavigationSection[] = [
  {
    label: "Operación",
    items: [
      {
        key: "inventario",
        label: "Inventario",
        icon: faBoxesStacked,
        children: [
          { key: "cargar", label: "Cargar", href: "/inventario/cargar" },
          { key: "stock", label: "Stock", href: "/inventario/stock" },
          {
            key: "movimientos",
            label: "Movimientos",
            href: "/inventario/movimientos",
          },
          { key: "analisis", label: "Análisis", href: "/inventario/analisis" },
        ],
      },
      {
        key: "ventas",
        label: "Ventas",
        icon: faReceipt,
        children: [
          { key: "dia", label: "Día de venta", href: "/ventas/dia" },
          {
            key: "dias",
            label: "Histórico de días",
            href: "/ventas/dias",
          },
          { key: "analisis", label: "Análisis", href: "/ventas/analisis" },
        ],
      },
      {
        key: "cuotas",
        label: "Cuotas",
        icon: faBullseye,
        children: [
          { key: "diaria", label: "Cuota diaria", href: "/cuotas/diaria" },
          { key: "mensual", label: "Cuota mensual", href: "/cuotas/mensual" },
          {
            key: "seguimiento-mensual",
            label: "Seguimiento mensual",
            href: "/cuotas/seguimiento-mensual",
          },
          {
            key: "seguimiento-diario",
            label: "Seguimiento diario",
            href: "/cuotas/seguimiento-diario",
          },
        ],
      },
    ],
  },
  {
    label: "Gestión",
    items: [
      {
        key: "personal",
        label: "Personal",
        icon: faPeopleGroup,
        children: [
          { key: "personal", label: "Personal", href: "/personal" },
        ],
      },
      {
        key: "herramientas",
        label: "Herramientas",
        icon: faWrench,
        children: [
          { key: "specs", label: "Specs", href: "/herramientas/specs" },
          {
            key: "gancheras",
            label: "Gancheras",
            href: "/herramientas/gancheras",
          },
          {
            key: "preciador",
            label: "Preciador",
            href: "/herramientas/preciador",
          },
        ],
      },
    ],
  },
];

function normalizedPath(pathname: string) {
  if (!pathname || pathname === "/") return DEFAULT_APP_HREF;
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function resolveNavigationState(pathname: string): NavigationState {
  const currentPath = normalizedPath(pathname);

  for (const section of SHELL_NAVIGATION) {
    for (const item of section.items) {
      const child = item.children.find(
        (candidate) =>
          candidate.href === currentPath ||
          currentPath.startsWith(candidate.href + "/"),
      );

      if (child) {
        return {
          activeModule: item.key,
          activeView: child.key,
          moduleLabel: item.label,
          viewLabel: child.label,
        };
      }
    }
  }

  const firstSegment = currentPath.split("/").filter(Boolean)[0];

  for (const section of SHELL_NAVIGATION) {
    const item = section.items.find(
      (candidate) => candidate.key === firstSegment,
    );

    if (item) {
      const firstChild = item.children[0];
      return {
        activeModule: item.key,
        activeView: firstChild?.key,
        moduleLabel: item.label,
        viewLabel: firstChild?.label,
      };
    }
  }

  return {
    activeModule: "inventario",
    activeView: "stock",
    moduleLabel: "Inventario",
    viewLabel: "Stock",
  };
}

export function getNavigationHref(module?: string, view?: string) {
  const normalizedView =
    module === "ventas" && view === "agregar"
      ? "dia"
      : module === "ventas" && view === "historial"
        ? "dias"
        : view;

  for (const section of SHELL_NAVIGATION) {
    const item = section.items.find((candidate) => candidate.key === module);
    if (!item) continue;

    const child =
      item.children.find((candidate) => candidate.key === normalizedView) ??
      item.children[0];

    return child?.href ?? DEFAULT_APP_HREF;
  }

  return DEFAULT_APP_HREF;
}
