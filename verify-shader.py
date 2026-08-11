# -*- coding: utf-8 -*-
"""Structural check on shader.html: every param has exactly one slider,
every slider has a param, and the panel groups come out in the right order."""
import io, re, sys
p = r"D:\ultron jits\cnvrt website run 3\shader.html"
s = io.open(p, encoding="utf-8").read()

D = re.search(r"var DEFAULTS = \{(.*?)\n\};", s, re.S).group(1)
params = re.findall(r"^  (\w+):", D, re.M)

SP = re.search(r"var SPEC = \[(.*?)\n\];", s, re.S).group(1)
sliders = re.findall(r"^  \['(\w+)',\s*-?[\d.]", SP, re.M)
groups = [g for g in re.findall(r"^  \['([^']*)'(?:,\s*'|\])", SP, re.M)
          if g not in params]

dup = sorted({k for k in sliders if sliders.count(k) > 1})
missing = [k for k in params if k not in sliders]
orphan = [k for k in sliders if k not in params]

print("params  : %d" % len(params))
print("sliders : %d" % len(sliders))
print("duplicate sliders   : %s" % (dup or "none"))
print("params with no slider: %s" % (missing or "none"))
print("sliders with no param: %s" % (orphan or "none"))
print("\npanel order:")
for i, g in enumerate(groups, 1):
    print("  %2d. %s" % (i, g))

# uniform wiring: every u_partN read in GLSL must be set in JS
decl = set(re.findall(r"uniform vec4 (u_\w+);", s))
setj = set("u_" + m for m in re.findall(r"gl\.uniform4f\(U\.(\w+),", s))
print("\nuniforms declared but never set: %s" % (sorted(decl - setj) or "none"))
print("uniforms set but not declared  : %s" % (sorted(setj - decl) or "none"))

# a default outside its own slider range silently snaps the moment the slider
# is touched - partAmount shipped at 5.0 with a max of 4.0 exactly this way
vals = dict(re.findall(r"^  (\w+):\s*(-?[\d.]+),?", D, re.M))
rng = re.findall(r"^  \['(\w+)',\s*(-?[\d.]+),\s*(-?[\d.]+),", SP, re.M)
oob = []
for k, lo, hi in rng:
    if k in vals:
        v = float(vals[k])
        if v < float(lo) - 1e-9 or v > float(hi) + 1e-9:
            oob.append("%s=%s not in [%s,%s]" % (k, vals[k], lo, hi))
print("defaults outside slider range: %s" % (oob or "none"))

bad = bool(dup or missing or orphan or (decl - setj) or (setj - decl) or oob)
sys.exit(1 if bad else 0)
