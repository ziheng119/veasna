import React, { useState } from 'react';
import { CrossIcon } from '@/assets/icons/CrossIcon';
import { SearchIcon } from '@/assets/icons';

interface FullSearchBarProps {
    placeholder: string;
    onSearchChange: (searchTerm: string) => void

}

export function FullSearchBar({ placeholder, onSearchChange }: FullSearchBarProps) {

    const [searchTerm, setSearchTerm] = useState<string>("")
    const [isFocused, setIsFocused] = useState<boolean>(false)

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchTerm(value)
        onSearchChange(value)
    }

    const handleClear = () => {
        setSearchTerm("")
        onSearchChange("")
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            handleClear()
        }
    }

    return (
        <div className='relative w-full'>
            <div className={`
                flex items-center bg-white border-2 rounded-full px-4 py-3 transition-all duration-200
                ${isFocused ? 'border-blue-500 shadow-md' : 'border-gray-300 hover:border-gray-400'}
            `}>
                <SearchIcon className='h-5 w-5 text-gray-400 mr-3' />  

                <input
                    type='text'
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="flex-1 outline-none text-gray-700 placeholder-gray-400"
                />

                <button
                    onClick={handleClear}
                    className='ml-2 p-1 rounded-full hover:bg-gray-100 transition-colors duration-150'
                    type='button'
                >
                    <CrossIcon className='h-4 w-4 text-gray-400 hover:text-gray-600' />
                </button>

            </div>
        </div>
    );
};