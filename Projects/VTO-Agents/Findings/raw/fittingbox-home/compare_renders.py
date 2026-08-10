import json, sys, base64, hashlib, os
import cv2, numpy as np
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

c = json.load(open(r"C:\Users\ankur.singh\AppData\Local\Temp\opencode\fbx\cdp_trace\cdp_capture.json", encoding="utf-8"))
rens = [r for r in c if "/render" in r.get("url", "") and r.get("respJson")]
OUT = r"C:\Users\ankur.singh\AppData\Local\Temp\opencode\fbx\cdp_trace"
SRC = r"C:\Users\ankur.singh\AppData\Local\Temp\opencode\fbx\static\static_face.png"

imgs = {}
for i, r in enumerate(rens):
    pj = r["postJson"]
    rj = r["respJson"]
    b64 = rj["outputImageB64"].split(",", 1)[1]
    raw = base64.b64decode(b64)
    path = os.path.join(OUT, f"out_render_{pj.get('uid')}.jpg")
    with open(path, "wb") as f:
        f.write(raw)
    imgs[pj["uid"]] = raw
    print(f"render uid={pj['uid']} output {len(raw)}B sha={hashlib.sha256(raw).hexdigest()[:16]} "
          f"eyes={rj['eyesPoints']}")

if len(imgs) > 1:
    k1, k2 = list(imgs.keys())[:2]
    print("outputs identical:", imgs[k1] == imgs[k2])

src = cv2.imread(SRC)
out1 = cv2.imdecode(np.frombuffer(imgs[list(imgs.keys())[0]], np.uint8), cv2.IMREAD_COLOR)
print("src", src.shape, "out", out1.shape)

front = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

def eye_band_metrics(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = front.detectMultiScale(g, 1.1, 5, minSize=(120, 120))
    if not len(faces):
        return None
    x, y, w, h = faces[0]
    gb = g[y:int(y + h * 0.45), x:x + w]
    return {"face": (x, y, w, h), "dark_eye": round(float((gb < 80).mean()), 3)}

sm = eye_band_metrics(src)
om = eye_band_metrics(out1)
print("source eye band:", sm)
print("output eye band:", om)

# diff between source and output around the reported eyesPoints
if src.shape == out1.shape:
    gs = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY).astype(float)
    go = cv2.cvtColor(out1, cv2.COLOR_BGR2GRAY).astype(float)
    d = np.abs(gs - go)
    eyes = [(e["x"], e["y"]) for e in rens[0]["respJson"]["eyesPoints"]]
    for (ex, ey) in eyes:
        x0, y0 = int(ex) - 40, int(ey) - 40
        patch = d[max(0, y0):y0 + 80, max(0, x0):x0 + 80]
        print(f"diff patch at eye({ex},{ey}): mean={patch.mean():.1f} max={patch.max():.0f} changed%={((patch > 10).mean() * 100):.1f}")
    # dark lens signature: count dark pixels in a 120x36 band centered between the two eyes in OUTPUT
    (ex1, ey1), (ex2, ey2) = eyes
    cx = int((ex1 + ex2) / 2); cy = int((ey1 + ey2) / 2)
    band = go[int(cy) - 20:int(cy) + 20, int(cx) - 90:int(cx) + 90]
    band_s = gs[int(cy) - 20:int(cy) + 20, int(cx) - 90:int(cx) + 90]
    print(f"eye-line band dark: source={(band_s < 80).mean():.3f} output={(band < 80).mean():.3f}")
    # where is the bulk of the diff? split into eye region vs rest
    eye_region = np.zeros_like(d)
    for (ex, ey) in eyes:
        eye_region[max(0, int(ey)-60):int(ey)+60, max(0, int(ex)-80):int(ex)+80] = 1
    outside = d[eye_region == 0]
    inside = d[eye_region == 1]
    print(f"diff mean inside-eye-region={inside.mean():.1f} outside={outside.mean():.1f} "
          f"(glasses would concentrate INSIDE)")

