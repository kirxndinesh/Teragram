import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { desktopFixture } from './desktop-fixture';

async function movie(page: import('@playwright/test').Page, filename = 'polish-video.mp4') {
  const bytes = await readFile(new URL(`../fixtures/${filename}`, import.meta.url));
  await desktopFixture(page, { gallery: true, settings: { startupView: 'photos' } });
  await page.route('http://localhost:14201/stream/**', route => {
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? '');
    const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(bytes.length - 1, Number(range[2])) : bytes.length - 1;
    return route.fulfill({ status: range ? 206 : 200, contentType: 'video/mp4', body: bytes.subarray(start, end + 1), headers: { 'accept-ranges':'bytes','access-control-allow-origin':'*','content-length':String(end-start+1), ...(range ? {'content-range':`bytes ${start}-${end}/${bytes.length}`} : {}) } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Open Weekend film.mp4', exact: true }).click();
  const dialog=page.getByRole('dialog',{name:'Weekend film.mp4',exact:true});
  await expect.poll(()=>dialog.locator('video').evaluate(element=>(element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  return dialog;
}

test('movie opens playing and exposes subtitle, audio, speed, sync and fit controls', async ({page})=>{
  const dialog=await movie(page); const video=dialog.locator('video');
  await expect(video).toHaveJSProperty('paused',false);
  await video.evaluate(element=>(element as HTMLVideoElement).loop=true);
  await dialog.getByLabel('Settings',{exact:true}).click();
  await dialog.getByLabel('Audio offset +0.05s',{exact:true}).click();
  await expect(dialog.locator('.movie-stepper output').first()).toHaveText('0.05s');
  await dialog.getByLabel('Subtitle size',{exact:true}).selectOption('1.5');
  await dialog.getByLabel('Subtitle background',{exact:true}).selectOption('0.5');
  await dialog.getByLabel('Aspect ratio',{exact:true}).selectOption('cover');
  await expect(video).toHaveCSS('object-fit','cover');
  await dialog.getByLabel('Aspect ratio',{exact:true}).selectOption('16:9');
  await expect.poll(()=>video.evaluate(element=>{const r=element.getBoundingClientRect();return r.width/r.height;})).toBeCloseTo(16/9,1);
  await dialog.getByRole('combobox',{name:'Playback speed',exact:true}).selectOption('0.75'); await expect(video).toHaveJSProperty('playbackRate',.75);
});

for(const format of ['srt','vtt','ass']) test(`external ${format} subtitles load as real text tracks and timing changes actual cues`, async({page})=>{
  const dialog=await movie(page); const video=dialog.locator('video');
  const content=format==='ass' ? '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.20,0:00:01.50,Default,,0,0,0,,Hello, Teragram\\NSecond line' : format==='vtt' ? 'WEBVTT\n\n00:00:00.200 --> 00:00:01.500\nHello Teragram' : '1\n00:00:00,200 --> 00:00:01,500\nHello Teragram\n';
  await dialog.locator('input[type=file]').setInputFiles({name:`captions.${format}`,mimeType:'text/plain',buffer:Buffer.from(content)});
  await expect.poll(()=>video.evaluate(element=>{const m=element as HTMLVideoElement;return m.textTracks.length && m.textTracks[0].cues?.length;})).toBe(1);
  await dialog.getByLabel('Settings',{exact:true}).click(); await dialog.getByLabel('Subtitle offset +0.1s',{exact:true}).click();
  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).textTracks[0].cues![0].startTime)).toBeCloseTo(.3,2);
  await dialog.getByLabel('Subtitle position',{exact:true}).fill('10');
  await expect.poll(()=>video.evaluate(element=>((element as HTMLVideoElement).textTracks[0].cues![0] as VTTCue).line)).toBe(80);
});


test('fragmented MP4 exposes both real audio tracks and switches the active MSE track', async ({page})=>{
  const dialog=await movie(page,'movie-multiaudio.mp4');
  await dialog.getByLabel('Audio',{exact:true}).first().click();
  const audio=dialog.getByRole('combobox',{name:'Audio',exact:true});
  await expect(audio).toBeEnabled();
  await expect(audio.locator('option')).toHaveCount(2);
  const options=await audio.locator('option').evaluateAll(items=>items.map(item=>({value:(item as HTMLOptionElement).value,label:item.textContent})));
  expect(options.map(item=>item.label).join(' ')).toMatch(/English|Hindi/);
  await audio.selectOption(options[1].value);
  await expect(audio).toHaveValue(options[1].value);
  await expect.poll(()=>dialog.locator('video').evaluate(element=>(element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
});
