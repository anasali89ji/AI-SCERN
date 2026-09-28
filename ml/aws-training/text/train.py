"""DETECTAI — Text Detector SageMaker Training Script"""
import os, json, argparse, time, random
import numpy as np, torch, torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.metrics import f1_score, accuracy_score, classification_report
from sklearn.utils.class_weight import compute_class_weight
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from datasets import load_dataset

MODEL_DIR  = os.environ.get("SM_MODEL_DIR",  "/opt/ml/model")
OUTPUT_DIR = os.environ.get("SM_OUTPUT_DIR", "/opt/ml/output")
os.makedirs(MODEL_DIR,exist_ok=True); os.makedirs(OUTPUT_DIR,exist_ok=True)

def parse_args():
    p=argparse.ArgumentParser()
    p.add_argument("--epochs",     type=int,   default=5)
    p.add_argument("--batch_size", type=int,   default=16)
    p.add_argument("--lr",         type=float, default=1e-5)
    p.add_argument("--max_len",    type=int,   default=512)
    p.add_argument("--hf_token",   type=str,   default="")
    p.add_argument("--hf_repo",    type=str,   default="saghi776/aiscern-text-detector")
    return p.parse_args()

def load_rows():
    rows=[]
    # HC3
    try:
        ds=load_dataset("Hello-SimpleAI/HC3",name="all",split="train",trust_remote_code=True)
        for item in ds:
            for txt in (item.get("human_answers") or []):
                if txt and len(txt.strip())>50: rows.append({"text":txt.strip()[:2000],"label":0})
            for txt in (item.get("chatgpt_answers") or []):
                if txt and len(txt.strip())>50: rows.append({"text":txt.strip()[:2000],"label":1})
        print(f"  ✓ HC3: {len(ds)}")
    except Exception as e: print(f"  ✗ HC3: {e}")
    # Research abstracts
    try:
        ds=load_dataset("NicolaiSivesind/ChatGPT-Research-Abstracts",split="train",trust_remote_code=True)
        for item in ds:
            h=item.get("real_abstract",""); a=item.get("generated_abstract","")
            if len(h.strip())>50: rows.append({"text":h.strip()[:2000],"label":0})
            if len(a.strip())>50: rows.append({"text":a.strip()[:2000],"label":1})
        print(f"  ✓ Research Abstracts: {len(ds)}")
    except Exception as e: print(f"  ✗ Abstracts: {e}")
    # WebText
    try:
        ds=load_dataset("stas/openwebtext-10k",split="train",trust_remote_code=True)
        for item in ds:
            t=item.get("text","")
            if len(t.strip())>100: rows.append({"text":t.strip()[:2000],"label":0})
        print(f"  ✓ WebText: {len(ds)}")
    except Exception as e: print(f"  ✗ WebText: {e}")
    # RAID
    try:
        ds=load_dataset("liamdugan/raid",split="train[:5000]",trust_remote_code=True)
        tc=next((c for c in ds.column_names if c in ("generation","text")),None)
        lc="label" if "label" in ds.column_names else "model"
        if tc:
            for item in ds:
                txt=item.get(tc,"")
                if len(txt.strip())>50:
                    lbl=0 if str(item.get(lc,"human")).lower() in ("human","0","none") else 1
                    rows.append({"text":txt.strip()[:2000],"label":lbl})
        print(f"  ✓ RAID: {len(ds)}")
    except Exception as e: print(f"  ✗ RAID: {e}")
    random.shuffle(rows); return rows

class TextDataset(Dataset):
    def __init__(self,rows,tok,max_len): self.rows=rows; self.tok=tok; self.max_len=max_len
    def __len__(self): return len(self.rows)
    def __getitem__(self,i):
        enc=self.tok(self.rows[i]["text"],max_length=self.max_len,padding="max_length",truncation=True,return_tensors="pt")
        return {"input_ids":enc["input_ids"].squeeze(0),"attention_mask":enc["attention_mask"].squeeze(0),"label":torch.tensor(self.rows[i]["label"],dtype=torch.long)}

def collate(batch):
    return {"input_ids":torch.stack([b["input_ids"] for b in batch]),"attention_mask":torch.stack([b["attention_mask"] for b in batch]),"label":torch.stack([b["label"] for b in batch])}

def main():
    args=parse_args(); device=torch.device("cuda" if torch.cuda.is_available() else "cpu"); print(f"Device: {device}")
    if args.hf_token:
        from huggingface_hub import login; login(token=args.hf_token,add_to_git_credential=False)
    BASE="microsoft/deberta-v3-base"
    tok=AutoTokenizer.from_pretrained(BASE)
    rows=load_rows(); split_idx=int(len(rows)*0.9)
    train_ds=TextDataset(rows[:split_idx],tok,args.max_len); val_ds=TextDataset(rows[split_idx:],tok,args.max_len)
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")
    labels_arr=np.array([r["label"] for r in rows[:split_idx]])
    cw=compute_class_weight("balanced",classes=np.unique(labels_arr),y=labels_arr)
    criterion=nn.CrossEntropyLoss(weight=torch.tensor(cw,dtype=torch.float32).to(device))
    nw=4 if device.type=="cuda" else 0
    train_loader=DataLoader(train_ds,batch_size=args.batch_size,shuffle=True,num_workers=nw,collate_fn=collate)
    val_loader=DataLoader(val_ds,batch_size=args.batch_size,shuffle=False,num_workers=nw,collate_fn=collate)
    model=AutoModelForSequenceClassification.from_pretrained(BASE,num_labels=2,id2label={0:"human-written",1:"ai-generated"},label2id={"human-written":0,"ai-generated":1},ignore_mismatched_sizes=True).to(device)
    optimizer=AdamW(model.parameters(),lr=args.lr,weight_decay=0.01); scheduler=CosineAnnealingLR(optimizer,T_max=args.epochs)
    best_f1,best_wts=0.0,None
    for epoch in range(args.epochs):
        t0=time.time(); model.train(); va_preds,va_true=[],[]
        for step,batch in enumerate(train_loader):
            ids=batch["input_ids"].to(device); mask=batch["attention_mask"].to(device); labels=batch["label"].to(device)
            optimizer.zero_grad(); out=model(input_ids=ids,attention_mask=mask); loss=criterion(out.logits,labels); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); optimizer.step()
            if (step+1)%25==0: print(f"  Ep{epoch+1} step{step+1}/{len(train_loader)} loss={loss.item():.4f}")
        model.eval()
        with torch.no_grad():
            for batch in val_loader:
                ids=batch["input_ids"].to(device); mask=batch["attention_mask"].to(device)
                out=model(input_ids=ids,attention_mask=mask); va_preds.extend(out.logits.argmax(-1).cpu().numpy()); va_true.extend(batch["label"].numpy())
        scheduler.step(); va_f1=f1_score(va_true,va_preds,average="weighted"); va_acc=accuracy_score(va_true,va_preds)
        print(f"\nEpoch {epoch+1}/{args.epochs} ({time.time()-t0:.0f}s) — Val F1: {va_f1:.4f} Acc: {va_acc:.4f}")
        if va_f1>best_f1: best_f1=va_f1; best_wts={k:v.clone() for k,v in model.state_dict().items()}; print(f"  ⭐ Best F1: {best_f1:.4f}")
    model.load_state_dict(best_wts); model.save_pretrained(MODEL_DIR); tok.save_pretrained(MODEL_DIR)
    with open(os.path.join(OUTPUT_DIR,"metrics.json"),"w") as f: json.dump({"best_val_f1":best_f1},f)
    if args.hf_token:
        model.push_to_hub(args.hf_repo,commit_message=f"SageMaker — F1={best_f1:.4f}"); tok.push_to_hub(args.hf_repo)
        print(f"✅ https://huggingface.co/{args.hf_repo}")
    print(f"\n✅ Best Val F1 = {best_f1:.4f}")

if __name__=="__main__": main()
