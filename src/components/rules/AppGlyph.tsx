import {
  siDiscord,
  siFacebook,
  siGooglechrome,
  siInstagram,
  siNetflix,
  siReddit,
  siTiktok,
  siX,
  siYoutube,
  type SimpleIcon,
} from 'simple-icons';
import './AppGlyph.css';

type AppGlyphProps = {
  label: string;
  iconDataUrl?: string;
  size?: 'small' | 'large';
};

const brandIcons: Record<string, SimpleIcon> = {
  instagram: siInstagram,
  facebook: siFacebook,
  tiktok: siTiktok,
  youtube: siYoutube,
  netflix: siNetflix,
  reddit: siReddit,
  discord: siDiscord,
  x: siX,
  chrome: siGooglechrome,
};

export function classFor(label: string) {
  const normalized = label.toLowerCase();
  return Object.keys(brandIcons).find((key) => normalized === key || normalized.includes(key)) ?? 'default';
}

export function AppGlyph({ label, iconDataUrl, size = 'small' }: AppGlyphProps) {
  const kind = classFor(label);
  const testId = `app-icon-${kind === 'default' ? label.toLowerCase().replaceAll(' ', '-') : kind}`;

  if (iconDataUrl) {
    return <img className={`amethyst-app-glyph amethyst-app-glyph--${size}`} src={iconDataUrl} alt="" data-testid={testId} />;
  }

  const icon = brandIcons[kind];
  if (icon) {
    return (
      <svg
        className={`amethyst-app-glyph amethyst-app-glyph--${size} amethyst-app-glyph--${kind}`}
        viewBox="0 0 24 24"
        aria-hidden="true"
        data-testid={testId}
      >
        <path d={icon.path} />
      </svg>
    );
  }

  return (
    <span className={`amethyst-app-glyph amethyst-app-glyph--${size} amethyst-app-glyph--default`} aria-hidden="true" data-testid={testId}>
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}
