/** LED-style number with unlit "8" segments behind it, like an electronic board display. */
export function Led({
  value,
  digits,
  on = true,
  blue = false,
  className = '',
}: {
  value: number | string;
  digits?: number;
  on?: boolean;
  blue?: boolean;
  className?: string;
}) {
  const text = String(value);
  const width = Math.max(digits ?? text.length, text.length);
  return (
    <span className={`led ${on ? 'on' : ''} ${blue ? 'blue' : ''} ${className}`} aria-label={text} role="img">
      <span className="ghost" aria-hidden="true">
        {'8'.repeat(width)}
      </span>
      <span className="lit" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
