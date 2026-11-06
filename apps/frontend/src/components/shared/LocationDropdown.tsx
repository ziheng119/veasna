'use client';
import { useState, useRef, useEffect } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { LocationIcon, PlusIcon, TrashIcon } from '@/assets/icons';
import { Location } from '@/lib/types/location';
import { useUserStore } from '@/stores/useUserStore';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/useConfirm';
import { MENU_CHEVRON, MENU_PANEL, MENU_TRIGGER } from '@/lib/motion';
import { cn } from '@/lib/utils';

export default function LocationDropdown() {
  const isAdmin = useUserStore(state => state.user?.role === "admin");
  const { confirm, dialog } = useConfirm();
  const { 
    locations, 
    currentLocation, 
    setCurrentLocation, 
    addLocation, 
    removeLocation, 
    isLoading, 
    error,
    setError 
  } = useLocationStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddLocationInput, setShowAddLocationInput] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditMode(false);
        setShowAddLocationInput(false);
        setNewLocationName('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when showing add location
  useEffect(() => {
    if (showAddLocationInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAddLocationInput]);

  const handleLocationSelect = (location: Location) => {
    if (!isEditMode) {
      setCurrentLocation(location);
      setIsOpen(false);
    }
  };

  const handleDeleteLocation = async (locationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const name = locations.find(location => location.id === locationId)?.name ?? 'this location';
    if (!await confirm({
      title: `Remove ${name}?`,
      description: 'It is no longer offered in the location menu. Patients and visits recorded there are kept.',
      confirmLabel: 'Remove location',
    })) return;
    try {
      await removeLocation(locationId);
    } catch (error) {
      console.error('Failed to delete location:', error);
      // Error is already set in the store, no need to handle it here
    }
  };

  const handleEditModeToggle = () => {
    setIsEditMode(!isEditMode);
    setShowAddLocationInput(false);
    setNewLocationName('');
  };

  const handleAddLocation = () => {
    setShowAddLocationInput(true);
  };

  const handleSubmitNewLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newLocationName.trim()) {
      try {
        await addLocation(newLocationName.trim());
        setNewLocationName('');
        setShowAddLocationInput(false);
        setError(null); 
      } catch (error) {
        console.error('Failed to create location:', error);
      }
    }
  };

  const handleCancelAdd = () => {
    setShowAddLocationInput(false);
    setNewLocationName('');
    setError(null); // Clear errors when canceling
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className={MENU_TRIGGER}
        data-state={isOpen ? 'open' : 'closed'}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <LocationIcon className="size-4" color={"currentColor"} />
        <span>{currentLocation?.name || 'Select Location'}</span>
        <ChevronDown className={MENU_CHEVRON} aria-hidden="true" />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={cn("absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-lg border border-border bg-card py-1 shadow-md", MENU_PANEL)}>
          {/* Error Display */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-destructive hover:text-destructive/80 mt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Header with Edit Toggle */}
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {isEditMode ? 'Edit Locations' : 'Select Location'}
            </span>
            {isAdmin && <button
              onClick={handleEditModeToggle}
              disabled={isLoading}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditMode ? 'Done' : 'Edit'}
            </button>}
          </div>

          {/* Location Options */}
          {locations.map((location) => (
            <div
              key={location.id}
              className={`flex items-center px-4 py-3 text-foreground ${
                !isEditMode ? 'hover:bg-accent hover:text-foreground cursor-pointer' : ''
              } transition-colors duration-150 ${
                currentLocation?.id === location.id && !isEditMode
                  ? 'bg-primary/10 text-primary font-medium'
                  : ''
              }`}
              onClick={() => handleLocationSelect(location)}
            >
              <LocationIcon className="w-4 h-4 mr-2" />
              <span className="flex-1">{location.name}</span>
              
              {isEditMode ? (

                <button
                  onClick={(e) => handleDeleteLocation(location.id, e)}
                  disabled={isLoading}
                  className="p-1 text-destructive hover:text-destructive hover:bg-destructive/10 rounded transition-[color,background-color,transform] duration-150 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete location"
                >
                  <TrashIcon className="w-4 h-4"/>
                </button>
              ) : (
        
                currentLocation?.id === location.id && (
                  <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )
              )}
            </div>
          ))}

          {/* Add Location Section - Only visible in edit mode */}
          {isEditMode && (
            <>
              {/* Separator */}
              <div className="border-t border-border my-1" />

              {showAddLocationInput ? (
                <form onSubmit={handleSubmitNewLocation} className="px-4 py-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="Enter location name"
                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                  <div className="flex space-x-2 mt-2">
                    <button
                      type="submit"
                      disabled={!newLocationName.trim() || isLoading}
                      className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                    >
                      {isLoading ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAdd}
                      disabled={isLoading}
                      className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={handleAddLocation}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-3 text-primary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 flex items-center space-x-2"
                >
                  <PlusIcon className='w-4 h-4'/>
                  <span className="font-medium">Add Location</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
      {dialog}
    </div>
  );
}