// Builds the text that is copied or shared to the notepad app. Pure functions.
import type { Anime, ExportOptions } from '../types';

export const DEFAULT_EXPORT: ExportOptions = {
  numbered: true,
  startAt: 1,
  separator: ' – ',
  english: true,
  japanese: false,
  rating: true,
  genres: true,
  year: false,
  episodes: false,
  link: false,
  maxGenres: 0,
};

function num(n: number): string {
  return String(Number(n.toFixed(1)));
}

export function exportLine(anime: Anime, userRating: number | null, o: ExportOptions, index: number): string {
  const main = o.english ? anime.titleEnglish || anime.title : anime.title;
  let name = main;
  if (o.japanese && anime.titleJapanese && anime.titleJapanese !== main) {
    name += ' / ' + anime.titleJapanese;
  }

  let bracket = '';
  if (o.rating) {
    if (userRating !== null && userRating !== undefined) bracket = '(' + num(userRating) + '/5)';
    else if (anime.score !== null && anime.score !== undefined) bracket = '(MAL ' + anime.score.toFixed(1) + '/10)';
  }

  const parts: string[] = [];
  if (o.genres && anime.genres.length) {
    const g = o.maxGenres > 0 ? anime.genres.slice(0, o.maxGenres) : anime.genres;
    parts.push(g.join(', '));
  }
  const yearEps: string[] = [];
  if (o.year && anime.year) yearEps.push(String(anime.year));
  if (o.episodes && anime.episodes) yearEps.push(anime.episodes + ' eps');
  if (yearEps.length) parts.push(yearEps.join(', '));
  if (o.link) parts.push('https://myanimelist.net/anime/' + anime.malId);

  let line = '';
  if (o.numbered) line += index + '. ';
  line += name;
  if (bracket) line += ' ' + bracket;
  if (parts.length) line += o.separator + parts.join(o.separator);
  return line;
}

export function formatEntries(
  items: { anime: Anime; userRating: number | null }[],
  o: ExportOptions,
): string {
  const start = Number.isFinite(o.startAt) ? Math.max(0, Math.floor(o.startAt)) : 1;
  return items.map((it, i) => exportLine(it.anime, it.userRating, o, start + i)).join('\n');
}
