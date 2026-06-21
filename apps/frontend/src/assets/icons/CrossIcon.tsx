interface MyIconProps extends React.SVGProps<SVGSVGElement> {
  width?: number | string;
  height?: number | string;
  color?: string;
}

export const CrossIcon: React.FC<MyIconProps> = ({
  width = 24,
  height = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg 
    width={width}
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g clipPath="url(#clip0_42_2887)">
    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="#323232"/>
    </g>
    <defs>
    <clipPath id="clip0_42_2887">
      <rect width="24" height="24" fill={color}/>
    </clipPath>
    </defs>
  </svg>
);


