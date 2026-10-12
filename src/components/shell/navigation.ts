import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBoxesStacked,
  faBullseye,
  faPeopleGroup,
  faReceipt,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";

export type ShellNavigationItem = {
  key: string;
  label: string;
  icon: IconDefinition;
  href: string;
};

export type ShellNavigationGroup = {
  label: string;
  items: ShellNavigationItem[];
};

export const SHELL_NAVIGATION: ShellNavigationGroup[] = [
  {
    label: "Operación",
    items: [
      {
        key: "inventario",
        label: "Inventario",
        icon: faBoxesStacked,
        href: "/dashboard?module=inventario&view=stock",
      },
      {
        key: "ventas",
        label: "Ventas",
        icon: faReceipt,
        href: "/dashboard?module=ventas&view=agregar",
      },
      {
        key: "cuotas",
        label: "Cuotas",
        icon: faBullseye,
        href: "/dashboard?module=cuotas&view=diaria",
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
        href: "/dashboard?module=personal",
      },
      {
        key: "herramientas",
        label: "Herramientas",
        icon: faWrench,
        href: "/dashboard?module=herramientas&view=specs",
      },
    ],
  },
];

export const MODULE_TITLES: Record<string, string> = {
  inventario: "Inventario",
  ventas: "Ventas",
  cuotas: "Cuotas",
  personal: "Personal",
  herramientas: "Herramientas",
};
