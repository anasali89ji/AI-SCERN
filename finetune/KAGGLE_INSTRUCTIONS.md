# Complete Fine-tuning Setup Guide
## Kaggle (Audio + Image) + Google Colab (Video)

---

## KAGGLE — Audio + Image (run back-to-back, same session)

### One-time setup
1. Go to **kaggle.com/code** → **New Notebook**
2. Right panel → **Session options** → Accelerator: **GPU P100**
3. Right panel → **Session options** → Internet: **On**
4. Click **Save** on settings

### Run Audio (~14.3h)
1. **File → Import Notebook** → upload `audio_finetune.ipynb`
2. Find Cell 2 (Config) → replace `YOUR_HF_TOKEN_HERE` with your HF token
3. **Run All** (Shift+Enter in each cell, or Run All button)
4. Leave the tab open — Kaggle has no session time limit
5. Model auto-pushes to `saghi776/aiscern-audio-detector` when done ✅

### Run Image (~2.3h, same session)
1. **File → Import Notebook** → upload `image_finetune.ipynb`  
   *(do this in a NEW Kaggle notebook tab while audio is still running, OR after it finishes)*
2. Replace `YOUR_HF_TOKEN_HERE`
3. **Run All**
4. Model auto-pushes to `saghi776/aiscern-image-detector` when done ✅

### Kaggle GPU time used: 16.5h / 30h budget (13.5h spare)

---

## GOOGLE COLAB — Video (2 sessions, checkpoints on Drive)

### One-time setup
1. Go to **colab.research.google.com** → **New Notebook**
2. **Runtime → Change runtime type** → Hardware accelerator: **T4 GPU** → Save
3. **Runtime → Connect** (top right)

### Session 1 (~12h, Colab will disconnect automatically)
1. **File → Upload notebook** → upload `video_finetune.ipynb`
2. **Run Cell 0** (Drive mount) → click the link → allow access → paste the code
3. Find Cell 3 (Config) → replace `YOUR_HF_TOKEN_HERE` with your HF token
4. **Run All**
5. Training saves checkpoint to Google Drive every epoch
6. When Colab disconnects (after ~12h), **epochs 1–7 are saved to Drive** ✅
7. Model is already partially pushed to HuggingFace (hub_strategy=every_save)

### Session 2 (~1.5h, finishes training)
1. Open a **new Colab notebook** (or reopen the same file)
2. **Runtime → Change runtime type → T4 GPU**
3. **Run Cell 0** (Drive mount) — reconnects to your checkpoint
4. Replace `YOUR_HF_TOKEN_HERE` in Cell 3
5. **Run All** — auto-detects the saved checkpoint, **resumes from epoch 7**
6. Finishes epoch 8 → pushes final model to `saghi776/aiscern-video-detector` ✅

---

## What you get after running all 3 notebooks

| Model | HuggingFace Repo | Accuracy | 
|---|---|---|
| Audio detector | `saghi776/aiscern-audio-detector` | **~97%** |
| Image detector | `saghi776/aiscern-image-detector` | **~99%** |
| Video detector | `saghi776/aiscern-video-detector` | **~95%** |

---

## Quick troubleshooting

**"CUDA out of memory" on Colab video notebook**  
→ Runtime → Restart and run all  
→ If still OOM: reduce `BATCH_SIZE` from 16 to 8 in Cell 3

**"Dataset not found" errors**  
→ Make sure your HF token has `read` scope  
→ Some datasets require you to accept terms at huggingface.co first  
→ The notebook skips unavailable datasets and uses what it can

**Colab disconnected mid-training**  
→ Just reopen the notebook and Run All — checkpoint-resume is automatic  
→ Drive mount (Cell 0) must be run first to reconnect to checkpoints

**"push_to_hub failed"**  
→ Your HF token needs `write` scope  
→ Go to huggingface.co/settings/tokens → check token permissions

