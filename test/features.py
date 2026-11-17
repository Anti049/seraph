"""SERAPH feature run against the mocks (never the real servers):
menu sounds · Ganymede default button / LAN address / network scan · queue · Plex library
customization · subtitle styling · styled SRT · Up hides player UI · embedded ASS → burn-in fallback.

Build first with the default pointed at the mock:
    (cd web && GANYMEDE_DEFAULT=http://localhost:4000 bun run build) && bun run mock/all.ts
"""
import asyncio, os
from playwright.async_api import async_playwright
os.makedirs("/tmp/sp", exist_ok=True)

COUNT_SOUNDS = """
window.__osc = 0;
const C = window.AudioContext;
if (C) { const o = C.prototype.createOscillator; C.prototype.createOscillator = function(){ window.__osc++; return o.call(this); }; }
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
        await ctx.add_init_script(COUNT_SOUNDS)
        # Belt and braces: block the real servers so a mistake can never reach them.
        await ctx.route("**/ganymede.nploetz.dev/**", lambda r: r.abort())
        await ctx.route("https://plex.tv/**", lambda r: r.abort())
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        async def k(x, n=1, w=260):
            for _ in range(n): await pg.keyboard.press(x); await pg.wait_for_timeout(w)
        f = lambda: pg.evaluate("document.activeElement && (document.activeElement.dataset.focusId || document.activeElement.innerText?.trim().slice(0,30) || document.activeElement.tagName)")
        txt = lambda: pg.evaluate("document.body.innerText")
        osc = lambda: pg.evaluate("window.__osc")
        sidebar = lambda: pg.evaluate("[...document.querySelectorAll('nav button')].map(b=>b.innerText.trim())")
        async def shot(n): await pg.screenshot(path=f"/tmp/sp/{n}.png")
        async def to(needle, key="ArrowDown", limit=40):
            for _ in range(limit):
                if needle in str(await f()): return True
                await k(key)
            return False
        async def press(label, w=900):
            """Focus the visible button with this label (as the D-pad would), then press OK."""
            ok = await pg.evaluate("""(l) => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().startsWith(l) && x.getBoundingClientRect().width>0 && getComputedStyle(x).visibility!=='hidden'); if(!b) return false; b.focus(); b.scrollIntoView({block:'center'}); return true; }""", label)
            if not ok: print("   !! no button:", label)
            await k("Enter", w=w)
        async def nav(item):
            await k("ArrowLeft", 3); await to(f"nav-{item}", "ArrowDown") or await to(f"nav-{item}", "ArrowUp"); await k("Enter", w=1200)

        await pg.goto("http://localhost:4100/?plextv=http://localhost:4100"); await pg.wait_for_timeout(1200)
        await shot("00-welcome")
        before = await osc(); await k("ArrowRight"); await k("ArrowRight"); await k("ArrowLeft")
        print("1. menu sounds play:", await osc() - before > 0)

        # --- Ganymede: "Use the default" (mock in this build) ---
        await k("ArrowRight"); await k("Enter", w=700)
        await shot("01-g-setup")
        print("2. setup focus:", await f())
        await k("Enter", w=1500)
        print("   default → sign-in:", "Sign in to Ganymede" in await txt(), await pg.evaluate("localStorage.getItem('sp:ganymede:url')"))
        await pg.keyboard.type("nicolas"); await k("ArrowDown"); await pg.keyboard.type("hunter2"); await k("Enter", w=2000)

        # --- Queue ---
        await nav("g-queue"); await shot("02-queue")
        t = await txt(); print("3. queue:", [w for w in ["LIVE: late night", "Convert video", "on hold", "Retry", "failed"] if w.lower() in t.lower()])
        await to("q-q2"); await k("ArrowRight"); print("   on:", await f()); await k("Enter", w=1200); print("   retry:", "Restarted" in await txt())

        # --- Change server: scan, then a LAN address ---
        await nav("settings"); await press("Change server")
        await press("Scan for local servers")
        print("4. scan asks for subnet (browser):", "Network to search" in await txt())
        await to("INPUT", "ArrowUp", 5); await pg.keyboard.press("Control+a"); await pg.keyboard.type("127.0.0"); await k("Enter", w=300)
        for _ in range(80):
            await pg.wait_for_timeout(500)
            if "Search finished" in await txt(): break
        await shot("03-scan")
        found = await pg.evaluate("[...document.querySelectorAll('[data-part=scan-addr]')].map(e=>e.innerText)")
        print("   scan found:", len(found), found[:2])
        await press("Type an address", 500)
        await to("INPUT", "ArrowUp", 6); print("   focus before typing:", await f(), await pg.evaluate("document.activeElement.value"))
        await pg.keyboard.press("Control+a"); await pg.keyboard.type("127.0.0.1:4000"); await k("Enter", w=2500)
        await shot("03b-lan"); print("   page says:", (await txt())[:160].replace("\n"," | "))
        print("   LAN address (no scheme):", await pg.evaluate("localStorage.getItem('sp:ganymede:url')"), "| sign-in:", "Sign in to Ganymede" in await txt())
        await pg.keyboard.type("nicolas"); await k("ArrowDown"); await pg.keyboard.type("hunter2"); await k("Enter", w=2000)

        # --- Plex + library customization ---
        await nav("settings"); await press("Add Plex", 6000); await k("Enter", w=3000)
        print("5. sidebar (default):", await sidebar())
        await nav("settings")
        foc = lambda fid: pg.evaluate(f"document.querySelector('[data-focus-id=\"{fid}\"]').focus()")
        await foc("libshow-2"); await k("Enter")                 # hide TV Shows
        await foc("libup-4"); await k("Enter"); await k("Enter")  # Kids Movies up twice (focus follows the row)
        await foc("libicon-3"); await k("Enter", w=400)           # Anime → open icon picker
        print("   picker focus starts on current icon:", await f())
        await to("icon-3-animation", "ArrowRight"); await k("Enter", w=400)
        await pg.evaluate("document.querySelector('[data-part=libs]').scrollIntoView()"); await pg.wait_for_timeout(300)
        await shot("04-library-settings")
        print("   sidebar (custom):", await sidebar())
        print("   anime icon set:", await pg.evaluate("JSON.parse(localStorage.getItem('sp:plexLibraries:machine-1')).icons['3']"))
        await nav("libraries"); await shot("05-all-libraries")
        print("   All libraries:", await pg.evaluate("[...document.querySelectorAll('[data-part=lib-name]')].map(e=>e.innerText)"))

        # --- Subtitle styling ---
        await nav("settings")
        await pg.evaluate("document.querySelector('[data-part=sub-preview]').scrollIntoView()")
        for label in ["Lexend", "Yellow", "Translucent box", "Large"]:
            await pg.evaluate(f"[...document.querySelectorAll('button.chip')].find(b=>b.innerText.trim()==='{label}')?.click()")
        await pg.wait_for_timeout(600); await shot("06-subtitle-settings")
        print("6. preview style:", await pg.evaluate("(s=>s.fontFamily+' / '+s.color+' / '+s.backgroundColor)(getComputedStyle(document.querySelector('[data-part=sub-preview] [data-part=sub-line]')))"))

        # --- Plex movie with external SRT, styled, still direct play ---
        await nav("home"); await to("movie.recentlyadded"); await k("Enter", w=1300); await k("Enter", w=3500)
        await k("ArrowDown", w=500); await to("p-tracks", "ArrowRight"); await k("Enter", w=600)
        await to("SRT External"); await k("Enter", w=4500)
        await pg.evaluate("document.querySelector('video').currentTime = 9"); await pg.wait_for_timeout(1500)
        await shot("07-styled-srt")
        print("7. SRT lines:", await pg.evaluate("[...document.querySelectorAll('[data-part=player] [data-part=sub-line]')].map(l=>l.innerText)"),
              "| quality:", await pg.evaluate("document.querySelector('[data-focus-id=p-quality]')?.innerText.trim()"))

        # --- Up from the timeline hides the controls; no menu sounds in the player ---
        await k("ArrowDown", w=500); await to("p-seek", "ArrowUp", 4)
        before = await osc(); await k("ArrowUp", w=600)
        print("8. Up on timeline hides OSD:", not await pg.evaluate("document.querySelector('[data-part=osd]').hasAttribute('data-shown')"),
              "| silent in player:", await osc() == before)
        await shot("08-osd-hidden")

        # --- Embedded ASS → segmented WebVTT; mock stream has none → burn-in fallback ---
        await k("ArrowDown", w=500); await to("p-tracks", "ArrowRight"); await k("Enter", w=600)
        await to("Signs (ASS)"); await k("Enter", w=2000)
        await pg.wait_for_timeout(16500)
        print("9. fallback to server subtitles:", "Using the server's subtitles" in await txt())
        print("ERRORS:", errs)
        await b.close()

asyncio.run(main())
