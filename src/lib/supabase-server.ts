import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file'
    )
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

/**
 * Set the current user's npub for Row Level Security policies
 * This must be called before any database queries to ensure users can only access their own data
 */
export async function setUserContext(npub: string) {
  const supabase = await createServerSupabaseClient();
  
  // Set the user context for RLS policies
  await supabase.rpc('set_user_npub', { user_npub: npub });
}

/**
 * Get the current user's npub from the database context
 */
export async function getCurrentUserNpub(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase.rpc('get_current_user_npub');
  
  if (error) {
    console.error('Error getting current user npub:', error);
    return null;
  }
  
  return data;
} 