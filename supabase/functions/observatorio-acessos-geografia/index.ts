import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createGeoHandler } from './core.mjs'
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{
  auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(3000)})}
})
Deno.serve(createGeoHandler({db,env:{
  GEO_ALLOWED_ORIGINS:Deno.env.get('GEO_ALLOWED_ORIGINS'),GEO_PROVIDER:Deno.env.get('GEO_PROVIDER'),
  GEO_PROVIDER_ENABLED:Deno.env.get('GEO_PROVIDER_ENABLED'),GEO_TRUSTED_INGRESS:Deno.env.get('GEO_TRUSTED_INGRESS'),
  GEO_IP_HEADER:Deno.env.get('GEO_IP_HEADER'),GEO_XFF_INDEX_FROM_RIGHT:Deno.env.get('GEO_XFF_INDEX_FROM_RIGHT')
}}))
