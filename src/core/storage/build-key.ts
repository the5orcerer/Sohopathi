export function buildStorageKey(pattern: string, params: Record<string, string>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, name) => {
    const value = params[name];
    if (!value) throw new Error(`missing storage key param: ${name}`);
    return value;
  });
}
