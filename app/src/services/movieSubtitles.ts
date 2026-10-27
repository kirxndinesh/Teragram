const seconds = (value: string) => {
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
  return match ? Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(3, '0')) / 1000 : NaN;
};
const stamp = (value: number) => { const ms = Math.round(value * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };
/** Normalize supported subtitle formats; styles and markup never become app HTML. */
export function subtitleWebVtt(input: string, name: string): string {
  if (input.length > 2 * 1024 * 1024) throw new Error('SUBTITLE_LIMIT');
  const cues: { start: number; end: number; text: string }[] = [];
  const add = (start: string, end: string, text: string) => { const a = seconds(start), b = seconds(end); if (Number.isFinite(a) && Number.isFinite(b) && b > a && a >= 0 && cues.length < 10000) cues.push({ start: a, end: b, text: text.replace(/\{[^}]*\}/g, '').replace(/<[^>]*>/g, '').replace(/\\[Nn]/g, '\n').trim() }); };
  const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (/\.ass$/i.test(name)) {
    let fields = ['layer','start','end','style','name','marginl','marginr','marginv','effect','text'];
    let events = false;
    for (const line of source.split('\n')) {
      if (/^\[/.test(line)) events = /^\[Events\]/i.test(line);
      if (!events) continue;
      if (/^Format:/i.test(line)) fields = line.slice(7).split(',').map(value => value.trim().toLowerCase());
      if (/^Dialogue:/i.test(line)) { const values = line.slice(9).split(','); const textIndex = fields.indexOf('text'); if (textIndex < 0) continue; add(values[fields.indexOf('start')] || '', values[fields.indexOf('end')] || '', values.slice(textIndex).join(',')); }
    }
  } else {
    for (const block of source.split(/\n\s*\n/)) {
      if (/^(WEBVTT|NOTE|STYLE|REGION)/.test(block.trim())) continue;
      const lines = block.split('\n'); const index = lines.findIndex(line => line.includes('-->')); if (index < 0) continue;
      const timing = lines[index].match(/(\S+)\s+-->\s+(\S+)/); if (timing) add(timing[1], timing[2], lines.slice(index + 1).join('\n'));
    }
  }
  if (!cues.length) throw new Error('SUBTITLE_INVALID');
  return 'WEBVTT\n\n' + cues.map((cue, index) => `${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}`).join('\n\n') + '\n';
}
