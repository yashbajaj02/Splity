import { cn } from "@/lib/utils";

export function AppLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Splity"
      className={cn("rounded-xl object-cover", className)}
    />
  );
}
