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
  // ── HC3 split into explicit ai / human to avoid broken label_field logic ─
  {
    name: 'hc3-ai',
    id: 'Hello-SimpleAI/HC3',
    config: 'en',
    media_type: 'text', label: 'ai',
    text_fields: ['chatgpt_answers'],
  },
  {
    name: 'hc3-human',
    id: 'Hello-SimpleAI/HC3',
    config: 'en',
    media_type: 'text', label: 'human',
    text_fields: ['human_answers'],
  },

  // ── AI-detection benchmarks ──────────────────────────────────────────────
  { name: 'raid-benchmark',    id: 'liamdugan/raid',                          config: 'default',       media_type: 'text', label: 'ai',    text_fields: ['generation', 'prompt', 'text'] },
  { name: 'ai-detection-pile', id: 'artem9k/ai-text-detection-pile',                                    media_type: 'text', label: 'mixed', label_field: 'label',    label_map: { '1': 'ai', '0': 'human', ai: 'ai', human: 'human' }, text_fields: ['text', 'document'] },
  { name: 'ghostbuster',       id: 'vivek9patel/ghostbuster-data',                                       media_type: 'text', label: 'mixed', label_field: 'label',    label_map: { gpt: 'ai', human: 'human', '1': 'ai', '0': 'human' }, text_fields: ['text', 'essay', 'content'] },
  { name: 'ai-vs-human',       id: 'shankarkarki/AI-Human-Text',                                         media_type: 'text', label: 'mixed', label_field: 'Generated', label_map: { '1': 'ai', '0': 'human' }, text_fields: ['Text', 'text'] },
  { name: 'mage-benchmark',    id: 'ziweili/mage',                                                       media_type: 'text', label: 'mixed', label_field: 'label',    label_map: { '0': 'human', '1': 'ai' }, text_fields: ['text', 'article'] },

  // ── AI-generated instruction/chat datasets ───────────────────────────────
  { name: 'dolly-15k',         id: 'databricks/databricks-dolly-15k',                                    media_type: 'text', label: 'ai',    text_fields: ['response', 'context', 'instruction'] },
  { name: 'alpaca',            id: 'tatsu-lab/alpaca',                                                    media_type: 'text', label: 'ai',    text_fields: ['output', 'input', 'instruction'] },
  { name: 'open-orca',         id: 'Open-Orca/OpenOrca',                                                  media_type: 'text', label: 'ai',    text_fields: ['response', 'question', 'system_prompt'] },
  { name: 'ultrachat',         id: 'HuggingFaceH4/ultrachat_200k',                                        media_type: 'text', label: 'ai',    text_fields: ['prompt', 'messages'] },
  { name: 'openhermes',        id: 'teknium/OpenHermes-2.5',                                               media_type: 'text', label: 'ai',    text_fields: ['conversations', 'text', 'output'] },
  { name: 'tiny-stories',      id: 'roneneldan/TinyStories',                                               media_type: 'text', label: 'ai',    text_fields: ['text', 'story'] },
  { name: 'gpt4-alpaca',       id: 'vicgalle/alpaca-gpt4',                                                 media_type: 'text', label: 'ai',    text_fields: ['output', 'input', 'instruction'] },
  { name: 'hh-rlhf',           id: 'Anthropic/hh-rlhf',                                                    media_type: 'text', label: 'ai',    text_fields: ['chosen', 'rejected'] },
  { name: 'airoboros',         id: 'jondurbin/airoboros-3.1',                                              media_type: 'text', label: 'ai',    text_fields: ['response', 'output', 'instruction'] },

  // ── Human-written datasets ───────────────────────────────────────────────
  { name: 'openwebtext',       id: 'Skylion007/openwebtext',                                               media_type: 'text', label: 'human', text_fields: ['text'] },
  { name: 'wikipedia-en',      id: 'wikimedia/wikipedia',                      config: '20231101.en',     media_type: 'text', label: 'human', text_fields: ['text', 'abstract'], language: 'en' },
  { name: 'cnn-dailymail',     id: 'abisee/cnn_dailymail',                     config: '3.0.0',           media_type: 'text', label: 'human', text_fields: ['article', 'highlights'] },
  { name: 'imdb-reviews',      id: 'stanfordnlp/imdb',                                                     media_type: 'text', label: 'human', text_fields: ['text', 'review'] },
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
]
