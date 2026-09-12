# ARIA LoRA — free, self-hosted fine-tune

Fine-tunes a small open model on Aiscern's own data so ARIA can run without
per-request NVIDIA API cost, while keeping the ability to call tools
(`get_pipeline_stats`, `detect_text`, `web_search`, `web_scan`) exactly the
way the current NVIDIA-backed path does. Text-only — no image understanding
(see the tradeoff note below).

## What this actually is

1. **`build_dataset.py`** — generates `aria_sft.jsonl` from
   `frontend/lib/rag/aria-knowledge.json` (Q&A pairs) plus hand-written
   tool-calling and persona examples, in the exact chat-message format
   Qwen2.5's chat template (and NIM's OpenAI-compatible API) both use.
2. **`aria_lora_training.ipynb`** — a free-Colab-T4 notebook: loads
   Qwen2.5-7B-Instruct in 4-bit, LoRA fine-tunes on the dataset above, saves
   and (optionally) pushes the adapter to your HF Hub account.
3. **`hf_space/`** — a Hugging Face Space (ZeroGPU, free tier) that loads
   the base model + your adapter and exposes an OpenAI-compatible
   `/v1/chat/completions`-shaped endpoint.
4. **`frontend/lib/inference/aria-lora.ts`** — a Next.js client for that
   Space, matching the exact return shape `lib/aria/function-calling.ts`
   already expects. **Not wired into `chat/route.ts` yet** — see "Next step"
   below for why.

## Steps

```bash
cd training/aria-lora
python3 build_dataset.py --out aria_sft.jsonl   # ~68 examples from the current KB
```

Open `aria_lora_training.ipynb` in Colab (Runtime -> T4 GPU), upload
`aria_sft.jsonl` when prompted, run all cells. Takes roughly 15-30 minutes
on a free T4 for 3 epochs over this dataset size.

Then create a new HF Space (Settings -> new Space -> SDK: Gradio,
Hardware: ZeroGPU — free), and either:
- upload `hf_space/app.py` + `hf_space/requirements.txt` directly, or
- `git push` them to the Space's own git remote (shown on the Space page).

Set two Space variables: `BASE_MODEL` (defaults to
`Qwen/Qwen2.5-7B-Instruct`, only change if you used a different base) and
`ADAPTER_REPO` (the Hub repo you pushed the trained adapter to).

## Honest limitations — read before expecting NVIDIA-level output

- **68 training examples is a starting point, not a finished dataset.**
  Enough to prove the pipeline end-to-end and get the model imitating
  ARIA's tone/tool-calling format, not enough for it to generalize well to
  phrasings it hasn't seen. Two ways to improve it without spending money:
  run the KB-derived questions in `build_dataset.py` through any LLM you
  already have free access to (Gemini's free tier, a local Ollama model)
  to paraphrase them into more varied phrasings, and add more hand-written
  tool-calling examples covering edge cases (ambiguous queries, tool
  failures, multi-turn follow-ups).
- **No image understanding.** This is the text-only path you chose —
  images stay handled by the existing detection pipeline (`detect_image`,
  `hf-analyze.ts`); ARIA reads about images (verdicts, OCR'd text) rather
  than looking at them directly. A vision-capable version is a separate,
  much heavier project (multimodal base model, real GPU time for training)
  — not something free Colab can realistically do well.
- **ZeroGPU is free but not always-on.** First request after idle has
  cold-start latency (model load, roughly 30-60s) — the 75s client timeout
  in `aria-lora.ts` accounts for that, but the user-facing chat will feel
  slow on a cold Space. Fine for low/hobby traffic; a real latency
  guarantee would mean a paid always-on GPU, which defeats the point here.
- **Quality vs. Nemotron-70B/Llama-3.3-70B is not going to be equal** — a
  7B LoRA fine-tune trades raw reasoning quality for zero cost. Reasonable
  for FAQ-style and tool-routing questions (what this dataset targets);
  weaker on genuinely novel or ambiguous requests than the larger models
  currently in `chat/route.ts`.

## Next step — integration (deliberately not done yet)

`aria-lora.ts` exists and matches the shape `function-calling.ts` expects,
but nothing calls it. Wiring it in for real needs the Space actually
deployed and hit with real traffic first — same reasoning the existing
`ARIA_FUNCTION_CALLING_ENABLED` flag's dark-launch comment gives for
untested model behavior. Once you've deployed and manually verified it
responds sanely:

```ts
// chat/route.ts, alongside the existing ARIA_FUNCTION_CALLING_ENABLED branch
if (process.env.ARIA_LORA_ENABLED === 'true') {
  const { callAriaLora } = await import('@/lib/inference/aria-lora')
  // same tools[]/messages[] shape already built for the NIM tool-calling path
}
```

Set `ARIA_LORA_ENABLED=true` and `ARIA_LORA_SPACE_URL` (your Space's base
URL) once you're ready to test it live — ask for that wiring when you get
there, since it should be validated against the deployed Space's actual
behavior, not written blind.
