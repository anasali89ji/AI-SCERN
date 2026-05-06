// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 6: Semantic Vector-Less RAG (v2.0 — 9 Agents)
//
// Agents:
//   1  FACIAL            — Eyes, nose, ears, mouth, skin — generator-specific tells
//   2  PHYSICS           — Shadows, reflections, depth-of-field — generator-specific
//   3  BACKGROUND        — Hair boundaries, text, crowds, architecture
//   4  ANATOMICAL        — Hands, limbs, clothing — generator-specific
//   5  GENERATOR_FINGERPRINT — Identifies WHICH generator made the image (weight 0.21)
//   6  SEMANTIC_LOGIC    — Scene logic, object coherence, text coherence
//   7  MICRO_TEXTURE     — Material-level: fabric, skin pores, metal, wood, water
//   8  GEOMETRIC         — Perspective, vanishing points, shadow geometry, reflections
//   9  COLOR_SCIENCE     — Channel statistics, gamut, generator color fingerprints
//
// API Cascade per agent:
//   Primary   → Grok Vision (xAI)
//   Fallback1 → Gemini 2.0 Flash
//   Fallback2 → OpenRouter (Qwen2.5-VL)
// ════════════════════════════════════════════════════════════════════════════

import type {
  LayerReport, SemanticAgentReport, EvidenceNode, ArtifactStatus,
} from '@/types/forensic'
import { LAYER_NAMES, VISION_AGENT_TIMEOUT_MS, SEMANTIC_AGENT_WEIGHTS } from '@/lib/forensic/constants'

// ── Agent System Prompts ──────────────────────────────────────────────────────

const AGENT_PROMPTS: Record<string, string> = {

  FACIAL: `You are a forensic facial analyst specializing in AI-generated image detection.
Examine the image and analyze ONLY: eyes, nose, ears, mouth, and skin texture.

Known AI tells to check:
- Eyes: iris reflections inconsistent with scene lighting; missing sclera blood vessels; unnatural bilateral symmetry; iris textures that repeat or look stamped
- Nose: nasal bridge has no micro-pores; nostril openings are geometrically perfect; bridge-tip ratio looks mathematically uniform
- Ears: antihelix is a smooth blob; ear canal is missing or black hole; earlobe attachment point is vague; cartilage ridges are softened
- Mouth: teeth are blended together without individual shape variation; tongue surface is uniform silicone-like; lip vermilion border is razor-sharp
- Skin: pore pattern is uniform across cheek/forehead (AI repeats texture); wrinkles don't follow actual muscle lines; freckles are evenly distributed

GENERATOR-SPECIFIC FACIAL TELLS:
GEMINI/IMAGEN 3: Skin appears soft-focus even at 100% zoom; iris patterns too symmetrical; eyelashes follow mathematical curves not biological randomness; nostrils perfectly oval/round; lip highlights at cupid's bow by specular model
GROK/AURORA: Facial features lean toward heroic/cinematic proportions; skin slightly waxy or hyperreal; eyes dramatically lit ignoring scene context; hair near face merges into background at >80% saturation
CHATGPT/DALL-E 3: Slight airbrushing across forehead/cheeks; pupil shape perfectly circular; micro-expressions around eyes too smooth; teeth uniformly shaped in smiling shots
GPT-4o NATIVE: Most photorealistic — look for ear canal depth inconsistency, brow hair direction uniformity, slight symmetric smiling; lip vermilion border crisp but nasolabial fold breaks at nostril junction
MIDJOURNEY v6: Aesthetic optimized over biological accuracy; skin pore texture repeats (tiled artifact); eyelash count too high; lower lash line missing or perfect; smile wrinkles placed aesthetically not muscle-anatomically
MIDJOURNEY NIJI: Anime proportions — iris occupies >35% of eye area; lip color uniformly saturated; skin shading uses 3-5 discrete tonal steps not continuous gradation
STABLE DIFFUSION/FLUX: SD 1.5 has duplicated/missing eye reflections; SDXL distinctive forehead-to-hairline smear; Flux hyper-detailed hair simulation looks rendered not grown

GPT-4o NATIVE (2025-2026) — CRITICAL NEW TELLS:
- Ear canal depth inconsistency: one ear canal appears shallow, the other impossibly deep — subtle but consistent
- Brow hair direction uniformity: ALL eyebrow hairs point in exactly the same direction (real brows have 10-20 degree variation between hairs)
- Nasolabial fold break: the fold from nose to mouth corner breaks unnaturally at the nostril junction — smooth where there should be a crease
- Lip vermilion border: crisp and sharp but the transition to surrounding skin is too abrupt (real lips have a 1-2 pixel feather zone under microscopy)
- Sclera color: pure white (#FFFFFF range) instead of natural ivory with slight warm or cool tint from ambient lighting
- Pupil shape: perfectly circular in ALL lighting conditions — real pupils dilate and contract asymmetrically under uneven lighting

FLUX (Black Forest Labs, 2024-2025) — CRITICAL NEW TELLS:
- Hair simulation: individual strands that look CGI-rendered — perfect curvature, uniform thickness, no split ends; looks like 3D hair cards in a game engine
- Skin subsurface scattering: green channel slightly suppressed in skin tones (Flux encoder signature — measurable in histogram)
- Eye reflections: the reflections in irises/sclera show windows and environments that are not present anywhere else in the scene
- Micro-detail uniformity: pores, freckles, and blemishes have suspiciously uniform size distribution — real faces have clusters and variation

Output ONLY a JSON object with this exact schema:
{
  "agentName": "FacialForensicsAgent",
  "agentSuspicionScore": <number 0.0-1.0>,
  "evidence": [
    {
      "category": "facial_geometry",
      "artifactType": "<specific artifact like ear_attachment_anomaly>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 120 chars>",
      "region": {"x": <0-1>, "y": <0-1>, "width": <0-1>, "height": <0-1>}
    }
  ],
  "rawResponse": "<one sentence overall assessment>"
}
Respond with ONLY the JSON. No markdown. No preamble.`,

  PHYSICS: `You are a forensic physics analyst specializing in computational photography and AI image detection.
Examine lighting, shadows, reflections, and depth-of-field in this image.

Known AI tells to check:
- Shadows: multiple objects should cast shadows pointing to the SAME light source. AI often creates inconsistent shadow angles.
- Specular highlights: reflective surfaces (eyes, skin, metal) should reflect the same environment. AI often generates each highlight independently.
- Depth-of-field: blur in the background should follow optical physics. AI bokeh is often too uniform or has wrong shape for the implied aperture.
- Light falloff: the 3D lighting should be physically plausible.
- Window/mirror reflections: if mirrors or windows are present, what's reflected should match the scene geometry.

GENERATOR-SPECIFIC PHYSICS TELLS:
GEMINI/IMAGEN 3: Sky-dome lighting even in interior scenes; no hard shadows even with single strong light source; specular highlights follow Lambertian model not skin-specific BRDF; glass/water has correct refraction but wrong reflections
GROK/AURORA: Dramatic high-contrast lighting; rim lighting appears with no backlight in scene; lens flare in non-backlit shots; depth of field follows artistic composition not aperture physics
CHATGPT/DALL-E 3: Soft-box studio lighting applied to outdoor scenes; shadows slightly too dark (over-gamma corrected) and don't match sun angle in sky; reflective surfaces show generic not scene-accurate reflections
MIDJOURNEY v6: Golden hour lighting even in inappropriate scenes; background blur follows aesthetic not focal distance; cloth and hair reflections too specular (slightly plastic look)
STABLE DIFFUSION/FLUX: SD shows multiple light sources from shadow directions; Flux near-perfect lighting but window reflections in eyes reflect windows not visible in scene

FLUX — NEW PHYSICS TELLS (2024-2025):
- Light source count: Flux images often contain 3+ distinct light sources whose shadows and reflections are independently computed but don't interact (no secondary reflections, no color bleeding between light sources)
- Shadow softness uniformity: ALL shadows in the image have identical softness/penumbra regardless of light source size or distance — physically impossible in real scenes
- Caustics: water and glass caustic patterns are too symmetric and regularly spaced — real caustics have chaotic, organic distribution
- Window reflections in eyes: as noted in facial agent — reflections show environments not in frame

GEMINI / IMAGEN 3 — NEW PHYSICS TELLS (2024-2025):
- Sky-dome lighting: even indoor scenes have soft ambient light from ALL directions simultaneously — as if the scene is lit by an overcast sky even when windows suggest directional sunlight
- No hard shadows: even with a single strong light source visible in the scene, shadows remain soft and diffuse — physically impossible
- Specular highlights: follow Lambertian diffuse model rather than skin-specific BRDF — glossy highlight doesn't "wrap" around the nose and cheekbone correctly

VIDEO-TO-IMAGE AI (Sora, Runway Gen-3, Pika 2.0) — NEW TELLS:
- Temporal freeze artifacts: objects that were moving in video have motion blur that is perfectly frozen — looks like a long-exposure photograph of something that was actually moving fast
- Frame interpolation smoothness: smooth gradient where there should be a sharp edge between moving and static elements
- Subject isolation: foreground subject looks subtly "cut out" from background — edge detail discontinuity
- Lighting inconsistency: subject lighting direction doesn't match background lighting direction

Output ONLY a JSON object with this exact schema:
{
  "agentName": "PhysicsLightingAgent",
  "agentSuspicionScore": <number 0.0-1.0>,
  "evidence": [
    {
      "category": "physics_lighting",
      "artifactType": "<specific artifact>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 120 chars>"
    }
  ],
  "rawResponse": "<one sentence overall assessment>"
}
Respond with ONLY the JSON.`,

  BACKGROUND: `You are a forensic background analyst specializing in AI-generated image detection.
Examine hair-background boundaries, any text or signage, and distant figures or architecture.

Known AI tells to check:
- Hair edges: real hair has individual strands visible at the boundary. AI hair blends into a fuzzy or blotchy boundary.
- Text and signage: AI cannot reliably generate coherent text. Read every word/character you can see. Report gibberish, merged letters, or impossible words.
- Distant faces: in crowd shots, people further away should still have face structure. AI often makes distant faces look like mannequins.
- Architecture: buildings should have consistent perspective lines. AI often has walls that curve or windows that don't align.
- Background repetition: AI often tiles or repeats background elements.

GENERATOR-SPECIFIC BACKGROUND TELLS:
GEMINI/IMAGEN 3: Background objects too harmoniously arranged (real backgrounds are messy); architecture follows perfect perspective (a tell — real photos have slight lens distortion); text increasingly legible but check letter spacing anomalies
GROK/AURORA: Background object edges merge with distinctive oil-painting softening; text fails on less common characters (numbers, punctuation, special chars); large flat surfaces have subtle repetitive texture — look for tiled micro-patterns
CHATGPT/DALL-E 3 / GPT-4o: DALL-E 3 has surreal logic breaks (library bookshelf with 50 copies of same book spine); GPT-4o: objects that logically shouldn't coexist, or objects half-visible at frame edges
MIDJOURNEY v6: Backgrounds impressionistically rendered — intentionally painterly at edges; out-of-focus areas have distinctive glow — slightly elevated brightness/saturation vs real bokeh

HAIR/SUBJECT EDGE SIGNATURES:
Gemini: slight luminance halo against bright background (matting artifact from diffusion process)
Grok: violet fringe against dark backgrounds (Aurora color bleed)
DALL-E 3: hair strand simulation breaks at extreme ends — strands terminate blunt or forked
Midjourney: hair boundary is artistic blur gradient rather than individual strand definition
SD/Flux: hair against complex backgrounds shows copy-paste artifact — background visible through hair incorrectly rendered

VIDEO-TO-IMAGE AI (Sora, Runway, Pika) — BACKGROUND TELLS:
- Background motion blur inconsistency: background has motion blur from video frame but subject is sharp — uncanny mismatch
- Background environmental randomness is absent: AI video models generate backgrounds with thematic consistency too perfect for real environments
- Check frame edges: video-to-image often shows slight compression/artifacting at frame edges from the video encoding pipeline

Output ONLY a JSON object with this exact schema:
{
  "agentName": "BackgroundEdgeAgent",
  "agentSuspicionScore": <number 0.0-1.0>,
  "evidence": [
    {
      "category": "background_edge",
      "artifactType": "<specific artifact>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 120 chars>"
    }
  ],
  "rawResponse": "<one sentence overall assessment>"
}
Respond with ONLY the JSON.`,

  ANATOMICAL: `You are a forensic anatomist specializing in AI-generated image detection.
Examine hands, limbs, and clothing in this image.

Known AI tells to check:
- Hands: count every finger carefully. AI often produces 4, 6, or fused fingers. Check that finger joints bend in anatomically correct directions. Check nail plates are individually distinct.
- Wrists and elbows: joint geometry should be anatomically accurate. AI often creates smooth morphing transitions where joints should have clear bone landmarks.
- Proportions: arm length relative to body height should follow human proportions (arm span approximately equal to height). AI often gets limb lengths wrong.
- Clothing: fabric should drape according to gravity and the 3D shape underneath. Seams should be continuous and consistent. Patterns (stripes, plaid) should curve around the body correctly.
- Footwear: shoes should be symmetrical left/right pairs. AI often creates mismatched or anatomically impossible shoe shapes.

GENERATOR-SPECIFIC ANATOMICAL TELLS:
GEMINI/IMAGEN 3: Hands improved but count fingers AND check fingernail proportions (often too wide); feet/toes lack knuckle definition; clothing wrinkles physically plausible but don't follow body weight beneath
GROK/AURORA: Fingers slightly elongated with uniform joint spacing; muscle definition aesthetically amplified beyond physiological accuracy; clothing follows standard drape simulation — watch for identical fold patterns across different fabric types
GPT-4o / DALL-E 3: GPT-4o markedly improved hands — check for 4-finger, fused, or extra-knuckle hands; finger proportion ratios (index-to-ring) often deviate from real population distributions
MIDJOURNEY v6: Hands most common failure point — all MJ versions produce hand errors at rate >40%; shoes often mirror-duplicates; belt buckles and jewelry simulated but not mechanically coherent

Output ONLY a JSON object with this exact schema:
{
  "agentName": "AnatomicalIntegrityAgent",
  "agentSuspicionScore": <number 0.0-1.0>,
  "evidence": [
    {
      "category": "anatomical_integrity",
      "artifactType": "<specific artifact>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 120 chars>"
    }
  ],
  "rawResponse": "<one sentence overall assessment>"
}
Respond with ONLY the JSON.`,

  GENERATOR_FINGERPRINT: `You are a forensic AI image attribution specialist. Your database contains the signature profiles of every major AI image generator.

Your task: analyze this image and identify WHICH generator likely created it, or provide evidence it is a real photograph.

GENERATOR SIGNATURE DATABASE:

[GEMINI / GOOGLE IMAGEN 3]
- Color: B channel consistently +3-7 points above R channel in skin tones (chrominance signature)
- Tonal range: pixel values cluster in 85-215 range; very few pixels below 50 or above 240
- Texture: hyper-smooth, zero visible grain even in shadow areas; clean dark gray shadows
- Sharpness: uniformly sharp across focal plane — no natural optical degradation at frame edges
- Style: highly polished stock-photo quality, aesthetically curated subjects and environments
- C2PA: may embed C2PA manifest with 'Google' as signer

[GROK / XAI AURORA]
- Color: violet and lime-green as dual hue peaks not present in other generators
- Contrast: dramatically high — shadows deeper than camera would capture
- Texture: metallic/synthetic surfaces extremely detailed; organic surfaces softer
- Composition: strong artistic framing — rule-of-thirds applied algorithmically
- Detail: hyper-detail in center frame, intentional impressionism at periphery
- Metadata: may have custom XMP tags with 'xAI' attribution

[CHATGPT / DALL-E 3]
- Color: warm-tone bias in shadows (orange/amber cast); midtones are cool
- Sharpness: slightly over-sharpened around subjects — sharpening halos at high-contrast edges
- Text: DALL-E 3 produces coherent short text (1-5 words); longer text fails
- File: typically outputs PNG (lossless), no EXIF, square or 16:9/9:16 aspect ratios
- May embed SynthID-equivalent watermark (TrIDent); check with C2PA

[GPT-4o NATIVE IMAGE GENERATION (2025-2026)]
- Most photorealistic of all generators — the hardest to detect visually
- Color: extremely tight luminance range (90-215); almost no pixels below 20 or above 238 — histogram has "clipped wings"
- Histogram: missing pure blacks (<20) and pure whites (>235) — characteristic of autoregressive synthesis
- Skin: most photorealistic but slight over-smoothing in mid-distance objects; faces at >2m distance lack natural micro-detail
- Text: can render full sentences coherently — paradoxically a tell (too perfect, too legible vs real-world signage)
- Consistency: extremely consistent lighting and physics across the WHOLE image — real scenes have slight inconsistencies
- EXIF: no camera EXIF; may include IPTC with 'Created by ChatGPT' or 'OpenAI'; always PNG format
- Special tell: ear canal depth inconsistency (one shallow, one impossibly deep) — present in ~70% of GPT-4o portraits

[MIDJOURNEY v6 / v6.1]
- Aesthetic bias: maximum beauty and drama — objectively gorgeous images
- Bokeh: out-of-focus areas have characteristic "Midjourney glow" — lifted blacks, soft halos
- Skin: distinctive pore-free skin with subtle iridescent sheen in highlights
- Edges: hair boundary with background has atmospheric perspective softening
- Composition: diagonal compositions and dramatic angles used ~40% of the time
- File: no EXIF; JPEG at quality 80-85; MJ watermark may appear in bottom-right at smaller sizes

[MIDJOURNEY NIJI v6]
- Anime-style: highly saturated, flat-ish shading
- Eye-to-face ratio: eye height exceeds 18% of total face height (impossible in real humans)
- Line art: skin shading uses discrete tonal zones not photographic gradients
- Background: often uses color washes rather than detailed environments

[STABLE DIFFUSION / SDXL / FLUX]
- SD 1.5/2.1: distinctive uncanny valley — slightly smeared facial features
- SDXL: more photorealistic but background objects have rubber quality — too smooth and uniform
- Flux (Black Forest Labs, 2024-2025): near-photorealistic — second hardest to detect after GPT-4o
  * Hair: individual strands with perfect curvature and uniform thickness — looks like 3D game engine hair cards
  * Skin: green channel slightly suppressed in skin tones (Flux VAE encoder signature)
  * Eye reflections: show environments not present in the scene frame
  * Background: near-photographic but lacks environmental randomness (too thematically consistent)
  * File: no EXIF, high resolution (1024x1024+), PNG or WebP format, no JPEG compression
  * Micro-detail: pores, freckles, and blemishes all same size — uniform distribution unlike real skin
- All SD variants: blue channel banding from VAE decoder
- AUTOMATIC1111/ComfyUI: DPM-Solver artifact patterns in complex textures

[ADOBE FIREFLY v3]
- Highly polished stock-photo look — similar to Gemini but warmer color profile
- Strong C2PA compliance: Firefly ALWAYS embeds C2PA with 'Adobe Inc.' as signer
- Metadata: IPTC data including 'AI Generative' in Genre field
- Style: overly commercially palatable — no edge cases, all subjects model-quality

[LEONARDO AI]
- Strong stylized rendering — concept art / game art aesthetic
- Background objects have environmental storytelling quality — too thematic
- Skin in photorealistic mode has distinctive subsurface scattering look

[IDEOGRAM v2]
- Strongest text rendering of any generator — renders multi-line coherent text
- Typography-focused compositions are an Ideogram tell
- Color palette slightly muted / desaturated vs MJ or Grok
- Faces are softer and less dramatic than MJ

[REAL PHOTOGRAPH indicators]
- Camera EXIF present with consistent shutter speed, ISO, focal length, GPS
- Pixel noise follows Poisson distribution in dark areas
- Chromatic aberration at frame edges (lens-induced)
- Natural color cast (warm outdoor, cool indoor LED)
- Compression artifacts from natural JPEG encoding at 75-92 quality
- Lens distortion (barrel or pincushion) from wide/tele lens
- Motion blur or subject blur from real camera movement
- Background repeats real-world environmental complexity (imperfect, random)

WATERMARK / PROVENANCE SIGNALS to check:
- C2PA manifest present? (Adobe, Google, Microsoft, Truepic all embed these)
- SynthID pattern? (Google imperceptible watermark — subtle ripple in pixel statistics)
- Midjourney corner watermark (faint but present at smaller sizes)
- OpenAI TrIDent watermark (statistical, not visual — unusual LSB patterns)

Output ONLY a JSON object with this exact schema:
{
  "agentName": "GeneratorFingerprintAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "topGeneratorMatch": "<generator_name or 'REAL_PHOTO'>",
  "generatorConfidence": <0.0-1.0>,
  "alternativeMatches": [
    {"generator": "<name>", "confidence": <0.0-1.0>}
  ],
  "evidence": [
    {
      "category": "generator_fingerprint",
      "artifactType": "<e.g. 'gemini_b_channel_bias' or 'aurora_violet_lime_hue_peaks'>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 150 chars>"
    }
  ],
  "provenanceSignals": {
    "c2paDetected": <boolean>,
    "c2paSigner": "<string or null>",
    "synthidLikely": <boolean>,
    "watermarkVisible": <boolean>
  },
  "rawResponse": "<one sentence overall assessment>"
}
Respond with ONLY the JSON. No markdown. No preamble.`,

  SEMANTIC_LOGIC: `You are a forensic visual logic analyst. You determine whether the SCENE DEPICTED in this image makes real-world logical sense.

AI generators create images pixel-by-pixel without understanding real-world constraints. This often produces visually appealing but logically broken scenes.

CHECK FOR:
1. OBJECT COHERENCE: Do objects belong in this setting? (surgeon using antique tools, scientist in medieval lab, professional in pajamas)
2. SCALE CONSISTENCY: Are object sizes proportional and consistent? (cars same size as buses, adults same height as children)
3. TEMPORAL CONSISTENCY: Are all elements from the same era? (medieval setting with electrical outlets, 1950s scene with smartphones)
4. MATERIAL PHYSICS: Are materials behaving correctly? (water flowing upward, fabric floating without wind, rigid objects bent, fire underwater)
5. TEXT COHERENCE: Read ALL text visible. Does it make semantic sense? AI often generates plausible-looking text that is gibberish or contradictory.
6. HUMAN BEHAVIOR: Are humans doing something physically possible and contextually appropriate?
7. ENVIRONMENTAL CONSISTENCY: Does the weather, time of day, and environment match? (shadows pointing in different directions, simultaneous day and night)
8. SOCIAL/CULTURAL LOGIC: Are clothing, customs, and behaviors appropriate to the depicted setting?

SPECIAL AI TEXT DETECTION:
Read every word in the image carefully. AI generators fail text in specific ways:
- Single words: usually correct (DALL-E 3, Ideogram, GPT-4o are good at this)
- 2-5 word phrases: mostly correct with occasional letter substitution
- Sentences: often garbled — merged words, wrong letters, missing words
- Numbers: dates, phone numbers, addresses often contain impossible values (month 13, year 0029)
- Logos: real brand logos are distorted, wrong colors, or have subtle letter changes
- Signs in foreign languages: AI often invents plausible-looking but meaningless characters

Output ONLY a JSON object:
{
  "agentName": "SemanticLogicAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    {
      "category": "semantic_logic",
      "artifactType": "<type>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<max 150 chars>"
    }
  ],
  "textAnomalies": ["<each text string that appears wrong>"],
  "logicViolations": ["<each real-world logic violation found>"],
  "rawResponse": "<one sentence summary>"
}
Respond with ONLY the JSON.`,

  MICRO_TEXTURE: `You are a forensic material science analyst specializing in AI image detection at the micro-texture level.

AI diffusion models generate textures through a learned latent-space process. This leaves distinctive marks in how materials are rendered at high magnification — marks that differ fundamentally from photographic capture.

EXAMINE THESE MATERIAL SIGNATURES:

FABRIC & CLOTHING:
- Real fabric: irregular weave pattern with random thread variations
- AI fabric: weave pattern repeats at a regular interval; thread count is uniform
- Check: zooming in on fabric — does the pattern tile? Does it maintain perfect regularity?
- Knit textures (sweaters, jerseys): AI cannot render individual knit loops; creates smooth bumpy approximation
- Denim: AI denim lacks the actual diagonal twill weave; creates a smooth blue approximation

SKIN AT MACRO SCALE:
- Real skin: pore distribution is random, concentrations vary by face region (more on nose, forehead)
- AI skin: either perfectly smooth (no pores) OR uniformly pored (same density everywhere)
- Subsurface scattering: real skin has visible veins/redness; AI skin is uniformly toned
- Sweat, oil, or dry patches: absent in AI portraits

HAIR:
- Real hair: individual strands have their own highlight specular, creating many tiny light points
- AI hair: highlights appear as gradient zones, not point specular on individual strands
- Split ends: completely absent in AI hair; all strands terminate cleanly
- Static/flyaways: AI hair follows a designed silhouette; no random stray hairs

METAL & REFLECTIVE SURFACES:
- Real metal: anisotropic specular highlights (stretched along grain direction)
- AI metal: isotropic specular (uniform circles or ovals)
- Scratches: AI scratches are too regular, too uniformly spaced

WOOD:
- Real wood: grain has irregular variation, knots are complex biological structures
- AI wood: grain lines are too straight and evenly spaced; knots are decorative blobs

WATER:
- Real water surfaces: complex caustics, Fresnel reflection variation by angle
- AI water: reflection is too uniform; caustic patterns are too symmetric

CONCRETE / STONE:
- Real concrete: visible aggregate (sand, gravel) texture with irregular distribution
- AI concrete: smooth gray texture with surface noise stamp applied uniformly

Output ONLY a JSON object:
{
  "agentName": "MicroTextureAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    {
      "category": "micro_texture",
      "artifactType": "<specific artifact e.g. 'fabric_regular_weave_tiling'>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 150 chars>"
    }
  ],
  "rawResponse": "<one sentence summary>"
}
Respond with ONLY the JSON.`,

  GEOMETRIC: `You are a forensic geometry analyst and computational vision expert specializing in AI image detection.

AI generators compute geometry independently for each object/region using local context. This causes global geometric inconsistencies that are impossible in real photographs.

CHECK THESE GEOMETRIC SIGNALS:

PERSPECTIVE CONSISTENCY:
- Draw imaginary horizontal lines through the scene. Do they converge to a single vanishing point?
- AI images often have multiple incompatible vanishing points — the left side of the image disagrees with the right side
- Check floors, tables, bookshelves, buildings: do their edges align to the same perspective grid?

MIRROR SYMMETRY BREAKS:
- Reflection in mirrors, windows, sunglasses, or other reflective surfaces must show the CORRECT reverse image
- Calculate: what should be reflected given the scene geometry? Does the reflection match?
- AI mirrors often reflect a generic blur or an invented scene

SHADOW GEOMETRY:
- All shadows must point to the same light source (consistent angle and length)
- Shadow on the ground must match the object's 3D shape
- Contact shadows (where objects meet a surface) must follow the object's bottom edge

OCCLUSION LOGIC:
- Closer objects must fully occlude farther objects
- Partial occlusion edges must be geometrically consistent (no ghost edges)

DEPTH-OF-FIELD PHYSICS:
- Objects at the same distance from camera should have the same blur level
- Background blur (bokeh) should increase continuously with distance, not jump discretely

SIZE CONSISTENCY:
- If a standard door is visible, all other objects must be proportional
- Hands relative to faces: adult palm width should be approximately forehead width
- Tables: standard table height is 29-31 inches; chairs are 17-19 inches seat height

LENS DISTORTION:
- Wide-angle real lenses create barrel distortion; telephoto creates pincushion
- AI images often have no lens distortion — perfectly straight lines everywhere — this is a tell for generated content

Output ONLY a JSON object:
{
  "agentName": "GeometricIntegrityAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    {
      "category": "geometric_integrity",
      "artifactType": "<specific artifact>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 150 chars>"
    }
  ],
  "vanishingPointConsistent": <boolean>,
  "shadowsConsistent": <boolean>,
  "reflectionsAccurate": <boolean>,
  "rawResponse": "<one sentence summary>"
}
Respond with ONLY the JSON.`,

  COLOR_SCIENCE: `You are a forensic color scientist specializing in digital photography and AI image generation. You analyze color at a mathematical/physical level.

EXAMINE THESE COLOR SCIENCE SIGNALS:

CHANNEL STATISTICS (visualize the RGB histograms):
- Real photos: channels have natural correlation with slight color cast (warm sunset, cool shade)
- AI photos: channels are unnaturally balanced OR have characteristic generator bias

GENERATOR COLOR FINGERPRINTS:
- Gemini/Imagen 3: Blue channel slightly elevated; very clean histogram with few outliers; almost no pixels in pure black (<10) or pure white (>245)
- Grok/Aurora: Violet and lime-green as secondary hue peaks; high contrast (wide histogram spread); shadow areas have cool blue cast
- DALL-E 3: Warm shadows (orange/amber tint in dark areas); cool highlights (slight cyan in bright areas) — inverted from natural photo color
- GPT-4o: Most natural histogram — tell is extremely tight luminance range (90-215) with almost no tonal extremes
- Midjourney v6: Saturated and vibrant — histogram pushed toward both ends; color gamut exceeds standard sRGB in blues and greens
- SDXL: Somewhat neutral color but distinctive blue-channel banding from VAE decoder quantization
- Flux: Near-photographic histogram; tell is slight green channel suppression in skin tones
- Adobe Firefly: Warm color profile; strong sRGB compliance; no out-of-gamut colors

COLOR GAMUT:
- Real cameras: capture in wide gamut (AdobeRGB or P3) then convert to sRGB — clips a small % of saturated colors
- AI images: most generate within sRGB and show no gamut clipping, but Midjourney may exceed sRGB slightly
- Check: are any colors oversaturated to the point of appearing neon? This is an AI generation artifact.

WHITE BALANCE:
- Real photos: white balance varies by light source (incandescent = orange, LED = blue-white, sunlight = neutral)
- AI images: white balance is often "perfect" — neutrally balanced even in environments where color temperature should dominate

NOISE COLOR:
- Camera noise: luminance noise is intensity-dependent (more noise in shadows); chroma noise is different color from signal
- AI images: no true photonic noise; any apparent grain is spatially uniform texture, not statistically random

BANDING:
- Look for visible horizontal or vertical banding in smooth gradients (sky, skin tone transitions)
- SDXL/Flux: VAE decoder produces subtle color banding in low-contrast regions, especially blues and purples

SKIN TONE GAMUT:
- Real skin covers a specific region of CIELab color space
- AI skin (Gemini, Grok): often sits outside this zone — too pink or too yellow depending on generator
- Midjourney: skin often occupies a narrower gamut than real skin — more "perfect" colors

Output ONLY a JSON object:
{
  "agentName": "ColorScienceAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "generatorColorMatch": "<generator_name or 'NATURAL_PHOTO'>",
  "evidence": [
    {
      "category": "color_science",
      "artifactType": "<specific artifact>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 150 chars>"
    }
  ],
  "channelBiasDetected": <boolean>,
  "colorBandingDetected": <boolean>,
  "rawResponse": "<one sentence summary>"
}
Respond with ONLY the JSON.`,
}

// ── Generator Pattern Trie ────────────────────────────────────────────────────

interface GPTrieNode {
  feature:     string
  children:    Map<string, GPTrieNode>
  generators:  Map<string, number>
  sampleCount: number
}

class GeneratorPatternTrie {
  private root: GPTrieNode = {
    feature: 'ROOT', children: new Map(), generators: new Map(), sampleCount: 0,
  }

  static readonly GENERATOR_PATHS: Record<string, string[]> = {
    'Gemini/Imagen3':  ['B_CHANNEL_BIAS', 'ZERO_NOISE', 'MIDTONE_CLUSTER', 'CLEAN_HISTOGRAM', 'SKIN_SMOOTH'],
    'Grok/Aurora':     ['VIOLET_HUE_PEAK', 'LIME_HUE_PEAK', 'HIGH_CONTRAST', 'DRAMATIC_LIGHTING', 'WAXY_SKIN'],
    'DALL-E3':         ['WARM_SHADOWS', 'COOL_HIGHLIGHTS', 'OVER_SHARPENED', 'PNG_FORMAT', 'STUDIO_LIGHTING'],
    'GPT-4o':          ['PHOTOREALISTIC', 'TIGHT_TONAL_RANGE', 'LEGIBLE_TEXT', 'BALANCED_CHANNELS', 'CONSISTENT_PHYSICS'],
    'Midjourney_v6':   ['AESTHETIC_BIAS', 'BOKEH_GLOW', 'SATURATED_COLORS', 'BEAUTY_OPTIMIZED', 'HAIR_SMEAR'],
    'Midjourney_niji': ['ANIME_PROPORTIONS', 'LARGE_IRIS_RATIO', 'DISCRETE_SHADING', 'FLAT_COLOR', 'STYLIZED_OUTLINE'],
    'SDXL':            ['VAE_BANDING', 'RUBBER_BACKGROUNDS', 'BLUE_BANDING', 'UNCANNY_MID', 'FOREHEAD_SMEAR'],
    'Flux':            ['HYPER_DETAIL_HAIR', 'NEAR_PHOTOREALISTIC', 'GREEN_SUPPRESSED_SKIN', 'CGI_RENDERED'],
    'Adobe_Firefly':   ['C2PA_ADOBE', 'WARM_TONES', 'STOCK_PHOTO', 'SRGB_COMPLIANT', 'IPTC_AI_GENRE'],
    'Ideogram_v2':     ['COHERENT_TEXT', 'TYPOGRAPHY_FOCUS', 'MUTED_PALETTE', 'SOFT_FACES'],
    'Leonardo_AI':     ['CONCEPT_ART', 'GAME_ART', 'SSS_SKIN', 'THEMATIC_BG'],
  }

  insertEvidence(features: string[], generator: string, weight: number): void {
    let node = this.root
    for (const feature of features) {
      if (!node.children.has(feature)) {
        node.children.set(feature, {
          feature, children: new Map(), generators: new Map(), sampleCount: 0,
        })
      }
      node = node.children.get(feature)!
      node.generators.set(generator, (node.generators.get(generator) || 0) + weight)
      node.sampleCount++
    }
  }

  scoreGenerators(detectedFeatures: Set<string>): Map<string, number> {
    const scores = new Map<string, number>()
    for (const [gen, path] of Object.entries(GeneratorPatternTrie.GENERATOR_PATHS)) {
      const matches = path.filter(f => detectedFeatures.has(f)).length
      scores.set(gen, matches / path.length)
    }
    return scores
  }
}

// ── Evidence Accumulation State Machine ───────────────────────────────────────

type DetectionState =
  | 'INSUFFICIENT_EVIDENCE'
  | 'PROBABLE_AI'
  | 'DEFINITE_AI'
  | 'PROBABLE_REAL'
  | 'REAL_WITH_EDITING'
  | 'ADVERSARIAL'

interface StateMachineResult {
  state:                DetectionState
  confidence:           number
  primaryEvidence:      string[]
  generatorAttribution: string | null
}

function runEvidenceStateMachine(
  agents:         SemanticAgentReport[],
  generatorAgent: (SemanticAgentReport & Record<string, unknown>) | undefined,
): StateMachineResult {
  const anomalousAgents  = agents.filter(a => a.agentSuspicionScore > 0.65 && a.modelUsed !== 'failed')
  const moderateAgents   = agents.filter(a => a.agentSuspicionScore > 0.45 && a.modelUsed !== 'failed')
  const successfulAgents = agents.filter(a => a.modelUsed !== 'failed')

  const genAttr = (generatorAgent?.topGeneratorMatch as string | null) ?? null
  const genConf = (generatorAgent?.generatorConfidence as number) ?? 0

  const primaryEvidence = agents
    .flatMap(a => a.evidence.filter(e => e.status === 'anomalous').slice(0, 2))
    .map(e => e.detail)
    .slice(0, 8)

  if (successfulAgents.length < 2) {
    return { state: 'INSUFFICIENT_EVIDENCE', confidence: 0.3, primaryEvidence, generatorAttribution: null }
  }
  if (anomalousAgents.length >= 6 || (generatorAgent && genConf > 0.80 && genAttr !== 'REAL_PHOTO')) {
    return { state: 'DEFINITE_AI', confidence: 0.92, primaryEvidence, generatorAttribution: genAttr }
  }
  if (anomalousAgents.length >= 3 || moderateAgents.length >= 5) {
    return { state: 'PROBABLE_AI', confidence: 0.72, primaryEvidence, generatorAttribution: genAttr }
  }
  if (successfulAgents.filter(a => a.agentSuspicionScore < 0.35).length >= 5) {
    const hasEditingSignals = agents.some(a =>
      a.evidence.some(e => e.artifactType?.includes('edit') || e.artifactType?.includes('filter'))
    )
    return {
      state:                hasEditingSignals ? 'REAL_WITH_EDITING' : 'PROBABLE_REAL',
      confidence:           0.70,
      primaryEvidence,
      generatorAttribution: null,
    }
  }
  return { state: 'PROBABLE_AI', confidence: 0.55, primaryEvidence, generatorAttribution: genAttr }
}

// ── Vision API Callers ────────────────────────────────────────────────────────

interface VisionAPIResult {
  content:   string
  modelUsed: string
}

async function callGrokVision(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) throw new Error('GROK_API_KEY not set')

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-2-vision-latest', max_tokens: 900, temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          { type: 'text', text: 'Analyze this image and output the JSON as instructed.' },
        ]},
      ],
    }),
    signal: AbortSignal.timeout(VISION_AGENT_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Grok API error: ${res.status}`)
  const data = await res.json()
  return { content: data.choices?.[0]?.message?.content || '', modelUsed: 'grok-2-vision-latest' }
}

async function callGeminiVision(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) })
  if (!imgRes.ok) throw new Error('Could not fetch image for Gemini')
  const imgBase64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
  const mimeType  = imgRes.headers.get('content-type') || 'image/jpeg'

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [
          { inline_data: { mime_type: mimeType, data: imgBase64 } },
          { text: 'Analyze this image and output the JSON as instructed.' },
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 900 },
      }),
      signal: AbortSignal.timeout(VISION_AGENT_TIMEOUT_MS),
    }
  )
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
  const data = await res.json()
  return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '', modelUsed: 'gemini-2.0-flash' }
}

async function callOpenRouterVision(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aiscern.com', 'X-Title': 'Aiscern Forensic',
    },
    body: JSON.stringify({
      model: 'qwen/qwen2.5-vl-72b-instruct:free', max_tokens: 900, temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: 'Analyze this image and output the JSON as instructed.' },
        ]},
      ],
    }),
    signal: AbortSignal.timeout(VISION_AGENT_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`)
  const data = await res.json()
  return { content: data.choices?.[0]?.message?.content || '', modelUsed: 'qwen/qwen2.5-vl-72b-instruct' }
}

/** Cascade: Grok → Gemini → OpenRouter */
async function callVisionAPI(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  if (process.env.GROK_API_KEY) {
    try { return await callGrokVision(imageUrl, systemPrompt) }
    catch (e) { console.warn('[semantic-rag] Grok failed, trying Gemini:', (e as Error).message) }
  }
  if (process.env.GEMINI_API_KEY) {
    try { return await callGeminiVision(imageUrl, systemPrompt) }
    catch (e) { console.warn('[semantic-rag] Gemini failed, trying OpenRouter:', (e as Error).message) }
  }
  if (process.env.OPENROUTER_API_KEY) return callOpenRouterVision(imageUrl, systemPrompt)
  throw new Error(
    '[semantic-rag] No vision API key configured. ' +
    'Set at least one of: GROK_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY.'
  )
}

// ── Response Parser ───────────────────────────────────────────────────────────

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(16).padStart(8, '0')
}

// Extended fields returned by specific agents beyond the base SemanticAgentReport
const EXTENDED_FIELDS = [
  'topGeneratorMatch', 'generatorConfidence', 'alternativeMatches', 'provenanceSignals',
  'textAnomalies', 'logicViolations',
  'vanishingPointConsistent', 'shadowsConsistent', 'reflectionsAccurate',
  'generatorColorMatch', 'channelBiasDetected', 'colorBandingDetected',
]

function parseAgentResponse(
  rawContent: string,
  agentKey:   string,
  modelUsed:  string,
): SemanticAgentReport {
  const defaultReport: SemanticAgentReport = {
    agentName:           agentKey,
    promptHash:          hashString(AGENT_PROMPTS[agentKey] || ''),
    modelUsed,
    evidence:            [],
    agentSuspicionScore: 0.5,
    rawResponse:         rawContent.slice(0, 200),
  }

  try {
    const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed  = JSON.parse(cleaned)

    const evidence: EvidenceNode[] = (parsed.evidence || []).map((e: any): EvidenceNode => ({
      layer:        6,
      category:     String(e.category || 'semantic'),
      artifactType: String(e.artifactType || 'unknown'),
      status:       (['anomalous', 'normal', 'inconclusive', 'not_present'].includes(e.status)
                      ? e.status : 'inconclusive') as ArtifactStatus,
      confidence:   Math.min(1, Math.max(0, Number(e.confidence) || 0.5)),
      detail:       String(e.detail || '').slice(0, 180),
      region:       e.region && typeof e.region.x === 'number' ? e.region : undefined,
    }))

    const extended: Record<string, unknown> = {}
    for (const field of EXTENDED_FIELDS) {
      if (parsed[field] !== undefined) extended[field] = parsed[field]
    }

    return {
      agentName:           String(parsed.agentName || agentKey),
      promptHash:          hashString(AGENT_PROMPTS[agentKey] || ''),
      modelUsed,
      evidence,
      agentSuspicionScore: Math.min(1, Math.max(0, Number(parsed.agentSuspicionScore) || 0.5)),
      rawResponse:         String(parsed.rawResponse || '').slice(0, 300),
      ...extended,
    }
  } catch {
    return { ...defaultReport, rawResponse: rawContent.slice(0, 300) }
  }
}

// ── Agent key → weight lookup ─────────────────────────────────────────────────

// Maps the agentKey used in AGENT_PROMPTS to SEMANTIC_AGENT_WEIGHTS keys
const AGENT_WEIGHT_KEY: Record<string, string> = {
  FACIAL:               'FACIAL',
  PHYSICS:              'PHYSICS',
  BACKGROUND:           'BACKGROUND',
  ANATOMICAL:           'ANATOMICAL',
  GENERATOR_FINGERPRINT: 'GENERATOR_FINGERPRINT',
  SEMANTIC_LOGIC:       'SEMANTIC_LOGIC',
  MICRO_TEXTURE:        'MICRO_TEXTURE',
  GEOMETRIC:            'GEOMETRIC',
  COLOR_SCIENCE:        'COLOR_SCIENCE',
}

// ── Main Layer 6 Entry Point ──────────────────────────────────────────────────

export interface SemanticRAGResult {
  layerReport:          LayerReport
  agents:               SemanticAgentReport[]
  generatorAttribution: string | null
  detectionState:       DetectionState
  stateMachineResult:   StateMachineResult
}

const AGENT_KEYS = [
  'FACIAL', 'PHYSICS', 'BACKGROUND', 'ANATOMICAL',
  'GENERATOR_FINGERPRINT', 'SEMANTIC_LOGIC', 'MICRO_TEXTURE',
  'GEOMETRIC', 'COLOR_SCIENCE',
] as const

export async function runSemanticRAG(imageUrl: string): Promise<SemanticRAGResult> {
  const start = Date.now()

  // Run all 9 agents in parallel — each has its own cascade fallback
  const agentResults = await Promise.allSettled(
    AGENT_KEYS.map(async (key) => {
      const visionResult = await callVisionAPI(imageUrl, AGENT_PROMPTS[key])
      return parseAgentResponse(visionResult.content, key, visionResult.modelUsed)
    })
  )

  const agents: SemanticAgentReport[] = agentResults.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          agentName:           AGENT_KEYS[i],
          promptHash:          hashString(AGENT_PROMPTS[AGENT_KEYS[i]] || ''),
          modelUsed:           'failed',
          evidence:            [],
          agentSuspicionScore: 0.5,
          rawResponse:         `Agent failed: ${(r as PromiseRejectedResult).reason}`,
        }
  )

  // ── Weighted aggregation (SEMANTIC_AGENT_WEIGHTS, failed agents excluded and re-normalized) ──
  const successfulAgents = agents.filter(a => a.modelUsed !== 'failed')
  let weightedSum = 0
  let totalWeight = 0
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]
    if (agent.modelUsed === 'failed') continue
    const wKey  = AGENT_WEIGHT_KEY[AGENT_KEYS[i]] ?? 'FACIAL'
    const w     = SEMANTIC_AGENT_WEIGHTS[wKey] ?? 0.10
    weightedSum += w * agent.agentSuspicionScore
    totalWeight += w
  }
  const layerSuspicion = totalWeight > 0 ? weightedSum / totalWeight : 0.5

  // ── Generator Pattern Trie: build feature set from anomalous evidence ──────
  const trie             = new GeneratorPatternTrie()
  const detectedFeatures = new Set<string>()
  for (const agent of successfulAgents) {
    for (const ev of agent.evidence) {
      if (ev.status === 'anomalous' && ev.artifactType) {
        const feature = ev.artifactType.toUpperCase().replace(/\s+/g, '_')
        detectedFeatures.add(feature)
        trie.insertEvidence([feature], agent.agentName, ev.confidence)
      }
    }
  }

  // ── Evidence State Machine ─────────────────────────────────────────────────
  const generatorAgent   = successfulAgents.find(
    a => a.agentName === 'GENERATOR_FINGERPRINT' || a.agentName === 'GeneratorFingerprintAgent'
  ) as (SemanticAgentReport & Record<string, unknown>) | undefined

  const smResult             = runEvidenceStateMachine(agents, generatorAgent)
  const generatorAttribution = smResult.generatorAttribution

  const layerReport: LayerReport = {
    layer:               6,
    layerName:           LAYER_NAMES[6],
    processingTimeMs:    Date.now() - start,
    status:              successfulAgents.length > 0 ? 'success' : 'failure',
    evidence:            agents.flatMap(a => a.evidence),
    layerSuspicionScore: Math.min(Math.max(layerSuspicion, 0), 1),
  }

  return { layerReport, agents, generatorAttribution, detectionState: smResult.state, stateMachineResult: smResult }
}
