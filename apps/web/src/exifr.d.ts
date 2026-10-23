declare module 'exifr/dist/lite.esm.mjs' {
  export interface ExifOutput {
    latitude?: number
    longitude?: number
    DateTimeOriginal?: Date | string
    [key: string]: unknown
  }

  export function parse(
    data: File | Blob | ArrayBuffer | Uint8Array | string,
    options?: unknown
  ): Promise<ExifOutput | undefined>

  export function gps(
    data: File | Blob | ArrayBuffer | Uint8Array | string
  ): Promise<{ latitude?: number; longitude?: number } | undefined>

  const exifr: {
    parse: typeof parse
    gps: typeof gps
  }

  export default exifr
}
