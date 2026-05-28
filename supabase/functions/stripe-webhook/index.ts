import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
// @deno-types="https://esm.sh/v135/stripe@14.21.0/types/index.d.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"

// ── Price ID → plan name map (must match Settings.tsx PLANS) ─────────────────
const PRICE_TO_PLAN: Record<string, string> = {
  'price_1TbQ07FULeu7PzK6ncQVbEUm': 'starter',      // starter monthly
  'price_1TbQ0DFULeu7PzK63w9dujNN': 'starter',      // starter annual
  'price_1TbQ0JFULeu7PzK6x1Bj5bEa': 'professional', // professional monthly
  'price_1TbQ0PFULeu7PzK6z1MhbjAT': 'professional', // professional annual
  'price_1TbQ0VFULeu7PzK6EaZQXHQK': 'enterprise',   // enterprise monthly
  'price_1TbQ0cFULeu7PzK6FcYlj2v2': 'enterprise',   // enterprise annual
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!stripeKey || !webhookSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET')
    return json({ error: 'Stripe not configured' }, 500)
  }

  // ── Verify Stripe signature ───────────────────────────────────────────────
  const signature = req.headers.get('stripe-signature')
  if (!signature) return json({ error: 'Missing stripe-signature header' }, 400)

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return json({ error: 'Invalid signature' }, 400)
  }

  // ── Supabase client (service role) ────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  console.log('Stripe event:', event.type)

  try {
    switch (event.type) {

      // ── Checkout completed → new subscription activated ───────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const tenantId = session.metadata?.tenant_id
        if (!tenantId) { console.warn('No tenant_id in checkout session metadata'); break }

        const subscriptionId = session.subscription as string
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = sub.items.data[0]?.price?.id ?? ''
        const plan = PRICE_TO_PLAN[priceId] ?? 'starter'

        await supabase.from('tenants').update({
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: session.customer as string,
          stripe_price_id: priceId,
          stripe_status: sub.status,
          plan,
        }).eq('id', tenantId)

        await supabase.from('notifications').insert({
          tenant_id: tenantId,
          type: 'payment_success',
          title: 'Suscripción activada',
          body: `Tu plan ${plan.charAt(0).toUpperCase() + plan.slice(1)} está activo. ¡Bienvenido!`,
          link: '/settings',
        })

        console.log(`Tenant ${tenantId} subscribed to ${plan} (${priceId})`)
        break
      }

      // ── Subscription updated (upgrade, downgrade, renewal) ────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price?.id ?? ''
        const plan = PRICE_TO_PLAN[priceId] ?? 'starter'

        // Try metadata first, fallback to stripe_customer_id lookup
        const tenantId = sub.metadata?.tenant_id
        const filter = tenantId
          ? supabase.from('tenants').update({ stripe_status: sub.status, stripe_price_id: priceId, stripe_subscription_id: sub.id, plan }).eq('id', tenantId)
          : supabase.from('tenants').update({ stripe_status: sub.status, stripe_price_id: priceId, stripe_subscription_id: sub.id, plan }).eq('stripe_customer_id', sub.customer as string)

        await filter
        console.log(`Subscription updated: ${plan}, status: ${sub.status}`)
        break
      }

      // ── Subscription canceled / expired ───────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription

        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .or(`stripe_subscription_id.eq.${sub.id},stripe_customer_id.eq.${sub.customer as string}`)
          .single()

        if (!tenant) { console.warn('No tenant for deleted subscription', sub.id); break }

        await supabase.from('tenants').update({
          stripe_status: 'canceled',
          stripe_subscription_id: null,
          stripe_price_id: null,
          plan: 'starter',
        }).eq('id', tenant.id)

        await supabase.from('notifications').insert({
          tenant_id: tenant.id,
          type: 'payment_failed',
          title: 'Suscripción cancelada',
          body: 'Tu suscripción ha sido cancelada. Tu cuenta vuelve al plan Starter.',
          link: '/settings',
        })

        console.log(`Tenant ${tenant.id} subscription canceled → starter`)
        break
      }

      // ── Payment failed ────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const { data: tenant } = await supabase
          .from('tenants').select('id').eq('stripe_customer_id', invoice.customer as string).single()

        if (!tenant) break

        await supabase.from('tenants').update({ stripe_status: 'past_due' }).eq('id', tenant.id)

        await supabase.from('notifications').insert({
          tenant_id: tenant.id,
          type: 'payment_failed',
          title: 'Pago fallido',
          body: 'No hemos podido procesar tu pago. Actualiza tu método de pago para mantener el acceso.',
          link: '/settings',
        })

        console.log(`Tenant ${tenant.id} payment failed → past_due`)
        break
      }

      // ── Payment succeeded (renewal) ───────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.billing_reason === 'subscription_create') break // handled by checkout.session.completed

        const { data: tenant } = await supabase
          .from('tenants').select('id').eq('stripe_customer_id', invoice.customer as string).single()

        if (!tenant) break

        // Re-activate only if was past_due
        await supabase.from('tenants')
          .update({ stripe_status: 'active' })
          .eq('id', tenant.id)
          .eq('stripe_status', 'past_due')

        console.log(`Tenant ${tenant.id} payment succeeded → active`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('Error processing event:', event.type, err)
    // Return 200 to prevent Stripe retrying — log for manual investigation
  }

  return json({ received: true })
})
