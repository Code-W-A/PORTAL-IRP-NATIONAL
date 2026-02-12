"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  List,
  CalendarDays,
  LogOut,
  BarChart3,
  Users,
  Newspaper,
  FileText,
  Settings,
  ClipboardList,
  Menu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { signOut } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";

import { initFirebase } from "@/lib/firebase";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  matchPrefixes?: string[];
};

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  items: NavItem[];
};

const BICP_ITEMS: NavItem[] = [
  { href: "/creaza-BICP", label: "Crează BICP", icon: Plus },
  {
    href: "/lista-BICP",
    label: "Lista BICP",
    icon: List,
    matchPrefixes: ["/lista-BICP", "/"],
  },
  { href: "/statistici-BICP", label: "Statistici BICP", icon: BarChart3 },
];

const ACREDITARI_ITEMS: NavItem[] = [
  { href: "/acreditari/creaza", label: "Cerere acreditare", icon: Plus, adminOnly: true },
  { href: "/acreditari/cereri", label: "Cereri acreditare", icon: FileText, adminOnly: true },
  { href: "/acreditari/lista", label: "Lista acreditări", icon: List, adminOnly: true },
  { href: "/acreditari/jurnalisti", label: "Jurnaliști acreditați", icon: Users, adminOnly: true },
];

const MONITORIZARE_ITEMS: NavItem[] = [
  { href: "/monitorizare/creaza", label: "Adaugă material", icon: Plus, adminOnly: true },
  { href: "/monitorizare/lista", label: "Lista materiale", icon: List, adminOnly: true },
  { href: "/monitorizare/statistici", label: "Statistici", icon: BarChart3, adminOnly: true },
  { href: "/monitorizare/revista", label: "Revista presei", icon: FileText, adminOnly: true },
];

const SIDEBAR_GROUPS: NavGroup[] = [
  { id: "bicp", label: "BICP", icon: FileText, items: BICP_ITEMS },
  {
    id: "acreditari",
    label: "Acreditări",
    icon: Users,
    adminOnly: true,
    items: ACREDITARI_ITEMS,
  },
  {
    id: "monitorizare",
    label: "Monitorizare",
    icon: Newspaper,
    adminOnly: true,
    items: MONITORIZARE_ITEMS,
  },
];

const SIDEBAR_LINKS: NavItem[] = [
  { href: "/proceduri-lucru", label: "Proceduri", icon: CalendarDays, adminOnly: true },
  {
    href: "/dashboard/raportari",
    label: "Raportări",
    icon: BarChart3,
    adminOnly: true,
    matchPrefixes: ["/dashboard/raportari"],
  },
  { href: "/activitate-zilnica", label: "Activitate zilnică", icon: ClipboardList, adminOnly: true },
  { href: "/calendar-activitati", label: "Calendar activități", icon: CalendarDays, adminOnly: true },
  { href: "/setari-structura", label: "Setări", icon: Settings },
];

function canAccess(item: { adminOnly?: boolean }, isAdmin: boolean) {
  return item.adminOnly ? isAdmin : true;
}

function isPathActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  if (item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  const segment = item.href.split("/").filter(Boolean)[0];
  if (!segment) return pathname === "/";
  return pathname.startsWith(`/${segment}`) && item.href !== "/setari-structura";
}

function isGroupActive(pathname: string, group: NavGroup, isAdmin: boolean) {
  return group.items
    .filter((item) => canAccess(item, isAdmin))
    .some((item) => isPathActive(pathname, item));
}

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { auth } = initFirebase();
  const { isAdmin } = useAuth();

  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const [openGroupIds, setOpenGroupIds] = useState<string[]>(["bicp"]);

  const visibleGroups = useMemo(
    () => SIDEBAR_GROUPS.filter((group) => canAccess(group, isAdmin)),
    [isAdmin]
  );

  const visibleLinks = useMemo(
    () => SIDEBAR_LINKS.filter((item) => canAccess(item, isAdmin)),
    [isAdmin]
  );

  useEffect(() => {
    const activeGroups = visibleGroups
      .filter((group) => isGroupActive(pathname, group, isAdmin))
      .map((group) => group.id);

    if (!activeGroups.length) return;

    setOpenGroupIds((prev) => Array.from(new Set([...prev, ...activeGroups])));
  }, [pathname, visibleGroups, isAdmin]);

  async function handleLogout() {
    try {
      localStorage.removeItem("bicpViewMode");
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <>
      <nav className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <button
            type="button"
            aria-label="Deschide meniul"
            onClick={() => setDesktopSidebarOpen(true)}
            className="hidden h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-700 transition-colors hover:bg-gray-100 md:inline-flex"
          >
            <Menu size={18} />
          </button>

          <Link
            href="/lista-BICP"
            className="inline-flex items-center text-gray-900 font-semibold tracking-tight"
          >
            <img
              src="/logo-aplicatie/sigla-aplicatie-svg.svg"
              alt="IRP"
              className="mr-2 h-6 w-6"
            />
            Portal IRP
          </Link>

          <div className="flex-1" />

          <button
            aria-label="Logout"
            onClick={handleLogout}
            className="inline-flex h-9 items-center rounded-md border border-gray-200 px-3 text-gray-900 hover:bg-gray-100 md:hidden"
          >
            <LogOut size={18} />
            <span className="ml-2 hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      <Sheet open={desktopSidebarOpen} onOpenChange={setDesktopSidebarOpen}>
        <SheetContent
          className="hidden h-full w-[320px] max-w-[86vw] border-l-0 border-r border-gray-200 bg-white p-0 left-0 right-auto md:block data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0"
          aria-describedby="desktop-sidebar-description"
        >
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-gray-200 px-5 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-base">
                <img
                  src="/logo-aplicatie/sigla-aplicatie-svg.svg"
                  alt="IRP"
                  className="h-5 w-5"
                />
                Portal IRP
              </SheetTitle>
              <SheetDescription id="desktop-sidebar-description">
                Navigație principală
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <Accordion
                type="multiple"
                value={openGroupIds}
                onValueChange={setOpenGroupIds}
                className="rounded-xl border border-gray-200 bg-gray-50/40 px-3"
              >
                {visibleGroups.map((group) => {
                  const GroupIcon = group.icon;
                  const groupIsActive = isGroupActive(pathname, group, isAdmin);

                  return (
                    <AccordionItem key={group.id} value={group.id} className="border-gray-200">
                      <AccordionTrigger className={groupIsActive ? "text-blue-700" : undefined}>
                        <span className="inline-flex items-center gap-2">
                          <GroupIcon size={16} />
                          {group.label}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {group.items
                            .filter((item) => canAccess(item, isAdmin))
                            .map((item) => {
                              const Icon = item.icon;
                              const active = isPathActive(pathname, item);

                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => setDesktopSidebarOpen(false)}
                                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                                    active
                                      ? "border border-blue-100 bg-blue-50 text-blue-700"
                                      : "text-gray-700 hover:bg-gray-100"
                                  }`}
                                >
                                  <Icon size={15} />
                                  {item.label}
                                </Link>
                              );
                            })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              <div className="mt-4 space-y-1">
                {visibleLinks.map((item) => {
                  const Icon = item.icon;
                  const active = isPathActive(pathname, item);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDesktopSidebarOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "border border-blue-100 bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-200 p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function BottomNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { auth } = initFirebase();
  const { isAdmin } = useAuth();

  const [bicpOpen, setBicpOpen] = useState(false);
  const [acreditariOpen, setAcreditariOpen] = useState(false);
  const [monitorizareOpen, setMonitorizareOpen] = useState(false);

  async function handleLogout() {
    try {
      localStorage.removeItem("bicpViewMode");
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error(error);
    }
  }

  const bottomItems = SIDEBAR_LINKS.filter((item) => canAccess(item, isAdmin));

  const item = (navItem: NavItem) => {
    const Icon = navItem.icon;
    const active = isPathActive(pathname, navItem);

    return (
      <button
        key={navItem.href}
        onClick={() => router.push(navItem.href)}
        className={`flex flex-1 flex-col items-center justify-center py-2 ${
          active ? "text-blue-700" : "text-gray-700"
        }`}
        aria-label={navItem.label}
      >
        <Icon size={18} />
        <span className="mt-1 text-xs">{navItem.label === "Calendar activități" ? "Calendar" : navItem.label}</span>
      </button>
    );
  };

  const showAcreditari = isAdmin;
  const showMonitorizare = isAdmin;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t bg-white md:hidden">
        <div className="relative flex-1">
          <button
            onClick={() => {
              setMonitorizareOpen(false);
              setAcreditariOpen(false);
              setBicpOpen((value) => !value);
            }}
            className={`flex w-full flex-col items-center justify-center py-2 ${
              isGroupActive(pathname, SIDEBAR_GROUPS[0], isAdmin) ? "text-blue-700" : "text-gray-700"
            }`}
            aria-label="BICP"
          >
            <FileText size={18} />
            <span className="mt-1 text-xs">BICP</span>
          </button>
        </div>

        {showAcreditari && (
          <div className="relative flex-1">
            <button
              onClick={() => {
                setMonitorizareOpen(false);
                setBicpOpen(false);
                setAcreditariOpen((value) => !value);
              }}
              className={`flex w-full flex-col items-center justify-center py-2 ${
                isGroupActive(pathname, SIDEBAR_GROUPS[1], isAdmin) ? "text-blue-700" : "text-gray-700"
              }`}
              aria-label="Acreditări"
            >
              <Users size={18} />
              <span className="mt-1 text-xs">Acreditări</span>
            </button>
          </div>
        )}

        {showMonitorizare && (
          <div className="relative flex-1">
            <button
              onClick={() => {
                setAcreditariOpen(false);
                setBicpOpen(false);
                setMonitorizareOpen((value) => !value);
              }}
              className={`flex w-full flex-col items-center justify-center py-2 ${
                isGroupActive(pathname, SIDEBAR_GROUPS[2], isAdmin) ? "text-blue-700" : "text-gray-700"
              }`}
              aria-label="Monitorizare"
            >
              <Newspaper size={18} />
              <span className="mt-1 text-xs">Monitorizare</span>
            </button>
          </div>
        )}

        {bottomItems.map((navItem) => item(navItem))}

        <button
          aria-label="Logout"
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center justify-center py-2 text-red-600"
        >
          <LogOut size={18} />
          <span className="mt-1 text-xs">Logout</span>
        </button>
      </nav>

      {bicpOpen && (
        <GroupModal
          title="BICP"
          items={BICP_ITEMS}
          onClose={() => setBicpOpen(false)}
          onNavigate={(href) => {
            setBicpOpen(false);
            router.push(href);
          }}
        />
      )}

      {monitorizareOpen && showMonitorizare && (
        <GroupModal
          title="Monitorizare"
          items={MONITORIZARE_ITEMS.filter((item) => canAccess(item, isAdmin))}
          onClose={() => setMonitorizareOpen(false)}
          onNavigate={(href) => {
            setMonitorizareOpen(false);
            router.push(href);
          }}
        />
      )}

      {acreditariOpen && showAcreditari && (
        <GroupModal
          title="Acreditări"
          items={ACREDITARI_ITEMS.filter((item) => canAccess(item, isAdmin))}
          onClose={() => setAcreditariOpen(false)}
          onNavigate={(href) => {
            setAcreditariOpen(false);
            router.push(href);
          }}
        />
      )}
    </>
  );
}

function GroupModal({
  title,
  items,
  onClose,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
        <div className="mb-2 text-center font-semibold text-gray-900">{title}</div>
        <div className="flex flex-col">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => onNavigate(item.href)}
                className="w-full rounded-lg px-4 py-3 text-left text-sm text-gray-800 transition-colors hover:bg-gray-50 inline-flex items-center gap-3"
              >
                <Icon size={16} /> {item.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-center">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}
