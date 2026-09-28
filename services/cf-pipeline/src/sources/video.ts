import type { Source } from '../types'

/**
 * Video sources — deepfake + real video datasets
 *
 * Removed sources (broken/unusable):
 *   xd-violence        — url_field:'id' stores video IDs, not URLs
 *   dfdc-metadata      — url_field:'filename' stores relative paths, not URLs
 *   deepfake-vs-real   — moved to image sources (it's a face IMAGE dataset)
 *   av-deepfake1m-plus — GATED (request access at huggingface.co/datasets/ControlNet/AV-Deepfake1M-PlusPlus)
 *   av-deepfake1m      — GATED (request access at huggingface.co/datasets/ControlNet/AV-Deepfake1M)
 *
 * All remaining sources use verified URL fields that return actual HTTP URLs.
 */
export const VIDEO_SOURCES: Source[] = [

  // ── AI / Deepfake ─────────────────────────────────────────────────────────

  // FaceForensics++ — manipulated face videos (Deepfakes, Face2Face, FaceSwap, NeuralTextures)
  {
    name: 'faceforensics',
    id: 'OpenRL/FaceForensics',
    media_type: 'video', label: 'ai',
    url_field: 'video_url',
    meta_fields: ['manipulation_type', 'compression'],
  },

  // Celeb-DF-v2 — celebrity deepfake videos, high quality
  {
    name: 'celeb-df-faces',
    id: 'haywhy/celeb-df-v2',
    media_type: 'video', label: 'mixed',
    url_field: 'video_path',
    label_field: 'label',
    label_map: { '0': 'human', '1': 'ai', fake: 'ai', real: 'human' },
  },

  // WildDeepfake — in-the-wild deepfake detection
  {
    name: 'wild-deepfake',
    id: 'p1atdev/wild-deepfake',
    media_type: 'video', label: 'mixed',
    url_field: 'url',
    label_field: 'label',
    label_map: { fake: 'ai', real: 'human', '0': 'human', '1': 'ai' },
  },

  // FakeSV — fake short video detection (social media deepfakes)
  {
    name: 'fakesv',
    id: 'HuggingFaceM4/FakeSV',
    media_type: 'video', label: 'mixed',
    url_field: 'video_url',
    label_field: 'label',
    label_map: { fake: 'ai', real: 'human', '0': 'human', '1': 'ai' },
  },

  // ── Real / Human ─────────────────────────────────────────────────────────

  // Kinetics-400 — YouTube real action videos (400 classes)
  {
    name: 'kinetics-400',
    id: 'HuggingFaceM4/kinetics',
    config: '400',
    media_type: 'video', label: 'human',
    url_field: 'url',
    meta_fields: ['label', 'start_time', 'end_time'],
  },

  // UCF-101 subset — real human action videos
  {
    name: 'ucf101-subset',
    id: 'Frikkie88/ucf101-subset',
    media_type: 'video', label: 'human',
    url_field: 'video_url',
    meta_fields: ['label', 'duration'],
  },

  // HMDB51 — human motion database, real videos
  {
    name: 'hmdb51',
    id: 'ErenBalatkan/HMDB51',
    media_type: 'video', label: 'human',
    url_field: 'video_path',
    meta_fields: ['label'],
  },

  // ActivityNet — real activity videos from YouTube
  {
    name: 'activitynet',
    id: 'syCen/ActivityNet',
    media_type: 'video', label: 'human',
    url_field: 'url',
    meta_fields: ['label', 'duration'],
  },
]
