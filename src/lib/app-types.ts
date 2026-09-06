export type MemberStatus = "pending" | "accepted";
export type NotificationType =
  | "group_invite"
  | "settlement_request"
  | "settlement_confirmed"
  | "expense_added"
  | "friend_request";
export type NotificationStatus = "pending" | "accepted" | "declined" | "read";

export type FriendRequestStatus = "none" | "pending_sent" | "pending_received" | "friends";

export interface FriendRequest {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
  /** Joined profile of the friend (friend_id side) */
  profile?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface UserSearchResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

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
  avatar_url?: string | null;
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
  note?: string | null;
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

export interface PairwiseDebt {
  from: string;
  to: string;
  amount: number;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  message_text: string;
  mentioned_user_id?: string | null;
  mentioned_all: boolean;
  is_edited: boolean;
  edited_at?: string | null;
  created_at: string;
  expires_at: string;
}

