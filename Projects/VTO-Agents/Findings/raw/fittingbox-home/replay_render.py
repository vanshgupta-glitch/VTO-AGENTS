import json, urllib.request, hashlib, base64, os

BASE = r"C:\Users\ankur.singh\AppData\Local\Temp\opencode\fbx\cdp_trace"
body = json.load(open(os.path.join(BASE, "render_body.json"), encoding="utf-8"))
url = "https://product-api.fittingbox.com/render"

def call(name, mutated):
    b = dict(body)
    b.update(mutated)
    req = urllib.request.Request(url, data=json.dumps(b).encode(), method="POST", headers={
        "Content-Type": "application/json",
        "Origin": "https://vto-advanced.fittingbox.com",
        "Referer": "https://vto-advanced.fittingbox.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        j = json.loads(data)
        img = j.get("outputImageB64", "")
        raw = img.split(",", 1)[1] if "," in img else ""
        png = base64.b64decode(raw) if raw else b""
        out = os.path.join(BASE, "replay_" + name + ".jpg")
        open(out, "wb").write(png)
        print(f"{name:28s} uid={b['uid']} shadows={b['shadows']} pd={b['avatarPd']} "
              f"out={len(png)}B sha={hashlib.sha256(png).hexdigest()[:12]} "
              f"eyes={j.get('eyesPoints')}")
    except Exception as e:
        print(f"{name:28s} FAILED: {e}")

# A: original
call("A_original_rx5277", {})
# B: different frame uid (rayban RB3025 aviator)
call("B_rb3025_uid", {"uid": "08056262897690"})
# C: shadows off
call("C_shadows_off", {"shadows": False})
# D: avatarPd changed 63 -> 70
call("D_pd_70", {"avatarPd": 70})
# E: transition setting
call("E_transition1", {"transitionSetting": 1})
# F: lensSimulationMaterial present
call("F_lens_mat", {"lensSimulationMaterial": {"id": "test"}})
# G: different input photo
other = open(os.path.join(BASE, "..", "cdp_trace", "..", "probe24", "no_glasses_before.jpg"), "rb").read() \
    if os.path.exists(os.path.join(BASE, "..", "probe24", "no_glasses_before.jpg")) else None
if other:
    call("G_other_photo", {"imageB64Data": "data:image/jpeg;base64," + base64.b64encode(other).decode()})
