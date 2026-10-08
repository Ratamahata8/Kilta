import { contentBundle as source } from "../content/source";
import type { Snapshot, PublicMedia } from "./types";

export const demoEntries = source.entries as Snapshot[];
export const demoMedia: PublicMedia[] = source.media.map((image) => ({
  ...image,
  url: `${import.meta.env.BASE_URL}${image.card.path}`,
  heroUrl: `${import.meta.env.BASE_URL}${image.hero.path}`,
  cardWidth: image.card.width, cardHeight: image.card.height,
  heroWidth: image.hero.width, heroHeight: image.hero.height,
}));
