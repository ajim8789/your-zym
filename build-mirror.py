#!/usr/bin/env python3
"""Regenerate mirror/*.html: single-file builds with inlined CSS/JS and
hosted page URLs (same scheme as the 2026-10-06 share)."""
import os

BASE = os.path.dirname(os.path.abspath(__file__))

PAGES = ["index", "admin", "login", "workout", "Registration"]
JS_FOR = {
    "index": ["config", "sheets", "app"],
    "admin": ["config", "sheets", "admin"],
    "login": ["config", "sheets", "login"],
    "workout": ["config", "sheets", "workout"],
    "Registration": ["config", "sheets"],
}
HOSTED = {
    "index.html": "https://muse.ai/files/1360301033830820/1872163737463658/rnxloox1wzwol1sei58xtuti/index.html",
    "login.html": "https://muse.ai/files/1360301033830820/1593015509232827/xe5olhhauofxusc10t8v3qwe/login.html",
    "Registration.html": "https://muse.ai/files/1360301033830820/1719673026830966/2txrzxdrc3oqqn3g76i78ajt/Registration.html",
    "admin.html": "https://muse.ai/files/1360301033830820/1846643446328847/9nlaqdghyjfmm5u8t3a16o1s/admin.html",
    "workout.html": "https://muse.ai/files/1360301033830820/2213724986689128/hp6ako4tav9ovw1gg9zcmq75/workout.html",
}


def read(p):
    with open(os.path.join(BASE, p), encoding="utf-8") as f:
        return f.read()


def build(page):
    html = read(f"{page}.html")
    css = read("assets/style.css")
    tag = '<link rel="stylesheet" href="assets/style.css" />'
    assert tag in html, f"{page}: style.css link not found"
    html = html.replace(tag, "<style>\n" + css + "\n</style>")
    for js in JS_FOR[page]:
        code = read(f"assets/{js}.js")
        tag = f'<script src="assets/{js}.js"></script>'
        assert tag in html, f"{page}: script tag for {js}.js not found"
        html = html.replace(tag, "<script>\n" + code + "\n</script>")
    assert '<script src="assets/' not in html and 'href="assets/' not in html, \
        f"{page}: un-inlined assets reference remains"
    for name, url in HOSTED.items():
        html = html.replace(name, url)
    out = os.path.join(BASE, "mirror", f"{page}.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print("built", out, len(html), "bytes")


if __name__ == "__main__":
    for p in PAGES:
        build(p)
    print("done")
