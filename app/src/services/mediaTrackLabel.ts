const languages: Record<string,string> = { eng:'en',hin:'hi',mal:'ml',tam:'ta',tel:'te',kan:'kn',ben:'bn',mar:'mr',spa:'es',fra:'fr',fre:'fr',deu:'de',ger:'de',jpn:'ja',kor:'ko',zho:'zh',chi:'zh',rus:'ru',ara:'ar' };
export function mediaTrackLabel(language: string | undefined, label: string | undefined, index: number) {
  if(label && !/^(Sound|Video|Audio)?Handler$/i.test(label) && label !== 'und') return label;
  const code=languages[language ?? ''] || language;
  if(code && code !== 'und') { try { const Constructor=(Intl as typeof Intl & {DisplayNames: new(locales:string[],options:{type:string})=>{of(code:string):string|undefined}}).DisplayNames;return new Constructor([navigator.language],{type:'language'}).of(code) || code; } catch { return code; } }
  return `#${index+1}`;
}
