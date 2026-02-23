# IMPORTANT: Edge Function Configuration

## JWT Verification Disabled

The file `/supabase/functions/config.toml` has been configured with:

```toml
verify_jwt = false
```

This disables automatic JWT verification by Supabase Edge Functions, allowing our custom authentication logic to handle token validation.

## ⚠️ ACTION REQUIRED

**YOU MUST REDEPLOY THE EDGE FUNCTION FOR THIS CHANGE TO TAKE EFFECT:**

### Option 1: Using Supabase CLI (Recommended)

```bash
cd supabase/functions
supabase functions deploy make-server-02205af0
```

### Option 2: Using the Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Find the `make-server-02205af0` function
4. Click **Deploy** or **Redeploy**

### Option 3: Delete and recreate the function

If redeployment doesn't work:
1. Delete the existing function from the Supabase Dashboard
2. Deploy a new one using the Supabase CLI or Dashboard

## Verification

After redeploying, test the authentication by:
1. Logging in to the application
2. Navigating to Settings → Users
3. The user list should load without "Invalid JWT" errors

## Why This Is Needed

Supabase Edge Functions automatically verify JWT tokens before they reach your code. Since we're using custom authentication with our own token verification in `/supabase/functions/server/auth.tsx`, we need to disable this automatic verification to prevent false rejections.

## Troubleshooting

If you still see "Invalid JWT" errors after redeploying:

1. Check the Edge Function logs in the Supabase Dashboard
2. Verify the config.toml file exists at `/supabase/functions/config.toml`
3. Ensure the function was actually redeployed (check deployment timestamp)
4. Clear browser localStorage and login again
