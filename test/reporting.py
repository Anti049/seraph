"""SERAPH: error reports, update notice, offline banner, instant Back (cache).
GitHub is mocked inside the browser (nothing reaches api.github.com).

    (cd web && GANYMEDE_DEFAULT=http://localhost:4000 bun run build) && bun run mock/all.ts
"""
import asyncio, json, os
from playwright.async_api import async_playwright
os.makedirs("/tmp/sp", exist_ok=True)
APP = "http://localhost:4100/?plextv=http://localhost:4100"

SEED = """
localStorage.setItem('sp:ganymede:url', 'http://localhost:4000');
localStorage.setItem('sp:ganymede:guest:http://localhost:4000', 'true');
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
        await ctx.route("**/ganymede.nploetz.dev/**", lambda r: r.abort())
        await ctx.route("https://plex.tv/**", lambda r: r.abort())
        filed, searched = [], []

        async def github(route):
            req = route.request
            url = req.url
            if "/releases/latest" in url:
                return await route.fulfill(json={"tag_name": "v9.9.9", "name": "SERAPH 9.9.9", "html_url": "https://github.com/Anti049/seraph/releases/tag/v9.9.9"})
            if "/search/issues" in url:
                searched.append(url)
                items = [{"number": 7, "html_url": "https://github.com/Anti049/seraph/issues/7"}] if filed else []
                return await route.fulfill(json={"items": items})
            if req.method == "POST":
                filed.append({"url": url, "auth": req.headers.get("authorization"), "body": json.loads(req.post_data or "{}")})
                return await route.fulfill(status=201, json={"number": 7, "html_url": "https://github.com/Anti049/seraph/issues/7"})
            if "/repos/" in url:
                return await route.fulfill(json={"full_name": "Anti049/seraph"})
            await route.fulfill(status=404, json={})
        await ctx.route("https://api.github.com/**", github)
        await ctx.add_init_script(SEED)

        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        f = lambda: pg.evaluate("document.activeElement && (document.activeElement.dataset.focusId || document.activeElement.innerText?.trim().slice(0,30) || document.activeElement.tagName)")
        txt = lambda: pg.evaluate("document.body.innerText")
        async def key(x, n=1, w=300):
            for _ in range(n): await pg.keyboard.press(x); await pg.wait_for_timeout(w)

        await pg.goto(APP); await pg.wait_for_timeout(2500)
        print("1. home (Ganymede guest):", "Recent streams" in await txt(), "| focus:", await f())

        # --- uncaught error → report dialog with QR, scrubbed ---
        before = await f()
        await pg.evaluate("""setTimeout(() => { throw new TypeError("boom at http://192.168.1.20:32400/library?X-Plex-Token=SECRET123 for ghp_abcdefghijklmnop1234") })""")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path="/tmp/sp/r1-dialog.png")
        t = await txt()
        print("2. dialog shown:", "Something went wrong" in t, "| QR:", await pg.evaluate("!!document.querySelector('[aria-label=\"QR code\"] path')"))
        print("   redacted:", "SECRET123" not in t and "192.168.1.20" not in t and "ghp_" not in t, "| focus in dialog:", await f())
        await key("Escape", w=500)
        print("   Back closes + focus restored:", "Something went wrong" not in await txt(), await f() == before)

        # --- same error again within a minute is not re-reported ---
        await pg.evaluate("""setTimeout(() => { throw new TypeError("boom at http://192.168.1.20:32400/library?X-Plex-Token=SECRET123 for ghp_abcdefghijklmnop1234") })""")
        await pg.wait_for_timeout(500)
        print("3. duplicate suppressed:", "Something went wrong" not in await txt())

        # --- network errors are not bugs ---
        await pg.evaluate("void Promise.reject(new TypeError('Failed to fetch'))"); await pg.wait_for_timeout(400)
        print("   fetch failure ignored:", "Something went wrong" not in await txt())

        # --- Settings: update notice + diagnostics + token & auto-filing ---
        await pg.goto(APP + "#/settings"); await pg.wait_for_timeout(2500)
        t = await txt()
        print("4. update available shown:", "SERAPH 9.9.9 is available" in t)
        print("   diagnostics:", [x for x in ["Platform", "Engine", "Ganymede"] if x in t])
        await pg.evaluate("document.querySelector('input[type=password]').scrollIntoView({block:'center'})")
        await pg.fill("input[type=password]", "github_pat_TESTTOKEN0123456789")
        await pg.focus("input[type=password]"); await key("Enter", w=900)
        t = await txt()
        print("   token saved + verified:", "saved on this TV" in await pg.evaluate("document.querySelector('input[type=password]').placeholder"), "OK: reports will be filed" in t)
        on = await pg.evaluate("""(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='On' && x.closest('div')?.innerText.includes('File reports automatically')); b.focus(); return !!b })()""")
        await key("Enter", w=400)
        await pg.screenshot(path="/tmp/sp/r2-settings-reports.png")

        await pg.evaluate("""setTimeout(() => { throw new RangeError("render blew up in Details") })"""); await pg.wait_for_timeout(1500)
        await pg.screenshot(path="/tmp/sp/r3-filed.png")
        body = filed[-1]["body"] if filed else {}
        print("5. auto-filed:", len(filed) == 1, "| labels:", body.get("labels"), "| title:", body.get("title"))
        print("   token sent only to GitHub:", filed and filed[-1]["auth"] == "Bearer github_pat_TESTTOKEN0123456789", "| fingerprint in body:", "seraph-fingerprint" in body.get("body", ""))
        print("   dialog says filed:", "Filed on GitHub" in await txt())
        await key("Escape", w=400)

        # same error later (after the 60 s window) → comment on existing issue
        await pg.evaluate("window.__now = Date.now; Date.now = () => window.__now() + 120000")
        await pg.evaluate("""setTimeout(() => { throw new RangeError("render blew up in Details") })"""); await pg.wait_for_timeout(1500)
        print("6. repeat → comment:", len(filed) == 2 and filed[-1]["url"].endswith("/issues/7/comments"))
        await pg.evaluate("Date.now = window.__now"); await key("Escape", w=400)

        # --- recent problems listed in About ---
        print("   recent problems listed:", "Recent problems on this TV" in await txt())

        # --- offline / online ---
        await ctx.set_offline(True); await pg.wait_for_timeout(500)
        await pg.screenshot(path="/tmp/sp/r4-offline.png")
        print("7. offline banner:", "No network connection" in await txt())
        await ctx.set_offline(False); await pg.wait_for_timeout(500)
        print("   back online toast:", "Back online" in await txt())

        # --- instant Back: reopening the channel list comes from the cache ---
        await pg.goto(APP + "#/ganymede/channels"); await pg.wait_for_timeout(2500)
        print("8. deep link kept:", pg.url.endswith("#/ganymede/channels"), "| focus:", await f())
        await pg.evaluate("performance.clearResourceTimings()")
        await key("Enter", w=1500); opened = pg.url
        await key("Escape", w=200)
        calls = await pg.evaluate("performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/api\\/v1\\/channel$/.test(n))")
        print("   opened", opened.split("#")[1], "→ Back: channel list refetched", len(calls), "times | cards shown 200 ms after Back:",
              await pg.evaluate("document.querySelectorAll('[data-focus-id^=gch-]').length") > 0, "| focus restored:", await f())

        print("unexpected page errors:", [e for e in errs if "boom" not in e and "blew up" not in e][:3])
        await b.close()

asyncio.run(main())
