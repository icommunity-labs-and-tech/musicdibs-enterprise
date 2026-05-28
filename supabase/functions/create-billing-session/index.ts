import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
// @deno-types="https://esm.sh/v135/stripe@14.21.0/types/index.d.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"

const PRICE_TO_PLAN: Record<string, string> = {
  'price_1TbQ07FULeu7PzK6ncQVbEUm': 'starter',
  'price_1TbQ0DFULeu7PzK63w9dujNN': 'starter',
  'price_1TbQ0JFULeu7PzK6x1Bj5bEa': 'professional',
  'price_1TbQ0PFULeu7PzK6z1MhbjAT': 'professional',
  'price_1TbQ0VFULeu7PzK6EaZQXHQK': 'enterprise',
  'price_1TbQ0cFULeu7PzK6FcYlj2v2': 'enterprise',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) {
    console.error('Missing STRIPE_SECRET_KEY')
    return json({ error: 'Stripe not configured' }, 500)
  }

  // ── Auth: extract user from JWT ───────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('Auth error:', userError)
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Resolve tenant via profiles table ────────────────────────────────────
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.tenant_id) {
    console.error('Profile error:', profileError)
    return json({ error: 'Tenant not found' }, 404)
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id, stripe_customer_id, stripe_subscription_id, stripe_status, plan')
    .eq('id', profile.tenant_id)
    .single()

  if (tenantError || !tenant) {
    console.error('Tenant error:', tenantError)
    return json({ error: 'Tenant not found' }, 404)
  }

  // ── Parse request body ────────────────────────────────────────────────────
  const { action, priceId, successUrl, cancelUrl } = await req.json()

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const appUrl = Deno.env.get('APP_URL') ?? 'https://enterprise.musicdibs.com'

  // ── Ensure Stripe customer exists ─────────────────────────────────────────
  let customerId = tenant.stripe_customer_id as string | null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { tenant_id: tenant.id, user_id: user.id },
    })
    customerId = customer.id

    await supabaseAdmin
      .from('tenants')
      .update({ stripe_customer_id: customerId })
      .eq('id', tenant.id)

    console.log(`Created Stripe customer ${customerId} for tenant ${tenant.id}`)
  }

  // ── Handle actions ────────────────────────────────────────────────────────
  try {
    if (action === 'portal') {
      // Billing portal session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl(appUrl, cancelUrl, '/settings'),
      })
      return json({ url: portalSession.url })
    }

    if (action === 'checkout') {
      if (!priceId) return json({ error: 'priceId required for checkout' }, 400)

      const hasActiveSub =
        tenant.stripe_subscription_id &&
        (tenant.stripe_status === 'active' || tenant.stripe_status === 'trialing')

      if (hasActiveSub) {
        // ── Upgrade/downgrade existing subscription ──────────────────────
        const sub = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id as string)
        const itemId = sub.items.data[0]?.id

        if (!itemId) return json({ error: 'Subscription item not found' }, 400)

        await stripe.subscriptions.update(tenant.stripe_subscription_id as string, {
          items: [{ id: itemId, price: priceId }],
          proration_behavior: 'create_prorations',
          metadata: { tenant_id: tenant.id },
        })

        const plan = PRICE_TO_PLAN[priceId] ?? 'starter'
        await supabaseAdmin.from('tenants').update({
          plan,
          stripe_price_id: priceId,
        }).eq('id', tenant.id)

        // Redirect to portal so user can see the updated subscription
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl(appUrl, successUrl, '/settings'),
        })
        return json({ url: portalSession.url })
      }

      // ── New subscription checkout ─────────────────────────────────────
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: returnUrl(appUrl, successUrl, '/settings?billing=success'),
        cancel_url: returnUrl(appUrl, cancelUrl, '/settings'),
        subscription_data: {
          metadata: { tenant_id: tenant.id },
        },
        metadata: { tenant_id: tenant.id },
      })

      return json({ url: session.url })
    }

    return json({ error: `Unknown action: ${action}` }, 400)

  } catch (err) {
    console.error('Stripe error:', err)
    return json({ error: (err as Error).message ?? 'Stripe error' }, 500)
  }
})

function returnUrl(base: string, override: string | undefined, fallback: string): string {
  if (override) return override
  return `${base}${fallback}`
}
