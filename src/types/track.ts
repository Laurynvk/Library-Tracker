export interface Track {
  id: string
  created_at: string
  title: string
  publisher: string | null
  fee: number | null
  due_date: string | null
  status: string
  invoice_status: string
  project_code: string | null
  folder_name: string | null
  notes: string | null
  source_url: string | null
  brief_parsed_at: string | null
}
