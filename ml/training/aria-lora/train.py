"""
ARIA LoRA — training script for a DigitalOcean GPU Droplet (or any bare
Linux box with a CUDA GPU and SSH access). Same training logic as
aria_lora_training.ipynb, without the Colab upload/mount cells — run it
over SSH instead.

Usage (on the Droplet, after scp'ing aria_sft.jsonl over):

    python3 train.py --dataset aria_sft.jsonl --output ./aria-lora-adapter

Optional: --push-to-hub your-username/aria-lora-qwen2.5-7b (needs
`huggingface-cli login` run first, or HF_TOKEN set in the environment).

Recommended Droplet: L40S or RTX 6000 Ada (~$1.57/GPU-hr on-demand as of
Sept 2026) — a 7B QLoRA fine-tune doesn't need H100-class hardware. Expect
well under $1 for a run this size. See setup_droplet.sh for the one-time
environment setup, and the README's "DigitalOcean" section for the full
workflow including the destroy-when-done billing note.
"""
import argparse
import json

import torch
from datasets import Dataset
from peft import LoraConfig, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer


def load_dataset(path: str) -> Dataset:
    rows = []
    with open(path) as f:
        for line in f:
            rows.append(json.loads(line))
    return Dataset.from_list(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, help="Path to aria_sft.jsonl (from build_dataset.py)")
    ap.add_argument("--base-model", default="Qwen/Qwen2.5-7B-Instruct")
    ap.add_argument("--output", default="./aria-lora-adapter")
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--push-to-hub", default=None, help="HF Hub repo id, e.g. your-username/aria-lora-qwen2.5-7b")
    args = ap.parse_args()

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    print(f"Loading {args.base_model}...")
    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
    )
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model)

    print(f"Loading dataset from {args.dataset}...")
    raw = load_dataset(args.dataset)
    print(f"{len(raw)} examples")

    def render(example):
        text = tokenizer.apply_chat_template(
            example["messages"], tools=example.get("tools"), tokenize=False, add_generation_prompt=False,
        )
        return {"text": text}

    dataset = raw.map(render, remove_columns=[c for c in raw.column_names if c != "text"])

    lora_config = LoraConfig(
        r=16, lora_alpha=32, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )

    sft_config = SFTConfig(
        output_dir="./aria-lora-out",
        num_train_epochs=args.epochs,
        per_device_train_batch_size=2,       # a Droplet GPU has more headroom than a free T4
        gradient_accumulation_steps=4,
        gradient_checkpointing=True,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        logging_steps=5,
        save_strategy="epoch",
        bf16=True,
        max_seq_length=2048,
        dataset_text_field="text",
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model, args=sft_config, train_dataset=dataset,
        peft_config=lora_config, processing_class=tokenizer,
    )

    print("Training...")
    trainer.train()

    print(f"Saving adapter to {args.output}")
    trainer.model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)

    if args.push_to_hub:
        print(f"Pushing to {args.push_to_hub}")
        trainer.model.push_to_hub(args.push_to_hub)
        tokenizer.push_to_hub(args.push_to_hub)

    print("Done. Remember to destroy the Droplet if you're not using it for inference too.")


if __name__ == "__main__":
    main()
