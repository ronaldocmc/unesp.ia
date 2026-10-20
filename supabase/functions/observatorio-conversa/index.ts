import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createConversationHandler } from './handler.mjs'

const env = Object.fromEntries(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'GROQ_MODEL', 'GEMINI_MODEL', 'GROQ_CHAT_MODEL', 'GEMINI_CHAT_MODEL'].map(key => [key, Deno.env.get(key)]))
Deno.serve(createConversationHandler({ createClient, env }))
