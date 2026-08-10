---
okf: 1
id: F015-video-test-corpus
type: finding
project: VTO
status: done
created: 2026-08-09
updated: 2026-08-09
tags: [vto, video-test, corpus, y4m, fake-camera, ui-test, accuracy, harness]
source_agent: opencode (video-test corpus)
source_task: VTO video UI-test corpus — conversion, naming, scoring
---

# F015 — Video UI-Test Corpus: Format, Clips, and Harness Scoring

**Project:** [[VTO]] · Consumers: VideoTester / Accuracy orchestrators, the
video harness (`rkumar-vto/tools/video-test/`)

## Question

What is the exact format, clip inventory, and per-clip pass/fail expectation of
the VTO video UI-test corpus — so tests run against a well-defined, reproducible
input set?

## Answer

### 1. Required input format

Chromium's fake webcam (`--use-file-for-fake-video-capture`) needs **Y4M**, not
MP4. `convert.py` produces the canonical encoding, confirmed identical across
all clips on 2026-08-09:

| Property | Value |
|---|---|
| Container | YUV4MPEG2 (Y4M) |
| Resolution | 640×480 |
| Framerate | 30 fps (`F30:1`) |
| Pixel format | yuv420p (`C420jpeg`) |
| Command | `ffmpeg -y -i in.mp4 -vf "scale=640:480,fps=30" -pix_fmt yuv420p -f yuv4mpegpipe out.y4m` |

### 2. Corpus inventory (`tools/video-test/videos/`, 2026-08-09)

| Clip (`.y4m`) | Duration | Source (`.mp4`) |
|---|---|---|
| `clear.y4m` | 31.6 s | `clear.mp4` (640×480) |
| `no_glasses.y4m` | 36.5 s | `no_glasses.mp4` (640×480) |
| `sunglasses.y4m` | 34.0 s | `sunglasses.mp4` (640×480) |
| `FaceWithClinicalGlassesForTesting.y4m` | 62.5 s | `FaceWithClinicalGlassesForTesting.mp4` (932×700) |
| `FaceWithSunglassesForTesting.y4m` | 62.2 s | `FaceWithSunglassesForTesting.mp4` (922×704) |
| `JustBareFaceVideoForTesting.y4m` | 60.2 s | `JustBareFaceVideoForTesting.mp4` (930×704) |
| `statusBeforeAgenticofBareFaceTryOn.y4m` | 39.5 s | `statusBeforeAgenticofBareFaceTryOn.mp4` (1360×638) |
| `statusBeforeAgenticofFaceWithSunglasses.y4m` | 35.1 s | `statusBeforeAgenticofFaceWithSunglasses.mp4` (1366×686) |
| `currentFrameRemovalFeatureState.y4m` | 32.2 s | `currentFrameRemovalFeatureState.mp4` (1362×694) |

**NOT converted** (accuracy reference only): `FittingBoxGlassesRemovalFeature.mp4`
(3840×2160, 45.4 s). Kept out of `videos/` scoring — it is ground-truth footage
for the accuracy harness (`--refs-dir`), not a scored test instance.

### 3. How the harness scores each clip

`run_video_test.py` derives the instance from the `.y4m` stem and classifies it
by substring match on the lowercased name — **order matters**:

1. contains `sun` → **SUNGLASSES** → pass iff removal `blocked`
2. contains `no` / `bare` / `without` → **NO-GLASSES** → pass iff neither
   `applied` nor `blocked`
3. contains `clear` / `glass` → **CLEAR** → pass iff `applied` and seg px > 0
4. otherwise → **FALLBACK** → pass iff widget build stamp seen

Corpus scoring (verified 2026-08-09):

| Clip | Match | Expectation |
|---|---|---|
| `clear` | clear | applied + seg px > 0 |
| `no_glasses` | no | neither applied nor blocked |
| `sunglasses` | sun | blocked |
| `FaceWithClinicalGlassesForTesting` | glass | applied + seg px > 0 |
| `FaceWithSunglassesForTesting` | sun | blocked |
| `JustBareFaceVideoForTesting` | bare | neither |
| `statusBeforeAgenticofBareFaceTryOn` | bare | neither |
| `statusBeforeAgenticofFaceWithSunglasses` | sun | blocked |
| `currentFrameRemovalFeatureState` | (none) | **FALLBACK** — widget loaded only |

### 4. Caveats / follow-ups

- ⚠️ **`currentFrameRemovalFeatureState` falls back to "widget loaded" scoring.**
  It documents the current Frame Removal feature state (per the owner, 2026-08-09).
  If the intent is to *assert removal is applied*, rename it to a name containing
  `clear`/`glass` (e.g. `currentClearGlassesRemovalState`) so the CLEAR path scores
  it — otherwise its verdict is weak by design.
- The three `statusBeforeAgentic*` clips are 1360×694-class footage of the
  pre-agentic feature states; they are legitimate corpus members but represent
  the *before* baseline.
- The 4K FittingBox clip is staged for the accuracy harness reference frames
  (OC-2B); it must not be converted into a `.y4m` inside `videos/` or the harness
  will try to score it.

## Implications

- **VideoTester** can now run a 9-clip corpus (3 canonical + 6 real-footage) with
  known expectations — no invented pass criteria.
- **Accuracy** gains a defined reference set: 3 FittingBox-style ground-truth
  clips (clear/sunglasses/no_glasses) plus the 4K FittingBox reference footage.
- Any new clip must be MP4→Y4M converted with the exact command in §1 and named
  so its substring hits the intended scoring branch.

## Evidence

- `rkumar-vto/tools/video-test/videos/` (the corpus itself, 2026-08-09)
- `convert.py` (canonical conversion), `run_video_test.py` (scoring logic, lines
  ~226–239), `accuracy.py` (reference-driven terms)

## Related

[[ENGINEERING-LOOP]] · [[F014-fittingbox-visual-ui-test-stats]] · [[OPENCODE-BRIEFS]] (OC-2 / OC-2B)
