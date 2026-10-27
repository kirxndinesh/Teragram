import { expect, test } from '@playwright/test';
import { desktopFixture, nativeCalls, openSettings } from './desktop-fixture';

for (const theme of ['light','dark'] as const) test(`sidebar trailing chevrons and unclipped toolbar in ${theme}`,async({page})=>{
  await desktopFixture(page,{gallery:true,theme,settings:{startupView:'photos'}});await page.goto('/');
  const quick=page.locator('.cloud-quick-navigation'); const label=quick.getByRole('button',{name:'Quick Access',exact:true});
  const chevron=quick.locator('.cloud-tree-chevron');
  await expect(label).toBeVisible(); expect((await chevron.boundingBox())!.x).toBeGreaterThan((await label.boundingBox())!.x+150);
  await quick.hover();await chevron.click();await expect(page.getByRole('button',{name:'Favorites',exact:true})).toHaveCount(0);
  await label.click();await expect(page.locator('.cloud-content-heading h1')).toHaveText('Photos');
  await page.locator('.cloud-sidebar').getByRole('button',{name:'Photos',exact:true}).click();
  const geometry=await page.locator('.cloud-view-toggle').evaluate(el=>{const c=getComputedStyle(el);return {height:el.getBoundingClientRect().height,overflow:c.overflow,border:c.borderWidth};});
  expect(geometry.height).toBeGreaterThanOrEqual(36);expect(geometry.overflow).toBe('visible');expect(geometry.border).toBe('0px');
  for(const button of await page.locator('.cloud-view-toggle button').all()) {await expect(button).toHaveCSS('height','36px');await expect(button).toHaveCSS('border-radius','10px');await expect(button).toHaveCSS('border-left-width','0px');}
});

test('Privacy keeps diagnostics on-device even with a legacy reporting preference',async({page})=>{
  await desktopFixture(page,{gallery:true,settings:{crashReportingEnabled:true}});await page.goto('/');await openSettings(page);
  const dialog=page.getByRole('dialog',{name:'Settings',exact:true});await dialog.getByRole('button',{name:'Privacy',exact:true}).click();
  await expect(dialog.getByRole('switch',{name:'Send anonymous crash reports'})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Open Local Crash Logs',exact:true}).click();expect(await nativeCalls(page,'cmd_open_local_crash_logs')).toHaveLength(1);
  await dialog.getByRole('button',{name:'About',exact:true}).click();await expect(dialog).toContainText('Kiran Dinesh (@kirxndinesh)');await expect(dialog).toContainText('An open-source cloud workspace');
  expect(await nativeCalls(page,'cmd_submit_crash_report')).toHaveLength(0);
});

test('adjacent image navigation keeps one stable viewer frame',async({page})=>{
  await desktopFixture(page,{gallery:true,settings:{startupView:'photos'}});await page.goto('/');await page.locator('.cloud-media-open').first().click();
  const dialog=page.getByRole('dialog').first();await expect(dialog.locator('.preview-original')).toHaveCSS('opacity','1');
  const before=await dialog.boundingBox();await dialog.getByRole('button',{name:'Next file',exact:true}).click();
  await expect(dialog.locator('.preview-original')).toHaveCSS('opacity','1');const after=await dialog.boundingBox();
  expect(after!.width).toBeCloseTo(before!.width,0);expect(after!.height).toBeCloseTo(before!.height,0);
});

test('existing-channel import searches, mounts and removes only the local folder link',async({page})=>{
  await desktopFixture(page,{gallery:true,settings:{startupView:'photos'}});
  await page.addInitScript(()=>{
    const original=(window as any).__TAURI_INTERNALS__.invoke;let attached=false;
    (window as any).__TAURI_INTERNALS__.invoke=async(command:string,args:any={})=>{
      if(command==='cmd_get_imported_channel_ids')return attached?[99]:[];
      if(command==='cmd_list_import_channels')return [{id:99,title:'Existing family channel',username:null,members:42,kind:'channel'},{id:-77,title:'Study group',username:null,members:8,kind:'group'}];
      if(command==='cmd_get_channel_details')return null;
      if(command==='cmd_import_channels'){(window as any).__desktopTest.calls.push({command,args});attached=true;return [];}
      if(command==='cmd_remove_imported_channel'){(window as any).__desktopTest.calls.push({command,args});attached=false;return null;}
      const result=await original(command,args);
      if(['cmd_scan_folders','cmd_get_enriched_folders'].includes(command)&&attached)return [...result,{id:99,name:'Existing family channel',is_public:false,group_id:null,display_order:5}];
      return result;
    };
  });
  await page.goto('/');await page.locator('.cloud-folder-navigation').getByRole('button',{name:'Folders',exact:true}).click();await page.locator('.cloud-folder-overview-toolbar').getByRole('button',{name:'Add Existing Channel',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add Existing Channel',exact:true});await expect(dialog).toContainText('42 members');
  await dialog.getByRole('textbox',{name:'Search channels and groups',exact:true}).fill('family');
  await expect(dialog.getByRole('checkbox')).toHaveCount(1);await dialog.getByRole('checkbox',{name:'Existing family channel',exact:true}).check();
  await dialog.getByRole('button',{name:/Add to Folders/}).click();await expect(dialog).toHaveCount(0);
  await page.locator('.cloud-folder-navigation').getByRole('button',{name:'Folders',exact:true}).click();
  const card=page.locator('.one-folder-card').filter({hasText:'Existing family channel'});await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Folder settings',exact:true}).click();await page.getByRole('button',{name:'Remove from Folders',exact:true}).click();
  await expect(card).toHaveCount(0);expect(await nativeCalls(page,'cmd_delete_folder')).toHaveLength(0);
});

test('reduced-motion startup waits for saved preferences before writing performance defaults',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await desktopFixture(page,{gallery:true,settings:{startupView:'photos',driveTourSeen:true}});
  await page.addInitScript(()=>{const original=(window as any).__TAURI_INTERNALS__.invoke;let release:()=>void;const gate=new Promise<void>(resolve=>release=resolve);(window as any).__releaseSettings=()=>release();(window as any).__settingsPending=false;(window as any).__TAURI_INTERNALS__.invoke=async(command:string,args:any={})=>{if(command==='plugin:store|get'&&args.key==='settings'){(window as any).__settingsPending=true;await gate;}return original(command,args);};});
  await page.goto('/');await expect.poll(()=>page.evaluate(()=>(window as any).__settingsPending)).toBe(true);
  await page.evaluate(()=>(window as any).__releaseSettings());await expect(page.locator('.cloud-content-heading h1')).toHaveText('Photos');
  await expect(page.getByRole('dialog',{name:/Introduction/})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('desktop-e2e-stores')!)['settings.json'].settings.driveTourSeen)).toBe(true);
});
