export type MemberStatus = "pending" | "accepted";
export type NotificationType =
  | "group_invite"
  | "settlement_request"
  | "settlement_confirmed"
  | "expense_added";
export type NotificationStatus = "pending" | "accepted" | "declined" | "read";

export interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  upi_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  status: MemberStatus;
  role: string;
  invited_by: string | null;
  joined_at: string;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  created_by: string;
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  type: NotificationType;
  status: NotificationStatus;
  group_id: string | null;
  amount: number | null;
  message: string | null;
  sender_username: string | null;
  sender_upi: string | null;
  created_at: string;
}
