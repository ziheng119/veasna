interface Props {
  onClick ?: () => void;
  mode ?: string
}

export default function SaveButton({ onClick, mode }: Props) {

  const label = mode === 'edit' ? 'Update' : 'Save';

  return (
    <button 
      className="bg-green-default rounded-md p-2 hover:cursor-pointer"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
