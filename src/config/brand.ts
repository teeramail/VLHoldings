export const brand = {
  name: "Asian online ",
  shortName: "V",
  tagline: "Cards of work",
  sectionTitle: "Cards of work",
  description: "Collect and organize media to send to your kid daily",
} as const;

export const appMetadata = {
  title: `${brand.name} - ${brand.tagline}`,
  description: brand.description,
} as const;
