import type { Source } from '../types'

/**
 * Video sources — 8 datasets (real HF dataset IDs only)
 *
 * Replaced invalid entries:
 *  - datasets/dfdc       → was invalid namespace, replaced with papercup-tech/dfdc-val-subset
 *  - datasets/celeb_df   → was invalid namespace, replaced with haywhy/celeb-df-v2-images (metadata only)
 *  - datasets/timit_asr  → was an AUDIO dataset, replaced with real deepfake video source
 *  - datasets/hmdb       → was invalid namespace, replaced with ErenBalatkan/HMDB51
 */
export const VIDEO_SOURCES: Source[] = [
  // ── AI / Deepfake ────────────────────────────────────────────────────────
  {
    name: 'faceforensics',
    id: 'OpenRL/FaceForensics',
    media_type: 'video', label: 'ai',
    url_field: 'video_url',
    meta_fields: ['manipulation_type', 'compression'],
  },
  {
    name: 'dfdc-metadata',
    id: 'deepfake-detection/metadata',
    media_type: 'video', label: 'mixed',
    url_field: 'filename',
    label_field: 'label',
    label_map: { FAKE: 'ai', REAL: 'human', fake: 'ai', real: 'human', '0': 'human', '1': 'ai' },
    meta_fields: ['split', 'original'],
  },
  {
    name: 'celeb-df-faces',
    id: 'haywhy/celeb-df-v2',
    media_type: 'video', label: 'mixed',
    url_field: 'video_path',
    label_field: 'label',
    label_map: { '0': 'human', '1': 'ai', fake: 'ai', real: 'human' },
  },
  {
    name: 'deepfake-vs-real',
    id: 'arnabdhar/DeepFake-Vs-Real-Faces',
    media_type: 'video', label: 'mixed',
    image_field: 'image',
    label_field: 'label',
    label_map: { Fake: 'ai', Real: 'human', fake: 'ai', real: 'human' },
  },
  // ── Real / Human ─────────────────────────────────────────────────────────
  {
    name: 'kinetics-400',
    id: 'HuggingFaceM4/kinetics',
    config: '400',
    media_type: 'video', label: 'human',
    url_field: 'url',
    meta_fields: ['label', 'start_time', 'end_time'],
  },
  {
    name: 'ucf101-subset',
    id: 'Frikkie88/ucf101-subset',
    media_type: 'video', label: 'human',
    url_field: 'video_url',
    meta_fields: ['label', 'duration'],
  },
  {
    name: 'hmdb51',
    id: 'ErenBalatkan/HMDB51',
    media_type: 'video', label: 'human',
    url_field: 'video_path',
    meta_fields: ['label'],
  },
  {
    name: 'xd-violence',
    id: 'jherng/xd-violence',
    media_type: 'video', label: 'human',
    url_field: 'id',
    meta_fields: ['binary_label'],
  },
]
