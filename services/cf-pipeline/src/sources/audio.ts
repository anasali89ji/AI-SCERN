import type { Source } from '../types'

export const AUDIO_SOURCES: Source[] = [
  // ── AI / Deepfake / Synthetic ────────────────────────────────────────────

  // ASVspoof5 — gold standard, 20+ attack types incl adversarial (NEW)
  {
    name: 'asvspoof5', id: 'jungjee/asvspoof5',
    media_type: 'audio', label: 'mixed',
    audio_field: 'audio',
    label_field: 'label',
    label_map: { spoof: 'ai', bonafide: 'human', fake: 'ai', real: 'human', '1': 'ai', '0': 'human' },
    meta_fields: ['attack_type', 'speaker_id'],
  },

  // MLAAD v9 — 51 languages, 140 TTS models, 687GB (NEW)
  {
    name: 'mlaad-fake', id: 'mueller91/MLAAD',
    config: 'default', split: 'train',
    media_type: 'audio', label: 'ai',
    audio_field: 'audio',
    meta_fields: ['language', 'tts_model', 'speaker'],
  },

  // UniDataPro real vs fake voice (NEW)
  {
    name: 'unidatapro-voice', id: 'UniDataPro/real-vs-fake-human-voice-deepfake-audio',
    media_type: 'audio', label: 'mixed',
    audio_field: 'audio',
    label_field: 'label',
    label_map: { fake: 'ai', real: 'human', FAKE: 'ai', REAL: 'human', '1': 'ai', '0': 'human' },
  },

  // Existing sources kept
  { name: 'fake-or-real',      id: 'MelyssaFaraj/fake_or_real_audio',                    media_type: 'audio', label: 'mixed', audio_field: 'audio', label_field: 'label', label_map: { fake:'ai',real:'human',FAKE:'ai',REAL:'human','1':'ai','0':'human' } },
  { name: 'in-the-wild-fake',  id: 'motheecreator/in-the-wild-audio-deepfake',           media_type: 'audio', label: 'mixed', audio_field: 'audio', label_field: 'label', label_map: { spoof:'ai',bonafide:'human',fake:'ai',real:'human' } },
  { name: 'wavefake',          id: 'balt0/WaveFake',                                      media_type: 'audio', label: 'ai',   audio_field: 'audio', meta_fields: ['vocoder','speaker'] },
  { name: 'deepfake-audio',    id: 'mo-thecreator/Deepfake-audio-detection',             media_type: 'audio', label: 'mixed', audio_field: 'audio', label_field: 'label', label_map: { FAKE:'ai',REAL:'human',fake:'ai',real:'human' } },
  { name: 'tts-detection',     id: 'the-crypt-keeper/tts-detection',                      media_type: 'audio', label: 'mixed', audio_field: 'audio', label_field: 'label', label_map: { ai:'ai',human:'human','1':'ai','0':'human' } },
  { name: 'asvspoof2019',      id: 'DynamicSuperb/AudioDeepfakeDetection_ASVspoof2019LA', media_type: 'audio', label: 'mixed', audio_field: 'audio', label_field: 'label', label_map: { spoofed:'ai',genuine:'human',spoof:'ai',bonafide:'human' } },

  // ── Real / Human ─────────────────────────────────────────────────────────
  { name: 'common-voice-en',   id: 'mozilla-foundation/common_voice_11_0', config: 'en',      media_type: 'audio', label: 'human', audio_field: 'audio', meta_fields: ['sentence','gender','age'], language: 'en' },
  { name: 'librispeech-clean', id: 'openslr/librispeech_asr',              config: 'clean',   media_type: 'audio', label: 'human', audio_field: 'audio', meta_fields: ['text','speaker_id'] },
  { name: 'speech-commands',   id: 'google/speech_commands',               config: 'v0.02',   media_type: 'audio', label: 'human', audio_field: 'audio', meta_fields: ['label'] },
  { name: 'fleurs-en',         id: 'google/fleurs',                        config: 'en_us',   media_type: 'audio', label: 'human', audio_field: 'audio', meta_fields: ['transcription','gender'], language: 'en' },
  { name: 'tedlium',           id: 'LIUM/tedlium',                         config: 'release3', media_type: 'audio', label: 'human', audio_field: 'audio', meta_fields: ['text','speaker_id'] },
  { name: 'voxceleb',          id: 'ProgramComputer/voxceleb',                                media_type: 'audio', label: 'human', audio_field: 'audio', meta_fields: ['speaker_id','nationality'] },
]
