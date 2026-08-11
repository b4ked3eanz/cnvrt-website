# -*- coding: utf-8 -*-
"""Structural check on the OFFERINGS glass ring in index.html.

Same job verify-shader.py does for shader.html: every parameter has exactly
one slider, every slider has a parameter, every default sits inside its own
slider's range, and every uniform the GLSL reads is actually written. None of
this is caught by a syntax check and all of it fails silently at runtime — a
default outside its slider's range snaps the moment the slider is touched, and
a uniform that is declared but never set is just black.
"""
import io, re, sys

p = r"D:\ultron jits\cnvrt website run 3\index.html"
s = io.open(p, encoding="utf-8").read()

# the glass module only — the file has several other DEFAULTS/SPEC pairs
mod = s[s.index("OFFERINGS - THE GLASS RING".replace("-", "\u2014")):]

D = re.search(r"var DEFAULTS = \{(.*?)\n  \};", mod, re.S).group(1)
params = re.findall(r"^    (\w+):", D, re.M)

SP = re.search(r"var SPEC = \[(.*?)\n    \];", mod, re.S).group(1)
sliders = re.findall(r"^      \['(\w+)',\s*-?[\d.]", SP, re.M)
groups = [g for g in re.findall(r"^      \['([^']+)'\]", SP, re.M)]

dup     = sorted({k for k in sliders if sliders.count(k) > 1})
missing = [k for k in params if k not in sliders]
# the composition's four are deliberately NOT in P — the panel reaches
# through window.OFFCOMP into the offerings driver so there is one copy of
# each number, not two. Check they exist THERE instead.
# OFFCOMP lives in the offerings DRIVER, above the glass module, so search the
# whole file rather than the module slice
_c = re.search(r"window\.OFFCOMP = \{\s*keys: \[([^\]]*)\]", s)
comp = set(re.findall(r"'(\w+)'", _c.group(1))) if _c else set()
drv = s[:s.index("OFFERINGS - THE GLASS RING".replace("-", "\u2014"))]
drvD = re.search(r"var DEFAULTS = \{(.*?)\n  \};", drv, re.S).group(1)
drvParams = set(re.findall(r"^    (\w+):", drvD, re.M))
print("borrowed from the driver: %s" % (", ".join(sorted(comp)) or "none"))
print("borrowed but not in the driver: %s"
      % (sorted(comp - drvParams) or "none"))
orphan  = [k for k in sliders if k not in params and k not in comp]

print("params  : %d" % len(params))
print("sliders : %d" % len(sliders))
print("duplicate sliders    : %s" % (dup or "none"))
print("params with no slider: %s" % (missing or "none"))
print("sliders with no param: %s" % (orphan or "none"))
print("panel groups         : %s" % ", ".join(groups))

# a default outside its own slider's range snaps the moment you touch it
vals = dict(re.findall(r"^    (\w+):\s*(-?[\d.]+),?", D, re.M))
rng  = re.findall(r"^      \['(\w+)',\s*(-?[\d.]+),\s*(-?[\d.]+),", SP, re.M)
oob = []
for k, lo, hi in rng:
    if k in vals and not (float(lo) <= float(vals[k]) <= float(hi)):
        oob.append("%s=%s not in [%s,%s]" % (k, vals[k], lo, hi))
print("defaults out of range: %s" % (oob or "none"))

# every uniform the GLSL reads must exist in the uniforms object
decl = set()
for blk in re.findall(r"'uniform [^']*?;\\n'", mod):
    decl |= set(re.findall(r"\b(u[A-Z]\w*)", blk))
U = re.search(r"var uni = \{(.*?)\n  \};", mod, re.S).group(1)
# several uniforms share a line, so anchor on the "name: {" shape,
# not on the line start
have = set(re.findall(r"(u\w+)\s*:\s*\{", U))
print("uniforms read but not declared: %s" % (sorted(decl - have) or "none"))
print("uniforms declared but not read: %s" % (sorted(have - decl) or "none"))

# ---------------------------------------------------------------------------
# EVERY SHADER DECLARES WHAT IT READS, ON ITS OWN.
#
# This is the check that would have caught the bug that cost the lit pass a
# whole rebuild: LIT_F read uIor and never declared it, so the fragment shader
# failed to compile, three.js dropped the material, and the lit canvas drew
# NOTHING. It read as a tuning problem, because the five surface intensities
# had just been rescaled, and no value of any of them could have brought it
# back.
#
# The check above cannot see it. It builds the UNION of every shader's
# declarations and compares that against the uniforms object — so a uniform
# that is in the object and declared in one shader passes even when a second
# shader reads it without declaring it. Each shader has to be read on its own.
# ---------------------------------------------------------------------------
BUILTIN = set("""
position normal uv uv1 uv2 tangent color skinIndex skinWeight instanceMatrix
modelMatrix modelViewMatrix projectionMatrix viewMatrix normalMatrix
cameraPosition isOrthographic logDepthBufFC
gl_Position gl_FragColor gl_FragCoord gl_PointSize gl_FrontFacing gl_PointCoord
""".split())

KEYWORDS = set("""
void float int bool vec2 vec3 vec4 ivec2 ivec3 ivec4 bvec2 bvec3 bvec4
mat2 mat3 mat4 sampler2D samplerCube uniform varying attribute const in out
inout precision highp mediump lowp return if else for while do break continue
struct discard true false define ifdef ifndef endif
abs acos all any asin atan ceil clamp cos cross degrees dFdx dFdy distance dot
equal exp exp2 faceforward floor fract greaterThan greaterThanEqual
inversesqrt length lessThan lessThanEqual log log2 matrixCompMult max min mix
mod normalize not notEqual pow radians reflect refract sign sin smoothstep
sqrt step tan texture2D texture2DProj texture2DLod textureCube main
r g b a x y z w rgb rgba xy xyz xyzw st
""".split())

STR = r"(?:'[^']*'|[A-Z_]+[A-Z_0-9]*)"
CHUNK = r"(?:\s*(?:/\*.*?\*/\s*)?" + STR + r"\s*\+?\s*)+"


def literal(src):
    """Concatenate the single-quoted pieces of a shader-source expression."""
    return "".join(re.findall(r"'([^']*)'", src))


# the shared source variables, so a shader that splices one in can be resolved
shared = {}
for nm in re.findall(r"var ([A-Z][A-Z_0-9]*) =\n?" + CHUNK + r";", mod, re.S):
    m = re.search(r"var %s =\n?(" % nm + CHUNK + r");", mod, re.S)
    if m:
        shared[nm] = m.group(1)

shaders = []   # (name, source-expression)
for nm, src in shared.items():
    shaders.append((nm, src))
for m in re.finditer(r"(vertexShader|fragmentShader)\s*:\s*\n?(" + CHUNK + r")", mod, re.S):
    shaders.append((m.group(1), m.group(2)))

undecl = []
for name, src in shaders:
    body = literal(src)
    # splice in any shared source this one references by name
    for nm, other in shared.items():
        if re.search(r"\b%s\b" % nm, src) and nm != name:
            body += literal(other)
    body = body.replace("\\n", "\n")
    if "void main" not in body:
        continue                     # a fragment of source, not a whole shader
    d = set()
    for line in re.findall(r"^\s*(?:uniform|varying|attribute)\s+\w+\s+([^;]+);", body, re.M):
        d |= set(re.findall(r"\b(\w+)\b", line))
    d |= set(re.findall(r"^\s*#define\s+(\w+)", body, re.M))
    # locals and parameters: anything given a type anywhere in the body
    d |= set(re.findall(r"\b(?:float|int|bool|vec[234]|mat[234]|ivec[234]|bvec[234])\s+(\w+)", body))
    read = set(re.findall(r"\b([a-zA-Z_]\w*)\b", body))
    for u in sorted(read - d - BUILTIN - KEYWORDS):
        # only report things shaped like this file's uniforms and varyings —
        # uCamelCase and vCamelCase — so a missed GLSL builtin is not noise
        if re.match(r"^[uv][A-Z]", u):
            undecl.append("%s reads %s" % (name, u))
print("read but NOT DECLARED in that shader: %s" % (undecl or "none"))

# the map/geo dirty sets must only name real parameters
def keyset(name):
    m = re.search(r"var %s = \{(.*?)\};" % name, mod, re.S)
    return set(re.findall(r"(\w+):\s*1", m.group(1)))
for nm in ("GEOKEYS", "MAPKEYS"):
    bad = sorted(keyset(nm) - set(params))
    print("%s naming no such param: %s" % (nm, bad or "none"))

# The two pads in the CSS and the two in the JS are two statements of one pair
# of numbers. --gpadc is the canvas/encode box; --gpad on the refract layer is
# the smaller filtered box. Either drifting is invisible until the mask slides
# off the ring.
pad_css  = re.search(r"--gpadc:(\d+)", s).group(1)
pad_js   = re.search(r"var PAD = (\d+);", mod).group(1)
rpad_css = re.search(r"\.off__glass--refract\{ --gpad:(\d+) \}", s).group(1)
rpad_js  = re.search(r"var RPAD = (\d+);", mod).group(1)
padbad = (pad_css != pad_js) or (rpad_css != rpad_js)
print("--gpadc %s vs PAD %s : %s"
      % (pad_css, pad_js, "OK" if pad_css == pad_js else "MISMATCH"))
print("refract --gpad %s vs RPAD %s : %s"
      % (rpad_css, rpad_js, "OK" if rpad_css == rpad_js else "MISMATCH"))

fail = bool(dup or missing or orphan or (comp - drvParams) or oob
            or (decl - have) or padbad or undecl)
print("\n%s" % ("FAIL" if fail else "ok"))
sys.exit(1 if fail else 0)
