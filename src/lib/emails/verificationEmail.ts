import { Resend } from 'resend';

export interface AppProfile {
  name?: string;
  icon?: string;
  description?: string;
  url?: string;
}

export interface VerificationEmailParams {
  email: string;
  code: string;
  scopeName: string;
  appProfile?: AppProfile | null;
}

/**
 * Formats a 6-digit code with a hyphen (e.g., "158984" -> "158-984")
 */
function formatCodeWithHyphen(code: string): string {
  if (code.length !== 6) {
    return code;
  }
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Strips protocol, path, and query parameters from a URL, leaving just the domain
 * (e.g., "https://example.com/path?query=value" -> "example.com")
 */
function stripUrlToDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // If URL parsing fails, try to strip protocol manually
    return url
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\?.*$/, '');
  }
}

/**
 * Builds the HTML email template for verification emails
 */
export function buildVerificationEmailHTML(
  params: VerificationEmailParams
): string {
  const { code, scopeName, appProfile } = params;
  const formattedCode = formatCodeWithHyphen(code);

  // Get app name for title (default to scope name if no app profile)
  const appName = appProfile?.name || scopeName;

  // Prepare app icon at the top if appProfile is provided
  let appIconTop = '';
  if (appProfile?.icon) {
    appIconTop = `
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="${appProfile.icon}" alt="${appName}" style="width: 64px; height: 64px; border-radius: 12px; object-fit: cover; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);" />
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #E9D5FF 0%, #FFFFFF 100%); min-height: 100vh;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- White card container -->
        <div style="background: white; border-radius: 16px; padding: 48px 40px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          
          ${appIconTop}
          
          <!-- Header icon -->
          
          <!-- Title -->
          <div style="text-align: center; margin: 0 0 16px 0;">
            <p style="font-size: 28px; font-weight: 400; color: #111827; margin: 0; line-height: 1.2;">
              Sign in to
            </p>
            <p style="font-size: 28px; font-weight: 700; color: #111827; margin: 4px 0 0 0; line-height: 1.2;">
              ${appName}
            </p>
            ${
              appProfile?.url
                ? `
            <p style="font-size: 14px; color: #6B7280; margin: 8px 0 0 0; line-height: 1.4;">
              from <a href="${appProfile.url}" style="color: #3B82F6; text-decoration: none;">${stripUrlToDomain(appProfile.url)}</a>
            </p>
            `
                : ''
            }
          </div>
          
          <!-- Instructions -->
          <p style="font-size: 16px; line-height: 1.6; color: #374151; text-align: center; margin: 0 0 32px 0;">
            Paste this one-time password into the form on the application website to finish signing in. 
            
          </p>
          
          <!-- OTP Code -->
          <div style="text-align: center; margin: 32px 0;">
            <div style="background: white; border: 2px solid #9333EA; border-radius: 8px; padding: 24px 32px; display: inline-block;">
              <span style="font-size: 36px; font-weight: 700; color: #111827; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                ${formattedCode}
              </span>
            </div>
          </div>
          
          <!-- Expiration notice -->
          <p style="font-size: 14px; color: #6B7280; text-align: center; margin: 0 0 32px 0;">
            Please note that it will expire in 10 minutes.
          </p>
          
          <!-- Divider -->
          <div style="border-top: 1px solid #E5E7EB; margin: 32px 0;"></div>
          
          <!-- Digital identity information -->
          <p style="font-size: 14px; line-height: 1.6; color: #6B7280; margin: 0 0 32px 0;">
            By entering this code, you will create a new digital identity in the <strong>${scopeName}</strong> community (if you don't have one already).
            You can claim your keys in your account settings later, once the connection is complete. If you are an existing user, you know the drill!
          </p>
          
          <!-- Security footer -->
          <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #E5E7EB;">
            <div style="text-align: center; margin-bottom: 16px;">
              <span style="font-size: 14px; color: #374151; margin-right: 3px;">Powered by</span>
              <a href="https://openbunker.opencollective.xyz" style="color: #3B82F6; text-decoration: underline; font-size: 14px; font-weight: 500;">OpenBunker</a>
            </div>
            <p style="font-size: 12px; line-height: 1.5; color: #6B7280; text-align: center; margin: 0;">
              We use Nostr keys as identities to connect you to your application. By connecting via the Openbunker service you are creating a Nostr identity and connecting it to the application so the application is allowed to sign.
              activity using your keys. Your activity is stored by Nostr relays and your keys are stored securely in an Openbunker server, but you can claim them any time on OpenBunker.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Sends a verification email with a one-time password
 */
export async function sendVerificationEmail(
  params: VerificationEmailParams
): Promise<void> {
  // Initialize Resend
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { email, code, scopeName, appProfile } = params;

  const html = buildVerificationEmailHTML({
    email,
    code,
    scopeName,
    appProfile,
  });

  // Use app name for subject if available, otherwise use scope name
  const subjectAppName = appProfile?.name || scopeName;

  const { error } = await resend.emails.send({
    from: 'Openbunker <info@updates.qualiaworks.com>',
    to: [email],
    subject: `Sign in to ${subjectAppName}`,
    html,
  });

  if (error) {
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}
