# How to Run on Kaggle (Free 30h GPU/week)

## One-time Setup
1. Go to https://www.kaggle.com/code → New Notebook
2. Settings → Accelerator → **GPU P100** (16GB — best free option)
3. Settings → Internet → **On**

## For Each Notebook

### Audio Detector (~2h on P100)
1. Upload `audio_finetune.ipynb` to Kaggle
2. Click **Run All**
3. Result: `saghi776/aiscern-audio-detector` on HuggingFace
4. Expected accuracy: **94-96%** (vs current 91%)

### Image Detector (~1.5h on P100)
1. Upload `image_finetune.ipynb` to Kaggle
2. Click **Run All**
3. Result: `saghi776/aiscern-image-detector` on HuggingFace
4. Expected accuracy: **97-99%** (vs current 97%)

### Video Detector (~1.5h on P100)
1. Upload `video_finetune.ipynb` to Kaggle
2. Click **Run All**
3. Result: `saghi776/aiscern-video-detector` on HuggingFace
4. Expected accuracy: **91-94%** (vs current 88%)

## GPU Hour Budget (30h/week free)
| Notebook | Time | Remaining |
|---|---|---|
| Audio | ~2h | 28h |
| Image | ~1.5h | 26.5h |
| Video | ~1.5h | 25h |
| **Total used** | **5h/week** | **25h spare** |

## After Training — Wire Models into Aiscern
The CF pipeline workers will call your fine-tuned models via
HuggingFace Inference API (free tier: 1000 calls/day per model).

Update `frontend/lib/inference/hf-analyze.ts`:
```typescript
const AUDIO_MODEL = 'saghi776/aiscern-audio-detector'
const IMAGE_MODEL = 'saghi776/aiscern-image-detector'
const VIDEO_MODEL = 'saghi776/aiscern-video-detector'
```
