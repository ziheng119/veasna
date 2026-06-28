interface Props {
  onClick ?: () => void;
  mode ?: string
}

export default function SaveButton({ onClick, mode }: Props) {

  const label = mode === 'edit' ? 'Update' : 'Save';

  return (
    <button 
      className="bg-primary text-primary-foreground rounded-md px-4 py-2 hover:cursor-pointer hover:bg-primary/90"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
