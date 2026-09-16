// Original local milestone catalog shared by unlock logic and the rewards screen.

export interface GemDef {
  id: string;
  name: string;
  kind: 'milestone' | 'seasonal';
  streakThreshold?: number; // consecutive focus-days needed to unlock (milestone gems only)
  palette: [string, string]; // two-color marbled gradient for the gem illustration
  image?: string; // path to the gem artwork
}

const GEM_IMAGES = [
  '/gems/amethyst-cluster.png',
  '/gems/amethyst-banded-stone.png',
  '/gems/amethyst-helix.png',
  '/gems/amethyst-star.png',
  '/gems/amethyst-geode.png',
  '/gems/amethyst-prism.png',
];

function gemImage(index: number): string {
  return GEM_IMAGES[index % GEM_IMAGES.length];
}

export const GEMS_CATALOG: GemDef[] = [
  { id: 'first-light', name: 'First Light', kind: 'milestone', streakThreshold: 1, palette: ['#7656D6', '#55D9ED'], image: gemImage(0) },
  { id: 'steady-spark', name: 'Steady Spark', kind: 'milestone', streakThreshold: 3, palette: ['#9D72FF', '#E9A8FF'], image: gemImage(1) },
  { id: 'clear-morning', name: 'Clear Morning', kind: 'milestone', streakThreshold: 5, palette: ['#55D9ED', '#B8A4FF'], image: gemImage(2) },
  { id: 'violet-week', name: 'Violet Week', kind: 'milestone', streakThreshold: 7, palette: ['#7448D8', '#D777FF'], image: gemImage(3) },
  { id: 'quiet-ten', name: 'Quiet Ten', kind: 'milestone', streakThreshold: 10, palette: ['#A05DFF', '#FFB6DC'], image: gemImage(4) },
  { id: 'fortnight-flow', name: 'Fortnight Flow', kind: 'milestone', streakThreshold: 14, palette: ['#6143C7', '#64D8EE'], image: gemImage(5) },
  { id: 'three-week-rhythm', name: 'Three-Week Rhythm', kind: 'milestone', streakThreshold: 21, palette: ['#8E5CF6', '#EC89DD'], image: gemImage(0) },
  { id: 'month-of-intent', name: 'Month of Intent', kind: 'milestone', streakThreshold: 30, palette: ['#3F2A7F', '#A778FF'], image: gemImage(1) },
  { id: 'deep-current', name: 'Deep Current', kind: 'milestone', streakThreshold: 45, palette: ['#4778D9', '#69E6DC'], image: gemImage(2) },
  { id: 'sixty-sunrises', name: 'Sixty Sunrises', kind: 'milestone', streakThreshold: 60, palette: ['#684EA8', '#E382F4'], image: gemImage(3) },
  { id: 'season-of-focus', name: 'Season of Focus', kind: 'milestone', streakThreshold: 90, palette: ['#9E67EE', '#FFD1A8'], image: gemImage(4) },
  { id: 'four-month-calm', name: 'Four-Month Calm', kind: 'milestone', streakThreshold: 120, palette: ['#825BE2', '#68CCED'], image: gemImage(5) },
  { id: 'half-year-glow', name: 'Half-Year Glow', kind: 'milestone', streakThreshold: 180, palette: ['#B05DE2', '#60D9C8'], image: gemImage(0) },
  { id: 'long-arc', name: 'The Long Arc', kind: 'milestone', streakThreshold: 250, palette: ['#8362E7', '#E6B764'], image: gemImage(1) },
  { id: 'year-of-intent', name: 'Year of Intent', kind: 'milestone', streakThreshold: 365, palette: ['#6651CD', '#7DE3E9'], image: gemImage(2) },
  { id: 'spring-bloom', name: 'Spring Bloom', kind: 'seasonal', palette: ['#D77BEF', '#67D7B5'], image: gemImage(3) },
  { id: 'summer-sky', name: 'Summer Sky', kind: 'seasonal', palette: ['#F2BC68', '#6EDAE9'], image: gemImage(4) },
  { id: 'autumn-dusk', name: 'Autumn Dusk', kind: 'seasonal', palette: ['#C77A55', '#8554D6'], image: gemImage(5) },
  { id: 'winter-hush', name: 'Winter Hush', kind: 'seasonal', palette: ['#79BDEB', '#EEE8FF'], image: gemImage(0) },
];
