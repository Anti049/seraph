"""Plex-only flow: drive SERAPH against mock/plex.ts with simulated remote keys; screenshots → /tmp/mq."""
import asyncio
from playwright.async_api import async_playwright

URL = "http://localhost:4100/?plextv=http://localhost:4100"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width": 1920, "height": 1080})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        async def key(k, n=1, wait=280):
            for _ in range(n):
                await pg.keyboard.press(k); await pg.wait_for_timeout(wait)
        async def focus():
            return await pg.evaluate("document.activeElement && (document.activeElement.dataset.focusId || document.activeElement.textContent.trim().slice(0,30) || document.activeElement.tagName)")
        async def text():
            return await pg.evaluate("document.body.innerText")
        async def shot(n):
            await pg.screenshot(path=f"/tmp/mq/{n}.png"); print(f"{n:28s} focus={await focus()}")

        await pg.goto(URL); await pg.wait_for_timeout(1200)
        await key("Enter", wait=1200); await shot("01-signin")  # Welcome → Plex
        await pg.wait_for_timeout(5000); await shot("02-servers")
        await key("Enter", wait=2500); await shot("03-home")
        t = await text(); print("   continue watching row:", "Continue watching" in t, "| music hub hidden:", "Recently Played Music" not in t)
        await key("ArrowDown"); await key("ArrowRight", 2); await shot("04-home-focus")
        await key("ArrowDown"); await key("Enter", wait=1500); await shot("05-details")
        await key("Enter", wait=3500); await shot("06-player")
        await pg.wait_for_timeout(5500); await shot("07-osd-hidden")
        await key("ArrowRight", 2, wait=150); await pg.wait_for_timeout(400); await shot("08-scrub-preview")
        await pg.wait_for_timeout(1500)
        print("   skip intro visible:", "Skip intro" in await text())
        await pg.wait_for_timeout(5200); await shot("09-skip-intro")
        await key("Enter", wait=1200)
        print("   time after skip:", round(await pg.evaluate("document.querySelector('video').currentTime")))
        await key("ArrowDown", wait=500); await key("ArrowRight", 4); await shot("10-controls")
        # open tracks panel
        while (await focus()) != "p-tracks":
            await key("ArrowLeft")
            if (await focus()) in ("p-play", None): break
        await key("Enter", wait=600); await shot("11-tracks-panel")
        # choose "English (SRT)" subtitles → forces transcode
        for _ in range(4): await key("ArrowDown")
        print("   selecting:", await focus())
        await key("Enter", wait=5000); await shot("12-transcoding")
        print("   quality button:", await pg.evaluate("[...document.querySelectorAll('[data-focus-id=p-quality]')].map(b=>b.innerText.trim())"))
        print("   hls playing at:", round(await pg.evaluate("document.querySelector('video').currentTime")))
        # jump to credits → Up Next
        await pg.evaluate("document.querySelector('video').currentTime = 161")
        await pg.wait_for_timeout(2500); await shot("13-upnext")
        await pg.wait_for_timeout(11000)
        t = await text(); print("   autoplayed next:", "E2" in t or "Undertow" in t)
        await shot("14-next-episode")
        await key("Escape", wait=300); await key("Escape", wait=300); await key("Escape", wait=900)
        await shot("15-after-back")
        print("ERRORS:", errs)
        await b.close()
asyncio.run(main())
