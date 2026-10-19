/** The scene page's buttons: solid dark for the main action, outlined for the rest. */
export const button = (primary: boolean) =>
  ({
    minHeight: 32,
    padding: '0 14px',
    borderRadius: 8,
    border: primary ? 'none' : '1.5px solid #17302a',
    background: primary ? '#17302a' : '#fbfcfb',
    color: primary ? '#ffffff' : '#17302a',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer'
  }) as const
