# Glass research — three verified passes

Raw output from three multi-agent research runs, each one adversarially
verified against primary sources before it was returned. Kept in the repo
because the runs cost real time and the originals lived in a session-scoped
temp folder that does not survive a restart.

| file | what is in it |
|---|---|
| `01-displacement-method-and-extrusion.md` | The Aave `feDisplacementMap` method, SVG filter mechanics, Chrome `backdrop-filter` behaviour measured on this machine, three.js `ExtrudeGeometry` bevel/smoothing, and the glah's own measured feature sizes. |
| `02-physics-thickness-fresnel-dispersion.md` | Back-face thickness, Beer-Lambert absorption, Schlick from IOR, total internal reflection, dispersion. **Also lists six defects it found in this repo's code**, several since fixed. |
| `03-production-builds-and-performance.md` | drei `MeshTransmissionMaterial` read line by line, junni/Codrops screen-space dispersion, and optimisation for heavy scroll-driven filter/WebGL assets. |

All three are long. Read the section you need, not the whole file.

**They are reports, not gospel.** Each was verified, and the verifier still
found fabrications and stale defaults in the first drafts. Anything critical
gets checked against the running page before it is trusted.
