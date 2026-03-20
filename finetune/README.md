# Aiscern Fine-tuning — Zero Budget Strategy

## Free Compute Available
- **Kaggle**: 30 GPU hours/week (P100 16GB) ← BEST
- **Google Colab**: Free T4 (12GB, session limits)
- **HuggingFace AutoTrain**: Free tier for small datasets

## Models to Fine-tune (small = trainable for free)
| Modality | Base Model | Params | Why |
|---|---|---|---|
| Audio | facebook/wav2vec2-base | 95M | Best audio features, PEFT-able |
| Image | google/vit-base-patch16-224 | 86M | Best deepfake detection base |
| Video | microsoft/xclip-base-patch32 | 87M | Frame-level, no video RAM needed |

## Strategy
1. Pull from `saghi776/detectai-dataset` (already scraped)
2. Fine-tune with LoRA (trains <1% of params = fits free GPU)
3. Push to `saghi776/aiscern-audio-detector` etc.
4. CF workers load fine-tuned model via HF Inference API (free)
