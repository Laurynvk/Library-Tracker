import { supabase } from './supabase';

const USER_ID = '4daf3a38-2ab6-42f4-82f1-de5a2483794d';

export type NamingTemplates = {
  default?: string;
  publishers?: Record<string, string>;
};

export type Preferences = {
  initials?: string;
  default_version?: string;
  dark_mode?: boolean;
};

export type UserSettings = {
  naming_templates: NamingTemplates;
  initials?: string;
  default_version?: string;
  dark_mode?: boolean;
};

let cache: UserSettings | null = null;

export async function fetchSettings(): Promise<UserSettings> {
  if (cache) return cache;
  const { data, error } = await supabase
    .from('user_settings')
    .select('naming_templates, preferences')
    .eq('user_id', USER_ID)
    .maybeSingle();
  if (error) throw error;
  const prefs = (data?.preferences ?? {}) as Preferences;
  cache = data
    ? {
        naming_templates: data.naming_templates as NamingTemplates,
        ...prefs,
      }
    : { naming_templates: {} };
  return cache;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const { naming_templates, initials, default_version, dark_mode } = settings;
  const preferences: Preferences = {};
  if (initials !== undefined) preferences.initials = initials;
  if (default_version !== undefined) preferences.default_version = default_version;
  if (dark_mode !== undefined) preferences.dark_mode = dark_mode;

  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: USER_ID, naming_templates, preferences });
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
