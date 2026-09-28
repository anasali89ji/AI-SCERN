"""
DETECTAI — Image Detector SageMaker Training Script
Run via: sagemaker_image_train.ipynb
Output model saved to /opt/ml/model/ → auto-uploaded to S3 by SageMaker
"""

import os, json, argparse, time, random
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.metrics import f1_score, accuracy_score, classification_report
from sklearn.utils.class_weight import compute_class_weight
from transformers import SwinForImageClassification, AutoFeatureExtractor
from datasets import load_dataset
from PIL import Image
import albumentations as A
from albumentations.pytorch import ToTensorV2

# ── Paths SageMaker injects automatically ────────────────────────────────────
MODEL_DIR   = os.environ.get("SM_MODEL_DIR",   "/opt/ml/model")
OUTPUT_DIR  = os.environ.get("SM_OUTPUT_DIR",  "/opt/ml/output")
os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--epochs",       type=int,   default=6)
    p.add_argument("--batch_size",   type=int,   default=32)
    p.add_argument("--lr",           type=float, default=2e-5)
    p.add_argument("--weight_decay", type=float, default=0.01)
    p.add_argument("--hf_token",     type=str,   default="")
    p.add_argument("--hf_repo",      type=str,   default="saghi776/aiscern-image-detector")
    p.add_argument("--img_size",     type=int,   default=224)
    return p.parse_args()

IMG_SIZE = 224

train_aug = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.HorizontalFlip(p=0.5),
    A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.15, hue=0.05, p=0.5),
    A.GaussNoise(var_limit=(5.0, 25.0), p=0.3),
    A.OneOf([A.GaussianBlur(blur_limit=(3,5), p=1.0), A.Sharpen(alpha=(0.1,0.3), p=1.0)], p=0.25),
    A.Normalize(mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]),
    ToTensorV2(),
])
val_aug = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.Normalize(mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]),
    ToTensorV2(),
])

class ImageDataset(Dataset):
    def __init__(self, records, transform):
        self.records   = records
        self.transform = transform
    def __len__(self): return len(self.records)
    def __getitem__(self, idx):
        img = self.records[idx]["image"]
        if not isinstance(img, np.ndarray):
            img = np.array(img.convert("RGB"), dtype=np.uint8)
        aug = self.transform(image=img)
        return aug["image"], torch.tensor(self.records[idx]["label"], dtype=torch.long)

def load_records():
    records = []
    print("Loading CIFAKE...")
    try:
        ds = load_dataset("judegrant/cifake", split="train", trust_remote_code=True)
        lc = "label" if "label" in ds.column_names else ds.column_names[-1]
        for item in ds:
            img = item.get("image") or item.get("img")
            if img and hasattr(img, "size"):
                records.append({"image": img.resize((IMG_SIZE,IMG_SIZE)).convert("RGB"), "label": int(item[lc])})
        print(f"  CIFAKE: {len(ds)}")
    except Exception as e: print(f"  CIFAKE failed: {e}")

    print("Loading DiffusionDB...")
    try:
        ds = load_dataset("poloclub/diffusiondb", "2m_random_1k", split="train", trust_remote_code=True)
        for item in ds:
            img = item.get("image") or item.get("img")
            if img and hasattr(img, "size"):
                records.append({"image": img.resize((IMG_SIZE,IMG_SIZE)).convert("RGB"), "label": 1})
        print(f"  DiffusionDB: {len(ds)}")
    except Exception as e: print(f"  DiffusionDB failed: {e}")

    print("Loading AI-vs-Human...")
    try:
        ds = load_dataset("Hemg/AI-Vs-Human-Generated-Dataset", split="train", trust_remote_code=True)
        lc = "label" if "label" in ds.column_names else ds.column_names[-1]
        for item in ds:
            img = item.get("image") or item.get("img")
            if img and hasattr(img, "size"):
                records.append({"image": img.resize((IMG_SIZE,IMG_SIZE)).convert("RGB"), "label": int(item[lc])})
        print(f"  AI-vs-Human: {len(ds)}")
    except Exception as e: print(f"  AI-vs-Human failed: {e}")

    print("Loading platform dataset...")
    try:
        ds = load_dataset("saghi776/detectai-dataset", name="image_en", split="train", trust_remote_code=True)
        for item in ds:
            img = item.get("image") or item.get("img")
            lbl = 1 if str(item.get("label","human")).lower() in ("ai","1","fake","generated") else 0
            if img and hasattr(img, "size"):
                records.append({"image": img.resize((IMG_SIZE,IMG_SIZE)).convert("RGB"), "label": lbl})
        print(f"  Platform: {len(ds)}")
    except Exception as e: print(f"  Platform: {e}")

    random.shuffle(records)
    return records

def main():
    args   = parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\nDevice: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    # HuggingFace auth
    if args.hf_token:
        from huggingface_hub import login
        login(token=args.hf_token, add_to_git_credential=False)
        print("HF authenticated")

    # Data
    records   = load_records()
    split_idx = int(len(records) * 0.9)
    train_ds  = ImageDataset(records[:split_idx], train_aug)
    val_ds    = ImageDataset(records[split_idx:],  val_aug)
    print(f"\nTrain: {len(train_ds)} | Val: {len(val_ds)}")

    # Class weights
    labels_arr   = np.array([r["label"] for r in records[:split_idx]])
    cw           = compute_class_weight("balanced", classes=np.unique(labels_arr), y=labels_arr)
    criterion    = nn.CrossEntropyLoss(weight=torch.tensor(cw, dtype=torch.float32).to(device))

    # Loaders
    nw           = 4 if device.type == "cuda" else 0
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=nw, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size, shuffle=False, num_workers=nw, pin_memory=True)

    # Model
    BASE = "microsoft/swin-base-patch4-window7-224"
    model = SwinForImageClassification.from_pretrained(
        BASE, num_labels=2,
        id2label={0:"human-real",1:"ai-generated"},
        label2id={"human-real":0,"ai-generated":1},
        ignore_mismatched_sizes=True,
    ).to(device)

    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_f1, best_wts = 0.0, None
    metrics_log = []

    for epoch in range(args.epochs):
        t0 = time.time()
        model.train()
        tr_preds, tr_true = [], []
        for step, (imgs, labels) in enumerate(train_loader):
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            out  = model(pixel_values=imgs)
            loss = criterion(out.logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            tr_preds.extend(out.logits.argmax(-1).cpu().numpy())
            tr_true.extend(labels.cpu().numpy())
            if (step+1) % 50 == 0:
                print(f"  Ep{epoch+1} step{step+1}/{len(train_loader)} loss={loss.item():.4f}")

        model.eval()
        va_preds, va_true = [], []
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                out = model(pixel_values=imgs)
                va_preds.extend(out.logits.argmax(-1).cpu().numpy())
                va_true.extend(labels.cpu().numpy())
        scheduler.step()

        va_f1  = f1_score(va_true, va_preds, average="weighted")
        va_acc = accuracy_score(va_true, va_preds)
        elapsed = time.time() - t0
        print(f"\nEpoch {epoch+1}/{args.epochs} ({elapsed:.0f}s) — Val F1: {va_f1:.4f} Acc: {va_acc:.4f}")
        metrics_log.append({"epoch": epoch+1, "val_f1": va_f1, "val_acc": va_acc})

        if va_f1 > best_f1:
            best_f1  = va_f1
            best_wts = {k: v.clone() for k, v in model.state_dict().items()}
            print(f"  ⭐ New best F1: {best_f1:.4f}")

    # Final eval
    model.load_state_dict(best_wts)
    model.eval()
    print("\n" + "="*50)
    print(classification_report(va_true, va_preds, target_names=["Real","AI"], digits=4))

    # Save metrics
    with open(os.path.join(OUTPUT_DIR, "metrics.json"), "w") as f:
        json.dump({"best_val_f1": best_f1, "epochs": metrics_log}, f, indent=2)

    # Save model locally (SageMaker uploads /opt/ml/model to S3 automatically)
    model.save_pretrained(MODEL_DIR)
    fe = AutoFeatureExtractor.from_pretrained(BASE)
    fe.save_pretrained(MODEL_DIR)
    print(f"\nModel saved to {MODEL_DIR}")

    # Push to HuggingFace Hub
    if args.hf_token and args.hf_repo:
        print(f"Pushing to HuggingFace: {args.hf_repo}")
        model.push_to_hub(args.hf_repo, commit_message=f"SageMaker — F1={best_f1:.4f}")
        fe.push_to_hub(args.hf_repo)
        print(f"✅ Live at: https://huggingface.co/{args.hf_repo}")

    print(f"\n✅ Training complete. Best Val F1 = {best_f1:.4f}")

if __name__ == "__main__":
    main()
