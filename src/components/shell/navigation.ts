import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faBoxesStacked, faBullseye, faPeopleGroup, faReceipt, faWrench } from "@fortawesome/free-solid-svg-icons";

export type NavigationChild = { key: string; label: string; href: string };
export type NavigationItem = { key: string; label: string; icon: IconDefinition; children: NavigationChild[] };
export type NavigationSection = { label: string; items: NavigationItem[] };

export const SHELL_NAVIGATION: NavigationSection[] = [
  { label: "Operación", items: [
    { key: "inventario", label: "Inventario", icon: faBoxesStacked, children: [
      { key: "cargar", label: "Cargar", href: "/dashboard?module=inventario&view=cargar" },
      { key: "stock", label: "Stock", href: "/dashboard?module=inventario&view=stock" },
      { key: "analisis", label: "Análisis", href: "/dashboard?module=inventario&view=analisis" },
    ] },
    { key: "ventas", label: "Ventas", icon: faReceipt, children: [
      { key: "agregar", label: "Agregar", href: "/dashboard?module=ventas&view=agregar" },
      { key: "historial", label: "Historial", href: "/dashboard?module=ventas&view=historial" },
      { key: "analisis", label: "Análisis", href: "/dashboard?module=ventas&view=analisis" },
    ] },
    { key: "cuotas", label: "Cuotas", icon: faBullseye, children: [
      { key: "diaria", label: "Cuota diaria", href: "/dashboard?module=cuotas&view=diaria" },
      { key: "mensual", label: "Cuota mensual", href: "/dashboard?module=cuotas&view=mensual" },
      { key: "seguimiento-mensual", label: "Seguimiento mensual", href: "/dashboard?module=cuotas&view=seguimiento-mensual" },
      { key: "seguimiento-diario", label: "Seguimiento diario", href: "/dashboard?module=cuotas&view=seguimiento-diario" },
    ] },
  ] },
  { label: "Gestión", items: [
    { key: "personal", label: "Personal", icon: faPeopleGroup, children: [{ key: "personal", label: "Personal", href: "/dashboard?module=personal" }] },
    { key: "herramientas", label: "Herramientas", icon: faWrench, children: [
      { key: "specs", label: "Specs", href: "/dashboard?module=herramientas&view=specs" },
      { key: "gancheras", label: "Gancheras", href: "/dashboard?module=herramientas&view=gancheras" },
      { key: "preciador", label: "Preciador", href: "/dashboard?module=herramientas&view=preciador" },
    ] },
  ] },
];

export const MODULE_TITLES: Record<string, string> = { inventario: "Inventario", ventas: "Ventas", cuotas: "Cuotas", personal: "Personal", herramientas: "Herramientas" };
