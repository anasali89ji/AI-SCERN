/**
 * DETECTAI Neural Pipeline v4 — Professional Edition
 * Real data from HuggingFace Datasets API, rich metadata,
 * quality scoring, deduplication, modality-aware scraping.
 */

export interface Env {
  DB:       D1Database
  HF_TOKEN: string
  HF_REPO?: string
}

// ── SOURCE DEFINITION ─────────────────────────────────────────────────────────
export interface Source {
  name:         string
  id:           string
  config?:      string
  split?:       string
  media_type:   'text' | 'image' | 'audio' | 'video'
  label:        'ai' | 'human' | 'mixed'
  text_fields?: string[]
  label_field?: string
  label_map?:   Record<string, 'ai' | 'human'>
  url_field?:   string
  audio_field?: string
  image_field?: string
  meta_fields?: string[]
}

// ── TEXT SOURCES ──────────────────────────────────────────────────────────────
export const TEXT_SOURCES: Source[] = [
  { name: 'hc3-english',        id: 'Hello-SimpleAI/HC3',                 config: 'en',            media_type: 'text', label: 'mixed',  label_field: 'source',   label_map: { 'chatgpt_answers': 'ai', 'human_answers': 'human' }, text_fields: ['text', 'chatgpt_answers', 'human_answers'] },
  { name: 'raid-benchmark',     id: 'liamdugan/raid',                      config: 'default',       media_type: 'text', label: 'ai',     text_fields: ['generation', 'prompt', 'text'] },
  { name: 'ai-detection-pile',  id: 'artem9k/ai-text-detection-pile',                               media_type: 'text', label: 'mixed',  label_field: 'label',    label_map: { '1': 'ai', '0': 'human', 'ai': 'ai', 'human': 'human' }, text_fields: ['text', 'document'] },
  { name: 'ghostbuster',        id: 'vivek9patel/ghostbuster-data',                                 media_type: 'text', label: 'mixed',  label_field: 'label',    label_map: { 'gpt': 'ai', 'human': 'human', '1': 'ai', '0': 'human' }, text_fields: ['text', 'essay', 'content'] },
  { name: 'ai-vs-human',        id: 'shankarkarki/AI-Human-Text',                                   media_type: 'text', label: 'mixed',  label_field: 'Generated',label_map: { '1': 'ai', '0': 'human' }, text_fields: ['Text', 'text'] },
  { name: 'mage-benchmark',     id: 'ziweili/mage',                                                 media_type: 'text', label: 'mixed',  label_field: 'label',    label_map: { '0': 'human', '1': 'ai' }, text_fields: ['text', 'article'] },
  { name: 'dolly-15k',          id: 'databricks/databricks-dolly-15k',                              media_type: 'text', label: 'ai',     text_fields: ['response', 'context', 'instruction'] },
  { name: 'alpaca',             id: 'tatsu-lab/alpaca',                                             media_type: 'text', label: 'ai',     text_fields: ['output', 'input', 'instruction'] },
  { name: 'open-orca',          id: 'Open-Orca/OpenOrca',                                           media_type: 'text', label: 'ai',     text_fields: ['response', 'question', 'system_prompt'] },
  { name: 'ultrachat',          id: 'HuggingFaceH4/ultrachat_200k',                                 media_type: 'text', label: 'ai',     text_fields: ['prompt', 'messages'] },
  { name: 'openhermes',         id: 'teknium/OpenHermes-2.5',                                       media_type: 'text', label: 'ai',     text_fields: ['conversations', 'text', 'output'] },
  { name: 'tiny-stories',       id: 'roneneldan/TinyStories',                                       media_type: 'text', label: 'ai',     text_fields: ['text', 'story'] },
  { name: 'gpt4-alpaca',        id: 'vicgalle/alpaca-gpt4',                                         media_type: 'text', label: 'ai',     text_fields: ['output', 'input', 'instruction'] },
  { name: 'hh-rlhf',            id: 'Anthropic/hh-rlhf',                                            media_type: 'text', label: 'ai',     text_fields: ['chosen', 'rejected'] },
  { name: 'airoboros',          id: 'jondurbin/airoboros-3.1',                                      media_type: 'text', label: 'ai',     text_fields: ['response', 'output', 'instruction'] },
  { name: 'openwebtext',        id: 'Skylion007/openwebtext',                                       media_type: 'text', label: 'human',  text_fields: ['text'] },
  { name: 'wikipedia-en',       id: 'wikimedia/wikipedia',                 config: '20231101.en',   media_type: 'text', label: 'human',  text_fields: ['text', 'abstract'] },
  { name: 'cnn-dailymail',      id: 'abisee/cnn_dailymail',                config: '3.0.0',         media_type: 'text', label: 'human',  text_fields: ['article', 'highlights'] },
  { name: 'imdb-reviews',       id: 'stanfordnlp/imdb',                                             media_type: 'text', label: 'human',  text_fields: ['text', 'review'] },
  { name: 'yelp-reviews',       id: 'Yelp/yelp_review_full',                                        media_type: 'text', label: 'human',  text_fields: ['text'] },
  { name: 'arxiv-abstracts',    id: 'gfissore/arxiv-abstracts-2021',                                 media_type: 'text', label: 'human',  text_fields: ['abstract', 'text', 'title'] },
  { name: 'pubmedqa',           id: 'qiaojin/PubMedQA',                   config: 'pqa_unlabeled',  media_type: 'text', label: 'human',  text_fields: ['abstract', 'question'] },
  { name: 'stack-exchange',     id: 'HuggingFaceH4/stack-exchange-preferences',                     media_type: 'text', label: 'human',  text_fields: ['question', 'answers'] },
  { name: 'scientific-papers',  id: 'armanc/scientific_papers',            config: 'pubmed',        media_type: 'text', label: 'human',  text_fields: ['article', 'abstract'] },
  { name: 'ag-news',            id: 'fancyzhx/ag_news',                                             media_type: 'text', label: 'human',  text_fields: ['text', 'description'] },
  { name: 'reddit-eli5',        id: 'Pavithree/eli5_category',                                      media_type: 'text', label: 'human',  text_fields: ['answers', 'title', 'selftext'] },
]

// ── IMAGE SOURCES ─────────────────────────────────────────────────────────────
export const IMAGE_SOURCES: Source[] = [
  { name: 'diffusiondb',        id: 'poloclub/diffusiondb',                config: 'large_random_100k', media_type: 'image', label: 'ai',    image_field: 'image',  meta_fields: ['prompt', 'width', 'height', 'seed'] },
  { name: 'midjourney-v6',      id: 'terminusresearch/midjourney-v6-160k-raw',                       media_type: 'image', label: 'ai',    url_field: 'url',      meta_fields: ['prompt', 'width', 'height'] },
  { name: 'civitai-images',     id: 'joachimsallstrom/civitai-images',                               media_type: 'image', label: 'ai',    url_field: 'url',      meta_fields: ['description', 'width', 'height'] },
  { name: 'cifake-ai',          id: 'jlbaker361/cifake-real-and-ai-generated-small-images',          media_type: 'image', label: 'mixed', image_field: 'image',  label_field: 'label', label_map: { 'FAKE': 'ai', 'REAL': 'human', 'fake': 'ai', 'real': 'human' } },
  { name: 'deepfake-faces',     id: 'marcelomoreno26/deepfake-detection',                            media_type: 'image', label: 'mixed', image_field: 'image',  label_field: 'label', label_map: { '0': 'human', '1': 'ai' } },
  { name: 'ai-art-laion',       id: 'fantasyfish/laion-art-subset',                                  media_type: 'image', label: 'ai',    url_field: 'url',      meta_fields: ['TEXT', 'WIDTH', 'HEIGHT'] },
  { name: 'dalle3-coco',        id: 'shunk031/MSCOCO-2017-Captions-DALLE3',                          media_type: 'image', label: 'ai',    url_field: 'url',      meta_fields: ['caption'] },
  { name: 'unsplash-25k',       id: 'jamescalam/unsplash-25k-photos',                                media_type: 'image', label: 'human', url_field: 'photo_image_url', meta_fields: ['photo_description', 'photo_width', 'photo_height'] },
  { name: 'flickr30k',          id: 'nlphuji/flickr30k',                                             media_type: 'image', label: 'human', image_field: 'image',  meta_fields: ['caption'] },
  { name: 'div2k-real',         id: 'eugenesiow/Div2k',                   config: 'bicubic_x2',     media_type: 'image', label: 'human', image_field: 'hr' },
  { name: 'celeba-hq',          id: 'CUHK-CSE/celebahq-faces',                                      media_type: 'image', label: 'human', image_field: 'image' },
]

// ── AUDIO SOURCES ─────────────────────────────────────────────────────────────
export const AUDIO_SOURCES: Source[] = [
  { name: 'fake-or-real',       id: 'MelyssaFaraj/fake_or_real_audio',                              media_type: 'audio', label: 'mixed', audio_field: 'audio',  label_field: 'label', label_map: { 'fake': 'ai', 'real': 'human', 'FAKE': 'ai', 'REAL': 'human', '1': 'ai', '0': 'human' } },
  { name: 'in-the-wild-fake',   id: 'motheecreator/in-the-wild-audio-deepfake',                     media_type: 'audio', label: 'mixed', audio_field: 'audio',  label_field: 'label', label_map: { 'spoof': 'ai', 'bonafide': 'human', 'fake': 'ai', 'real': 'human' } },
  { name: 'wavefake',           id: 'balt0/WaveFake',                                               media_type: 'audio', label: 'ai',    audio_field: 'audio',  meta_fields: ['vocoder', 'speaker'] },
  { name: 'deepfake-audio',     id: 'mo-thecreator/Deepfake-audio-detection',                       media_type: 'audio', label: 'mixed', audio_field: 'audio',  label_field: 'label', label_map: { 'FAKE': 'ai', 'REAL': 'human', 'fake': 'ai', 'real': 'human' } },
  { name: 'tts-detection',      id: 'the-crypt-keeper/tts-detection',                               media_type: 'audio', label: 'mixed', audio_field: 'audio',  label_field: 'label', label_map: { 'ai': 'ai', 'human': 'human', '1': 'ai', '0': 'human' } },
  { name: 'asvspoof2019',       id: 'DynamicSuperb/AudioDeepfakeDetection_ASVspoof2019LA',          media_type: 'audio', label: 'mixed', audio_field: 'audio',  label_field: 'label', label_map: { 'spoofed': 'ai', 'genuine': 'human', 'spoof': 'ai', 'bonafide': 'human' } },
  { name: 'common-voice-en',    id: 'mozilla-foundation/common_voice_11_0', config: 'en',           media_type: 'audio', label: 'human', audio_field: 'audio',  meta_fields: ['sentence', 'gender', 'age'] },
  { name: 'librispeech-clean',  id: 'openslr/librispeech_asr',            config: 'clean',          media_type: 'audio', label: 'human', audio_field: 'audio',  meta_fields: ['text', 'speaker_id'] },
  { name: 'speech-commands',    id: 'google/speech_commands',             config: 'v0.02',           media_type: 'audio', label: 'human', audio_field: 'audio',  meta_fields: ['label'] },
  { name: 'fleurs-en',          id: 'google/fleurs',                      config: 'en_us',           media_type: 'audio', label: 'human', audio_field: 'audio',  meta_fields: ['transcription', 'gender'] },
  { name: 'tedlium',            id: 'LIUM/tedlium',                       config: 'release3',        media_type: 'audio', label: 'human', audio_field: 'audio',  meta_fields: ['text', 'speaker_id'] },
  { name: 'voxceleb',           id: 'ProgramComputer/voxceleb',                                      media_type: 'audio', label: 'human', audio_field: 'audio',  meta_fields: ['speaker_id', 'nationality'] },
]

// ── VIDEO SOURCES ─────────────────────────────────────────────────────────────
export const VIDEO_SOURCES: Source[] = [
  { name: 'faceforensics',      id: 'OpenRL/FaceForensics',                                         media_type: 'video', label: 'ai',    url_field: 'video_url', meta_fields: ['manipulation_type', 'compression'] },
  { name: 'dfdc-meta',          id: 'datasets/dfdc',                                                media_type: 'video', label: 'ai',    url_field: 'url',       meta_fields: ['label', 'confidence', 'original'] },
  { name: 'celeb-df',           id: 'datasets/celeb_df',                                            media_type: 'video', label: 'mixed', url_field: 'video_path',label_field: 'label', label_map: { '0': 'human', '1': 'ai', 'fake': 'ai', 'real': 'human' } },
  { name: 'deepfake-timit',     id: 'datasets/timit_asr',                                           media_type: 'video', label: 'ai',    url_field: 'file',      meta_fields: ['text'] },
  { name: 'kinetics-400',       id: 'HuggingFaceM4/kinetics',             config: '400',             media_type: 'video', label: 'human', url_field: 'url',       meta_fields: ['label', 'start_time', 'end_time'] },
  { name: 'ucf101-subset',      id: 'Frikkie88/ucf101-subset',                                      media_type: 'video', label: 'human', url_field: 'video_url', meta_fields: ['label', 'duration'] },
  { name: 'hmdb51',             id: 'datasets/hmdb',                                                media_type: 'video', label: 'human', url_field: 'video_path',meta_fields: ['action_label'] },
  { name: 'xd-violence',        id: 'jherng/xd-violence',                                           media_type: 'video', label: 'human', url_field: 'id',        meta_fields: ['binary_label'] },
]

export const ALL_SOURCES = [...TEXT_SOURCES, ...IMAGE_SOURCES, ...AUDIO_SOURCES, ...VIDEO_SOURCES]

// ══════════════════════════════════════════════════════════════════════════════
// HUGGINGFACE DATASETS API CLIENT
// ══════════════════════════════════════════════════════════════════════════════

const HF_API = 'https://datasets-server.huggingface.co'

export async function fetchHFRows(
  dataset: string, config = 'default', split = 'train',
  offset = 0, length = 100, hfToken?: string,
): Promise<{ rows: { row_idx: number; row: Record<string, any> }[] }> {
  const url = `${HF_API}/rows?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${length}`
  const headers: Record<string, string> = { 'User-Agent': 'DETECTAI-Pipeline/4.0' }
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`HF ${res.status}: ${dataset}`)
  return res.json() as any
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT EXTRACTION
// ══════════════════════════════════════════════════════════════════════════════

function extractText(row: Record<string, any>, fields: string[]): string | null {
  for (const f of fields) {
    const v = row[f]
    if (!v) continue
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
    if (Array.isArray(v)) {
      const first = v[0]
      if (typeof first === 'string' && first.trim()) return first.trim()
      if (first && typeof first === 'object') {
        const c = first.content ?? first.text ?? first.value
        if (typeof c === 'string' && c.trim()) return c.trim()
      }
    }
    if (typeof v === 'object' && v !== null) {
      const c = v.text ?? v.content ?? v.value
      if (typeof c === 'string' && c.trim()) return c.trim()
    }
  }
  return null
}

function extractLabel(row: Record<string, any>, src: Source): 'ai' | 'human' {
  if (src.label !== 'mixed') return src.label as 'ai' | 'human'
  if (!src.label_field || !src.label_map) return 'ai'
  const raw = row[src.label_field]
  if (raw == null) return 'ai'
  return src.label_map[String(raw)] ?? 'ai'
}

export async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function qualityText(t: string): number {
  const words = t.split(/\s+/).length
  let s = 0.4
  if (t.length > 200)  s += 0.1
  if (t.length > 1000) s += 0.1
  if (words > 30)      s += 0.1
  if (words > 150)     s += 0.1
  if (t.length > 8000) s -= 0.1
  return Math.min(0.98, Math.max(0, s))
}

function qualityAudio(dur?: number, sr?: number): number {
  let s = 0.6
  if (dur && dur >= 1)   s += 0.1
  if (dur && dur >= 5)   s += 0.1
  if (dur && dur >= 30)  s += 0.05
  if (sr  && sr >= 16000) s += 0.05
  return Math.min(0.98, s)
}

function qualityImage(w?: number, h?: number): number {
  let s = 0.6
  if (w && h) {
    const px = w * h
    if (px > 50000)   s += 0.1
    if (px > 250000)  s += 0.1
    if (px > 500000)  s += 0.1
  }
  return Math.min(0.98, s)
}

// ══════════════════════════════════════════════════════════════════════════════
// PER-MODALITY ROW EXTRACTORS
// ══════════════════════════════════════════════════════════════════════════════

interface ExtractResult {
  label:            'ai' | 'human'
  content_text?:    string
  content_url?:     string
  content_preview?: string
  content_hash:     string
  quality_score:    number
  word_count?:      number
  char_count?:      number
  sentence_count?:  number
  language?:        string
  duration_seconds?: number
  sample_rate?:      number
  has_speech?:       boolean
  resolution_w?:     number
  resolution_h?:     number
  file_format?:      string
  has_face?:         boolean
  metadata?:         Record<string, any>
}

export async function extractTextRow(row: Record<string, any>, src: Source): Promise<ExtractResult | null> {
  const fields = src.text_fields ?? ['text', 'content', 'body', 'article', 'document']
  const text = extractText(row, fields)
  if (!text || text.length < 80) return null

  const label   = extractLabel(row, src)
  const trimmed = text.slice(0, 5000)
  const hash    = await sha256(trimmed.slice(0, 400))
  const words   = trimmed.split(/\s+/)
  const sents   = (trimmed.match(/[.!?]+\s/g) ?? []).length || 1
  const quality = qualityText(trimmed)
  if (quality < 0.4) return null

  return {
    label,
    content_text:    trimmed.slice(0, 4000),
    content_preview: trimmed.slice(0, 250).replace(/\s+/g, ' '),
    content_hash:    hash,
    quality_score:   quality,
    word_count:      words.length,
    char_count:      trimmed.length,
    sentence_count:  sents,
    language:        'en',
  }
}

export async function extractImageRow(row: Record<string, any>, src: Source, idx: number): Promise<ExtractResult | null> {
  const label = extractLabel(row, src)
  let url: string | undefined, w: number | undefined, h: number | undefined, fmt: string | undefined

  const imgFeature = src.image_field ? row[src.image_field] : null
  if (imgFeature) {
    if (typeof imgFeature === 'string') url = imgFeature
    else {
      url = imgFeature.path ?? imgFeature.url
      w   = imgFeature.width;  h = imgFeature.height
      fmt = imgFeature.format?.toLowerCase()
    }
  }
  if (!url && src.url_field) {
    const v = row[src.url_field]
    if (typeof v === 'string') url = v
  }
  if (!url) {
    for (const f of ['image_url', 'url', 'path', 'img_path', 'file_path']) {
      if (typeof row[f] === 'string') { url = row[f]; break }
    }
  }

  const meta: Record<string, any> = {}
  for (const f of (src.meta_fields ?? [])) {
    if (row[f] != null) {
      meta[f] = row[f]
      if (f === 'width'  || f === 'WIDTH')  w = Number(row[f])
      if (f === 'height' || f === 'HEIGHT') h = Number(row[f])
    }
  }

  const hash = await sha256(`${src.name}:img:${idx}:${url ?? ''}`)
  return {
    label,
    content_url:     url,
    content_preview: url ? `[Image] ${url.slice(0, 200)}` : `[Image from ${src.name}]`,
    content_hash:    hash,
    quality_score:   qualityImage(w, h),
    resolution_w:    w,
    resolution_h:    h,
    file_format:     fmt,
    has_face:        /face|celeb|deepfake|portrait/i.test(src.name),
    metadata:        Object.keys(meta).length ? meta : undefined,
  }
}

export async function extractAudioRow(row: Record<string, any>, src: Source, idx: number): Promise<ExtractResult | null> {
  const label = extractLabel(row, src)
  let url: string | undefined, dur: number | undefined, sr: number | undefined

  const af = src.audio_field ? row[src.audio_field] : null
  if (af) {
    if (typeof af === 'string') url = af
    else {
      url = af.path ?? af.url
      sr  = af.sampling_rate
      if (af.array && af.sampling_rate) {
        const len = Array.isArray(af.array) ? af.array.length : (af.array?.length ?? 0)
        if (len > 0) dur = len / af.sampling_rate
      }
    }
  }
  if (!url && src.url_field) {
    const v = row[src.url_field]
    if (typeof v === 'string') url = v
  }

  let transcript: string | undefined
  const meta: Record<string, any> = {}
  for (const f of (src.meta_fields ?? [])) {
    if (row[f] != null) {
      meta[f] = row[f]
      if (f === 'duration') dur = Number(row[f])
      if (f === 'sampling_rate') sr = Number(row[f])
      if (f === 'sentence' || f === 'text' || f === 'transcription') transcript = String(row[f])
    }
  }

  const hash = await sha256(`${src.name}:audio:${idx}:${url ?? ''}`)
  return {
    label,
    content_url:      url,
    content_preview:  transcript?.slice(0, 250) ?? `[Audio from ${src.name}]`,
    content_hash:     hash,
    quality_score:    qualityAudio(dur, sr),
    duration_seconds: dur,
    sample_rate:      sr,
    has_speech:       true,
    metadata:         Object.keys(meta).length ? meta : undefined,
  }
}

export async function extractVideoRow(row: Record<string, any>, src: Source, idx: number): Promise<ExtractResult | null> {
  const label = extractLabel(row, src)
  let url: string | undefined, dur: number | undefined, w: number | undefined, h: number | undefined

  if (src.url_field) {
    const v = row[src.url_field]
    if (typeof v === 'string') url = v
  }
  if (!url) {
    for (const f of ['video_url', 'url', 'path', 'video_path', 'file']) {
      if (typeof row[f] === 'string') { url = row[f]; break }
    }
  }

  const meta: Record<string, any> = {}
  for (const f of (src.meta_fields ?? [])) {
    if (row[f] != null) {
      meta[f] = row[f]
      if (f === 'duration') dur = Number(row[f])
      if (f === 'width')  w = Number(row[f])
      if (f === 'height') h = Number(row[f])
      if (f === 'end_time' && meta['start_time']) dur = Number(row[f]) - Number(meta['start_time'])
    }
  }

  const hash = await sha256(`${src.name}:video:${idx}:${url ?? ''}`)
  return {
    label,
    content_url:      url,
    content_preview:  `[Video from ${src.name}]${url ? ` — ${url.slice(0, 120)}` : ''}`,
    content_hash:     hash,
    quality_score:    Math.min(0.98, 0.65 + (url ? 0.1 : 0) + (dur ? 0.1 : 0) + Math.random() * 0.05),
    duration_seconds: dur,
    resolution_w:     w,
    resolution_h:     h,
    has_face:         /face|celeb|deepfake/i.test(src.name),
    metadata:         Object.keys(meta).length ? meta : undefined,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// D1 BATCH INSERT WITH DEDUPLICATION
// ══════════════════════════════════════════════════════════════════════════════

export async function batchInsert(
  db:       D1Database,
  items:    { src: Source; item: ExtractResult; rowIdx: number; wid: string }[],
): Promise<number> {
  if (!items.length) return 0

  const hashes = items.map(i => i.item.content_hash)
  const ph     = hashes.map(() => '?').join(',')
  const exist  = await db.prepare(`SELECT content_hash FROM dataset_items WHERE content_hash IN (${ph})`).bind(...hashes).all()
  const seen   = new Set((exist.results ?? []).map((r: any) => r.content_hash))

  const novel = items.filter(i => !seen.has(i.item.content_hash))
  if (!novel.length) return 0

  const stmts = novel.map(({ src, item, rowIdx, wid }) => {
    const split = rowIdx % 10 === 0 ? 'test' : rowIdx % 5 === 0 ? 'val' : 'train'
    return db.prepare(`INSERT OR IGNORE INTO dataset_items (
      id,media_type,source_name,hf_dataset_id,label,confidence,
      content_text,content_url,content_preview,content_hash,
      quality_score,language,word_count,char_count,sentence_count,
      duration_seconds,sample_rate,resolution_w,resolution_h,file_format,
      has_face,has_speech,is_synthetic,split,hf_row_index,hf_config,hf_split,worker_id,metadata,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `).bind(
      crypto.randomUUID(), src.media_type, src.name, src.id, item.label, item.quality_score,
      item.content_text ?? null, item.content_url ?? null, item.content_preview ?? null, item.content_hash,
      item.quality_score, item.language ?? 'en', item.word_count ?? null, item.char_count ?? null, item.sentence_count ?? null,
      item.duration_seconds ?? null, item.sample_rate ?? null, item.resolution_w ?? null, item.resolution_h ?? null, item.file_format ?? null,
      item.has_face ? 1 : 0, item.has_speech ? 1 : 0, 0, split, rowIdx,
      src.config ?? 'default', src.split ?? 'train', wid,
      item.metadata ? JSON.stringify(item.metadata) : null,
    )
  })

  let inserted = 0
  for (let i = 0; i < stmts.length; i += 80) {
    try {
      await db.batch(stmts.slice(i, i + 80))
      inserted += stmts.slice(i, i + 80).length
    } catch {
      for (const s of stmts.slice(i, i + 80)) {
        try { await s.run(); inserted++ } catch {}
      }
    }
  }

  if (inserted > 0) {
    await db.prepare(
      `UPDATE pipeline_state SET total_scraped=total_scraped+?,last_scrape_at=datetime('now'),updated_at=datetime('now') WHERE id=1`
    ).bind(inserted).run().catch(() => {})
  }
  return inserted
}

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE SCRAPER — fetches + extracts + inserts
// ══════════════════════════════════════════════════════════════════════════════

export async function scrapeSource(
  db:      D1Database,
  src:     Source,
  token:   string,
  wid:     string,
  target = 80,
): Promise<{ source: string; inserted: number; skipped: number; error?: string }> {
  try {
    const offset = Math.floor(Math.random() * 15000)
    const { rows } = await fetchHFRows(src.id, src.config ?? 'default', src.split ?? 'train', offset, Math.min(target * 2, 100), token)

    const d1items: { src: Source; item: any; rowIdx: number; wid: string }[] = []
    let skipped = 0

    for (const { row_idx, row } of rows) {
      if (d1items.length >= target) break
      let extracted = null
      try {
        switch (src.media_type) {
          case 'text':  extracted = await extractTextRow(row, src); break
          case 'image': extracted = await extractImageRow(row, src, row_idx); break
          case 'audio': extracted = await extractAudioRow(row, src, row_idx); break
          case 'video': extracted = await extractVideoRow(row, src, row_idx); break
        }
      } catch {}
      if (extracted) d1items.push({ src, item: extracted, rowIdx: offset + row_idx, wid })
      else skipped++
    }

    const inserted = await batchInsert(db, d1items)
    return { source: src.name, inserted, skipped: skipped + (d1items.length - inserted) }
  } catch (e: any) {
    return { source: src.name, inserted: 0, skipped: 0, error: e?.message }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HUGGINGFACE PUSHER
// ══════════════════════════════════════════════════════════════════════════════

export async function pushToHF(db: D1Database, token: string, repo: string, batchSz = 5000) {
  const { results } = await db.prepare(`
    SELECT id,media_type,source_name,hf_dataset_id,label,quality_score,
           content_preview,content_url,content_hash,word_count,char_count,
           duration_seconds,sample_rate,resolution_w,resolution_h,file_format,
           has_face,has_speech,split,hf_row_index,language,created_at
    FROM dataset_items WHERE hf_pushed_at IS NULL ORDER BY quality_score DESC,created_at ASC LIMIT ?
  `).bind(batchSz).all()

  if (!results?.length) return { pushed: 0 }

  const jsonl = (results as any[]).map(r => JSON.stringify({
    id: r.id, media_type: r.media_type, source: r.source_name, source_dataset: r.hf_dataset_id,
    label: r.label, quality: r.quality_score, preview: r.content_preview, url: r.content_url,
    hash: r.content_hash, split: r.split, language: r.language ?? 'en',
    word_count: r.word_count, char_count: r.char_count,
    duration_s: r.duration_seconds, sample_rate: r.sample_rate,
    width: r.resolution_w, height: r.resolution_h, format: r.file_format,
    has_face: r.has_face === 1, has_speech: r.has_speech === 1,
    row_index: r.hf_row_index, scraped_at: r.created_at,
  })).join('\n')

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const mediaTypes = [...new Set((results as any[]).map((r: any) => r.media_type))]
  const folderTag = mediaTypes.length === 1 ? mediaTypes[0] : 'mixed'

  const hfRes = await fetch(`https://huggingface.co/api/datasets/${repo}/commit/main`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commit_message: `pipeline v4: ${results.length} ${folderTag} items (${ts})`,
      operations: [{ key: `data/${folderTag}/batch_${ts}.jsonl`, type: 'addOrUpdate', content: btoa(unescape(encodeURIComponent(jsonl))) }],
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!hfRes.ok) {
    const err = await hfRes.text().catch(() => '')
    await db.prepare(`INSERT INTO hf_push_log (item_count,repo,status,error,created_at) VALUES (0,?,'error',?,datetime('now'))`).bind(repo, err.slice(0, 500)).run().catch(() => {})
    return { pushed: 0, error: err.slice(0, 200) }
  }

  const hfJson = await hfRes.json() as any
  const cid = hfJson.id ?? 'unknown'
  const now = new Date().toISOString()
  const ids = (results as any[]).map((r: any) => `'${r.id}'`).join(',')
  await db.prepare(`UPDATE dataset_items SET hf_pushed_at=?,hf_commit_id=? WHERE id IN (${ids})`).bind(now, cid).run()
  await db.prepare(`UPDATE pipeline_state SET total_pushed=total_pushed+?,last_push_at=?,updated_at=datetime('now') WHERE id=1`).bind(results.length, now).run().catch(() => {})
  await db.prepare(`INSERT INTO hf_push_log (item_count,commit_id,repo,status,created_at) VALUES (?,?,?,'success',datetime('now'))`).bind(results.length, cid, repo).run().catch(() => {})

  return { pushed: results.length, commitId: cid }
}

export async function cleanupPushed(db: D1Database): Promise<number> {
  const r = await db.prepare(`DELETE FROM dataset_items WHERE hf_pushed_at IS NOT NULL AND hf_pushed_at < datetime('now','-48 hours')`).run()
  return r.meta?.changes ?? 0
}

// ══════════════════════════════════════════════════════════════════════════════
// STATUS
// ══════════════════════════════════════════════════════════════════════════════

export async function getStatus(db: D1Database) {
  const [st, ct, ql, sr, pl] = await db.batch([
    db.prepare('SELECT * FROM pipeline_state WHERE id=1'),
    db.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN media_type='text'  THEN 1 ELSE 0 END) as text_count,
      SUM(CASE WHEN media_type='image' THEN 1 ELSE 0 END) as image_count,
      SUM(CASE WHEN media_type='audio' THEN 1 ELSE 0 END) as audio_count,
      SUM(CASE WHEN media_type='video' THEN 1 ELSE 0 END) as video_count,
      SUM(CASE WHEN label='ai'    THEN 1 ELSE 0 END) as ai_count,
      SUM(CASE WHEN label='human' THEN 1 ELSE 0 END) as human_count,
      SUM(CASE WHEN hf_pushed_at IS NOT NULL THEN 1 ELSE 0 END) as pushed,
      SUM(CASE WHEN hf_pushed_at IS NULL     THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN split='train' THEN 1 ELSE 0 END) as train_count,
      SUM(CASE WHEN split='val'   THEN 1 ELSE 0 END) as val_count,
      SUM(CASE WHEN split='test'  THEN 1 ELSE 0 END) as test_count
      FROM dataset_items`),
    db.prepare(`SELECT ROUND(AVG(quality_score),3) as avg_quality,
      ROUND(AVG(CASE WHEN media_type='text'  THEN word_count END),0)  as avg_words,
      ROUND(AVG(CASE WHEN media_type='audio' THEN duration_seconds END),1) as avg_audio_s,
      ROUND(AVG(CASE WHEN media_type='image' THEN resolution_w*resolution_h END),0) as avg_pixels
      FROM dataset_items`),
    db.prepare(`SELECT source_name,media_type,label,COUNT(*) as count FROM dataset_items GROUP BY source_name,media_type,label ORDER BY count DESC LIMIT 20`),
    db.prepare(`SELECT item_count,commit_id,status,error,created_at FROM hf_push_log ORDER BY created_at DESC LIMIT 10`),
  ])
  return {
    pipeline:  'DETECTAI Neural Pipeline v4 — Real Data',
    version:   'v4.0',
    data_mode: 'REAL (HuggingFace Datasets API)',
    source_registry: { text: TEXT_SOURCES.length, image: IMAGE_SOURCES.length, audio: AUDIO_SOURCES.length, video: VIDEO_SOURCES.length },
    state:     st.results[0],
    dataset:   ct.results[0],
    quality:   ql.results[0],
    top_sources: sr.results,
    recent_pushes: pl.results,
  }
}
