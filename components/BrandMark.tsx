import { useId } from "react";

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * The site's own mark: a pair of beamed notes. It is decorative wherever it
 * appears next to the written site name.
 */
export function BrandMark({ size = 60, className }: BrandMarkProps) {
  const gradientId = useId();
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 60 60"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="54" x2="54" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fb724b" />
          <stop offset="0.5" stopColor="#ff0069" />
          <stop offset="1" stopColor="#d300c5" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M22 10.5a3 3 0 0 1 2.33-2.92l24-5.5A3 3 0 0 1 52 5v34.5a9 9 0 1 1-6-8.49V17.76l-18 4.13V45.5a9 9 0 1 1-6-8.49V10.5Zm6 5.23 18-4.12V8.76l-18 4.13v2.84ZM19 42.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm24-6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
    </svg>
  );
}
