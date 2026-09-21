import glob
import re
import urllib.request
import os
import hashlib

html_files = glob.glob(r'C:\dev\GotoShop\stitch_reference\**\*.html', recursive=True)
images = {}

for hf in html_files:
    with open(hf, 'r', encoding='utf-8') as f:
        content = f.read()
    for m in re.finditer(r'<img[^>]+>', content):
        tag = m.group(0)
        src_match = re.search(r'src=["\']([^"\']+)["\']', tag)
        alt_match = re.search(r'(?:data-alt|alt)=["\']([^"\']+)["\']', tag)
        if src_match:
            src = src_match.group(1)
            alt = alt_match.group(1) if alt_match else ""
            if src not in images:
                images[src] = alt

print(f"Total unique images found: {len(images)}")
os.makedirs(r"C:\dev\GotoShop\media\downloaded", exist_ok=True)

for i, (src, alt) in enumerate(images.items()):
    short_alt = re.sub(r'[^a-zA-Z0-9]', '_', alt[:30]).strip('_').lower()
    filename = f"img_{i}_{short_alt}.jpg" if short_alt else f"img_{i}.jpg"
    target_path = os.path.join(r"C:\dev\GotoShop\media\downloaded", filename)
    print(f"[{i+1}/{len(images)}] Downloading {filename} from {src[:50]}...")
    try:
        req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response, open(target_path, 'wb') as out_file:
            out_file.write(response.read())
        print(f"  -> Saved {filename} ({os.path.getsize(target_path)} bytes)")
    except Exception as e:
        print(f"  -> Failed to download: {e}")
