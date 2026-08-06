import { ImageOff } from 'lucide-react';
import { photoPair } from '../lib/demoData';

function Pane({ src, tag, alt, isAfter }) {
  return (
    <div className="ba-pane">
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <div className="ba-missing">
          <ImageOff size={14} aria-hidden="true" />
          <span>Not on file</span>
        </div>
      )}
      <span className={`ba-tag${isAfter ? ' ba-tag-after' : ''}`}>{tag}</span>
    </div>
  );
}

/**
 * @param {'mini'|'full'} size  `mini` for table cells, `full` for the gallery
 */
export default function BeforeAfter({ item, size = 'full' }) {
  const { before, after, hasAny } = photoPair(item);
  const what = item?.title || 'this case';

  if (!hasAny) {
    return (
      <span className="row cell-sub" style={{ '--gap': '5px' }}>
        <ImageOff size={13} aria-hidden="true" /> No photos
      </span>
    );
  }

  return (
    <div className={`ba ${size === 'mini' ? 'ba-mini' : 'ba-full'}`}>
      <Pane src={before} tag="Before" alt={`${what} — as reported`} />
      <Pane src={after} tag="After" alt={`${what} — after the work`} isAfter />
    </div>
  );
}
