export type StatusId =
  | 'briefed'
  | 'writing'
  | 'written'
  | 'revising'
  | 'needs_rev'
  | 'revised'
  | 'need_to_deliver'
  | 'approved'
  | 'delivered'
  | 'holding'
  | 'rejected';

export type InvoiceStatus = 'unpaid' | 'invoiced' | 'paid';

export type ActivityEventKind =
  | 'created'
  | 'status_change'
  | 'email_matched'
  | 'invoice_change'
  | 'note';

export type ActivityEvent = {
  at: string;
  kind: ActivityEventKind;
  from?: string;
  to?: string;
  source?: 'user' | 'email' | 'ai';
  detail?: string;
};

export type Track = {
  id: string;
  created_at: string;
  code: string | null;
  title: string;
  album: string | null;
  version: string;
  status: StatusId;
  invoice: InvoiceStatus;
  due_date: string | null;
  publisher: string | null;
  publisher_email: string | null;
  fee: number | null;
  brief_link: string | null;
  folder_path: string | null;
  brief_parsed_at: string | null;
  file_naming: string | null;
  collaborators: string[];
  notes: string | null;
  activity: ActivityEvent[];
};

export type NewTrack = Omit<Track, 'id' | 'created_at' | 'activity'> & {
  activity?: ActivityEvent[];
};

export type InboxItemState = 'pending' | 'approved' | 'dismissed';

export type InboxItem = {
  id: string;
  user_id: string;
  track_id: string | null;
  raw_email: string;
  sender: string;
  subject: string;
  excerpt: string;
  proposed_status: StatusId | null;
  current_status: StatusId | null;
  state: InboxItemState;
  created_at: string;
  resolved_at: string | null;
};
