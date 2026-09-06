import { format } from "date-fns";
import { X, Clock, User, Calendar, Receipt, Building2, ChevronRight } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { parseExpenseDescription } from "@/lib/api";
import type { Expense, ExpenseSplit } from "@/lib/app-types";
import { CategoryIcon, getExpenseCategory, CATEGORY_CONFIG } from "@/components/CategoryIcon";
import { useQuery } from "@tanstack/react-query";
import { getProfilesByIds, getSplitsForGroup, getGroup } from "@/lib/api";
import { getInitials, cn } from "@/lib/utils";

interface ExpenseDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  currentUserId: string;
  creatorDisplayName?: string;
  initialSplits?: ExpenseSplit[];
  groupName?: string;
}

export function ExpenseDetailsSheet({
  open,
  onOpenChange,
  expense,
  currentUserId,
  creatorDisplayName,
  initialSplits,
  groupName: propGroupName,
}: ExpenseDetailsSheetProps) {
  const { data } = useQuery({
    queryKey: ["expense-sheet-details", expense?.id],
    enabled: open && !!expense,
    queryFn: async () => {
      if (!expense) return null;

      let splits = initialSplits;
      if (!splits || splits.length === 0) {
        const allSplits = await getSplitsForGroup(expense.group_id);
        splits = allSplits.filter((s) => s.expense_id === expense.id);
      }

      let groupName = propGroupName;
      if (!groupName) {
        const group = await getGroup(expense.group_id);
        groupName = group?.name ?? "Group";
      }

      const memberIds = Array.from(
        new Set([expense.paid_by, expense.created_by, ...splits.map((s) => s.user_id)])
      );

      const profiles = await getProfilesByIds(memberIds);
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      return { splits, profileMap, groupName };
    },
  });

  if (!expense) return null;

  const splits = data?.splits ?? initialSplits ?? [];
  const profileMap = data?.profileMap ?? new Map();
  const groupName = data?.groupName ?? propGroupName ?? "Group";

  const { cleanDescription } = parseExpenseDescription(expense.description);
  const categoryKey = getExpenseCategory(cleanDescription);
  const categoryInfo = CATEGORY_CONFIG[categoryKey] || CATEGORY_CONFIG.other;
  const CategoryIconComp = categoryInfo.icon;

  // Paid by info
  const paidByProfile = profileMap.get(expense.paid_by);
  let paidByName = "User";
  if (expense.paid_by === currentUserId) {
    paidByName = "You";
  } else if (paidByProfile?.full_name?.trim()) {
    paidByName = paidByProfile.full_name.trim();
  } else if (paidByProfile?.username?.trim()) {
    paidByName = paidByProfile.username.trim().replace(/^@/, "");
  } else if (creatorDisplayName && expense.paid_by === expense.created_by) {
    paidByName = creatorDisplayName;
  }

  // Your share
  let yourShare = 0;
  const selfSplit = splits.find((s) => s.user_id === currentUserId);
  if (selfSplit) {
    yourShare = Number(selfSplit.amount_owed);
  } else if (expense.paid_by === currentUserId) {
    const othersOwed = splits
      .filter((s) => s.user_id !== currentUserId)
      .reduce((sum, s) => sum + Number(s.amount_owed), 0);
    yourShare = Math.max(0, Number(expense.amount) - othersOwed);
  }

  const expenseDate = new Date(expense.created_at);
  const formattedDate = !isNaN(expenseDate.getTime())
    ? format(expenseDate, "dd MMM yyyy • h:mm a")
    : "";

  const userPaid = expense.paid_by === currentUserId;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-white px-0 rounded-t-3xl border-t border-slate-100 max-h-[85vh]">
        <div className="px-5 pt-5 pb-4 flex items-start justify-between border-b border-slate-100/60 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <CategoryIcon description={cleanDescription} size="md" />
            <div className="flex flex-col items-start gap-0.5">
              <DrawerTitle className="font-display text-lg font-bold text-slate-900 text-left">
                {cleanDescription}
              </DrawerTitle>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {formattedDate}
              </span>
            </div>
          </div>
          <DrawerClose className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors shrink-0 shadow-sm active:scale-95">
            <X className="w-4 h-4 stroke-[2.5]" />
          </DrawerClose>
        </div>

        <div className="px-5 py-6 space-y-6 overflow-y-auto scrollbar-hide pb-10">
          {/* Amount */}
          <div className="flex flex-col items-start justify-center pb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Total Amount
            </span>
            <span className={cn(
              "font-display text-4xl font-bold tracking-tight",
              userPaid ? "text-emerald-600" : "text-slate-900"
            )}>
              ₹{Number(expense.amount).toFixed(2)}
            </span>
          </div>

          <div className="h-px w-full bg-slate-100" />

          {/* Core Details (Minimal Grid) */}
          <div className="space-y-4">
            {/* Paid By */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Paid by</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[9px] flex items-center justify-center shadow-xs">
                  {getInitials(paidByName)}
                </div>
                <span className="text-sm font-bold text-slate-900">{paidByName}</span>
              </div>
            </div>
            
            <div className="h-px w-full bg-slate-50" />

            {/* Your Share */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Your share</span>
              <span className="text-sm font-bold text-emerald-600">
                ₹{yourShare.toFixed(2)}
              </span>
            </div>

            <div className="h-px w-full bg-slate-50" />

            {/* Category */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Category</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">
                <CategoryIconComp className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-xs font-semibold text-slate-700">{categoryInfo.label}</span>
              </div>
            </div>

            <div className="h-px w-full bg-slate-50" />

            {/* Group */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Group</span>
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">{groupName}</span>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-slate-100" />

          {/* Split Breakdown */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
              Split Details
            </span>
            <div className="space-y-2.5 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              {splits.map((s) => {
                const isMe = s.user_id === currentUserId;
                const p = profileMap.get(s.user_id);
                let name = "User";
                if (isMe) name = "You";
                else if (p?.full_name?.trim()) name = p.full_name.trim();
                else if (p?.username?.trim()) name = p.username.trim().replace(/^@/, "");

                return (
                  <div key={s.user_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-bold text-[8px] flex items-center justify-center shrink-0">
                        {getInitials(name)}
                      </div>
                      <span className={cn(
                        "text-sm",
                        isMe ? "font-bold text-slate-900" : "font-medium text-slate-600"
                      )}>
                        {name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-700">
                      ₹{Number(s.amount_owed).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
