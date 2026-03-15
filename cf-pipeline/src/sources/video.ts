import type { Source } from '../types'

/**
 * Video sources — includes gated datasets (AV-Deepfake1M, Deepfake-Eval-2024)
 * Gated datasets require HF_TOKEN with approved access.
 * Worker will skip gracefully if 401/403 returned (no token or not approved yet).
 *
 * To unlock gated datasets, request access at:
 *   https://huggingface.co/datasets/ControlNet/AV-Deepfake1M-PlusPlus
 *   https://huggingface.co/datasets/ControlNet/AV-Deepfake1M
 *   https://huggingface.co/datasets/nuriachandra/Deepfake-Eval-2024
 */
export const VIDEO_SOURCES: Source[] = [
  // ── AI / Deepfake ────────────────────────────────────────────────────────

  // AV-Deepfake1M++ — 2M clips, 9 generation models (GATED — request access)
  {
    name: 'av-deepfake1m-plus',
    id: 'ControlNet/AV-Deepfake1M-PlusPlus',
    media_type: 'video', label: 'mixed',
    url_field: 'video_path',
    label_field: 'label',
    label_map: { fake: 'ai', real: 'human', '1': 'ai', '0': 'human', FAKE: 'ai', REAL: 'human' },
    meta_fields: ['manipulation_type', 'generator', 'split'],
  },

  // AV-Deepfake1M v1 — 1M+ clips, CC BY-NC 4.0 (GATED — request access)
  {
    name: 'av-deepfake1m',
    id: 'ControlNet/AV-Deepfake1M',
    media_type: 'video', label: 'mixed',
    url_field: 'video_path',
    label_field: 'label',
    label_map: { fake: 'ai', real: 'human', '1': 'ai', '0': 'human' },
    meta_fields: ['manipulation_type', 'subject_id'],
  },

  // Existing deepfake sources
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
