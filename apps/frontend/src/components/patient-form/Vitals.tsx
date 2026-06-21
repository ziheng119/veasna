import React from 'react';

interface PatientData {
    height?: string;
    weight?: string;
    bmi?: string;
    category?: string;
    below_3rd_percentile?: boolean;
    bp_systolic?: string;
    bp_diastolic?: string;
    temperature?: string;
    additionalNotes?: string;
}

interface Props {
    patient: PatientData;
    onUpdatePatient: (updates: Partial<PatientData>) => void;
    isViewMode: boolean;
}

export default function Vitals({patient, onUpdatePatient, isViewMode}: Props) {

    const inputProps = {
        disabled: isViewMode,
        readOnly: isViewMode,
    };

    const handleChange = (field: keyof PatientData, value: string | boolean) => {
        if (isViewMode) return;
        if (typeof value === 'string') {

            const regex0dp = /^\d*$/;
            const regex1dp = /^\d*\.?\d{0,1}$/;
            const regex2dp = /^\d*\.?\d{0,2}$/;

            if (field === 'weight' || field === 'bmi') {
                if (value === '' || regex2dp.test(value)) {
                    onUpdatePatient({ [field] : value });
                }
            } else if (field === 'bp_systolic' || field === 'bp_diastolic' || field === 'height') {
                if (value === '' || regex0dp.test(value)) {
                    onUpdatePatient({ [field] : value });
                }
            } else if (field === 'temperature') {
                if (value === '' || regex1dp.test(value)) {
                    onUpdatePatient({ [field] : value });
                }
            } else {
                onUpdatePatient({ [field] : value });
            }
        } else {
            onUpdatePatient({ [field] : value });
        };
    };

    const calculateBMI = () => {
        if (isViewMode) return;

        // Safely parse numbers, default to NaN if invalid
        const heightValue = patient?.height ? parseFloat(patient.height) / 100 : NaN;
        const weightValue = patient?.weight ? parseFloat(patient.weight) : NaN;

        // Exit if either value is not a valid positive number
        if (!heightValue || !weightValue || isNaN(heightValue) || isNaN(weightValue)) {
            // Optionally reset BMI and category if input is invalid
            onUpdatePatient({ bmi: '', category: '' });
            return;
        }

        const bmiValue = weightValue / (heightValue * heightValue);
        const roundedBMI = Math.round(bmiValue * 100) / 100; // 2 decimal places

        let category = '';
        if (bmiValue < 18.5) {
            category = 'Underweight';
        } else if (bmiValue < 25) {
            category = 'Healthy Weight';
        } else if (bmiValue < 30) {
            category = 'Overweight';
        } else if (bmiValue < 40) {
            category = 'Obese';
        } else {
            category = 'Severely Obese';
        }

        onUpdatePatient({
            bmi: roundedBMI.toString(),
            category,
        });
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'Underweight':
                return 'bg-blue-600';
            case 'Healthy Weight':
                return 'bg-green-600';
            case 'Overweight':
                return 'bg-yellow-600';
            case 'Obese':
                return 'bg-orange-600';
            case 'Severely Obese':
                return 'bg-red-600';
            default:
                return 'bg-gray-200';
        }
    };

    return (
        <div className='space-y-6'>
            <div className='space-y-5 w-full max-w-lg'>

                <div className='grid grid-cols-2 gap-4 items-center'>
                    <label className='text-sm font-medium'>
                        Height (cm)
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        inputMode='numeric'
                        pattern='[0-9]*'
                        value={patient.height}
                        onChange={(e) => handleChange('height', e.target.value)}
                        className='w-64 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
                    />
                </div>

                <div className='grid grid-cols-2 gap-4 items-center'>
                    <label className='text-sm font-medium'>
                        Weight (kg)
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        inputMode='decimal'
                        placeholder='0.00'
                        value={patient.weight}
                        onChange={(e) => handleChange('weight', e.target.value)}
                        className='w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
                    />
                </div>

                <div className='grid grid-cols-2 gap-4 items-center'>
                    <label className='text-sm font-medium'>
                        BMI
                    </label>
                    <div className='flex items-center gap-2'>
                        <input
                            type='text'
                            inputMode='decimal'
                            pattern='[0-9]*\.?[0-9]{0,2}'
                            placeholder='0.00'
                            value={patient.bmi}
                            onChange={(e) => handleChange('bmi', e.target.value)}
                            className='w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
                            readOnly
                        />
                        <button
                            type='button'
                            onClick={calculateBMI}
                            className="px-3 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Calculate BMI
                        </button>
                    </div>
                </div>

                <div>
                    <div className='grid grid-cols-2 gap-4 items-center'>
                        <label htmlFor='below3rdPercentile' className='text-sm font-medium w-2/3'>
                            Child is below 3rd percentile (BMI by age)
                        </label>
                        <input
                            {...inputProps}
                            type='checkbox'
                            id='below3rdPercentile'
                            checked={patient.below_3rd_percentile}
                            onChange={(e) => handleChange('below_3rd_percentile', e.target.checked)}
                            className='justify-self-start h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                        />
                    </div>
                </div>

                <div className='grid grid-cols-2 gap-4 items-center'>
                    <label className='text-sm font-medium'>
                        Category
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        value={patient.category || ""} // default to empty string if undefined
                        onChange={(e) => handleChange('category', e.target.value)}
                        className={`text-center w-36 px-3 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                            getCategoryColor(patient.category || "")
                        }`}   
                        readOnly
                    />
                </div>

                <div className='grid grid-cols-2 gap-4 items-center'>
                    <label className='text-sm font-medium'>
                        Blood Pressure [Systolic / Diastolic] (mm Hg)
                    </label>
                    <div className='flex gap-2 items-center'>
                    <input
                        {...inputProps}
                        type='text'
                        inputMode='numeric'
                        pattern='[0-9]*'
                        value={patient.bp_systolic}
                        onChange={(e) => handleChange('bp_systolic', e.target.value)}
                        className='w-29 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
                        placeholder='Systolic'
                    />
                    <span>/</span>
                    <input
                        {...inputProps}
                        type='text'
                        inputMode='numeric'
                        pattern='[0-9]*'
                        value={patient.bp_diastolic}
                        onChange={(e) => handleChange('bp_diastolic', e.target.value)}
                        className='w-29 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
                        placeholder='Diastolic'
                    />
                    </div>                 
                </div>

                <div className='grid grid-cols-2 gap-4 items-center'>
                    <label className='text-sm font-medium mb-2'>
                        Temperature (°C)
                    </label>
                    <input
                        {...inputProps}
                        type='text'
                        inputMode='decimal'
                        pattern='[0-9]*\.?[0-9]{0,1}'
                        placeholder='0.0'
                        value={patient.temperature}
                        onChange={(e) => handleChange('temperature', e.target.value)}
                        className='w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
                    />
                </div>

                <div className='grid grid-cols-2 gap-4'>
                    <label className='text-sm font-medium'>
                        Additional Notes
                    </label>
                    <textarea
                        {...inputProps}
                        value={patient.additionalNotes}
                        onChange={(e) => handleChange('additionalNotes', e.target.value)}
                        rows={4}
                        className='w-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
                        placeholder='Enter any additional notes...'
                    />
                </div>

            </div>
        </div>
    )
}