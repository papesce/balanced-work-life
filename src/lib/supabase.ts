import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookieOptions: {
      sameSite: "lax",
      path: "/",
      maxAge: 400 * 24 * 60 * 60,
    },
    auth: {
      lock: async (name, acquireTimeout, fn) => await fn(),
    },
  },
);
