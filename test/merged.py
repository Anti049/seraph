"""SERAPH with both sources: start empty, add Ganymede, add Plex, browse + play both.
Needs: bun run mock/all.ts (Plex mock :4100/:32400, Ganymede mock :4000). Screenshots → /tmp/mq2."""
import asyncio, os
from playwright.async_api import async_playwright
os.makedirs("/tmp/mq2", exist_ok=True)
APP = "http://localhost:4100/?plextv=http://localhost:4100"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width": 1920, "height": 1080})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        async def k(x, n=1, w=280):
            for _ in range(n): await pg.keyboard.press(x); await pg.wait_for_timeout(w)
        f = lambda: pg.evaluate("document.activeElement && (document.activeElement.dataset.focusId || document.activeElement.innerText?.trim().slice(0,28) || document.activeElement.tagName)")
        txt = lambda: pg.evaluate("document.body.innerText")
        async def shot(n): await pg.screenshot(path=f"/tmp/mq2/{n}.png"); print(f"{n:24s} focus={await f()}")
        async def to(focus_text, key="ArrowDown", limit=25):
            for _ in range(limit):
                if focus_text in str(await f()): return True
                await k(key)
            return False

        await pg.goto(APP); await pg.wait_for_timeout(1500); await shot("01-welcome")
        await k("ArrowRight"); await k("Enter", w=600); await shot("02-g-address")
        await k("ArrowUp", 2); await pg.keyboard.press("Control+a"); await pg.keyboard.type("http://localhost:4000"); await k("Enter", w=1500)
        await shot("03-g-login")
        await pg.keyboard.type("nicolas"); await k("ArrowDown"); await pg.keyboard.type("hunter2"); await k("Enter", w=2000)
        await shot("04-home-ganymede-only")
        t = await txt(); print("   rows:", [r for r in ["Recent streams", "Continue watching"] if r in t])
        # Settings → Add Plex
        await k("ArrowLeft", 2); await to("nav-settings"); await k("Enter", w=1200)
        await to("Add Plex", "ArrowDown"); await k("Enter", w=1200); await shot("05-plex-code")
        await pg.wait_for_timeout(5000); await shot("06-plex-servers")
        await k("Enter", w=3000); await shot("07-home-both")
        t = await txt()
        print("   rows:", [r for r in ["Continue watching", "Recent streams", "Recently Added Movies", "TV Shows"] if r in t])
        await k("ArrowLeft", 2); await shot("08-sidebar-sections")
        print("   sidebar:", await pg.evaluate("[...document.querySelectorAll('nav button')].map(b=>b.innerText.trim())"))
        # Ganymede: open a stream from Recent streams and play with chat
        await k("ArrowRight"); await to("grec-", "ArrowDown"); await k("Enter", w=1500); await shot("09-g-video")
        await k("Enter", w=6000); await shot("10-g-player-chat")
        print("   chat lines:", await pg.evaluate("document.querySelectorAll('[data-part=chat-line]').length"),
              "| chapters btn:", await pg.evaluate("!!document.querySelector('[data-focus-id=p-chapters]')"),
              "| plex-only controls hidden:", await pg.evaluate("!document.querySelector('[data-focus-id=p-quality]')"))
        for i in range(3):
            await k("Escape", w=900); print("   back", i, await f(), await pg.evaluate("document.querySelector('[data-part=player]') ? 'player' : 'no player'"))
        # Plex movie from home
        await to("movie.recentlyadded", "ArrowDown"); await k("Enter", w=1500); await k("Enter", w=4500); await shot("11-plex-player")
        print("   plex controls:", await pg.evaluate("[...document.querySelectorAll('[data-part=controls] button')].map(b=>b.innerText.trim())"))
        await k("Escape", w=900); await k("Escape", w=900); await k("Escape", w=900)
        # Search across both
        await k("ArrowLeft", 2); await to("nav-search", "ArrowUp"); await k("Enter", w=900)
        await pg.keyboard.type("Speedrun"); await pg.wait_for_timeout(1500); await shot("12-search-streams")
        print("   search rows:", await pg.evaluate("[...document.querySelectorAll('section h2')].map(h=>h.innerText)"))
        await pg.focus("input"); await pg.fill("input", "Harbor"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(1500); await shot("13-search-plex")
        print("   search rows:", await pg.evaluate("[...document.querySelectorAll('section h2')].map(h=>h.innerText)"))
        print("   g progress saved:", "progress" in open("/tmp/gmock.log").read())
        print("ERRORS:", errs)

        # ---- Android-style: UI served from Ganymede's own origin ----
        pg2 = await b.new_page(viewport={"width": 1920, "height": 1080})
        await pg2.goto("http://localhost:4000/tv/?plextv=http://localhost:4100"); await pg2.wait_for_timeout(1200)
        await pg2.keyboard.press("ArrowRight"); await pg2.keyboard.press("Enter"); await pg2.wait_for_timeout(500)
        await pg2.keyboard.press("ArrowUp"); await pg2.keyboard.press("Control+a"); await pg2.keyboard.type("http://localhost:4000"); await pg2.keyboard.press("Enter"); await pg2.wait_for_timeout(1500)
        await pg2.keyboard.type("nicolas"); await pg2.keyboard.press("ArrowDown"); await pg2.keyboard.type("hunter2"); await pg2.keyboard.press("Enter"); await pg2.wait_for_timeout(2000)
        api_calls = await pg2.evaluate("performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/api/v1/')).slice(0,3)")
        print("   same-origin API calls:", api_calls)
        await b.close()
asyncio.run(main())
