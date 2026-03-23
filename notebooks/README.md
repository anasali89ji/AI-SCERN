# DETECTAI — Fine-Tuning Notebooks

> Run these notebooks on **Google Colab** (T4 GPU — free tier works)  
> Before running: add `HF_TOKEN` to **Colab Secrets** panel (🔑 icon on left sidebar)

---

## 📋 Notebook Index

| # | Notebook | Model Output | Status | Est. Time |
|---|----------|-------------|--------|-----------|
| 1 | `01_IMAGE_DETECTOR.ipynb` | `saghi776/aiscern-image-detector` | ⚠️ Run after collecting 20k+ images | 5–8 hrs |
| 2 | `02_VIDEO_DETECTOR.ipynb` | `saghi776/aiscern-video-detector` | ⚠️ Run after collecting 100k+ frames | 12–20 hrs |
| 3 | `03_AUDIO_DETECTOR.ipynb` | `saghi776/aiscern-audio-detector` | ⚠️ Run after collecting 10k+ clips | 8–12 hrs |
| 4 | `04_TEXT_DETECTOR.ipynb`  | `saghi776/aiscern-text-detector`  | ✅ **RUN THIS FIRST** (413k rows ready) | 3–5 hrs |

**Priority order: TEXT → IMAGE → AUDIO → VIDEO**

---

## 🔧 Setup (one-time)

1. Open notebook in [Google Colab](https://colab.research.google.com)
2. Click **Runtime → Change runtime type → T4 GPU**
3. Click 🔑 **Secrets** (left sidebar) → Add secret `HF_TOKEN` = `YOUR_HF_TOKEN_FROM_COLAB_SECRETS`
4. Run all cells in order

---

## 🌐 Website Integration

After each notebook completes, update **one file**:

```
frontend/lib/inference/hf-analyze.ts
```

```typescript
const MODELS = {
  text_primary:  'saghi776/aiscern-text-detector',   // ← after notebook 4
  image_primary: 'saghi776/aiscern-image-detector',  // ← after notebook 1
  audio_primary: 'saghi776/aiscern-audio-detector',  // ← after notebook 3
  // video uses NVIDIA NIM — separate integration
}
```

`git push` → Vercel auto-deploys. No other changes needed.

---

## 🎯 What Each Notebook Detects

### 01 — Image Detector
- Midjourney v5/v6 · SDXL / Flux · DALL-E 3 · Gemini Nano / Imagen
- **Grok Aurora** · Adobe Firefly · Leonardo AI · Canva AI
- AI-generated faces vs real human faces (texture, expression, symmetry signals)
- Face quality analysis: Laplacian sharpness, DCT frequency artifacts, edge density

### 02 — Video Detector
- FaceSwap · DeepFaceLab · FaceForensics++ · StyleGAN3
- Runway Gen-2/3 · Pika Labs · Kling AI · Sora
- Temporal inconsistency analysis · Face boundary compositing artifacts
- DCT checkerboard detection · Color channel correlation analysis

### 03 — Audio Detector
- ElevenLabs (voice cloning) · PlayHT · XTTS/Coqui · VALL-E
- OpenAI TTS · Murf AI · Amazon Polly · Google TTS
- Breath/silence pattern analysis · Spectral centroid variance
- Pitch regularity analysis · RMS energy compression detection

### 04 — Text Detector
- ChatGPT / GPT-4o · Claude · Gemini · Llama 3 · Mistral · Copilot
- 413,000 training samples — highest priority
- Burstiness, perplexity proxy, MATTR vocab richness (mirrors website signals)
