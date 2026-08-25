/** Content licences an author can attach to an article. */
export const LICENSES = {
  all_rights_reserved: { label: "© All rights reserved", short: "All rights reserved" },
  cc_by: { label: "CC BY 4.0 — Attribution", short: "CC BY 4.0" },
  cc_by_sa: { label: "CC BY-SA 4.0 — Attribution, ShareAlike", short: "CC BY-SA 4.0" },
  cc_by_nc: { label: "CC BY-NC 4.0 — Attribution, Non-Commercial", short: "CC BY-NC 4.0" },
  cc0: { label: "CC0 1.0 — Public domain dedication", short: "CC0" },
} as const;

export type LicenseCode = keyof typeof LICENSES;

export const LICENSE_OPTIONS = (Object.keys(LICENSES) as LicenseCode[]).map((code) => ({
  code,
  label: LICENSES[code].label,
}));

export function isLicenseCode(code: string): code is LicenseCode {
  return code in LICENSES;
}

export function licenseLabel(code: string): string {
  return isLicenseCode(code) ? LICENSES[code].label : LICENSES.all_rights_reserved.label;
}

export function licenseShort(code: string): string {
  return isLicenseCode(code) ? LICENSES[code].short : LICENSES.all_rights_reserved.short;
}
