import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createRadarHandler } from './handler.mjs'

Deno.serve(createRadarHandler({
  createClient,
  env: {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    RADAR_AGENT_TOKEN: Deno.env.get('RADAR_AGENT_TOKEN'),
    GEMINI_API_KEY: Deno.env.get('GEMINI_API_KEY'),
    GEMINI_MODEL: Deno.env.get('GEMINI_MODEL'),
  },
}))
