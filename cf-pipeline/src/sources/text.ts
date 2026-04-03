import type { Source } from '../types'

/**
 * Text sources — 28 datasets
 *
 * Fixed hc3-english: original had label_field='source' which is the domain
 * (medicine/finance/etc), not the label. Split into two explicit sources:
 * hc3-ai (chatgpt_answers) and hc3-human (human_answers).
 *
 * Fixed stack-exchange: answers is an array of {text_url, answer} objects;
 * added 'answer' to text_fields so the nested object extractor picks it up.
 */
export const TEXT_SOURCES: Source[] = [
  // ── HC3 replaced — Hello-SimpleAI/HC3 returns 404 (dataset moved/removed) ─
  // Replaced with verified working alternatives:
  { name: 'no-robots',         id: 'HuggingFaceH4/no_robots',              media_type: 'text', label: 'ai',    text_fields: ['prompt', 'messages', 'response'] },
  { name: 'truthfulqa-human',  id: 'truthful_qa',  config: 'generation',   media_type: 'text', label: 'human', text_fields: ['question', 'best_answer', 'correct_answers'] },

  // ── AI-detection benchmarks ──────────────────────────────────────────────
  // raid-benchmark removed — liamdugan/raid returns 404 (dataset removed); raid-v2 below covers it
  // ghostbuster removed — vivek9patel/ghostbuster-data is private/inaccessible
  { name: 'ai-detection-pile', id: 'artem9k/ai-text-detection-pile',                                    media_type: 'text', label: 'mixed', label_field: 'label',    label_map: { '1': 'ai', '0': 'human', ai: 'ai', human: 'human' }, text_fields: ['text', 'document'] },
  // ai-vs-human removed — shankarkarki/AI-Human-Text is private/inaccessible
  // mage-benchmark removed — ziweili/mage is private/inaccessible; m4-ai below covers detection benchmarks

  // ── AI-generated instruction/chat datasets ───────────────────────────────
  { name: 'dolly-15k',         id: 'databricks/databricks-dolly-15k',                                    media_type: 'text', label: 'ai',    text_fields: ['response', 'context', 'instruction'] },
  { name: 'alpaca',            id: 'tatsu-lab/alpaca',                                                    media_type: 'text', label: 'ai',    text_fields: ['output', 'input', 'instruction'] },
  { name: 'open-orca',         id: 'Open-Orca/OpenOrca',                                                  media_type: 'text', label: 'ai',    text_fields: ['response', 'question', 'system_prompt'] },
  { name: 'ultrachat',         id: 'HuggingFaceH4/ultrachat_200k',            config: 'default', split: 'train_sft', media_type: 'text', label: 'ai',    text_fields: ['prompt', 'messages'] },
  { name: 'openhermes',        id: 'teknium/OpenHermes-2.5',                                               media_type: 'text', label: 'ai',    text_fields: ['conversations', 'text', 'output'] },
  { name: 'tiny-stories',      id: 'roneneldan/TinyStories',                                               media_type: 'text', label: 'ai',    text_fields: ['text', 'story'] },
  { name: 'gpt4-alpaca',       id: 'vicgalle/alpaca-gpt4',                                                 media_type: 'text', label: 'ai',    text_fields: ['output', 'input', 'instruction'] },
  { name: 'hh-rlhf',           id: 'Anthropic/hh-rlhf',                                                    media_type: 'text', label: 'ai',    text_fields: ['chosen', 'rejected'] },
  { name: 'airoboros',         id: 'jondurbin/airoboros-3.1',                                              media_type: 'text', label: 'ai',    text_fields: ['response', 'output', 'instruction'] },

  // ── Human-written datasets ───────────────────────────────────────────────
  // openwebtext — Skylion007/openwebtext returns 404 (dataset removed); replaced with verified fork
  { name: 'openwebtext',       id: 'stas/openwebtext-10k',                                                 media_type: 'text', label: 'human', text_fields: ['text'] },
  { name: 'wikipedia-en',      id: 'wikimedia/wikipedia',                      config: '20231101.en',     media_type: 'text', label: 'human', text_fields: ['text', 'abstract'], language: 'en' },
  { name: 'cnn-dailymail',     id: 'abisee/cnn_dailymail',                     config: '3.0.0',           media_type: 'text', label: 'human', text_fields: ['article', 'highlights'] },
  { name: 'imdb-reviews',      id: 'stanfordnlp/imdb',                        config: 'plain_text',      media_type: 'text', label: 'human', text_fields: ['text', 'review'] },
  { name: 'yelp-reviews',      id: 'Yelp/yelp_review_full',                                                media_type: 'text', label: 'human', text_fields: ['text'] },
  { name: 'arxiv-abstracts',   id: 'gfissore/arxiv-abstracts-2021',                                         media_type: 'text', label: 'human', text_fields: ['abstract', 'text', 'title'] },
  { name: 'pubmedqa',          id: 'qiaojin/PubMedQA',                         config: 'pqa_unlabeled',   media_type: 'text', label: 'human', text_fields: ['abstract', 'question'] },
  {
    name: 'stack-exchange',
    id: 'HuggingFaceH4/stack-exchange-preferences',
    media_type: 'text', label: 'human',
    // answers is [{text_url, answer}] — include 'answer' so nested extractor picks it up
    text_fields: ['question', 'answers', 'answer', 'body'],
  },
  { name: 'scientific-papers', id: 'armanc/scientific_papers',                 config: 'pubmed',          media_type: 'text', label: 'human', text_fields: ['article', 'abstract'] },
  { name: 'ag-news',           id: 'fancyzhx/ag_news',                                                     media_type: 'text', label: 'human', text_fields: ['text', 'description'] },
  { name: 'reddit-eli5',       id: 'Pavithree/eli5_category',                                              media_type: 'text', label: 'human', text_fields: ['answers', 'title', 'selftext'] },

  // ── NEW ADDITIONS — Higher quality AI detection datasets ─────────────────
  // M4 benchmark — top academic AI detection dataset, 4 AI models x 4 domains
  { name: 'm4-ai',           id: 'NicolaiSivesind/M4',                     config: 'default',   media_type: 'text', label: 'mixed', label_field: 'source', label_map: { human: 'human', chatgpt: 'ai', cohere: 'ai', davinci003: 'ai', bloomz: 'ai' }, text_fields: ['text'] },
  // RAID — adversarial AI detection, 11 generators, 4 attack types
  { name: 'raid-v2',         id: 'liamdugan/raid',                         config: 'raid_extra', media_type: 'text', label: 'mixed', label_field: 'label',  label_map: { human: 'human', ai: 'ai', '0': 'human', '1': 'ai' }, text_fields: ['generation', 'prompt'] },
  // CHEAT — ChatGPT paraphrase detection (harder cases)
  { name: 'cheat',           id: 'hannxu/CHEAT',                                                media_type: 'text', label: 'mixed', label_field: 'label',  label_map: { human: 'human', ai: 'ai', ChatGPT: 'ai' }, text_fields: ['abstract', 'text'] },
  // TuringBench — 19 neural generators including GPT-4
  { name: 'turingbench',     id: 'zhiheng-liu/TuringBench',                                    media_type: 'text', label: 'mixed', label_field: 'label',  label_map: { human: 'human', ai: 'ai', '0': 'human', '1': 'ai' }, text_fields: ['Generation', 'text'] },
  // AiWriter detection dataset — essays and academic writing  
  { name: 'aiwriter-detect', id: 'tum-nlp/cannot-tell-ai-apart',                               media_type: 'text', label: 'mixed', label_field: 'label',  label_map: { human: 'human', ai: 'ai', '0': 'human', '1': 'ai' }, text_fields: ['text', 'essay'] },
  // SemEval 2024 Task 8 — multilingual machine-generated text detection
  { name: 'semeval2024-mg',  id: 'nbarnabee/SemEval2024Task8',                                 media_type: 'text', label: 'mixed', label_field: 'label',  label_map: { human: 'human', machine: 'ai', '0': 'human', '1': 'ai' }, text_fields: ['text'] },
  // GPT-wiki — Wikipedia paragraphs rewritten by GPT-3.5
  { name: 'gpt-wiki',        id: 'aadityaubhat/GPT-wiki-intro',                                media_type: 'text', label: 'ai',   text_fields: ['generated_intro', 'intro'] },
  // Human news articles (Reuters, BBC — high quality)
  { name: 'c4-human',        id: 'allenai/c4',                             config: 'en',        media_type: 'text', label: 'human', text_fields: ['text', 'url'] },  // cc_news had no org namespace → replaced with allenai/c4
]
