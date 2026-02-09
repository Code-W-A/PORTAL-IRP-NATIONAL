import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

const Command = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-md border border-gray-200 bg-white text-gray-900", className)}
      {...props}
    />
  )
);
Command.displayName = "Command";

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b border-gray-200 px-3">
    <Search className="mr-2 h-4 w-4 text-gray-500" />
    <input
      ref={ref}
      className={cn(
        "h-10 w-full bg-transparent text-sm outline-none placeholder:text-gray-400",
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

const CommandList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("max-h-[320px] overflow-auto p-1", className)} {...props} />
  )
);
CommandList.displayName = "CommandList";

const CommandEmpty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-3 text-sm text-gray-500", className)} {...props} />
  )
);
CommandEmpty.displayName = "CommandEmpty";

type CommandItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

const CommandItem = React.forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100",
        active && "bg-blue-50 text-blue-700",
        className
      )}
      {...props}
    />
  )
);
CommandItem.displayName = "CommandItem";

export { Command, CommandInput, CommandList, CommandItem, CommandEmpty };
