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
                flex items-center bg-card border rounded-full px-4 py-3 transition-all duration-200
                ${isFocused ? 'border-primary shadow-sm ring-2 ring-primary/20' : 'border-border hover:border-primary/40'}
            `}>
                <SearchIcon className='h-5 w-5 text-muted-foreground mr-3' />  

                <input
                    type='text'
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground"
                />

                <button
                    onClick={handleClear}
                    className='ml-2 p-1 rounded-full hover:bg-accent transition-colors duration-150'
                    type='button'
                >
                    <CrossIcon className='h-4 w-4 text-muted-foreground hover:text-foreground' />
                </button>

            </div>
        </div>
    );
};