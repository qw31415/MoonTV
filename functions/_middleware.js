
// File: /functions/_middleware.js

/**
 * Miko's Password Protection Middleware for Cloudflare Pages
 *
 * This function intercepts every request to your site.
 * It checks for a password provided in the 'Authorization' header.
 *
 * How to use:
 * 1. Send a request with the header: `Authorization: Bearer YOUR_PASSWORD`
 * 2. The passwords 'ADMIN_PASSWORD' and 'VALID_KEYS' must be set in your
 *    Cloudflare Pages project's Environment Variables.
 */
export const onRequest = async ({ request, next, env }) => {
  // --- Password Configuration ---
  // Passwords are read from your project's environment variables for security.
  // ADMIN_PASSWORD: The password for the admin user. e.g., "Miko@MoonTV#2025!"
  // VALID_KEYS: A comma-separated string of other valid passwords. e.g., "fyqnb,10593"
  const adminPassword = env.ADMIN_PASSWORD;
  const validKeysEnv = env.VALID_KEYS;

  // --- Security Check ---
  // If the environment variables are not set, block access to prevent the site
  // from being accidentally exposed without protection.
  if (!adminPassword || !validKeysEnv) {
    return new Response('Configuration Error: Server passwords not set.', { status: 500 });
  }

  // Prepare the list of valid keys by splitting the string and trimming whitespace.
  const validKeys = validKeysEnv.split(',').map(key => key.trim());

  // --- Authorization Logic ---
  // Get the 'Authorization' header from the user's request.
  const authorization = request.headers.get('Authorization');

  // Check if the header exists and starts with "Bearer ".
  if (authorization && authorization.startsWith('Bearer ')) {
    // Extract the password from the header.
    const providedKey = authorization.substring(7);

    // Check if the provided password is the admin password OR is in the list of valid keys.
    if (providedKey === adminPassword || validKeys.includes(providedKey)) {
      // If the password is correct, proceed to show the actual page.
      console.log('Access granted.');
      return next();
    }
  }

  // --- Access Denied ---
  // If no valid password was provided, return a 401 Unauthorized response.
  // This will prevent the user from seeing the site content.
  const unauthorizedHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>401 Unauthorized</title>
      <style>
        body { background-color: #1a1a1a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { text-align: center; padding: 40px; border-radius: 8px; background-color: #2a2a2a; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); }
        h1 { color: #ff4d4d; margin-top: 0; }
        p { color: #b0b0b0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>401 Unauthorized</h1>
        <p>A valid password is required to access this resource.</p>
      </div>
    </body>
    </html>
  `;

  return new Response(unauthorizedHtml, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Bearer realm="Restricted Area"',
      'Content-Type': 'text/html',
    },
  });
};
