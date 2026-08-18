from pathlib import Path

from PIL import Image


ASSET_DIR = Path("assets/images")
ICON_NAMES = (
    "icon.png",
    "splash-icon.png",
    "favicon.png",
    "android-icon-foreground.png",
    "android-icon-background.png",
    "android-icon-monochrome.png",
)


def resize_icon(path: Path) -> None:
    with Image.open(path) as image:
        image = image.convert("RGBA")
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        image.save(path, format="PNG", optimize=True, compress_level=9)


for icon_name in ICON_NAMES:
    resize_icon(ASSET_DIR / icon_name)
