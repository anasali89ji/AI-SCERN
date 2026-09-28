# Aiscern — Fine-tuning Notebooks

All notebooks run on **Kaggle free T4 x2 GPU** (15h/week quota).  
Each trains a LoRA adapter, merges it, and pushes directly to HuggingFace.

## Notebooks

| File | Model | HF Repo | Target |
|---|---|---|---|
| `text_finetune.ipynb` | DeBERTa-v3-base + LoRA | `saghi776/aiscern-text-detector` | ≥80% acc |
| `image_finetune.ipynb` | ViT-Large-patch16-224 + LoRA | `saghi776/aiscern-image-detector` | ≥80% acc |
| `audio_finetune.ipynb` | wav2vec2-base + LoRA | `saghi776/aiscern-audio-detector` | ≥80% acc |
| `video_finetune.ipynb` | ViT-base-patch16-224 + LoRA | `saghi776/aiscern-video-detector` | ≥80% acc |

## Kaggle Setup (one-time)

1. Go to [kaggle.com](https://kaggle.com) → New Notebook
2. Settings → Accelerator → **GPU T4 x2**
3. Settings → Add Secret → Name: `HF_TOKEN` → Value: your HuggingFace token
4. Upload the notebook file and run all cells

## After Training — Wire into Website

### Text (already wired at weight 0.45)
```
MODELS.text_finetuned = 'saghi776/aiscern-text-detector'  ← already in hf-analyze.ts
```

### Image (already wired)
```
MODELS.image_finetuned = 'saghi776/aiscern-image-detector'  ← already in hf-analyze.ts
```

### Audio (add after training)
In `frontend/lib/inference/hf-analyze.ts`, add to MODELS:
```typescript
audio_finetuned: 'saghi776/aiscern-audio-detector',
```
Then in `analyzeAudio()`, add to `Promise.allSettled`:
```typescript
hfInference(MODELS.audio_finetuned, null, { binary: true, binaryData: audioBuffer, timeoutMs: 15000 }).catch(() => null),
```
And parse with weight 0.50:
```typescript
const sAudio0 = parseHFText(rawAudioHF[0], ['fake','label_1','1'], ['real','label_0','0'])
if (sAudio0 !== null) mlScores.push({ model: MODELS.audio_finetuned, aiScore: sAudio0, weight: 0.50 })
```

### Video (add after training)
```typescript
video_finetuned: 'saghi776/aiscern-video-detector',
```
Use in per-frame inference in `analyzeVideoFrames()` in `nvidia-nim.ts`.

## Expected Accuracy by Dataset Size

| Samples | Expected Acc | Notes |
|---|---|---|
| 20k/class | 72–76% | Minimum viable |
| 50k/class | 78–83% | Target range |
| 100k/class | 84–90% | With diverse datasets |

## Troubleshooting

**Out of memory**: Reduce `BATCH_SIZE` to 8, increase `GRAD_ACCUM` to 8  
**Dataset not found**: Some datasets need approval on HuggingFace — request access first  
**Accuracy below 75%**: Run for more epochs (set `EPOCHS=8`) or add more diverse datasets  
**Push fails**: Ensure your HF token has write access to `saghi776` org
