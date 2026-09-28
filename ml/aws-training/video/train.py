"""DETECTAI — Video Frame Detector SageMaker Training Script"""
import os, json, argparse, time, random
import numpy as np, torch, torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.metrics import f1_score, accuracy_score, classification_report
from sklearn.utils.class_weight import compute_class_weight
from transformers import SwinForImageClassification, AutoFeatureExtractor
from datasets import load_dataset
import albumentations as A
from albumentations.pytorch import ToTensorV2

MODEL_DIR  = os.environ.get("SM_MODEL_DIR",  "/opt/ml/model")
OUTPUT_DIR = os.environ.get("SM_OUTPUT_DIR", "/opt/ml/output")
os.makedirs(MODEL_DIR, exist_ok=True); os.makedirs(OUTPUT_DIR, exist_ok=True)

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--epochs",     type=int,   default=6)
    p.add_argument("--batch_size", type=int,   default=64)
    p.add_argument("--lr",         type=float, default=2e-5)
    p.add_argument("--hf_token",   type=str,   default="")
    p.add_argument("--hf_repo",    type=str,   default="saghi776/aiscern-video-detector")
    return p.parse_args()

IMG_SIZE = 224
train_aug = A.Compose([A.Resize(IMG_SIZE,IMG_SIZE),A.HorizontalFlip(p=0.5),A.RandomBrightnessContrast(p=0.3),A.GaussNoise(var_limit=(5,20),p=0.2),A.Normalize(mean=[0.485,0.456,0.406],std=[0.229,0.224,0.225]),ToTensorV2()])
val_aug   = A.Compose([A.Resize(IMG_SIZE,IMG_SIZE),A.Normalize(mean=[0.485,0.456,0.406],std=[0.229,0.224,0.225]),ToTensorV2()])

class FrameDataset(Dataset):
    def __init__(self, recs, tf): self.recs=recs; self.tf=tf
    def __len__(self): return len(self.recs)
    def __getitem__(self, i):
        img = self.recs[i]["image"]
        if not isinstance(img, np.ndarray): img=np.array(img.convert("RGB"),dtype=np.uint8)
        out=self.tf(image=img); return out["image"],torch.tensor(self.recs[i]["label"],dtype=torch.long)

def load_records():
    records=[]
    sources=[
        ("judegrant/cifake","train","label",None,lambda i,l: int(i[l])),
        ("Warvito/FaceForensics_faces","train","label",None,lambda i,l: int(i[l])),
    ]
    for ds_name,split,lc,sub,get_lbl in sources:
        try:
            ds=load_dataset(ds_name,split=split,trust_remote_code=True)
            lc_=lc if lc in ds.column_names else ds.column_names[-1]
            for item in ds:
                img=item.get("image") or item.get("img")
                if img and hasattr(img,"size"):
                    records.append({"image":img.resize((IMG_SIZE,IMG_SIZE)).convert("RGB"),"label":get_lbl(item,lc_)})
            print(f"  ✓ {ds_name}: {len(ds)}")
        except Exception as e: print(f"  ✗ {ds_name}: {e}")
    random.shuffle(records); return records

def main():
    args=parse_args()
    device=torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if args.hf_token:
        from huggingface_hub import login; login(token=args.hf_token,add_to_git_credential=False)
    records=load_records(); split_idx=int(len(records)*0.9)
    train_ds=FrameDataset(records[:split_idx],train_aug); val_ds=FrameDataset(records[split_idx:],val_aug)
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")
    labels_arr=np.array([r["label"] for r in records[:split_idx]])
    cw=compute_class_weight("balanced",classes=np.unique(labels_arr),y=labels_arr)
    criterion=nn.CrossEntropyLoss(weight=torch.tensor(cw,dtype=torch.float32).to(device))
    nw=4 if device.type=="cuda" else 0
    train_loader=DataLoader(train_ds,batch_size=args.batch_size,shuffle=True,num_workers=nw,pin_memory=True)
    val_loader=DataLoader(val_ds,batch_size=args.batch_size,shuffle=False,num_workers=nw,pin_memory=True)
    BASE="microsoft/swin-base-patch4-window7-224"
    model=SwinForImageClassification.from_pretrained(BASE,num_labels=2,id2label={0:"real",1:"deepfake-ai"},label2id={"real":0,"deepfake-ai":1},ignore_mismatched_sizes=True).to(device)
    optimizer=AdamW(model.parameters(),lr=args.lr,weight_decay=0.01)
    scheduler=CosineAnnealingLR(optimizer,T_max=args.epochs)
    best_f1,best_wts=0.0,None
    for epoch in range(args.epochs):
        t0=time.time(); model.train(); tr_preds,tr_true=[],[]
        for step,(imgs,labels) in enumerate(train_loader):
            imgs,labels=imgs.to(device),labels.to(device); optimizer.zero_grad()
            out=model(pixel_values=imgs); loss=criterion(out.logits,labels); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); optimizer.step()
            tr_preds.extend(out.logits.argmax(-1).cpu().numpy()); tr_true.extend(labels.cpu().numpy())
            if (step+1)%50==0: print(f"  Ep{epoch+1} step{step+1}/{len(train_loader)} loss={loss.item():.4f}")
        model.eval(); va_preds,va_true=[],[]
        with torch.no_grad():
            for imgs,labels in val_loader:
                imgs,labels=imgs.to(device),labels.to(device)
                out=model(pixel_values=imgs); va_preds.extend(out.logits.argmax(-1).cpu().numpy()); va_true.extend(labels.cpu().numpy())
        scheduler.step(); va_f1=f1_score(va_true,va_preds,average="weighted"); va_acc=accuracy_score(va_true,va_preds)
        print(f"\nEpoch {epoch+1}/{args.epochs} ({time.time()-t0:.0f}s) — Val F1: {va_f1:.4f} Acc: {va_acc:.4f}")
        if va_f1>best_f1: best_f1=va_f1; best_wts={k:v.clone() for k,v in model.state_dict().items()}; print(f"  ⭐ Best F1: {best_f1:.4f}")
    model.load_state_dict(best_wts); model.save_pretrained(MODEL_DIR)
    AutoFeatureExtractor.from_pretrained(BASE).save_pretrained(MODEL_DIR)
    with open(os.path.join(OUTPUT_DIR,"metrics.json"),"w") as f: json.dump({"best_val_f1":best_f1},f)
    if args.hf_token:
        model.push_to_hub(args.hf_repo,commit_message=f"SageMaker — F1={best_f1:.4f}")
        AutoFeatureExtractor.from_pretrained(BASE).push_to_hub(args.hf_repo)
        print(f"✅ https://huggingface.co/{args.hf_repo}")
    print(f"\n✅ Best Val F1 = {best_f1:.4f}")

if __name__=="__main__": main()
