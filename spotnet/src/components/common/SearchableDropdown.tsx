import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown, Loader2 } from 'lucide-react';

export interface DropdownOption {
  value: string | number;
  label: string;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  onSearch?: (query: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  allowClear?: boolean;
  name?: string;
  id?: string;
  serverSide?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  value,
  onChange,
  onSearch,
  placeholder = 'Select an option',
  className = '',
  isLoading = false,
  disabled = false,
  error,
  label,
  required = false,
  allowClear = true,
  name,
  id,
  serverSide = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<DropdownOption[]>(options);
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenValue = value !== null && value !== undefined ? String(value) : '';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update filtered options when options change or when search term changes
  useEffect(() => {
    if (serverSide) {
      setFilteredOptions(options);
    } else {
      if (searchTerm === '') {
        setFilteredOptions(options);
      } else {
        const filtered = options.filter(option =>
          option.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredOptions(filtered);
      }
    }
  }, [options, searchTerm, serverSide]);

  // Update selected label when value changes
  useEffect(() => {
    if (value === null || value === '') {
      setSelectedLabel('');
    } else {
      const option = options.find(opt => opt.value === value);
      setSelectedLabel(option ? option.label : '');
    }
  }, [value, options]);

  // Handle search input change with debounce for server-side search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchTerm(query);
    
    if (serverSide && onSearch) {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
      
      searchTimeout.current = setTimeout(() => {
        onSearch(query);
      }, 300);
    }
  };

  // Handle option selection
  const handleSelect = (option: DropdownOption) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearchTerm('');
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
    }
  };

  return (
    <div className={`relative ${className}`} id={id}>
      {name && (
        <input type="hidden" name={name} value={hiddenValue} />
      )}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div
        ref={dropdownRef}
        className={`relative ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        <div
          onClick={toggleDropdown}
          className={`input flex items-center justify-between cursor-pointer ${
            error ? 'border-red-300' : ''
          }`}
        >
          <div className="flex-1 truncate">
            {value !== null && value !== '' ? selectedLabel : placeholder}
          </div>
          <div className="flex items-center">
            {allowClear && value !== null && value !== '' && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
          </div>
        </div>
        
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search..."
                  className="input input-sm pl-8 w-full"
                  autoComplete="off"
                />
              </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                </div>
              ) : filteredOptions.length > 0 ? (
                <ul className="py-1">
                  {filteredOptions.map((option) => (
                    <li
                      key={option.value}
                      onClick={() => handleSelect(option)}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                        value === option.value ? 'bg-primary-50 text-primary-700' : ''
                      }`}
                    >
                      {option.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-3 text-center text-sm text-gray-500">
                  No options found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default SearchableDropdown;
