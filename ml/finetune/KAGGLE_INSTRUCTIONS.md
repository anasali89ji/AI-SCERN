# Aiscern Fine-tuning — Kaggle Instructions
## All 3 notebooks run on Kaggle (P100 GPU, ~30h/week budget)

---

## ONE-TIME KAGGLE SETUP (do this once)
1. Go to **kaggle.com/code** → **New Notebook**
2. Right panel → **Session options** → Accelerator: **GPU P100**
3. Right panel → **Session options** → Internet: **On**
4. Click **Save**

---

## NOTEBOOK 1 — Text Detection (~3.5h)
**Model**: DeBERTa-v3-base + LoRA → `saghi776/aiscern-text-detector`  
**Accuracy target**: 96–98% | **F1 target**: ≥ 0.96

### Datasets loaded automatically
| Dataset | Samples | Source |
|---|---|---|
| HC3 (Human-ChatGPT Corpus) | ~87k | Hello-SimpleAI/HC3 |
| AI-Human text | ~50k | andythetechnerd03/AI-human-text |
| Dogge AI generated text | ~50k | Dogge/ai_generated_text_dataset |
| RAID benchmark | ~30k | raid-bench/raid |

### Steps
1. **File → Import Notebook** → upload `text_finetune.ipynb`
2. **HF token is already hardcoded** — no edits needed
3. Click **Run All**
4. Model auto-pushes to `saghi776/aiscern-text-detector` after every epoch ✅
5. Leave tab open — Kaggle has no session time limit

---

## NOTEBOOK 2 — Image Detection (~4h, same session)
**Model**: ViT-Large-patch16-224 + LoRA → `saghi776/aiscern-image-detector`  
**Accuracy target**: 98–99%  
**Note**: Upgraded from ViT-base (86M) → ViT-Large (307M) for higher accuracy

### Datasets loaded automatically
| Dataset | Samples | Type |
|---|---|---|
| CIFAKE | 60k | SDXL-generated vs real CIFAR-10 |
| Haywood AI+Real fullset | ~50k | Multi-generator AI vs real photos |
| GenImage (Molbap) | ~30k | Midjourney, DALL-E, SD vs real |
| FaceForensics++ | ~18k | Deepfake face swaps |

### Steps
1. **File → Import Notebook** → upload `image_finetune.ipynb`
2. **HF token is already hardcoded** — no edits needed
3. Click **Run All**
4. Model auto-pushes to `saghi776/aiscern-image-detector` after every epoch ✅

---

## NOTEBOOK 3 — Audio Detection (~14.3h)
**Model**: facebook/wav2vec2-base + LoRA → `saghi776/aiscern-audio-detector`  
**Accuracy target**: ~97%

### Steps
1. **File → Import Notebook** → upload `audio_finetune.ipynb`
2. **HF token is already hardcoded** — no edits needed
3. Click **Run All**
4. Model auto-pushes to `saghi776/aiscern-audio-detector` when done ✅

---

## GPU BUDGET SUMMARY
| Notebook | Time | Budget used |
|---|---|---|
| Text | ~3.5h | 3.5h |
| Image | ~4.0h | 4.0h |
| Audio | ~14.3h | 14.3h |
| **Total** | **~21.8h** | **21.8h / 30h (8.2h spare)** |

---

## HOW MODELS WIRE TO THE WEBSITE
After training completes, **no deployment needed**. The models auto-load on the first HF Inference API request.

- Text fine-tuned model runs as **primary** with 0.45 weight in the ensemble
- Image fine-tuned model runs as **primary** with 0.45 weight in the ensemble
- Old ensemble models (RoBERTa, ViT-base, etc.) remain as fallback
- Cold start on first request: ~20s, then stays warm

The `HUGGINGFACE_API_TOKEN` env var in Vercel already handles auth — nothing else to configure.

---

## TROUBLESHOOTING

**"CUDA out of memory"**
→ In Config cell, reduce `BATCH_SIZE` from 16 → 8 and add `GRAD_ACCUM = 4`

**"Dataset not found" / 404**
→ HF token has read scope — some datasets need terms accepted at huggingface.co first
→ Notebook skips unavailable datasets and trains on what it can load

**"push_to_hub failed"**
→ Ensure HF token has `write` scope: huggingface.co/settings/tokens

**Kaggle session expired mid-training**
→ Checkpoint auto-saves every epoch to `./checkpoints`
→ Re-import notebook → Run All → training resumes from last checkpoint automatically

**Model not showing on HF after training**
→ Check `saghi776/` namespace — may take 1–2 min to appear after push
→ Hub pushes happen after every epoch so partial results are already there
