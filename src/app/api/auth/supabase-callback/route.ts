import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session?.user) {
      const user = data.session.user
      
      // Try to find existing key in database by email
      const existingKey = await prisma.keys.findFirst({
        where: {
          email: user.email
        }
      })

      if (existingKey) {
        // Redirect to login page with the secret key
        const loginUrl = `${origin}/login?secret_key=${encodeURIComponent(existingKey.npub)}`
        return NextResponse.redirect(loginUrl)
      } else {
        // If no key found, redirect to error page
        return NextResponse.redirect(`${origin}/login?error=no_key_found`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
} 