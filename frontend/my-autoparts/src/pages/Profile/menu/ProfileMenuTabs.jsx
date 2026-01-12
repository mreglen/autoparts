import React, { useState } from 'react';

export default function ProfileMenuTabs({ tabs, activeTab, onTabChange }) {
    const [expandedMenus, setExpandedMenus] = useState({});

    const toggleSubmenu = (menuId) => {
        setExpandedMenus(prev => ({
            ...prev,
            [menuId]: !prev[menuId]
        }));
    };

    const renderMenuItem = (tab) => {
        if (tab.submenu) {
            const isExpanded = expandedMenus[tab.id];
            const hasActiveSubmenu = tab.submenu.some(subTab => activeTab === subTab.id);

            return (
                <div key={tab.id}>
                    <button
                        onClick={() => toggleSubmenu(tab.id)}
                        className={`w-full px-4 py-3 text-left text-sm font-medium border-l-4 transition-colors flex items-center justify-between ${
                            hasActiveSubmenu
                                ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <span>{tab.label}</span>
                        <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    {isExpanded && (
                        <div className="ml-4 border-l border-gray-200">
                            {tab.submenu.map((subTab) => (
                                <button
                                    key={subTab.id}
                                    onClick={() => onTabChange(subTab.id)}
                                    className={`w-full px-4 py-2 text-left text-sm font-medium border-l-4 transition-colors ${
                                        activeTab === subTab.id
                                            ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {subTab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-3 text-left text-sm font-medium border-l-4 transition-colors ${
                    activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
                {tab.label}
            </button>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 sticky top-4">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Меню</h2>
            </div>
            <div className="flex flex-col">
                {tabs.map(renderMenuItem)}
            </div>
        </div>
    );
}
