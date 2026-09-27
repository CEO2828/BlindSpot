"""Run explicitly: python tests/browser_check.py. Starts its own local test server."""
import json,os,socket,subprocess,sys,time
from pathlib import Path
from urllib.request import build_opener,ProxyHandler
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
artifacts=root/'artifacts';artifacts.mkdir(exist_ok=True)
with socket.socket() as s:
    s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(port)],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
base=f'http://127.0.0.1:{port}'
checks=[]
try:
    opener=build_opener(ProxyHandler({}))
    for attempt in range(60):
        try:opener.open(base+'/health',timeout=.3);break
        except Exception:time.sleep(.1)
    else:raise RuntimeError('Test server did not start')
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base)
        expect(page.locator('.evidence-title')).to_have_text('NVIDIA → TSMC')
        expect(page.locator('#connected')).to_have_text('$6,000')
        expect(page.locator('#connected-percent')).to_have_text('60% of total')
        assert page.locator('#holdings-drawer').is_hidden()
        checks.append('Automatic initial evidence and default $6,000/60%; compact holdings')
        for name in ['AMD','Broadcom','NVIDIA']:
            page.get_by_role('button',name=f'Inspect {name} evidence',exact=True).click()
            expect(page.locator('.evidence-title')).to_have_text(name+' → TSMC')
        page.locator('#relationship-select').select_option('avgo-tsmc-2025-11-02')
        expect(page.locator('.evidence-fact')).to_contain_text('contract manufacturers')
        checks.append('All published edges and explicit selector resolve distinct sources')
        page.locator('#edit-holdings').click();page.locator('#amount-0').fill('777');page.keyboard.press('Escape')
        expect(page.locator('#total')).to_have_text('$10,000')
        page.locator('#edit-holdings').click();expect(page.locator('#amount-0')).to_have_value('2500.00')
        page.locator('#amount-0').fill('-1');page.get_by_role('button',name='Save changes',exact=True).click()
        expect(page.locator('#drawer-error')).to_be_visible();expect(page.locator('#amount-0')).to_have_value('-1')
        page.locator('#cancel-drawer').click()
        page.locator('#edit-holdings').click();page.get_by_role('button',name='Remove AVGO',exact=True).click();page.get_by_role('button',name='Save changes',exact=True).click()
        expect(page.locator('#connected-percent')).to_have_text('52.94% of total')
        expect(page.locator('.evidence-title')).to_have_text('NVIDIA → TSMC')
        page.locator('#edit-holdings').click();page.locator('#amount-0').fill('3000.01');page.keyboard.press('Enter')
        expect(page.locator('#connected')).to_have_text('$5,000.01')
        expect(page.locator('.evidence-title')).to_have_text('NVIDIA → TSMC')
        checks.append('Transactional drawer: Escape/cancel, inline error, removal, Enter apply and valid evidence retained')
        page.locator('.portfolio-menu summary').click();page.locator('#reset').click();expect(page.locator('#connected')).to_have_text('$6,000')
        page.locator('#add-holding').click();page.locator('#add-ticker').fill('ZZZZ');page.locator('#add').click();page.locator('#amount-3').fill('100');page.locator('#add-ticker').fill('ZZZZ');page.locator('#add').click();expect(page.locator('.position')).to_have_count(4)
        page.get_by_role('button',name='Save changes',exact=True).click();expect(page.locator('#total')).to_have_text('$10,100');expect(page.locator('#connected')).to_have_text('$6,000')
        page.locator('#save-portfolio').click();page.locator('#reset').click();page.locator('#restore-portfolio').click();expect(page.locator('#total')).to_have_text('$10,100')
        checks.append('Unknown holding denominator, duplicate prevention and local persistence')
        page.route('**/api/evidence/amd-*',lambda route:route.abort())
        page.get_by_role('button',name='Inspect AMD evidence',exact=True).click();expect(page.locator('#retry-evidence')).to_be_visible()
        page.unroute('**/api/evidence/amd-*');page.locator('#retry-evidence').click();expect(page.locator('.evidence-title')).to_have_text('AMD → TSMC')
        delayed=[]
        page.route('**/api/evidence/nvda-*',lambda route:delayed.append(route))
        page.get_by_role('button',name='Inspect NVIDIA evidence',exact=True).click();expect(page.locator('#evidence')).to_contain_text('Loading source evidence')
        page.get_by_role('button',name='Inspect Broadcom evidence',exact=True).click();expect(page.locator('.evidence-title')).to_have_text('Broadcom → TSMC')
        for route in delayed:route.continue_()
        page.unroute('**/api/evidence/nvda-*');page.wait_for_timeout(150)
        expect(page.locator('.evidence-title')).to_have_text('Broadcom → TSMC')
        checks.append('Evidence outage/retry and stale-response protection')
        page.locator('#peer-company').select_option('NVDA');expect(page.locator('#peer-results')).to_contain_text('Also shares the selected supplier');expect(page.locator('#peer-results')).to_contain_text('Insufficient coverage to compare')
        page.locator('[data-compare-peer="AMD"]').click();expect(page.locator('#comparison')).to_contain_text('Shared disclosed suppliers: TSMC')
        page.locator('[data-modal-evidence]').first.click();expect(page.locator('#source-content')).to_contain_text('NVIDIA');page.locator('#close-source').click()
        checks.append('Automatic peer discovery, manual comparison and evidence modal')
        page.get_by_role('button',name='Coverage',exact=True).click();expect(page.locator('#catalog-summary')).to_contain_text('23 assessed');expect(page.locator('#catalog-summary')).to_contain_text('13 pending')
        page.locator('#catalog-search').fill('Ambiq');expect(page.locator('#catalog-list')).to_contain_text('relationship found');page.locator('[data-coverage="AMBQ"]').click();expect(page.locator('#source-content')).to_contain_text('Pending publication review');page.locator('#close-source').click()
        checks.append('Coverage assessment/publication counts and pending records')
        page.get_by_role('button',name='Workspace',exact=True).click();page.locator('#reset').click();expect(page.locator('#connected')).to_have_text('$6,000')
        page.locator('.edge-hit').first.focus();page.keyboard.press('Enter');expect(page.locator('.evidence-title')).to_have_text('NVIDIA → TSMC')
        for width in [1440,768,390,320]:
            page.set_viewport_size({'width':width,'height':900 if width==1440 else 844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            if width in [1440,390]:page.screenshot(path=str(artifacts/f'after-editorial-{width}.png'),full_page=True)
            page.locator('#edit-holdings').click();assert page.evaluate('document.querySelector("dialog[open]").scrollWidth<=innerWidth')
            if width==390:
                page.wait_for_timeout(230)
                page.screenshot(path=str(artifacts/'editorial-drawer-mobile.png'))
            page.keyboard.press('Escape')
        checks.append('Keyboard edge selection; 320/390/768/1440px layouts and mobile drawer')
        page.locator('#edit-holdings').click()
        for i in range(3):page.locator('#amount-'+str(i)).fill('0')
        page.locator('#unassessed').fill('0');page.get_by_role('button',name='Save changes',exact=True).click();expect(page.locator('#total')).to_have_text('$0');expect(page.locator('#evidence')).to_contain_text('No verified evidence')
        checks.append('Zero-total explicit no-evidence state')
        assert not errors,errors
        browser.close()
    (artifacts/'browser-results.json').write_text(json.dumps({'passed':checks,'console_errors':errors},indent=2))
    print(json.dumps({'passed':checks,'console_errors':errors},indent=2))
finally:
    server.terminate();server.wait(timeout=10)
