import Input from "../shared/react-components/Input";
import SaveButton from "../shared/SaveButton";
import VerticalLabelInputPair from "../shared/VerticalLabelInputPair";

export default function SnellensTest() {
  return (
    <div>
      <div className="min-h-[70vh] flex flex-col">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-[30px] items-center">
          {/* Header Row */}
          <p className="font-semibold text-start ">Visual Acuity</p>
          <p className="text-center ">Left (OS)</p>
          <p className="text-center ">Right (OD)</p>

          {/* With Pinhole Row */}
          <p className="text-start ">With Pinhole</p>
          <Input />
          <Input />

          {/* Without Pinhole Row */}
          <p className="text-start ">Without Pinhole</p>
          <Input />
          <Input />
        </div>

        <VerticalLabelInputPair label="Additional Notes" />
      </div>
      <div className="flex items-center justify-end">
        <SaveButton />
      </div>
    </div>

  )
}