import os, sys, time
from playwright.sync_api import sync_playwright

BASE = r"C:\Users\choon\AppData\Local\Temp\claude\c--WORK-SodamFN\a43f71c5-c555-4667-ae9d-45729bd931fc\scratchpad"
FPS = 24
DUR = 8
N = FPS * DUR
FRAMES = os.path.join(BASE, "frames")
os.makedirs(FRAMES, exist_ok=True)

url = "file:///" + BASE.replace("\\", "/") + "/semhana_live.html"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(url)
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(1200)  # images + font settle
    n_anim = page.evaluate("() => { const a = document.getAnimations(); a.forEach(x => x.pause()); return a.length; }")
    print(f"animations paused: {n_anim}", flush=True)
    t0 = time.time()
    for i in range(N):
        t_ms = i * 1000.0 / FPS
        page.evaluate(f"() => document.getAnimations().forEach(a => {{ a.currentTime = {t_ms}; }})")
        page.screenshot(path=os.path.join(FRAMES, f"f_{i:04d}.png"))
        if i % 24 == 0:
            print(f"frame {i}/{N}  ({time.time()-t0:.0f}s)", flush=True)
    browser.close()
print(f"DONE {N} frames in {time.time()-t0:.0f}s", flush=True)
