import Image from "next/image";

interface SiteLogoProps {
  /** Rendered width and height in CSS pixels. */
  size: number;
  /** Set for the logo that is visible as soon as the page loads. */
  priority?: boolean;
  className?: string;
}

/**
 * The app logo. It is decorative wherever it sits beside the written site
 * name or inside a labelled link, so its alternative text is empty.
 */
export function SiteLogo({ size, priority = false, className }: SiteLogoProps) {
  return (
    <Image
      className={className}
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
    />
  );
}
