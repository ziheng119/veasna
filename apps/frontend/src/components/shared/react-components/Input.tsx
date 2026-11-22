interface Props {
  placeholder?:string
  classname?: string
  onChange?: () => void
}

export default function Input({ placeholder, classname }: Props) {
  return (
    <input 
      className={`bg-background border border-input block rounded-sm p-0.5 ${classname? classname : ""}}`}
      placeholder={placeholder? placeholder : ""}
    ></input>
  )
}