import { supabase } from './supabase';

const USER_ID = '4daf3a38-2ab6-42f4-82f1-de5a2483794d';

export type NamingTemplates = {
  default?: string;
  publishers?: Record<string, string>;
};

export type UserSettings = {
  naming_templates: NamingTemplates;
};

let cache: UserSettings | null = null;

export async function fetchSettings(): Promise<UserSettings> {
  if (cache) return cache;
  const { data, error } = await supabase
    .from('user_settings')
    .select('naming_templates')
    .eq('user_id', USER_ID)
    .maybeSingle();
  if (error) throw error;
  cache = data
    ? { naming_templates: data.naming_templates as NamingTemplates }
    : { naming_templates: {} };
  return cache;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: USER_ID, naming_templates: settings.naming_templates });
  if (error) throw error;
  cache = settings;
}

export async function fetchPublisherNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('tracks')
    .select('publisher')
    .not('publisher', 'is', null);
  if (error) throw error;
  const names = (data as { publisher: string }[]).map((r) => r.publisher);
  return [...new Set(names)].sort();
}
