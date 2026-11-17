import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  rootRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu components must be used inside DropdownMenu.");
  }
  return context;
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      if (contentRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, rootRef, contentRef }}>
      <div ref={rootRef} className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

type DropdownMenuTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children: React.ReactNode;
};

function DropdownMenuTrigger({ asChild = false, children, ...props }: DropdownMenuTriggerProps) {
  const { open, setOpen } = useDropdownMenuContext();
  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(event);
    if (!event.defaultPrevented) setOpen((current) => !current);
  };

  if (asChild) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ...props,
      onClick,
      "aria-expanded": open,
    });
  }

  return (
    <button type="button" {...props} onClick={onClick} aria-expanded={open}>
      {children}
    </button>
  );
}

type DropdownMenuContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end";
  portal?: boolean;
};

function DropdownMenuContent({ className, align = "end", portal = false, style, ...props }: DropdownMenuContentProps) {
  const { open, rootRef, contentRef } = useDropdownMenuContext();
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  React.useLayoutEffect(() => {
    if (!open || !portal) return;
    const reposition = () => {
      const anchor = rootRef.current?.getBoundingClientRect();
      const menu = contentRef.current?.getBoundingClientRect();
      if (!anchor || !menu) return;
      const below = anchor.bottom + 8;
      const above = anchor.top - menu.height - 8;
      const top = below + menu.height <= window.innerHeight - 8 ? below
        : above >= 8 ? above : Math.max(8, window.innerHeight - menu.height - 8);
      const preferredLeft = align === "end" ? anchor.right - menu.width : anchor.left;
      setPosition({ top, left: Math.max(8, Math.min(preferredLeft, window.innerWidth - menu.width - 8)) });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, portal, align, rootRef, contentRef]);
  if (!open) return null;
  const content = (
    <div
      ref={contentRef}
      className={cn(
        "z-50 min-w-[180px] rounded-md border border-gray-200 bg-white p-1 shadow-lg",
        portal ? "fixed" : `absolute mt-2 ${align === "end" ? "right-0" : "left-0"}`,
        className
      )}
      style={portal ? { ...style, ...position, maxWidth: "calc(100vw - 16px)" } : style}
      {...props}
    />
  );
  return portal ? createPortal(content, document.body) : content;
}

function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-2 py-1.5 text-xs font-semibold text-gray-500", className)} {...props} />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("my-1 h-px bg-gray-200", className)} {...props} />;
}

type DropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  inset?: boolean;
};

function DropdownMenuItem({ className, inset, onClick, ...props }: DropdownMenuItemProps) {
  const { setOpen } = useDropdownMenuContext();
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-sm px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100",
        inset && "pl-8",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
};
