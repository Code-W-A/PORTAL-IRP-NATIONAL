"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, List, CalendarDays, LogOut, BarChart3, ChevronDown, Users, Newspaper, FileText, Settings } from "lucide-react";
import { signOut } from "firebase/auth";
import { initFirebase } from "@/lib/firebase";
import { useState, useRef, useEffect } from "react";

// Dropdown component
function NavDropdown({ 
  label, 
  icon, 
  items, 
  isActive 
}: { 
  label: string; 
  icon: React.ReactNode; 
  items: { href: string; label: string; icon: React.ReactNode }[]; 
  isActive: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 h-14 inline-flex items-center border-b-2 transition-colors gap-1 ${
          isActive
            ? "text-blue-700 border-blue-600 font-medium"
            : "text-gray-900 border-transparent hover:text-blue-700 hover:border-blue-200"
        }`}
      >
        {icon}
        <span className="ml-1">{label}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-700 transition-colors"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { auth } = initFirebase();

  async function handleLogout() {
    try {
      localStorage.removeItem("bicpViewMode");
      await signOut(auth);
      router.replace("/login");
    } catch (e) {
      console.error(e);
    }
  }

  const linkCls = (href: string) => {
    const isActive = pathname === href;
    return [
      "px-3 h-14 inline-flex items-center border-b-2 transition-colors",
      isActive
        ? "text-blue-700 border-blue-600 font-medium"
        : "text-gray-900 border-transparent hover:text-blue-700 hover:border-blue-200",
    ].join(" ");
  };

  // Grupăm linkurile logic
  const bicpItems = [
    { href: "/creaza-BICP", label: "Crează BICP", icon: <Plus size={16} /> },
    { href: "/lista-BICP", label: "Lista BICP", icon: <List size={16} /> },
    { href: "/statistici-BICP", label: "Statistici BICP", icon: <BarChart3 size={16} /> },
  ];

  const acreditariItems = [
    { href: "/acreditari/creaza", label: "Generează acreditare", icon: <Plus size={16} /> },
    { href: "/acreditari/lista", label: "Lista acreditări", icon: <FileText size={16} /> },
    { href: "/acreditari/jurnalisti", label: "Jurnaliști acreditați", icon: <Users size={16} /> },
  ];

  const monitorizareItems = [
    { href: "/monitorizare/creaza", label: "Adaugă material", icon: <Plus size={16} /> },
    { href: "/monitorizare/lista", label: "Lista materiale", icon: <List size={16} /> },
    { href: "/monitorizare/statistici", label: "Statistici", icon: <BarChart3 size={16} /> },
    { href: "/monitorizare/revista", label: "Revista presei", icon: <FileText size={16} /> },
  ];

  // Verificăm care secțiune este activă
  const isBicpActive = pathname.includes("BICP") || pathname === "/";
  const isAcreditariActive = pathname.startsWith("/acreditari");
  const isMonitorizareActive = pathname.startsWith("/monitorizare");

  return (
    <nav className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 flex items-center">
        <Link href="/lista-BICP" className="mr-4 inline-flex items-center text-gray-900 font-semibold tracking-tight">
          <img src="/logo-aplicatie/sigla-aplicatie-svg.svg" alt="IRP" className="h-6 w-6 mr-2" />
          Portal IRP
        </Link>
        
        <div className="hidden md:flex items-stretch gap-2">
          {/* Dropdown pentru BICP */}
          <NavDropdown 
            label="BICP" 
            icon={<FileText size={18} />}
            items={bicpItems}
            isActive={isBicpActive}
          />

          {/* Dropdown pentru Acreditări */}
          {/* <NavDropdown 
            label="Acreditări" 
            icon={<Users size={18} />}
            items={acreditariItems}
            isActive={isAcreditariActive}
          /> */}

          {/* Dropdown pentru Monitorizare */}
          {/* <NavDropdown 
            label="Monitorizare" 
            icon={<Newspaper size={18} />}
            items={monitorizareItems}
            isActive={isMonitorizareActive}
          /> */}

          {/* Setări - link direct */}
          <Link className={linkCls("/setari-structura")} href="/setari-structura">
            <Settings size={18} className="mr-1" /> Setări
          </Link>
        </div>
        
        <div className="flex-1" />
        <button aria-label="Logout" onClick={handleLogout} className="h-9 px-3 rounded-md border border-gray-200 text-gray-900 hover:bg-gray-100 inline-flex items-center">
          <LogOut size={18} />
          <span className="ml-2 hidden sm:inline">Logout</span>
        </button>
      </div>
    </nav>
  );
}

export function BottomNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { auth } = initFirebase();
  const [bicpOpen, setBicpOpen] = useState(false);

  async function handleLogout() {
    try {
      localStorage.removeItem("bicpViewMode");
      await signOut(auth);
      router.replace("/login");
    } catch (e) {
      console.error(e);
    }
  }

  const item = (href: string, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => router.push(href)}
      className={`flex flex-col items-center justify-center flex-1 py-2 ${
        pathname === href || pathname.startsWith(href.split('/')[1] ? `/${href.split('/')[1]}` : href)
          ? "text-blue-700" 
          : "text-gray-700"
      }`}
      aria-label={label}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );

  return (
    <>
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white h-16 md:hidden flex z-40">
      <div className="relative flex-1">
        <button
          onClick={() => setBicpOpen((v) => !v)}
          className={`flex flex-col items-center justify-center w-full py-2 ${
            pathname.startsWith("/lista-BICP") || pathname.startsWith("/creaza-BICP") || pathname.startsWith("/statistici-BICP")
              ? "text-blue-700"
              : "text-gray-700"
          }`}
          aria-label="BICP"
        >
          <FileText size={18} />
          <span className="text-xs mt-1">BICP</span>
        </button>
        {/* Modal handled outside of nav */}
      </div>
      {/* {item("/acreditari/lista", "Acreditări", <Users size={18} />)} */}
      {/* {item("/monitorizare/lista", "Monitorizare", <Newspaper size={18} />)} */}
      {item("/setari-structura", "Setări", <Settings size={18} />)}
      <button aria-label="Logout" onClick={handleLogout} className="flex flex-col items-center justify-center flex-1 py-2 text-red-600">
        <LogOut size={18} />
        <span className="text-xs mt-1">Logout</span>
      </button>
    </nav>
    {bicpOpen && (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" onClick={() => setBicpOpen(false)} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
          <div className="text-center mb-2 font-semibold text-gray-900">BICP</div>
          <div className="flex flex-col">
            <button
              onClick={() => { setBicpOpen(false); router.push("/creaza-BICP"); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 rounded-lg"
            >
              <Plus size={16} /> Crează BICP
            </button>
            <button
              onClick={() => { setBicpOpen(false); router.push("/lista-BICP"); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 rounded-lg"
            >
              <List size={16} /> Lista BICP
            </button>
            <button
              onClick={() => { setBicpOpen(false); router.push("/statistici-BICP"); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 rounded-lg"
            >
              <BarChart3 size={16} /> Statistici BICP
            </button>
          </div>
          <div className="mt-2 text-center">
            <button onClick={() => setBicpOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">Închide</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}


