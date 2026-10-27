const TEXT_EXTENSIONS = /\.(txt|md|markdown|json|csv|js|jsx|ts|tsx|py|html|css|scss|xml|ya?ml|log|ini|toml|rs|sh|sql|conf|svg)$/i;
export const isTextDocument = (name: string) => TEXT_EXTENSIONS.test(name);
export const isCreativeDocument = (name: string) => /\.(psd|psb|ai)$/i.test(name);
