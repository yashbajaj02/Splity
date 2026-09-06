import { Utensils, Zap, ShoppingBag, Car, Film, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExpenseCategory =
  | "food"
  | "utilities"
  | "shopping"
  | "transport"
  | "entertainment"
  | "other";

export const CATEGORY_CONFIG: Record<
  ExpenseCategory,
  { icon: React.ElementType; bg: string; text: string; label: string }
> = {
  food:          { icon: Utensils,    bg: "bg-orange-100", text: "text-orange-600", label: "Food & Dining" },
  utilities:     { icon: Zap,         bg: "bg-violet-100", text: "text-violet-600", label: "Utilities" },
  shopping:      { icon: ShoppingBag, bg: "bg-pink-100",   text: "text-pink-600",   label: "Shopping" },
  transport:     { icon: Car,         bg: "bg-sky-100",    text: "text-sky-600",    label: "Transport" },
  entertainment: { icon: Film,        bg: "bg-purple-100", text: "text-purple-600", label: "Entertainment" },
  other:         { icon: Package,     bg: "bg-gray-100",   text: "text-gray-500",   label: "Other" },
};

export function getExpenseCategory(description: string): ExpenseCategory {
  const d = description.toLowerCase();
  if (
    d.includes("food") || d.includes("pizza") || d.includes("burger") ||
    d.includes("dinner") || d.includes("lunch") || d.includes("breakfast") ||
    d.includes("cafe") || d.includes("restaurant") || d.includes("snack") ||
    d.includes("meal") || d.includes("coffee") || d.includes("tea") ||
    d.includes("chai") || d.includes("starbucks") || d.includes("swiggy") ||
    d.includes("zomato") || d.includes("dahi") || d.includes("biryani") ||
    d.includes("rice") || d.includes("roti") || d.includes("dal") ||
    d.includes("jeera") || d.includes("masala")
  ) return "food";
  if (
    d.includes("bill") || d.includes("wifi") || d.includes("electricity") ||
    d.includes("power") || d.includes("water") || d.includes("recharge") ||
    d.includes("utility") || d.includes("gas") || d.includes("rent") ||
    d.includes("maintenance") || d.includes("internet") || d.includes("broadband") ||
    d.includes("tide") || d.includes("ariel")
  ) return "utilities";
  if (
    d.includes("shopping") || d.includes("grocery") || d.includes("groceries") ||
    d.includes("supermarket") || d.includes("market") || d.includes("store") ||
    d.includes("clothes") || d.includes("amazon") || d.includes("blinkit") ||
    d.includes("zepto") || d.includes("milk") || d.includes("instamart") ||
    d.includes("bigbasket") || d.includes("dmart")
  ) return "shopping";
  if (
    d.includes("cab") || d.includes("uber") || d.includes("ola") ||
    d.includes("auto") || d.includes("taxi") || d.includes("metro") ||
    d.includes("train") || d.includes("flight") || d.includes("fuel") ||
    d.includes("petrol") || d.includes("diesel") || d.includes("travel") ||
    d.includes("bus") || d.includes("rapido")
  ) return "transport";
  if (
    d.includes("movie") || d.includes("cinema") || d.includes("theatre") ||
    d.includes("show") || d.includes("netflix") || d.includes("game") ||
    d.includes("party") || d.includes("pub") || d.includes("club") ||
    d.includes("beer") || d.includes("drink") || d.includes("event") ||
    d.includes("concert") || d.includes("bookmyshow")
  ) return "entertainment";
  return "other";
}

const SIZE_CONFIG = {
  xs: { container: "w-8 h-8 rounded-xl",   icon: "w-3.5 h-3.5" },
  sm: { container: "w-9 h-9 rounded-xl",   icon: "w-4 h-4"     },
  md: { container: "w-10 h-10 rounded-2xl", icon: "w-5 h-5" },
  lg: { container: "w-12 h-12 rounded-2xl", icon: "w-6 h-6"     },
  xl: { container: "w-14 h-14 rounded-3xl", icon: "w-7 h-7"     },
};

interface CategoryIconProps {
  description: string;
  size?: keyof typeof SIZE_CONFIG;
  className?: string;
}

export function CategoryIcon({ description, size = "md", className }: CategoryIconProps) {
  const category = getExpenseCategory(description);
  const config = CATEGORY_CONFIG[category];
  const sizeConf = SIZE_CONFIG[size];
  const Icon = config.icon;
  return (
    <div className={cn("flex items-center justify-center shrink-0", sizeConf.container, config.bg, className)}>
      <Icon className={cn("stroke-[2.2]", sizeConf.icon, config.text)} />
    </div>
  );
}
