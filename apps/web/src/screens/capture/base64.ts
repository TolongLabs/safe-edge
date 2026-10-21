// In chunks: spreading a whole photo into one call overflows the stack.
export const base64 = (b: ArrayBuffer) => {
  const bytes = new Uint8Array(b)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
