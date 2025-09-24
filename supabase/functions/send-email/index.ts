// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { Resend } from 'npm:resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string).replace(
  'v1,whsec_',
  ''
);

Deno.serve(async req => {
  console.log('Request received', req);
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);
  try {
    console.log('Verifying...');
    const { user, email_data } = wh.verify(payload, headers) as {
      user: {
        email: string;
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
        token_new: string;
        token_hash_new: string;
      };
    };
    console.log('email_data', {
      site_url: email_data.site_url,
      redirect_to: email_data.redirect_to,
      email_action_type: email_data.email_action_type,
    });

    // Determine if this is sign up or sign in based on email action type
    const isSignUp = email_data.email_action_type === 'signup';
    const actionText = isSignUp ? 'Sign up' : 'Sign in';
    const welcomeMessage = isSignUp
      ? 'Welcome to Openbunker! (You are creating an openbunker account.)'
      : 'Welcome back to Openbunker!';

    // Create magic link
    const magicLink = `${email_data.site_url}${email_data.redirect_to}?token=${email_data.token}&type=${email_data.email_action_type}`;

    const { error } = await resend.emails.send({
      from: 'Openbunker <onboarding@resend.dev>',
      to: [user.email],
      subject: `${actionText}: Welcome to Openbunker!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Welcome to Openbunker!</h1>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; color: #555; margin: 0 0 15px 0;">
              ${welcomeMessage}
            </p>
            
            <p style="font-size: 14px; color: #666; margin: 0 0 20px 0;">
              To confirm your account, use the following code:
            </p>
            
            <div style="background-color: #fff; border: 2px solid #e9ecef; border-radius: 6px; padding: 15px; text-align: center; margin: 15px 0;">
              <span style="font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 3px; font-family: monospace;">
                ${email_data.token}
              </span>
            </div>
            
            <p style="font-size: 14px; color: #666; margin: 20px 0 10px 0;">
              Or click on the Magic link below:
            </p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="${magicLink}" 
                 style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Confirm Account
              </a>
            </div>
          </div>
          
          <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px;">
            If you didn't request this ${isSignUp ? 'account creation' : 'sign in'}, please ignore this email.
          </p>
        </div>
      `,
      text: `${welcomeMessage}\n\nTo confirm your account, use the following code: ${email_data.token}\n\nOr click on the Magic link below:\n${magicLink}\n\nIf you didn't request this ${isSignUp ? 'account creation' : 'sign in'}, please ignore this email.`,
    });
    if (error) {
      throw error;
    }
    console.log('Email sent');
  } catch (error) {
    console.error('Error sending email', error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code,
          message: error.message,
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', 'application/json');
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: responseHeaders,
  });
});
