"""DETECTAI — Audio Detector SageMaker Training Script"""
import os, json, argparse, time, random
import numpy as np, torch, torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.metrics import f1_score, accuracy_score, classification_report
from sklearn.utils.class_weight import compute_class_weight
from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor
from datasets import load_dataset, Audio

MODEL_DIR  = os.environ.get("SM_MODEL_DIR",  "/opt/ml/model")
OUTPUT_DIR = os.environ.get("SM_OUTPUT_DIR", "/opt/ml/output")
os.makedirs(MODEL_DIR,exist_ok=True); os.makedirs(OUTPUT_DIR,exist_ok=True)

TARGET_SR=16000; MAX_SEC=8.0; MAX_SAMPLES=int(TARGET_SR*MAX_SEC)

def parse_args():
    p=argparse.ArgumentParser()
    p.add_argument("--epochs",     type=int,   default=8)
    p.add_argument("--batch_size", type=int,   default=16)
    p.add_argument("--lr",         type=float, default=5e-5)
    p.add_argument("--hf_token",   type=str,   default="")
    p.add_argument("--hf_repo",    type=str,   default="saghi776/aiscern-audio-detector")
    return p.parse_args()

def safe_audio(item):
    try:
        a=item.get("audio") or item.get("speech")
        if a is None: return None
        arr=np.array(a["array"],dtype=np.float32); src_sr=int(a.get("sampling_rate",TARGET_SR))
        if src_sr!=TARGET_SR:
            import torchaudio.functional as AF
            arr=AF.resample(torch.from_numpy(arr),src_sr,TARGET_SR).numpy()
        if arr.ndim>1: arr=arr.mean(axis=0)
        if len(arr)<MAX_SAMPLES: arr=np.pad(arr,(0,MAX_SAMPLES-len(arr)))
        else: arr=arr[:MAX_SAMPLES]
        return arr.astype(np.float32)
    except: return None

def load_records():
    records=[]
    for ds_name,split,get_lbl in [
        ("aarnphm/wavefake","train",lambda i: int(i.get("label",0))),
        ("Sreyan88/FakeOrReal","train",lambda i: int(i.get("label",i.get("labels",0)))),
    ]:
        try:
            ds=load_dataset(ds_name,split=split,trust_remote_code=True).cast_column("audio",Audio(sampling_rate=TARGET_SR))
            for item in ds:
                arr=safe_audio(item)
                if arr is not None: records.append({"audio":arr,"label":get_lbl(item)})
            print(f"  ✓ {ds_name}: {len(ds)}")
        except Exception as e: print(f"  ✗ {ds_name}: {e}")
    random.shuffle(records); return records

class AudioDataset(Dataset):
    def __init__(self,recs,fe): self.recs=recs; self.fe=fe
    def __len__(self): return len(self.recs)
    def __getitem__(self,i):
        arr=self.recs[i]["audio"].astype(np.float32)
        inp=self.fe(arr,sampling_rate=TARGET_SR,return_tensors="pt",padding="max_length",max_length=MAX_SAMPLES,truncation=True)
        return inp.input_values.squeeze(0),torch.tensor(self.recs[i]["label"],dtype=torch.long)

def main():
    args=parse_args(); device=torch.device("cuda" if torch.cuda.is_available() else "cpu"); print(f"Device: {device}")
    if args.hf_token:
        from huggingface_hub import login; login(token=args.hf_token,add_to_git_credential=False)
    BASE="facebook/wav2vec2-base"
    fe=Wav2Vec2FeatureExtractor.from_pretrained(BASE)
    records=load_records(); split_idx=int(len(records)*0.9)
    train_ds=AudioDataset(records[:split_idx],fe); val_ds=AudioDataset(records[split_idx:],fe)
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")
    labels_arr=np.array([r["label"] for r in records[:split_idx]])
    cw=compute_class_weight("balanced",classes=np.unique(labels_arr),y=labels_arr)
    criterion=nn.CrossEntropyLoss(weight=torch.tensor(cw,dtype=torch.float32).to(device))
    nw=4 if device.type=="cuda" else 0
    train_loader=DataLoader(train_ds,batch_size=args.batch_size,shuffle=True,num_workers=nw,pin_memory=True)
    val_loader=DataLoader(val_ds,batch_size=args.batch_size,shuffle=False,num_workers=nw,pin_memory=True)
    model=Wav2Vec2ForSequenceClassification.from_pretrained(BASE,num_labels=2,id2label={0:"human-real",1:"ai-synthetic"},label2id={"human-real":0,"ai-synthetic":1})
    for p in model.wav2vec2.feature_extractor.parameters(): p.requires_grad=False
    model=model.to(device)
    optimizer=AdamW(model.parameters(),lr=args.lr,weight_decay=0.01); scheduler=CosineAnnealingLR(optimizer,T_max=args.epochs)
    best_f1,best_wts=0.0,None
    for epoch in range(args.epochs):
        t0=time.time(); model.train(); va_preds,va_true=[],[]
        for step,(audio,labels) in enumerate(train_loader):
            audio,labels=audio.to(device),labels.to(device); optimizer.zero_grad()
            out=model(input_values=audio); loss=criterion(out.logits,labels); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); optimizer.step()
            if (step+1)%20==0: print(f"  Ep{epoch+1} step{step+1}/{len(train_loader)} loss={loss.item():.4f}")
        model.eval()
        with torch.no_grad():
            for audio,labels in val_loader:
                audio,labels=audio.to(device),labels.to(device)
                out=model(input_values=audio); va_preds.extend(out.logits.argmax(-1).cpu().numpy()); va_true.extend(labels.cpu().numpy())
        scheduler.step(); va_f1=f1_score(va_true,va_preds,average="weighted"); va_acc=accuracy_score(va_true,va_preds)
        print(f"\nEpoch {epoch+1}/{args.epochs} ({time.time()-t0:.0f}s) — Val F1: {va_f1:.4f} Acc: {va_acc:.4f}")
        if va_f1>best_f1: best_f1=va_f1; best_wts={k:v.clone() for k,v in model.state_dict().items()}; print(f"  ⭐ Best F1: {best_f1:.4f}")
    model.load_state_dict(best_wts); model.save_pretrained(MODEL_DIR); fe.save_pretrained(MODEL_DIR)
    with open(os.path.join(OUTPUT_DIR,"metrics.json"),"w") as f: json.dump({"best_val_f1":best_f1},f)
    if args.hf_token:
        model.push_to_hub(args.hf_repo,commit_message=f"SageMaker — F1={best_f1:.4f}"); fe.push_to_hub(args.hf_repo)
        print(f"✅ https://huggingface.co/{args.hf_repo}")
    print(f"\n✅ Best Val F1 = {best_f1:.4f}")

if __name__=="__main__": main()
