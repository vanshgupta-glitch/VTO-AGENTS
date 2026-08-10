#!/usr/bin/env python3
"""
One-shot bootstrap for the whole swarm.

    python tools/bootstrap.py            # init + verify + status  (recommended)
    python tools/bootstrap.py init       # create/update every profile and agent
    python tools/bootstrap.py start      # ALSO bring up gateways  (see note)
    python tools/bootstrap.py status     # what exists and what is running
    python tools/bootstrap.py stop       # stop the gateways this script started
    python tools/bootstrap.py ping       # live-test every agent

Do I need `start`?
    Probably not yet. A Hermes gateway connects ONE profile to a messaging
    platform (Telegram, Discord, WhatsApp, Slack). The swarm invokes agents as
    one-shot subprocesses — `hermes -p admin -z "..."` — which works with every
    gateway stopped.

    Run `start` only when an agent must be reachable from a chat platform
    directly. It registers a background service per profile, so four profiles
    means four services on this machine.

Safety
    Idempotent. Additive only. Never deletes or modifies anything it did not
    create, and never touches the pre-existing profiles.
"""
import json, os, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SETUP = ROOT / "tools" / "setup.py"
HERMES_PROFILES = Path(os.environ.get("LOCALAPPDATA", "")) / "hermes" / "profiles"
OPENCLAW_JSON = Path.home() / ".openclaw" / "openclaw.json"

C = dict(g="\033[32m", y="\033[33m", r="\033[31m", b="\033[1m", d="\033[2m", x="\033[0m")
def hdr(t): print(f"\n{C['b']}{t}{C['x']}\n" + C['d'] + "─" * 66 + C['x'])
def say(sym, msg, col="x"): print(f"  {C[col]}{sym}{C['x']} {msg}")


def run(cmd, timeout=300):
    # On Windows these CLIs are .cmd shims, which subprocess will not resolve
    # from a bare name — resolve through PATH first.
    exe = shutil.which(cmd[0]) or cmd[0]
    try:
        r = subprocess.run([exe] + cmd[1:], capture_output=True, text=True, timeout=timeout,
                           encoding="utf-8", errors="replace")
        return r.returncode, (r.stdout or "") + (r.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, "timed out"
    except FileNotFoundError:
        return 127, f"not found: {cmd[0]}"


def hermes_profiles_from_registry():
    """Agents whose runtime is hermes — read straight from the registry."""
    out = []
    for d in sorted((ROOT / "agents").iterdir()):
        f = d / "agent.yaml"
        if f.is_file() and "runtime: hermes" in f.read_text(encoding="utf-8"):
            out.append(d.name)
    return out


# ── commands ──────────────────────────────────────────────────────────────────
def cmd_init():
    hdr("1 · RENDER REGISTRY INTO LIVE INSTALLATIONS")
    code, out = run([sys.executable, str(SETUP), "apply"], timeout=900)
    print(out.rstrip())
    if code != 0:
        say("✗", "setup failed — fix the errors above before continuing", "r")
        return code

    hdr("2 · OPENCLAW AGENTS")
    code, out = run(["openclaw", "agents", "list"], timeout=120)
    if code == 0:
        for line in out.strip().splitlines()[:12]:
            if line.strip():
                say("·", line.strip()[:70], "d")
    else:
        say("!", "could not list openclaw agents (gateway may be down) — config was still written", "y")
    return 0


def cmd_start():
    profiles = hermes_profiles_from_registry()
    hdr(f"HERMES GATEWAYS · {len(profiles)} profiles")
    print(f"  {C['d']}Each install registers a background service on this machine.{C['x']}\n")
    for p in profiles:
        code, out = run(["hermes", "-p", p, "gateway", "install"], timeout=300)
        if code != 0 and "already" not in out.lower():
            say("!", f"{p:12} install: {out.strip().splitlines()[-1][:60] if out.strip() else 'failed'}", "y")
        code, out = run(["hermes", "-p", p, "gateway", "start"], timeout=300)
        say("✓" if code == 0 else "✗", f"{p:12} gateway {'started' if code == 0 else 'FAILED — ' + out.strip()[:60]}",
            "g" if code == 0 else "r")

    hdr("OPENCLAW GATEWAY")
    code, out = run(["openclaw", "gateway", "status"], timeout=120)
    if "registered" in out.lower() or code == 0:
        say("✓", "openclaw gateway service registered", "g")
        for line in out.strip().splitlines()[:3]:
            say("·", line.strip()[:68], "d")
    else:
        say("!", "openclaw gateway not running — `openclaw gateway install` then `start`", "y")
    return 0


def cmd_stop():
    hdr("STOPPING HERMES GATEWAYS")
    for p in hermes_profiles_from_registry():
        code, out = run(["hermes", "-p", p, "gateway", "stop"], timeout=180)
        say("✓" if code == 0 else "·", f"{p:12} {'stopped' if code == 0 else 'was not running'}",
            "g" if code == 0 else "d")
    print(f"\n  {C['d']}OpenClaw's gateway is shared and was left alone.{C['x']}")
    return 0


def cmd_status():
    hdr("REGISTRY")
    for d in sorted((ROOT / "agents").iterdir()):
        f = d / "agent.yaml"
        if not f.is_file():
            continue
        t = f.read_text(encoding="utf-8")
        get = lambda k: next((l.split(":", 1)[1].strip() for l in t.splitlines()
                              if l.startswith(k + ":")), "?")
        say("·", f"{d.name:12} tier {get('tier')}  {get('runtime'):9} {get('model')[:42]}", "d")

    hdr("HERMES PROFILES")
    code, out = run(["hermes", "profile", "list"], timeout=120)
    mine = set(hermes_profiles_from_registry())
    for line in out.splitlines():
        name = line.strip().lstrip("◆").split()[0] if line.strip() and not line.strip().startswith(("Profile", "─")) else ""
        if name in mine:
            running = "running" in line.lower()
            say("✓" if running else "·", line.strip()[:72], "g" if running else "d")

    hdr("SOUL DRIFT")
    code, out = run([sys.executable, str(SETUP), "verify"], timeout=300)
    print("\n".join(l for l in out.splitlines() if l.strip() and "DRIFT CHECK" not in l))

    hdr("OPENCLAW")
    if OPENCLAW_JSON.is_file():
        cfg = json.loads(OPENCLAW_JSON.read_text(encoding="utf-8"))
        ids = [a.get("id") for a in cfg.get("agents", {}).get("list", [])]
        say("✓", f"agents: {', '.join(ids)}", "g")
    code, out = run(["openclaw", "gateway", "status"], timeout=120)
    say("·", out.strip().splitlines()[0][:68] if out.strip() else "unknown", "d")
    return 0


def cmd_ping():
    hdr("LIVE PING · every hermes agent")
    print(f"  {C['d']}Each call costs tokens. Answers should sound like the agent's soul.{C['x']}\n")
    bad = 0
    for p in hermes_profiles_from_registry():
        code, out = run(["hermes", "-p", p, "-z",
                         "Reply with one short sentence: what is your single defining rule?"], timeout=300)
        first = next((l.strip() for l in out.strip().splitlines() if l.strip()), "")
        if code == 0 and first and "error" not in first.lower()[:24]:
            say("✓", f"{p:12} {first[:78]}", "g")
        else:
            say("✗", f"{p:12} {first[:78] or 'no response'}", "r"); bad += 1
    return 1 if bad else 0


def cmd_all():
    rc = cmd_init()
    if rc:
        return rc
    cmd_status()
    print(f"\n{C['b']}Ready.{C['x']}  Agents are callable now:  "
          f"{C['g']}hermes -p admin -z \"your prompt\"{C['x']}")
    print(f"  {C['d']}Gateways are NOT running and are not needed for this. "
          f"Run `start` only for direct chat-platform access.{C['x']}\n")
    return 0


if __name__ == "__main__":
    cmds = {"all": cmd_all, "init": cmd_init, "start": cmd_start,
            "stop": cmd_stop, "status": cmd_status, "ping": cmd_ping}
    c = sys.argv[1] if len(sys.argv) > 1 else "all"
    if c not in cmds:
        print(__doc__); sys.exit(2)
    sys.exit(cmds[c]() or 0)
