import { expect, test } from '@playwright/test';
import { desktopFixture, openSettings } from './desktop-fixture';

test('Teragram exposes Settings only in Profile and About opens the official repository', async ({page})=>{
  await desktopFixture(page,{gallery:true});await page.goto('/');
  await expect(page).toHaveTitle('Teragram'); await expect(page.locator('.cloud-brand')).toHaveText('Teragram');
  await expect(page.locator('.cloud-header').getByRole('button',{name:'Settings',exact:true})).toHaveCount(0);
  await expect(page.locator('.cloud-sidebar').getByRole('button',{name:'Settings',exact:true})).toHaveCount(0);
  await openSettings(page);
  const dialog=page.getByRole('dialog',{name:'Settings',exact:true});await dialog.getByRole('button',{name:'About',exact:true}).click();
  await expect(dialog).toContainText('Teragram');await expect(dialog).toContainText('v1.0');
  await dialog.getByRole('button',{name:'github.com/kirxndinesh/Teragram',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__desktopTest.calls.some((call:any)=>call.command.includes('open_url')&&JSON.stringify(call.args).includes('https://github.com/kirxndinesh/Teragram')))).toBe(true);
});

test('sidebar animation preserves gallery column membership and card elements',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await desktopFixture(page,{gallery:true,settings:{startupView:'photos',thumbnailScale:1}});await page.goto('/');
  await expect(page.locator('.cloud-masonry-column')).toHaveCount(4);
  await expect(page.locator('.cloud-media-open img').first()).toBeVisible();
  await page.evaluate(()=>{(window as any).__originalCards=[...document.querySelectorAll('.cloud-media-tile')];});
  await page.locator('.cloud-brand').click();
  const columns=await page.evaluate(async()=>{const counts:number[]=[];for(let i=0;i<25;i++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));counts.push(document.querySelectorAll('.cloud-masonry-column').length);}return counts;});
  expect(columns.every(count=>count===4)).toBe(true);
  expect(await page.evaluate(()=>(window as any).__originalCards.every((node:Element)=>node.isConnected))).toBe(true);
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('width','68px');
  await page.locator('.cloud-brand').click();await expect(page.locator('.cloud-sidebar')).toHaveCSS('width','248px');
  await expect(page.locator('.cloud-masonry-column')).toHaveCount(4);
});

test('sidebar trees animate while hidden children remain inert',async({page})=>{
  await desktopFixture(page,{gallery:true,settings:{quickAccessExpanded:false}});await page.goto('/');
  await expect(page.locator('#cloud-quick-links').locator('..').locator('..')).toHaveAttribute('aria-hidden','true');
  await page.getByRole('button',{name:'Quick Access',exact:true}).click();
  await expect(page.getByRole('button',{name:'Favorites',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Quick Access',exact:true}).click();
  await expect(page.getByRole('button',{name:'Favorites',exact:true})).toHaveCount(0);
});


test('Settings keyboard shortcut and reduced-motion preferences remain usable', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await desktopFixture(page,{gallery:true}); await page.goto('/');
  await expect(page.locator('.cloud-brand')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+,');
  await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toHaveCount(0);
  await expect(page.locator('.cloud-view-transition')).toHaveCSS('animation-name','none');
  await page.locator('.cloud-brand').click();
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('transition-duration','0s');
});
