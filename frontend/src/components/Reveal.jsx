import { useReveal } from '../lib/useReveal';

/**
 * Wrapper that fades-and-lifts its contents in as they scroll into view.
 *
 * Renders as whatever tag you ask for rather than adding a div, so a `.band`
 * section keeps its own margins, border and grid role — wrapping those in an
 * extra element is what breaks the dividing rules between sections.
 *
 * Children can stagger by carrying `.reveal-item` and an inline `--i` index,
 * matching the convention `.anim-rise` already uses elsewhere.
 */
export default function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useReveal();

  return (
    <Tag ref={ref} className={`reveal ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
