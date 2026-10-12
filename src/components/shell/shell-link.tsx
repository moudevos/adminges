"use client";

import Link from "next/link";
import {
  createContext,
  type ComponentProps,
  type ReactNode,
  useContext,
} from "react";

type NavigationHandler = (href: string) => void;

const ShellNavigationContext = createContext<NavigationHandler | null>(null);

export function ShellNavigationProvider({
  onNavigate,
  children,
}: {
  onNavigate: NavigationHandler;
  children: ReactNode;
}) {
  return (
    <ShellNavigationContext.Provider value={onNavigate}>
      {children}
    </ShellNavigationContext.Provider>
  );
}

type ShellLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export function ShellLink({ href, onClick, ...props }: ShellLinkProps) {
  const beginNavigation = useContext(ShellNavigationContext);

  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) beginNavigation?.(href);
      }}
    />
  );
}
