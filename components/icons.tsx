import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    ...props,
  };
}

/** Tab bar icons draw outlined by default and filled or heavier when `active`. */
type TabIconProps = IconProps & { active?: boolean };

export const HomeIcon = ({ active, ...props }: TabIconProps) => (
  <svg {...base(props)}>
    <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" fill={active ? "currentColor" : "none"} />
  </svg>
);

export const SearchIcon = ({ active, ...props }: TabIconProps) => (
  <svg {...base(props)} strokeWidth={active ? 3 : 2}>
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="m16 16 5.5 5.5" />
  </svg>
);

export const StepsIcon = ({ active, ...props }: TabIconProps) => (
  <svg {...base(props)} strokeWidth={active ? 3 : 2}>
    <path d="M9 6h12M9 12h12M9 18h12" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth={active ? 4 : 3} />
  </svg>
);

export const QuestionIcon = ({ active, ...props }: TabIconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9.5" fill={active ? "currentColor" : "none"} />
    <g stroke={active ? "#fff" : "currentColor"}>
      <path d="M9.2 9.2a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1.1-1.5 2.1" />
      <path d="M12 17.2h.01" strokeWidth={3} />
    </g>
  </svg>
);

export const InfoIcon = ({ active, ...props }: TabIconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9.5" fill={active ? "currentColor" : "none"} />
    <g stroke={active ? "#fff" : "currentColor"}>
      <path d="M12 11v6" />
      <path d="M12 7.3h.01" strokeWidth={3} />
    </g>
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const CopyIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
  </svg>
);

export const ExternalIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const NoteIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M9 18V5.5l11-2.5v12.5" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="15.5" r="3" />
  </svg>
);

export const ChevronIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
