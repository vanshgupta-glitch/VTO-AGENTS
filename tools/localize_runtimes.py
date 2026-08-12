#!/usr/bin/env python3
"""
Regenerate config/runtimes.yaml from ~/.agentic-os/config.json.

The checked-in file names C:/Users/ankur.singh paths that do not exist on this
machine -- it was copied from a second engineer's setup and never localised.
Agent OS already records the correct local binaries, so we read them rather
than hand-editing and letting the two disagree again.

    python tools/localize_runtimes.py --check    # report, change nothing
    python tools/localize_runtimes.py --write    # rewrite runtimes.yaml

Safety
    --check never writes. --write replaces the whole file, which is safe
    because the file is generated: every value is derived from Agent OS
    config or PATH.
"""
import json, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENTIC = Path.home() / ".agentic-os" / "config.json"
OUT = ROOT / "config" / "runtimes.yaml"

# name -> (agentic-os config key, cmd_template, extra keys)
#
# Every template below is verified against the tool's real `--help` on this
# machine. The previous file invented `--prompt-file` for BOTH hermes and
# openclaw; neither accepts it, which is exactly what this file's own header
# warns against ("NEVER invent flags - confirm with --help").
#
#   hermes    -z/--oneshot takes the prompt INLINE. There is no prompt-file
#             option, so `inline_prompt: true` marks it for the length guard
#             in runtimes.ts (Windows caps a command line at 32767 chars).
#   openclaw  `agent` is a SUBCOMMAND, not a flag, and it does accept a file
#             via --message-file.
#   opencode  `run [message..] -m <model>` - the original template was right.
SPEC = {
    # model_override_template is appended ONLY when SWARM_MODEL_OVERRIDE is set,
    # so a smoke test can run on a free model without editing agents/*.yaml
    # (which setup.py hashes, and which the cost spec protects from being used
    # as a cost lever). Unset in normal operation.
    "hermes":   ("hermes",   ["-p", "{profile}", "-z", "{message}"],
                 {"inline_prompt": True,
                  "model_override_template": ["-m", "{model}", "--provider", "openrouter"]}),
    "openclaw": ("openclaw", ["agent", "--agent", "{agent}",
                              "--message-file", "{instruction_file}", "--json"], {}),
    "opencode": (None,       ["run", "{message}", "-m", "{model}"],
                 {"strip_ansi": True, "inline_prompt": True}),
    "claude":   ("claude",   ["-p", "{instruction}", "--model", "{model}"],
                 {"inline_prompt": True}),
    "python":   (None,       [], {}),
}


def dereference_shim(path):
    """Resolve an npm .cmd shim to the real executable it wraps.

    This is decision D-015 in practice: the name on PATH may be a shim. Node 20+
    refuses to spawn a .cmd without a shell (CVE-2024-27980), so pointing the
    swarm at `opencode.cmd` fails with a bare EINVAL -- and the workaround,
    shell: true, would open command injection on a prompt that arrives from
    Slack. Pointing at the .exe avoids both.

    npm shims contain a line like:
        "%dp0%\\node_modules\\opencode-ai\\bin\\opencode.exe"   %*
    """
    p = Path(path)
    if p.suffix.lower() not in (".cmd", ".bat"):
        return path
    try:
        for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
            m = re.search(r'"%dp0%\\?(.+?)"', line)
            if not m:
                continue
            target = (p.parent / m.group(1).lstrip("\\")).resolve()
            if target.exists() and target.suffix.lower() == ".exe":
                return str(target)
    except Exception:
        pass
    return path


def resolve(name, key):
    """Agent OS config first, then PATH. Returns a forward-slashed absolute path or None."""
    if key and AGENTIC.is_file():
        try:
            v = json.loads(AGENTIC.read_text(encoding="utf-8")).get(key)
            if v and Path(v).exists():
                return dereference_shim(str(Path(v))).replace("\\", "/")
        except Exception:
            pass
    if name == "python":
        return sys.executable.replace("\\", "/")
    w = shutil.which(name)
    if not w:
        return None
    return dereference_shim(str(Path(w).resolve())).replace("\\", "/")


def version_of(binpath):
    """First line of `--version`, folded to ASCII.

    Hermes prints a U+00B7 separator which arrives here as mojibake under the
    Windows console codec. Anything non-ASCII in a generated config is a
    liability -- setup.py already ascii-folds for the same reason -- so the
    version string is reduced to characters that survive every codec.
    """
    try:
        r = subprocess.run([binpath, "--version"], capture_output=True, text=True, timeout=30)
        blob = (r.stdout or r.stderr or "").strip()
        if not blob:
            return ""
        line = blob.splitlines()[0]
        return line.encode("ascii", "ignore").decode("ascii").replace('"', "").strip()
    except Exception:
        return ""


def build():
    lines = [
        "# Command templates. GENERATED by tools/localize_runtimes.py - do not hand-edit.",
        "# Absolute paths only: the name on PATH may be a shim (decision D-015).",
        "runtimes:",
    ]
    missing = []
    for name, (key, tmpl, extra) in SPEC.items():
        b = resolve(name, key)
        if not b:
            missing.append(name)
            continue
        lines.append(f"  {name}:")
        lines.append(f"    bin: {b}")
        lines.append('    version_flag: "--version"')
        v = version_of(b)
        if v:
            lines.append(f'    expected_version: "{v}"')
        if tmpl:
            lines.append(f"    cmd_template: {json.dumps(tmpl)}")
        for k, val in extra.items():
            rendered = json.dumps(val) if isinstance(val, list) else str(val).lower()
            lines.append(f"    {k}: {rendered}")
    return "\n".join(lines) + "\n", missing


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "--check"
    text, missing = build()
    for m in missing:
        print(f"  [!] {m}: not found in ~/.agentic-os/config.json or on PATH")
    if mode == "--write":
        OUT.write_text(text, encoding="utf-8")
        print(f"  [ok] wrote {OUT}")
    else:
        print(text)
    sys.exit(1 if missing else 0)
