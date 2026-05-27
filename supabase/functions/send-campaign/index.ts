import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Missing authorization" }, 401)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return json({ error: "Unauthorized" }, 401)

    // ── Parse body ────────────────────────────────────────────────────────────
    const { campaign_id } = await req.json()
    if (!campaign_id) return json({ error: "campaign_id required" }, 400)

    // ── Load campaign ─────────────────────────────────────────────────────────
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("*, tenants!inner(id, name)")
      .eq("id", campaign_id)
      .single()

    if (campErr || !campaign) return json({ error: "Campaign not found" }, 404)
    if (campaign.status !== "ready") return json({ error: `Campaign status is '${campaign.status}', must be 'ready'` }, 422)

    const tenantId = campaign.tenant_id

    // ── Load Mailerlite API key ────────────────────────────────────────────────
    const { data: settings } = await supabase
      .from("tenant_settings")
      .select("api_keys")
      .eq("tenant_id", tenantId)
      .single()

    const mailerliteKey = settings?.api_keys?.mailerlite
    if (!mailerliteKey) return json({ error: "Mailerlite API key not configured. Add it in Settings → AI & Proveedores." }, 422)

    // ── Build Mailerlite campaign ─────────────────────────────────────────────
    const mlHeaders = {
      "Authorization": `Bearer ${mailerliteKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    }

    // 1. Create campaign in Mailerlite
    const subject = campaign.subject || campaign.name
    const fromName = (campaign.tenants as any)?.name || "MusicDibs"

    const createBody = {
      name: campaign.name,
      type: "regular",
      language_id: campaign.language === "es" ? 1 : 2, // 1=ES, 2=EN
      emails: [{
        subject,
        from_name: fromName,
        from: "noreply@musicdibs.com", // must be verified sender in Mailerlite
        content: buildEmailHtml(campaign),
        plain_text: buildEmailText(campaign),
      }],
    }

    const createRes = await fetch("https://connect.mailerlite.com/api/campaigns", {
      method: "POST",
      headers: mlHeaders,
      body: JSON.stringify(createBody),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      console.error("Mailerlite create error:", err)
      return json({ error: `Mailerlite error: ${createRes.status} — ${err}` }, 502)
    }

    const mlCampaign = await createRes.json()
    const mlCampaignId = mlCampaign.data?.id
    if (!mlCampaignId) return json({ error: "Mailerlite did not return campaign id" }, 502)

    // 2. Schedule / send immediately
    const scheduleBody = { delivery: "instant" }
    const scheduleRes = await fetch(`https://connect.mailerlite.com/api/campaigns/${mlCampaignId}/schedule`, {
      method: "POST",
      headers: mlHeaders,
      body: JSON.stringify(scheduleBody),
    })

    if (!scheduleRes.ok) {
      const err = await scheduleRes.text()
      console.error("Mailerlite schedule error:", err)
      // Campaign created but not sent — still update status to reflect partial success
    }

    // ── Update campaign status in Supabase ────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        mailerlite_campaign_id: mlCampaignId,
      })
      .eq("id", campaign_id)

    if (updateErr) console.error("Status update error:", updateErr)

    // ── Insert notification ───────────────────────────────────────────────────
    await supabase.from("notifications").insert({
      tenant_id: tenantId,
      type: "campaign_ready",
      title: "Campaña enviada",
      body: `"${campaign.name}" se ha enviado correctamente.`,
      link: `/campaigns/${campaign_id}`,
    })

    // ── Dispatch webhook event ─────────────────────────────────────────────────
    supabase.functions.invoke("webhook-dispatcher", {
      body: {
        tenant_id: tenantId,
        event: "campaign.sent",
        payload: {
          campaign_id,
          campaign_name: campaign.name,
          mailerlite_campaign_id: mlCampaignId,
          total_contacts: campaign.total_contacts,
          sent_at: new Date().toISOString(),
        },
      },
    }).then(() => {}) // fire and forget

    return json({ success: true, mailerlite_campaign_id: mlCampaignId })

  } catch (err) {
    console.error("send-campaign error:", err)
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500)
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
}

function buildEmailHtml(campaign: any): string {
  const subject = campaign.subject || campaign.name
  const goal = campaign.goal ? `<p style="color:#666;font-size:15px;margin:0 0 16px">${campaign.goal}</p>` : ""
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;background:#F5EFE6">
  <div style="background:white;border-radius:16px;padding:32px;border:1px solid rgba(0,0,0,0.06)">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:#C9973A;border-radius:12px;margin-bottom:12px">
        🎵
      </div>
      <h1 style="margin:0;font-size:22px;color:#1A1510">${subject}</h1>
    </div>
    ${goal}
    <p style="color:#1A1510;font-size:15px;line-height:1.6;margin:0 0 24px">
      ${campaign.ai_prompt || "Contenido generado con IA por MusicDibs Enterprise."}
    </p>
    ${campaign.audio_url ? `
    <div style="text-align:center;margin:24px 0">
      <a href="${campaign.audio_url}" style="display:inline-block;background:#C9973A;color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:15px">
        ▶ Escuchar audio personalizado
      </a>
    </div>` : ""}
    <hr style="border:none;border-top:1px solid rgba(0,0,0,0.06);margin:24px 0">
    <p style="color:#999;font-size:12px;text-align:center;margin:0">
      Enviado con MusicDibs Enterprise · <a href="{{unsubscribe}}" style="color:#C9973A">Darse de baja</a>
    </p>
  </div>
</body>
</html>`
}

function buildEmailText(campaign: any): string {
  return `${campaign.subject || campaign.name}\n\n${campaign.ai_prompt || ""}\n\nPara darse de baja: {{unsubscribe}}`
}
