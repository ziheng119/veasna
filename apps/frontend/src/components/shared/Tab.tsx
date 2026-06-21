interface Props {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export default function Tab({ label, isActive, onClick }: Props) {
  return (
    <div 
      className={`flex-1 rounded-t-lg text-center hover:cursor-pointer h-[48px]] lg:h-[30px] flex items-center justify-center ${isActive ? "bg-beige-default" : "bg-green-default"}`}
      onClick={onClick}
    >
      <p className="m-0">
        {label}
      </p>
    </div>
  );
}