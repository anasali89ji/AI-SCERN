# AISCERN Solution Pages — Final Image Asset Package

> **Generated:** July 15, 2026
> **Total Images:** 15 (9 hero + 6 problem)
> **Format:** WebP (converted from source PNG, quality 85)
> **Aspect Ratio:** All 16:9 horizontal
> **Post-processing:** Converted PNG → WebP with Pillow (`quality=85`). Originals removed after conversion; sizes now 94–245 KB per image (down from 1.8–2.6 MB PNG).

---

## Directory Structure

```
public/solutions/
├── content-creators/
│   ├── hero.webp      # Creator in studio with dual monitors, editing timeline
│   └── problem.webp   # Empty creator desk with AI-generated script, ring light
├── education/
│   ├── hero.webp      # Professor grading papers with red pen, laptop dashboard
│   └── problem.webp   # Authentic messy essay vs pristine AI essay on dorm desk
├── healthcare/
│   ├── hero.webp      # Physician with tablet in hospital corridor
│   └── problem.webp   # Tablet showing fabricated medical journal, alert system
├── hr/
│   └── hero.webp      # Recruiter reviewing resumes at glass desk, city dusk
├── legal/
│   ├── hero.webp      # Senior partner at mahogany desk with magnifying glass
│   └── problem.webp   # Legal brief with red circle, detection report paperclipped
├── marketing/
│   └── hero.webp      # Marketing director in warehouse war room, digital wall
├── media/
│   ├── hero.webp      # Newsroom editor catching deepfake at deadline
│   └── problem.webp   # Corkboard: authentic grainy rally vs synthetic perfect photo
├── research/
│   └── hero.webp      # Scientist at lab bench with microscope, integrity dashboard
└── security/
    ├── hero.webp      # SOC analyst at curved monitor array, 3:17 AM
    └── problem.webp   # Split: grandmother in warm kitchen vs attacker in dark room
```

---

## License Note

These images were generated using AI image generation tools (ChatGPT/DALL-E, Gemini).
**Verify usage rights** with your AI platform's terms of service before commercial deployment.
For production, consider replacing with CC0-licensed photographs from Unsplash/Pexels/Pixabay.

## Known Gaps (Not Covered by This Package)

The original polish brief also called for per-feature UI mockups (3 per page), one photo per use case, and a real customer headshot per case study. None of those were supplied in this asset drop, so:
- Feature cards still render with Lucide icons only (no mockup images wired in).
- Use cases render as text (challenge → action → outcome), no persona photos.
- Case studies use placeholder tokens (`[CUSTOMER NAME]`, `[COMPANY]`, `[QUOTE TEXT HERE]`, `[METRIC]`) — real customer quotes need to be swapped in before shipping; see `caseStudy` prop on each page.
- `hr`, `marketing`, and `research` have no `problem.webp` — their pages render without a problem-section image (falls back gracefully, no broken image).

