import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export function DrugIcon({ className = "w-6 h-6", size = 24 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Capsule pill shape */}
      <rect
        x="3"
        y="8"
        width="18"
        height="8"
        rx="4"
        ry="4"
        transform="rotate(-45 12 12)"
      />
      {/* Divider rotated +45° (clockwise), shorter to fit inside capsule */}
      <line
        x1="9"
        y1="9"
        x2="15"
        y2="15"
      />
    </svg>
  );
}

export default DrugIcon;
