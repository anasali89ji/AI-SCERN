# Sensor profile schema (QESM / L14)

Each `<sensor>.json` in this directory describes one camera sensor's
neutral gray-locus behaviour under a set of standard illuminants, used by
`analyzers/qesm.py` for gray-locus sensor matching.

```jsonc
{
  "name": "Sony A7 IV",
  "sensor_type": "BSI_CMOS",
  "year": 2021,
  "spectral_peaks": { "R": 610, "G": 545, "B": 455 },   // approx nm, informational only — not used in scoring yet
  "gray_locus": {
    "d65":      { "r_g": 0.921, "b_g": 0.973 },
    "tungsten": { "r_g": 1.148, "b_g": 0.612 },
    "tl84":     { "r_g": 0.976, "b_g": 0.895 },
    "f11":      { "r_g": 0.938, "b_g": 0.952 }
  },

  // Optional. Fractional std-dev of r_g/b_g across real-world samples of
  // this sensor (unit variation, AWB variation, manufacturing tolerance).
  // If omitted, qesm.py assumes a 3% modeling default — NOT a measured
  // value. Add this block only when backed by real calibration data
  // (multiple real photos / raw captures from that sensor), not guesses.
  "gray_locus_std": {
    "d65": { "r_g": 0.02, "b_g": 0.015 }
  }
}
```

## Current scope

This database currently has ~20 sensors with real, publicly-documented
gray-locus values. The L14 optimization spec calls for 200+ sensors with
full spectral response curves Q(λ) and per-ISO variation — we did not
expand it, because we have no verified spectral-response measurements for
that many cameras, and fabricating plausible-looking numbers would create
false confidence rather than real detection power (a sensor "match" against
invented data isn't a match against anything real).

If you have access to real calibration data (raw captures with known
camera + illuminant, or published spectral response curves from a sensor
manufacturer/reviewer), adding a profile here is the right way to grow
QESM's coverage. Keep `gray_locus_std` empty (falls back to the documented
3% default) rather than inventing a number.
