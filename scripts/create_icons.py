"""
Generate a clean 32x32 tray icon and 256x256 app icon for Electron.
Creates a solid circle with a modern mic/AI waveform logo in PNG format.
"""

import struct
import zlib
from pathlib import Path


def create_png(width: int, height: int, output_path: str):
    # Generates a PNG with transparent background and vibrant gradient circular badge
    raw_rows = []
    r_center = width / 2
    radius = width / 2 - 2

    for y in range(height):
        row = bytearray([0])  # filter type 0
        for x in range(width):
            dx = x - r_center
            dy = y - r_center
            dist = (dx * dx + dy * dy) ** 0.5

            if dist <= radius:
                # Anti-aliasing edge
                alpha = min(255, int(max(0, radius - dist + 1) * 255))
                # Gradient from Blue (59, 130, 246) to Violet (139, 92, 246)
                factor = (x + y) / (width + height)
                r = int(59 * (1 - factor) + 139 * factor)
                g = int(130 * (1 - factor) + 92 * factor)
                b = int(246)
                # Draw white dot in center or mic contour
                if abs(dx) < width * 0.15 and abs(dy) < height * 0.25:
                    r, g, b = 255, 255, 255
                row.extend([r, g, b, alpha])
            else:
                row.extend([0, 0, 0, 0])
        raw_rows.append(bytes(row))

    raw_data = b"".join(raw_rows)
    compressed = zlib.compress(raw_data)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png_header = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png_bytes = (
        png_header
        + chunk(b"IHDR", ihdr_data)
        + chunk(b"IDAT", compressed)
        + chunk(b"IEND", b"")
    )

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(png_bytes)
    print(f"Generated {width}x{height} PNG at {out.resolve()}")


if __name__ == "__main__":
    create_png(32, 32, "frontend/electron/tray_icon.png")
    create_png(256, 256, "frontend/electron/app_icon.png")
