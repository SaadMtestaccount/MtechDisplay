import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Down-level the Supabase client to the .browserslistrc targets: node_modules are not
  // transpiled by default and old TV browsers (LG webOS, Tizen) choke on newer syntax
  // (docs/CONTRACTS.md §20).
  transpilePackages: [
    "@supabase/supabase-js",
    "@supabase/ssr",
    "@supabase/realtime-js",
    "@supabase/postgrest-js",
    "@supabase/storage-js",
    "@supabase/auth-js",
    "@supabase/functions-js",
  ],
};

export default nextConfig;
