import os
import re
import gzip
import base64
import mimetypes
import subprocess
import sys
import shutil
from pathlib import Path


ASSET_URL_RE = re.compile(
    r'(?P<quote>["\'])(?P<url>(?:\./)?assets/[^"\']+\.(?:png|jpe?g|gif|webp|ico|svg))(?P=quote)',
    re.IGNORECASE,
)


def inline_asset_urls(text, dist_dir):
    """Replace built local asset URLs with data URIs so firmware serves one document."""
    dist_path = Path(dist_dir)

    def replace(match):
        quote = match.group("quote")
        url = match.group("url")
        relative_url = url[2:] if url.startswith("./") else url
        asset_path = dist_path / Path(relative_url.replace("/", os.sep))
        if not asset_path.is_file():
            return match.group(0)

        mime_type, _ = mimetypes.guess_type(asset_path.name)
        if mime_type is None:
            mime_type = "application/octet-stream"

        encoded = base64.b64encode(asset_path.read_bytes()).decode("ascii")
        return f'{quote}data:{mime_type};base64,{encoded}{quote}'

    return ASSET_URL_RE.sub(replace, text)


def add_inline_favicon(html):
    """Prevent the browser's automatic /favicon.ico request on the ESP server."""
    if re.search(r'<link\b[^>]*\brel=["\'](?:shortcut icon|icon)["\']', html, re.IGNORECASE):
        return html
    return html.replace("</head>", '  <link rel="icon" href="data:,">\n</head>', 1)

def main():
    print("Building Web UI...")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    webui_dir = os.path.join(current_dir, "webui")
    
    # Locate npm executable in a cross-platform way (critical on Windows where it is often npm.cmd)
    npm_executable = shutil.which("npm")
    if npm_executable is None:
        print("ERROR: 'npm' command not found in your PATH.", file=sys.stderr)
        print("", file=sys.stderr)
        print("Node.js (which includes npm) is required to build the web UI.", file=sys.stderr)
        print("Please install Node.js from https://nodejs.org/ and ensure it is added to your system PATH.", file=sys.stderr)
        print("", file=sys.stderr)
        print("After installing, open a new terminal/PowerShell window and try again.", file=sys.stderr)
        sys.exit(1)
    
    # Ensure dependencies are installed (very common on fresh clones / Windows)
    node_modules_dir = os.path.join(webui_dir, "node_modules")
    if not os.path.isdir(node_modules_dir):
        print("node_modules not found — running 'npm install' first (this may take a minute)...")
        try:
            subprocess.run([npm_executable, "install"], cwd=webui_dir, check=True)
        except subprocess.CalledProcessError as e:
            print(f"Error running npm install: {e}", file=sys.stderr)
            sys.exit(1)
        except FileNotFoundError as e:
            print(f"Failed to launch npm: {e}", file=sys.stderr)
            sys.exit(1)
        print("npm install completed.")
    
    # Run npm run build in the webui folder
    print("Running 'npm run build' in webui/ ...")
    try:
        subprocess.run([npm_executable, "run", "build"], cwd=webui_dir, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error running npm run build: {e}", file=sys.stderr)
        print("Check the output above for Vite / npm errors (missing deps, syntax errors in webui/src, etc.).", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError as e:
        print(f"Failed to launch npm: {e}", file=sys.stderr)
        print("Make sure Node.js/npm is correctly installed and available in PATH.", file=sys.stderr)
        sys.exit(1)

    dist_dir = os.path.join(webui_dir, "dist")
    
    # Read built index.html
    index_html_path = os.path.join(dist_dir, "index.html")
    if not os.path.exists(index_html_path):
        print(f"Error: {index_html_path} does not exist", file=sys.stderr)
        print("Vite did not produce dist/index.html. The build may have failed silently or the root/index.html in webui/src is missing.", file=sys.stderr)
        sys.exit(1)
        
    with open(index_html_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Read and decompress app.js.gz
    app_js_gz_path = os.path.join(dist_dir, "app.js.gz")
    if not os.path.exists(app_js_gz_path):
        print(f"Error: {app_js_gz_path} does not exist", file=sys.stderr)
        print("The Vite build did not produce the expected gzipped assets.", file=sys.stderr)
        print("Check that vite-plugin-compression is working and that rollupOptions in vite.config.js are producing app.js + style.css.", file=sys.stderr)
        sys.exit(1)
        
    with gzip.open(app_js_gz_path, "rb") as f:
        js = f.read().decode("utf-8")
    js = inline_asset_urls(js, dist_dir)

    # Read and decompress style.css.gz
    style_css_gz_path = os.path.join(dist_dir, "style.css.gz")
    if not os.path.exists(style_css_gz_path):
        print(f"Error: {style_css_gz_path} does not exist", file=sys.stderr)
        print("The Vite build did not produce the expected gzipped assets.", file=sys.stderr)
        print("Check that vite-plugin-compression is working and that rollupOptions in vite.config.js are producing app.js + style.css.", file=sys.stderr)
        sys.exit(1)
        
    with gzip.open(style_css_gz_path, "rb") as f:
        css = f.read().decode("utf-8")
    css = inline_asset_urls(css, dist_dir)

    # Inline JS: find the script tag matching app.js (possibly with cache buster query)
    html = re.sub(
        r'<script type="module" crossorigin src="\./app\.js[^"]*"></script>',
        lambda m: f'<script type="module">{js}</script>',
        html
    )

    # Inline CSS: find the style/link tag matching style.css (possibly with cache buster query)
    html = re.sub(
        r'<link rel="stylesheet" crossorigin href="\./style\.css[^"]*">',
        lambda m: f'<style>{css}</style>',
        html
    )

    # Force isDev to false for production
    html = html.replace("const isDev = true;", "const isDev = false;")
    html = add_inline_favicon(html)

    # Gzip the final inlined HTML
    inlined_html_bytes = html.encode("utf-8")
    gzipped_html = gzip.compress(inlined_html_bytes)

    # Generate C header content
    header_path = os.path.join(current_dir, "main", "index_html.h")
    
    # Format bytes as hex array formatted with line breaks for readability
    c_bytes_list = [f"0x{b:02x}" for b in gzipped_html]
    c_bytes_formatted = ""
    for i in range(0, len(c_bytes_list), 12):
        chunk = ", ".join(c_bytes_list[i:i+12])
        c_bytes_formatted += f"    {chunk},\n"
    
    # Trim the trailing comma and newline
    c_bytes_formatted = c_bytes_formatted.rstrip(",\n")

    with open(header_path, "w", encoding="utf-8") as f:
        f.write("/* Auto-generated by web_builder.py. Do not edit. */\n")
        f.write("#pragma once\n\n")
        f.write("const unsigned char index_html_gz[] = {\n")
        f.write(c_bytes_formatted)
        f.write("\n};\n\n")
        f.write(f"const unsigned int index_html_gz_len = {len(gzipped_html)};\n")

    print(f"Web UI build completed. Generated {header_path} ({len(gzipped_html)} bytes gzipped).")

if __name__ == "__main__":
    main()
