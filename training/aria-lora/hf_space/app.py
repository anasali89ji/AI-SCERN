"""
ARIA LoRA — HF Spaces inference server (ZeroGPU, free tier).

Loads the Qwen2.5-7B-Instruct base model + the LoRA adapter trained by
aria_lora_training.ipynb, and exposes a single OpenAI-compatible endpoint:

    POST /v1/chat/completions
    { "messages": [...], "tools": [...] }  ->  { "choices": [{ "message": {...} }] }

Deliberately mirrors the shape frontend/lib/inference/nvidia-nim.ts and
frontend/lib/aria/function-calling.ts already speak, so swapping this in as
a provider needs no parsing changes on the Next.js side.

Deploy: create a new HF Space, SDK = Gradio, hardware = ZeroGPU. Copy this
file + requirements.txt into it. Set repo secrets/variables:
  BASE_MODEL    (default: Qwen/Qwen2.5-7B-Instruct)
  ADAPTER_REPO  (your fine-tuned adapter repo from the notebook's push_to_hub)

ZeroGPU is free but not always-on — the first request after idle has cold-
start latency (model load). Fine for a hobby-scale assistant; not a
guarantee of low latency under load.
"""
import json
import os
import time

import gradio as gr
import spaces
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct")
ADAPTER_REPO = os.environ.get("ADAPTER_REPO", "")  # e.g. "your-username/aria-lora-qwen2.5-7b"

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
if ADAPTER_REPO:
    from peft import PeftModel
    model = PeftModel.from_pretrained(model, ADAPTER_REPO)
model.eval()


@spaces.GPU(duration=60)
def generate(messages: list[dict], tools: list[dict] | None, max_new_tokens: int = 512):
    prompt = tokenizer.apply_chat_template(
        messages,
        tools=tools or None,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.4,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    text = tokenizer.decode(output[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
    return text


def parse_tool_calls(raw_text: str):
    """Qwen2.5's chat template renders tool calls as <tool_call>{...}</tool_call>
    blocks. Extract them into OpenAI's tool_calls shape; if none are present,
    treat the whole output as a plain content string."""
    import re

    matches = re.findall(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", raw_text, re.DOTALL)
    if not matches:
        return raw_text.strip(), None

    tool_calls = []
    for i, m in enumerate(matches):
        try:
            call = json.loads(m)
            tool_calls.append({
                "id": f"call_{i}",
                "type": "function",
                "function": {"name": call.get("name"), "arguments": json.dumps(call.get("arguments", {}))},
            })
        except json.JSONDecodeError:
            continue
    return None, (tool_calls or None)


def chat_completions(payload: dict):
    messages = payload.get("messages", [])
    tools = payload.get("tools")
    max_tokens = payload.get("max_tokens", 512)

    raw = generate(messages, tools, max_new_tokens=max_tokens)
    content, tool_calls = parse_tool_calls(raw)

    return {
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "model": "aria-lora",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": content, "tool_calls": tool_calls},
            "finish_reason": "tool_calls" if tool_calls else "stop",
        }],
    }


def gradio_handler(payload_json: str) -> str:
    try:
        payload = json.loads(payload_json)
        return json.dumps(chat_completions(payload))
    except Exception as e:  # noqa: BLE001 — surface the error to the caller, not a 500
        return json.dumps({"error": str(e)})


demo = gr.Interface(
    fn=gradio_handler,
    inputs=gr.Textbox(label="OpenAI-style chat completion request (JSON)", lines=10),
    outputs=gr.Textbox(label="Response (JSON)", lines=10),
    title="ARIA LoRA — inference endpoint",
    description="POST a JSON body via this Space's /call/gradio_handler API route, or use the HF Spaces REST API wrapper.",
    api_name="chat_completions",
)

if __name__ == "__main__":
    demo.launch()
