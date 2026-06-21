import React from 'react';

interface PatientData {
    queue_no?: string;
    english_name?: string;
    khmer_name?: string;
    date_of_birth?: string;
    age?: string;
    sex?: string;
    phone_number?: string;
    address?: string;
    face_id?: string;
}

interface Props {
    patient: PatientData;
    onUpdatePatient: (updates: Partial<PatientData>) => void;
    isViewMode: boolean;
}

export default function PatientInfo({ patient, onUpdatePatient, isViewMode}: Props) {

    const inputProps = {
        disabled: isViewMode,
        readOnly: isViewMode,
    };

    // Restrictions for respective inputs 
    const handleChange = (field: keyof PatientData, value: string) => {
        if (isViewMode) return;
        if (field === 'age') {
            const regex = /^\d*$/; // only Integers
            if (value === '' || regex.test(value)) {
                onUpdatePatient({ [field]: value });
            }
        } else if (field === 'date_of_birth') {
            const regex = /^(\d{0,2})(\/?)(\d{0,2})(\/?)(\d{0,4})$/; // Allow DD/MM/YYYY format with slashes
            if (value === '' || regex.test(value)) {
                onUpdatePatient({ [field]: value });
            }
        } else if (field === 'phone_number') {
            // Allow: digits, spaces, plus sign (only at start), hyphens, parentheses
            const regex = /^[\+]?[\d\s\-\(\)]*$/;
            if (value === '' || regex.test(value)) {
            onUpdatePatient({ [field]: value });
            } 
        } else {
            onUpdatePatient({ [field]: value });
        };
    }

    // Helper function to calculate age
    const calculateAge = () => {
        if (!patient.date_of_birth) return;

        const parts = patient.date_of_birth.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);

            if (day && month && year && year > 1900) {
                // javascript months are 0 index (ie January = 0)
                const birthDate = new Date(year, month - 1, day);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();

                // handle age if birthday yet to pass
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }

                if (age >= 0 && age < 150) {
                    onUpdatePatient({age: age.toString() });
                }
            }
        }
    }

    const handleDateChange = (value: string) => {
        handleChange('date_of_birth', value);
    };
    

    return (
        <div className='space-y-4 w-full max-w-md'>

                {/* Queue Number */}
                <div className='flex items-center gap-4'>
                    <label className="min-w-[120px] text-sm font-medium">
                        Queue Number
                    </label>
                    <input
                        {...inputProps}
                        type="text"
                        value={patient.queue_no}
                        onChange={(e) => handleChange('queue_no', e.target.value)}
                        className="w-64 px-3 py-2 border border-gray-300 border-width-10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    />
                </div>

                {/* English Name */}
                <div className='flex items-center gap-4'>
                    <label className='min-w-[120px] text-sm font-medium'>
                        English Name
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        value={patient.english_name}
                        onChange={(e) => handleChange('english_name', e.target.value)}
                        className="w-64 px-3 py-2 border border-gray-300 border-width-10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    />
                </div>

                <div className='flex items-center gap-4'>
                <label className='min-w-[120px] text-sm font-medium'>
                        Khmer Name
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        value={patient.khmer_name}
                        onChange={(e) => handleChange('khmer_name', e.target.value)}
                        className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    />
                </div>

                <div className='flex items-center gap-4'>
                    <label className='min-w-[120px] text-sm font-medium'>
                        Date of Birth
                    </label>
                    <div className='flex items-center gap-2'>
                        <input
                            {...inputProps}
                            type='date'
                            value={patient.date_of_birth ?
                                patient.date_of_birth.split('/').reverse().join('-') : ''
                            }
                            onChange={(e) => {
                                if (e.target.value) {
                                    const formatted = e.target.value.split('-').reverse().join('/');
                                    handleDateChange(formatted)
                                } else {
                                    handleDateChange('');
                                }
                            }}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                        />
                        <button 
                            type='button'
                            onClick={calculateAge}
                            className='px-3 py-2 bg-blue-500 text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white'
                        >
                            Calculate Age
                        </button>
                    </div>
                </div>

                <div className='flex items-center gap-4'>
                    <label className='min-w-[120px] text-sm font-medium'>
                        Age
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        inputMode='numeric'
                        pattern='[0-9]*'
                        value={patient.age}
                        onChange={(e) => handleChange('age', e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    />
                </div>

                <div className='flex items-center gap-4'>
                    <label className='min-w-[120px] text-sm font-medium'>
                        Sex
                    </label>
                    <div className='flex items-center gap-4'>
                        <label className='flex items-center gap-2'>
                            <input
                                {...inputProps}
                                type='radio'
                                name='sex'
                                value='M'
                                checked={patient.sex === 'M'}
                                onChange={(e) => onUpdatePatient({ sex: e.target.value })}
                                className='w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300'
                            />
                            <span className='text-sm'>M</span>
                        </label>
                        <label className='flex items-center gap-2'>
                            <input
                                {...inputProps}
                                type='radio'
                                name='sex'
                                value='F'
                                checked={patient.sex === 'F'}
                                onChange={(e) => onUpdatePatient({ sex: e.target.value })}
                                className='w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300'
                            />
                            <span className='text-sm'>F</span>
                        </label>
                    </div>
                    
                </div>

                <div className='flex items-center gap-4'>
                  <label className='min-w-[120px] text-sm font-medium'>
                        Phone Number
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        inputMode='numeric'
                        pattern='[0-9]*'
                        value={patient.phone_number}
                        onChange={(e) => handleChange('phone_number', e.target.value)}
                        className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    />
                </div>

                <div className='flex items-center gap-4'>
                  <label className='min-w-[120px] text-sm font-medium'>
                        Address
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        value={patient.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                        className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    />
                </div>

                <div className='flex items-center gap-4'>
                  <label className='min-w-[120px] text-sm font-medium'>
                        Face ID
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        value={patient.face_id}
                        onChange={(e) => handleChange('face_id', e.target.value)}
                        className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    />
                </div>

        </div>
    );
}
