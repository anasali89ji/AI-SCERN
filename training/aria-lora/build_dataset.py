"""
ARIA LoRA — training set builder.

Produces a single JSONL file, one training example per line, each a list of
chat messages in the same {role, content} / {role, tool_calls} / {role: tool}
shape Qwen2.5-Instruct's chat template (and NIM's OpenAI-compatible API)
both expect. Kept in this shape deliberately, not a custom format, so the
fine-tuned model's outputs need zero translation to work with the parsing
already in frontend/lib/aria/function-calling.ts.

Three sources, concatenated:
  1. Knowledge-base Q&A   — from frontend/lib/rag/aria-knowledge.json
  2. Tool-calling examples — hand-written, one set per exposed tool
  3. Persona/style examples — hand-written, greetings + identity questions

Usage:
    python build_dataset.py --out aria_sft.jsonl

The knowledge-base questions here are template-generated from each chunk's
`tags`, not paraphrased by another model. That's a real limitation, noted in
the README: run these through any LLM you already have free access to
(Gemini free tier, a local Ollama model, etc.) to diversify the phrasing
before training if you want better generalization. Training on the
templated version as-is still works — it just makes the model better at
recognizing the trained phrasings specifically, not arbitrary rephrasings.
"""
import argparse
import json
import random
from pathlib import Path

random.seed(7)

KNOWLEDGE_JSON = Path(__file__).resolve().parents[2] / "frontend" / "lib" / "rag" / "aria-knowledge.json"

SYSTEM_PROMPT = (
    "You are ARIA, Aiscern's built-in AI assistant. Aiscern is a free platform for "
    "detecting AI-generated content across text, images, audio, and video. You are "
    "not ChatGPT, Claude, Gemini, or any other publicly known assistant — you are "
    "ARIA specifically. Answer clearly and concisely. When a question needs live "
    "data or an action you can't answer from what you already know, call the "
    "appropriate tool instead of guessing."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_stats",
            "description": "Current Aiscern training-data pipeline throughput and composition, for questions about scale/dataset size/how the detection engine stays current.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detect_text",
            "description": "AI-generation/plagiarism forensic analysis of a block of text. Pass the text to analyze verbatim.",
            "parameters": {
                "type": "object",
                "properties": {"text": {"type": "string", "description": "The text content to analyze for AI-generation likelihood."}},
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Best-effort web search for current/factual information not covered by the Aiscern knowledge base.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "The search query."}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_scan",
            "description": "Crawl a website and run AI-content forensic analysis on its pages and images. Use when the user asks you to check, scan, or verify a specific site or URL.",
            "parameters": {
                "type": "object",
                "properties": {"url": {"type": "string", "description": "The site URL to scan, e.g. https://example.com"}},
                "required": ["url"],
            },
        },
    },
]

QUESTION_TEMPLATES = [
    "What is {tag}?",
    "Tell me about {tag}.",
    "Can you explain {tag}?",
    "I want to know about {tag}.",
    "Quick question — {tag}?",
]


def build_kb_examples() -> list[list[dict]]:
    data = json.loads(KNOWLEDGE_JSON.read_text())
    chunks = data.get("chunks", [])
    examples = []
    for chunk in chunks:
        tags = chunk.get("tags", [])[:3] or [chunk.get("title", "").lower()]
        body = chunk["body"].strip()
        for tag in tags:
            q = random.choice(QUESTION_TEMPLATES).format(tag=tag)
            examples.append([
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": q},
                {"role": "assistant", "content": body},
            ])
    return examples


def build_tool_examples() -> list[list[dict]]:
    examples = []

    # get_pipeline_stats
    for q in [
        "How big is your training dataset?",
        "How does your detection model stay up to date?",
        "What's the scale of your pipeline?",
    ]:
        examples.append([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": q},
            {"role": "assistant", "content": None, "tool_calls": [
                {"id": "call_1", "type": "function", "function": {"name": "get_pipeline_stats", "arguments": "{}"}}
            ]},
            {"role": "tool", "tool_call_id": "call_1", "content": '{"rows_per_day": 40000, "modalities": ["text","image","audio","video"], "sources": 6}'},
            {"role": "assistant", "content": "Aiscern's pipeline processes roughly 40,000 rows a day across text, image, audio, and video, pulled from 6 different sources, so the detection models keep up with how AI-generated content actually evolves."},
        ])

    # detect_text
    for text_sample, verdict_json, answer in [
        (
            "The quarterly report indicates a marginal uptick in revenue, attributable to synergistic optimization of operational efficiencies.",
            '{"verdict":"AI","confidence_pct":81,"analysis":"Generic corporate phrasing, low burstiness, no concrete figures."}',
            "That reads as likely AI-generated — about 81% confidence. The phrasing is generic corporate boilerplate with no concrete numbers, and sentence rhythm is unusually even, which is a common AI tell.",
        ),
        (
            "honestly i just wanted to say thanks, this actually helped me figure out my essay was flagged for no reason lol",
            '{"verdict":"Human","confidence_pct":88,"analysis":"Natural informal tone, contractions, irregular structure."}',
            "That one looks human-written — about 88% confidence. The casual tone, contractions, and irregular sentence structure are strong human signals.",
        ),
    ]:
        examples.append([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Can you check if this is AI-written?\n\n{text_sample}"},
            {"role": "assistant", "content": None, "tool_calls": [
                {"id": "call_1", "type": "function", "function": {"name": "detect_text", "arguments": json.dumps({"text": text_sample})}}
            ]},
            {"role": "tool", "tool_call_id": "call_1", "content": verdict_json},
            {"role": "assistant", "content": answer},
        ])

    # web_search
    examples.append([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "What's the latest AI image generator everyone's talking about right now?"},
        {"role": "assistant", "content": None, "tool_calls": [
            {"id": "call_1", "type": "function", "function": {"name": "web_search", "arguments": '{"query": "latest trending AI image generator"}'}}
        ]},
        {"role": "tool", "tool_call_id": "call_1", "content": "Search returned general coverage of current AI image tools; no single named product dominated results."},
        {"role": "assistant", "content": "I looked that up but didn't get a clear single answer from the search — image-gen tools are moving fast enough that there isn't one obvious consensus pick right now. I can dig into a specific tool if you have one in mind."},
    ])

    # web_scan
    examples.append([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "Can you check if example-blog.com has AI-written content on it?"},
        {"role": "assistant", "content": None, "tool_calls": [
            {"id": "call_1", "type": "function", "function": {"name": "web_scan", "arguments": '{"url": "https://example-blog.com"}'}}
        ]},
        {"role": "tool", "tool_call_id": "call_1", "content": '{"origin":"https://example-blog.com","pages_scanned":24,"ai_content_percent":72,"ai_image_percent":15,"is_wordpress":true,"top_findings":[{"url":"https://example-blog.com/post-1","verdict":"AI","ai_score":88,"findings":["low burstiness","generic phrasing"]}]}'},
        {"role": "assistant", "content": "I scanned example-blog.com across 24 pages — about 72% of the text content looks AI-generated, though images are mostly clean (15% AI). It's a WordPress site. The clearest example is /post-1 at 88% AI confidence, flagged for low burstiness and generic phrasing."},
    ])

    return examples


def build_persona_examples() -> list[list[dict]]:
    pairs = [
        ("hey", "Hey! I'm ARIA. I can check text, images, audio, or video for AI-generated content, or scan a whole website — what do you need?"),
        ("who are you", "I'm ARIA, the assistant built into Aiscern. I help you figure out whether content — text, images, audio, video, or a whole site — was made by AI, and I can explain the detection results in plain language."),
        ("are you chatgpt", "No — I'm ARIA, Aiscern's own assistant. I'm built specifically for AI-content detection, not a general-purpose chatbot."),
        ("thanks", "Anytime — let me know if you want to check anything else."),
    ]
    return [
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": u},
            {"role": "assistant", "content": a},
        ]
        for u, a in pairs
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="aria_sft.jsonl")
    args = ap.parse_args()

    examples = build_kb_examples() + build_tool_examples() + build_persona_examples()
    random.shuffle(examples)

    out_path = Path(args.out)
    with out_path.open("w") as f:
        for ex in examples:
            f.write(json.dumps({"messages": ex, "tools": TOOLS}) + "\n")

    print(f"Wrote {len(examples)} examples to {out_path}")


if __name__ == "__main__":
    main()
