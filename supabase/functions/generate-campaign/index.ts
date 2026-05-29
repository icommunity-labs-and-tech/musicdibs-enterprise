import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

// ── KIE.ai adapter ────────────────────────────────────────────────────────────
// Docs reference: https://kie.ai/api-docs
// The following endpoints are based on KIE.ai v2 music generation API.
// Verify against your B2C implementation if endpoints differ.

const KIE_BASE = "https://kieai.erweima.ai/api/v1"

interface KieGenerateParams {
  prompt: string
  style?: string
  duration?: number        // seconds — KIE accepts 15–240s
  instrumental?: boolean
  title?: string
}

interface KieTask {
  taskId: string
  status: "pending" | "processing" | "completed" | "failed"
  audioUrl?: string
  errorMessage?: string
}

async function kieGenerate(apiKey: string, params: KieGenerateParams): Promise<string> {
  const body = {
    prompt: params.prompt,
    style: params.style ?? "pop",
    title: params.title ?? "Generated Song",
    customMode: false,
    instrumental: params.instrumental ?? false,
    model: "V5",
  }

  const res = await fetch(`${KIE_BASE}/music/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`KIE.ai generate failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  // KIE returns { code: 200, data: { taskId: "..." } } or similar
  const taskId = data?.data?.taskId ?? data?.taskId
  if (!taskId) throw new Error(`KIE.ai did not return taskId: ${JSON.stringify(data)}`)
  return taskId
}

async function kiePollTask(apiKey: string, taskId: string): Promise<KieTask> {
  const res = await fetch(`${KIE_BASE}/music/record-info?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`KIE.ai poll failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  // KIE returns { code: 200, data: { status, audioUrl, ... } }
  const record = data?.data ?? data
  const status = record?.status?.toLowerCase() ?? "pending"
  const audioUrl = record?.audioUrl ?? record?.audio_url ?? record?.url

  return {
    taskId,
    status: status === "success" || status === "completed" ? "completed"
           : status === "failed" || status === "error" ? "failed"
           : status === "processing" || status === "running" ? "processing"
           : "pending",
    audioUrl,
    errorMessage: record?.failReason ?? record?.error_message,
  }
}

// ── Storage upload ────────────────────────────────────────────────────────────

async function uploadAudioToStorage(
  supabase: ReturnType<typeof createClient>,
  campaignId: string,
  audioUrl: string,
): Promise<string> {
  // Download audio from KIE CDN
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) throw new Error(`Failed to fetch audio from KIE CDN: ${audioRes.status}`)

  const contentType = audioRes.headers.get("content-type") ?? "audio/mpeg"
  const buffer = await audioRes.arrayBuffer()
  const ext = contentType.includes("wav") ? "wav" : contentType.includes("ogg") ? "ogg" : "mp3"
  const path = `${campaignId}/song.${ext}`

  const { error } = await supabase.storage
    .from("campaign-audio")
    .upload(path, buffer, { contentType, upsert: true })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data: urlData } = supabase.storage.from("campaign-audio").getPublicUrl(path)
  return urlData.publicUrl
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Missing authorization" }, 401)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Allow both JWT (frontend trigger) and service role (cron retry)
    const token = authHeader.replace("Bearer ", "")
    const isServiceRole = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!isServiceRole) {
      const { error: authErr } = await supabase.auth.getUser(token)
      if (authErr) return json({ error: "Unauthorized" }, 401)
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { campaign_id, job_id } = body

    // ── Find the job ────────────────────────────────────────────────────────
    let jobQuery = supabase
      .from("generation_jobs")
      .select("*, campaigns!inner(*)")

    if (job_id) {
      jobQuery = jobQuery.eq("id", job_id)
    } else if (campaign_id) {
      jobQuery = jobQuery.eq("campaign_id", campaign_id).eq("status", "queued")
    } else {
      return json({ error: "campaign_id or job_id required" }, 400)
    }

    const { data: job, error: jobErr } = await jobQuery
      .order("created_at", { ascending: true })
      .limit(1)
      .single()

    if (jobErr || !job) return json({ error: "No queued generation job found" }, 404)

    const campaign = (job as any).campaigns
    const tenantId = job.tenant_id

    // ── Load KIE.ai API key (platform secret) ───────────────────────────────
    const kieApiKey = Deno.env.get("KIE_API_KEY")
    if (!kieApiKey) return json({ error: "KIE_API_KEY not configured" }, 500)

    // ── Mark job as processing ──────────────────────────────────────────────
    await supabase.from("generation_jobs").update({
      status: "processing",
      started_at: new Date().toISOString(),
    }).eq("id", job.id)

    await supabase.from("campaigns").update({ status: "generating" }).eq("id", campaign.id)

    // ── Call KIE.ai ─────────────────────────────────────────────────────────
    let kieTaskId: string
    try {
      kieTaskId = await kieGenerate(kieApiKey, {
        prompt: job.prompt ?? campaign.ai_prompt ?? "Create an upbeat promotional music track",
        style: job.style ?? campaign.music_style ?? "pop",
        duration: job.duration_seconds ?? campaign.duration_seconds ?? 30,
        title: campaign.name,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await supabase.from("generation_jobs").update({
        status: "failed",
        error_message: msg,
        attempts: (job.attempts ?? 0) + 1,
      }).eq("id", job.id)
      await supabase.from("campaigns").update({ status: "queued" }).eq("id", campaign.id)
      return json({ error: msg }, 500)
    }

    // ── Poll KIE.ai for completion (max 5 min, 10s intervals) ───────────────
    const MAX_POLLS = 30
    const POLL_INTERVAL_MS = 10_000
    let audioUrl: string | undefined

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

      let task: KieTask
      try {
        task = await kiePollTask(kieApiKey, kieTaskId)
      } catch (err) {
        // Network blip — continue polling
        console.warn(`Poll attempt ${i + 1} failed:`, err)
        continue
      }

      if (task.status === "completed" && task.audioUrl) {
        audioUrl = task.audioUrl
        break
      }

      if (task.status === "failed") {
        const msg = task.errorMessage ?? "KIE.ai generation failed"
        await supabase.from("generation_jobs").update({
          status: "failed",
          error_message: msg,
          attempts: (job.attempts ?? 0) + 1,
        }).eq("id", job.id)
        await supabase.from("campaigns").update({ status: "queued" }).eq("id", campaign.id)
        return json({ error: msg }, 500)
      }
    }

    if (!audioUrl) {
      const msg = "KIE.ai generation timed out after 5 minutes"
      await supabase.from("generation_jobs").update({
        status: "failed",
        error_message: msg,
        attempts: (job.attempts ?? 0) + 1,
      }).eq("id", job.id)
      await supabase.from("campaigns").update({ status: "queued" }).eq("id", campaign.id)
      return json({ error: msg }, 500)
    }

    // ── Upload audio to Supabase Storage ────────────────────────────────────
    let publicUrl: string
    try {
      publicUrl = await uploadAudioToStorage(supabase, campaign.id, audioUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await supabase.from("generation_jobs").update({
        status: "failed",
        error_message: msg,
        attempts: (job.attempts ?? 0) + 1,
      }).eq("id", job.id)
      await supabase.from("campaigns").update({ status: "queued" }).eq("id", campaign.id)
      return json({ error: msg }, 500)
    }

    // ── Mark job done + campaign ready ──────────────────────────────────────
    await supabase.from("generation_jobs").update({
      status: "done",
      output_url: publicUrl,
      output_metadata: { kie_task_id: kieTaskId, original_url: audioUrl },
      completed_at: new Date().toISOString(),
      attempts: (job.attempts ?? 0) + 1,
    }).eq("id", job.id)

    await supabase.from("campaigns").update({
      status: "ready",
      audio_url: publicUrl,
    }).eq("id", campaign.id)

    return json({ success: true, audio_url: publicUrl })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("generate-campaign error:", msg)
    return json({ error: msg }, 500)
  }
})
