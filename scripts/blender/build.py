"""Build the 3D models of the site with Blender, as .glb files.

    npm run models                      # all models -> public/models/
    npm run models -- paper-plane       # one model

or, without npm:

    blender -b --python scripts/blender/build.py -- [--out DIR] [name ...]

Each model is a Python module in scripts/blender/models/ with a `build()`
function that makes its objects in an empty scene.
"""

import argparse
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from lib import export_glb, reset_scene  # noqa: E402

# File name (without .glb) -> module in scripts/blender/models/.
MODELS = {
    "paper-plane": "paper_plane",
}


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("names", nargs="*", help="models to build (default: all)")
    parser.add_argument("--out", default=os.path.join(REPO, "public", "models"))
    args = parser.parse_args(argv)

    names = args.names or list(MODELS)
    unknown = [name for name in names if name not in MODELS]
    if unknown:
        sys.exit(f"Unknown model: {', '.join(unknown)}. Known: {', '.join(MODELS)}")

    for name in names:
        reset_scene()
        importlib.import_module(f"models.{MODELS[name]}").build()
        path = os.path.join(args.out, f"{name}.glb")
        size = export_glb(path)
        print(f"MODEL {name}.glb  {size / 1024:.1f} KB  -> {os.path.relpath(path, REPO)}")


main()
