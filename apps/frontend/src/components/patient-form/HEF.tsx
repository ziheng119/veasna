import React from 'react';

interface PatientData {
    know_of_hef?: string;
    has_hef?: string;
    notes?: string;
}

interface Props {
    patient: PatientData;
    onUpdatePatient: (updates: Partial<PatientData>) => void;
    isViewMode: boolean;

}

export default function HEF({patient, onUpdatePatient, isViewMode}: Props) {
    const handleChange = (field: keyof PatientData, value: string) => {
        if (isViewMode) return;
        onUpdatePatient({ [field]: value});
    }

    const inputProps = {
        disabled: isViewMode,
        readOnly: isViewMode,
    };
  
  return (
    <div className='space-y-6'>

      {/* Yes/No block */}
      <div>
        <label className='block text-sm font-medium mb-3'>
          Does patient know about HEF?
        </label>
        <div className='flex space-x-6'>
          {['yes', 'no'].map(opt => (
            <div className='flex items-center' key={opt}>
              <input
                {...inputProps}
                type='radio'
                id={`knowsHEF-${opt}`}
                name='knowsAboutHEF'
                value={opt}
                checked={patient.know_of_hef === opt}
                onChange={e => handleChange('know_of_hef', e.target.value)}
                className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300'
              />
              <label htmlFor={`knowsHEF-${opt}`} className='ml-2 text-sm'>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </label>
            </div>
          ))}
        </div>
      </div>
  
      <div>
        <label className='block text-sm font-medium mb-3'>
          Does patient have HEF?
        </label>
        <div className='flex space-x-6'>
          {['yes', 'no'].map(opt => (
            <div className='flex items-center' key={opt}>
              <input
                {...inputProps}
                type='radio'
                id={`hasHEF-${opt}`}
                name='hasHEF'
                value={opt}
                checked={patient.has_hef === opt}
                onChange={e => handleChange('has_hef', e.target.value)}
                className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300'
              />
              <label htmlFor={`hasHEF-${opt}`} className='ml-2 text-sm'>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </label>
            </div>
          ))}
        </div>
      </div>
  
      {/* Textarea */}
      <div>
        <label className='block text-sm font-medium mb-2'>
          Does patient use HEF? Why or why not?
        </label>
        <textarea
          {...inputProps}
          value={patient.notes}
          onChange={e => handleChange('know_of_hef', e.target.value)}
          rows={6}
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
          placeholder='Insert Text'
        />
      </div>
    </div>
  );
  
}