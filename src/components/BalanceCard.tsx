import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function BalanceCard({
  totalOwe,
  totalOwed,
}: {
  totalOwe: number;
  totalOwed: number;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Net balance logic as requested:
  // Net = Total amount I owe - Total amount owed to me
  // e.g. You owe 98.75, Owed to you 38.00 -> Net = 60.75 -> shown as -₹60.75 (negative)
  const net = totalOwe - totalOwed;
  const isNegative = net > 0.005;
  const isPositive = net < -0.005;

  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only tilt on devices with hover and fine pointers
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5
    setTilt({
      x: -py * 10, // max +/- 5 deg
      y: px * 6,   // max +/- 3 deg
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, active: false });
  };

  let displayAmount = "₹0.00";
  let statusText = "All settled up";
  let amountColor = "text-slate-900";
  let statusColor = "text-slate-500";
  let statusDot = "bg-slate-400";
  let cardTheme =
    "bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100/50 border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.1)]";
  let waveColor1 = "text-slate-300/40";
  let waveColor2 = "text-slate-400/30";
  let buttonTheme = "bg-white/95 text-slate-600 border-slate-200 hover:bg-slate-50";

  if (isNegative) {
    displayAmount = `-₹${net.toFixed(2)}`;
    statusText = "You owe";
    amountColor = "text-rose-600";
    statusColor = "text-rose-600";
    statusDot = "bg-rose-500";
    // Very light red/pink card background with hover shadow elevation
    cardTheme =
      "bg-gradient-to-br from-rose-50/90 via-pink-50/60 to-rose-100/40 border-rose-200/70 shadow-[0_2px_12px_rgba(244,63,94,0.06)] hover:shadow-[0_12px_28px_rgba(244,63,94,0.18)]";
    // Subtle red moving wave
    waveColor1 = "text-rose-400/40";
    waveColor2 = "text-pink-400/30";
    buttonTheme = "bg-white/95 text-rose-600 border-rose-200 hover:bg-rose-50";
  } else if (isPositive) {
    const posAmount = Math.abs(net);
    displayAmount = `+₹${posAmount.toFixed(2)}`;
    statusText = "You are owed";
    amountColor = "text-emerald-600";
    statusColor = "text-emerald-700";
    statusDot = "bg-emerald-500";
    // Very light green/mint card background with hover shadow elevation
    cardTheme =
      "bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-emerald-100/40 border-emerald-200/70 shadow-[0_2px_12px_rgba(16,185,129,0.06)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.18)]";
    // Subtle green moving wave
    waveColor1 = "text-emerald-400/40";
    waveColor2 = "text-teal-400/30";
    buttonTheme = "bg-white/95 text-emerald-700 border-emerald-200 hover:bg-emerald-50";
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: tilt.active
          ? `perspective(1200px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) translateZ(6px)`
          : "perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0)",
        transition: tilt.active
          ? "transform 0.12s cubic-bezier(0, 0, 0.2, 1), box-shadow 0.2s ease-out"
          : "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.5s ease-out",
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "group relative w-full h-[148px] rounded-3xl border overflow-hidden select-none will-change-transform animate-hero-flip",
        cardTheme,
      )}
    >
      {/* Top Right Swap Button: Fixed exact position across both states */}
      <button
        type="button"
        onClick={() => setShowBreakdown((prev) => !prev)}
        className={cn(
          "absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center border shadow-xs transition-all duration-200 active:scale-90 hover:scale-105",
          buttonTheme,
        )}
        aria-label={showBreakdown ? "Show current balance" : "Show balance breakdown"}
        title={showBreakdown ? "Show current balance" : "Show balance breakdown"}
      >
        <ArrowLeftRight
          className={cn(
            "w-4 h-4 stroke-[2.2] transition-transform duration-300",
            showBreakdown ? "rotate-180" : "",
          )}
        />
      </button>

      {/* State 1: Current Balance View */}
      <div
        className={cn(
          "absolute inset-0 p-5 flex flex-col justify-between transition-all duration-300 ease-out z-10",
          showBreakdown
            ? "-translate-x-full opacity-0 pointer-events-none scale-95"
            : "translate-x-0 opacity-100 scale-100",
        )}
      >
        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wide">
            Your current balance
          </p>
          <p
            className={cn(
              "mt-1.5 font-display text-3xl font-bold tracking-tight inline-block transition-transform duration-200 origin-left group-hover:scale-[1.02] group-hover:-translate-y-0.5",
              amountColor,
            )}
          >
            {displayAmount}
          </p>
        </div>
        <div>
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold", statusColor)}>
            <span className={cn("w-2 h-2 rounded-full", statusDot)} />
            {statusText}
          </span>
        </div>
      </div>

      {/* State 2: Breakdown View */}
      <div
        className={cn(
          "absolute inset-0 p-5 flex flex-col justify-between transition-all duration-300 ease-out z-10",
          showBreakdown
            ? "translate-x-0 opacity-100 scale-100"
            : "translate-x-full opacity-0 pointer-events-none scale-95",
        )}
      >
        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wide">
            Balance breakdown
          </p>
          <div className="mt-2 space-y-1.5 pr-12">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-500">You owe</span>
              <span className="font-display text-base sm:text-lg font-bold text-rose-600 inline-block transition-transform duration-200 origin-right group-hover:scale-[1.02]">
                ₹{totalOwe.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600">Owed to you</span>
              <span className="font-display text-base sm:text-lg font-bold text-emerald-600 inline-block transition-transform duration-200 origin-right group-hover:scale-[1.02]">
                ₹{totalOwed.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">Tap icon to return</p>
      </div>

      {/* Wave background — continuous left-to-right, color-coded by balance state */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden h-20 opacity-45 z-0">
        <div className="absolute bottom-0 left-0 w-full h-full flex overflow-hidden">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className={cn("w-[200%] min-w-[200%] h-16 animate-wave-flow shrink-0", waveColor1)}
            fill="currentColor"
          >
            <path d="M0,60 C150,20 300,90 450,40 C525,15 570,35 600,60 C750,20 900,90 1050,40 C1125,15 1170,35 1200,60 L1200,120 L0,120 Z" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-full flex overflow-hidden opacity-55">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className={cn("w-[200%] min-w-[200%] h-12 animate-wave-flow-slow shrink-0", waveColor2)}
            fill="currentColor"
          >
            <path d="M0,45 C150,75 300,15 450,65 C525,90 570,70 600,45 C750,75 900,15 1050,65 C1125,90 1170,70 1200,45 L1200,120 L0,120 Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
