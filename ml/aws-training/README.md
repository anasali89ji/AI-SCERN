# DETECTAI — AWS SageMaker Training

Train all 4 models on AWS using your $100 credits.

## Cost Breakdown (ml.g4dn.xlarge @ ~$0.75/hr)

| Week | Model | Est. Time | Est. Cost |
|------|-------|-----------|-----------|
| Week 1 | Image Detector (Swin-Base) | 2–3 hrs | ~$2.50 |
| Week 2 | Video Detector (Swin-Base frames) | 2–3 hrs | ~$2.50 |
| Week 3 | Audio Detector (Wav2Vec2) | 3–4 hrs | ~$3.00 |
| Week 4 | Text Detector (DeBERTa-v3) | 2–3 hrs | ~$2.50 |
| **Total** | **All 4 models** | **~12 hrs** | **~$10** |

**$100 credits = train each model ~10 times** (plenty for experiments and retraining)

## Quick Start

### 1. One-Time AWS Setup (15 minutes)

```bash
# Request GPU quota (takes 24hrs — do this NOW)
AWS Console → Service Quotas → SageMaker →
"ml.g4dn.xlarge for training job instances" → Request increase → Value: 1

# Create S3 bucket
AWS Console → S3 → Create bucket → Name: detectai-training
```

### 2. Open SageMaker Studio

```
AWS Console → SageMaker → Studio → Open Studio
File → Upload → upload the folder for the model you're training this week
```

### 3. Run the Launcher Notebook

Each modality folder has `sagemaker_launch.ipynb`.
- Cell 1: Store your HF token (one time only)
- Cell 2–4: Launch the job
- Cell 5: Monitor progress

### 4. Monitor Cost

```
AWS Console → Billing → Cost Explorer
Set "Service" = SageMaker to see real-time spend
```

## Folder Structure

```
aws-training/
├── image/
│   ├── train.py              ← SageMaker training script
│   ├── requirements.txt      ← Python dependencies
│   └── sagemaker_launch.ipynb ← Run this in SageMaker Studio
├── video/
│   ├── train.py
│   └── requirements.txt
├── audio/
│   ├── train.py
│   └── requirements.txt
└── text/
    ├── train.py
    └── requirements.txt
```

## After Training

Each script automatically:
1. Saves model to `/opt/ml/model/` → SageMaker uploads to your S3
2. Pushes model + tokenizer to your HuggingFace repo
3. Your website (`hf-analyze.ts`) picks up the new weights instantly

## Tips to Save Money

- Use `keep_alive_period_in_seconds=300` (warm pool) — saves 3–5 min startup per job
- Set a **billing alarm**: Billing → Budgets → Create → Alert at $20 spent
- Stop notebook instances when not in use (they charge even idle)
- Use Spot instances for 60–70% savings (add `use_spot_instances=True` to estimator)
